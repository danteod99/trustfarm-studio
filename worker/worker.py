"""Servidor local de TrustFarm Studio: toma trabajos de la cola de Supabase y los genera
con ComfyUI en la GPU de casa (o en una GPU alquilada; da igual dónde corra).

No abre puertos: él pregunta a Supabase (ai_claim_job), genera, sube el archivo al bucket
ai-media y marca el trabajo como listo. Si algo falla, lo marca fallido y devuelve los
créditos (mismo ref `refund:<id>` que la web, así nunca se reembolsa dos veces).

Uso:  python worker.py            (lee config.json junto a este archivo)
"""
from __future__ import annotations

import json
import os
import random
import socket
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

AQUI = Path(__file__).resolve().parent
# En RunPod la config viene en la imagen (sin la clave) y la clave en una variable de entorno.
CFG = json.loads(Path(os.environ.get("WORKER_CONFIG", AQUI / "config.json")).read_text(encoding="utf-8"))

SUPA = (os.environ.get("SUPABASE_URL") or CFG["supabase_url"]).rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or CFG["service_role_key"]
COMFY = CFG.get("comfy_url", "http://127.0.0.1:8188").rstrip("/")
WORKER_ID = os.environ.get("WORKER_ID") or CFG.get("worker_id") or socket.gethostname()
BUCKET = "ai-media"
HEARTBEAT_SEG = 30
JOB_TIMEOUT_SEG = int(CFG.get("job_timeout_seg", 25 * 60))

H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

# Tamaños por formato y resolución (múltiplos de 16, los que recomiendan Wan y Qwen).
VIDEO_SIZE = {
    "480p": {"16:9": (832, 480), "9:16": (480, 832), "1:1": (624, 624)},
    "720p": {"16:9": (1280, 720), "9:16": (720, 1280), "1:1": (960, 960)},
}
IMAGE_SIZE = {"1:1": (1328, 1328), "16:9": (1664, 928), "9:16": (928, 1664)}


def log(msg: str):
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


# ───────── Supabase (REST con service role) ─────────

def rpc(nombre: str, args: dict):
    r = requests.post(f"{SUPA}/rest/v1/rpc/{nombre}", headers=H, json=args, timeout=30)
    r.raise_for_status()
    return r.json()


def actualizar(gen_id: str, cambios: dict, solo_si: str = "running") -> list:
    r = requests.patch(
        f"{SUPA}/rest/v1/ai_generations?id=eq.{gen_id}&status=in.({solo_si})",
        headers={**H, "Prefer": "return=representation"},
        json={**cambios, "updated_at": ahora()},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def reclamar(gen_id: str) -> dict | None:
    """Toma un trabajo concreto (RunPod recibe el id); None si ya lo tomó otro o no existe."""
    r = requests.patch(
        f"{SUPA}/rest/v1/ai_generations?id=eq.{gen_id}&status=eq.queued",
        headers={**H, "Prefer": "return=representation"},
        json={"status": "running", "worker": WORKER_ID, "updated_at": ahora()},
        timeout=30,
    )
    r.raise_for_status()
    filas = r.json()
    return filas[0] if filas else None


def heartbeat(modelos: list[str], gpu: str):
    requests.post(
        f"{SUPA}/rest/v1/ai_workers",
        headers={**H, "Prefer": "resolution=merge-duplicates"},
        json={"id": WORKER_ID, "models": modelos, "last_seen": ahora(), "info": {"gpu": gpu}},
        timeout=15,
    ).raise_for_status()


def bajar_storage(ruta: str) -> bytes:
    r = requests.get(f"{SUPA}/storage/v1/object/{BUCKET}/{ruta}", headers=H, timeout=60)
    r.raise_for_status()
    return r.content


def subir_storage(ruta: str, datos: bytes, mime: str):
    r = requests.post(
        f"{SUPA}/storage/v1/object/{BUCKET}/{ruta}",
        headers={**H, "Content-Type": mime, "x-upsert": "true"},
        data=datos,
        timeout=300,
    )
    r.raise_for_status()


def fallar(job: dict, error: str):
    """Marca fallido y reembolsa una sola vez."""
    log(f"   ✗ {job['id']}: {error}")
    filas = actualizar(job["id"], {"status": "failed", "error": error[:500]}, solo_si="queued,running")
    if filas and filas[0].get("charged") and filas[0].get("cost_credits", 0) > 0:
        rpc("ai_credit", {
            "p_user": job["user_id"],
            "p_amount": filas[0]["cost_credits"],
            "p_reason": "refund",
            "p_ref": f"refund:{job['id']}",
            "p_meta": {"worker": WORKER_ID},
        })


# ───────── ComfyUI ─────────

def comfy_vivo() -> str | None:
    """Devuelve el nombre de la GPU si ComfyUI responde."""
    try:
        r = requests.get(f"{COMFY}/system_stats", timeout=5)
        r.raise_for_status()
        devs = r.json().get("devices") or [{}]
        return devs[0].get("name", "GPU")
    except requests.RequestException:
        return None


def rellenar(nodo, valores: dict):
    """Cambia los marcadores {{PROMPT}}, {{SEED}}… del workflow por los valores del trabajo.
    Un string que es exactamente "{{X}}" se reemplaza por el valor con su tipo (número)."""
    if isinstance(nodo, dict):
        return {k: rellenar(v, valores) for k, v in nodo.items()}
    if isinstance(nodo, list):
        return [rellenar(v, valores) for v in nodo]
    if isinstance(nodo, str):
        exacto = nodo.strip()
        if exacto.startswith("{{") and exacto.endswith("}}") and exacto[2:-2] in valores:
            return valores[exacto[2:-2]]
        for k, v in valores.items():
            nodo = nodo.replace("{{" + k + "}}", str(v))
    return nodo


def subir_a_comfy(datos: bytes, nombre: str) -> str:
    r = requests.post(f"{COMFY}/upload/image", files={"image": (nombre, datos, "image/jpeg")},
                      data={"overwrite": "true"}, timeout=60)
    r.raise_for_status()
    return r.json()["name"]


def ejecutar(workflow: dict) -> tuple[bytes, str]:
    r = requests.post(f"{COMFY}/prompt", json={"prompt": workflow, "client_id": WORKER_ID}, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"ComfyUI rechazó el workflow: {r.text[:300]}")
    prompt_id = r.json()["prompt_id"]

    fin = time.time() + JOB_TIMEOUT_SEG
    while time.time() < fin:
        time.sleep(3)
        h = requests.get(f"{COMFY}/history/{prompt_id}", timeout=30).json().get(prompt_id)
        if not h:
            continue
        estado = h.get("status", {})
        if estado.get("status_str") == "error":
            msgs = [m for m in estado.get("messages", []) if m and m[0] == "execution_error"]
            raise RuntimeError(f"ComfyUI: {msgs[0][1].get('exception_message', 'error') if msgs else 'error'}")
        if not estado.get("completed"):
            continue
        for salida in h.get("outputs", {}).values():
            for lista in salida.values():
                if not isinstance(lista, list):
                    continue
                for f in lista:
                    if isinstance(f, dict) and f.get("filename") and f.get("type") == "output":
                        ext = f["filename"].rsplit(".", 1)[-1].lower()
                        if ext in ("mp4", "webm", "png", "jpg", "jpeg", "webp"):
                            v = requests.get(f"{COMFY}/view", params={
                                "filename": f["filename"], "subfolder": f.get("subfolder", ""), "type": "output",
                            }, timeout=300)
                            v.raise_for_status()
                            return v.content, ext
        raise RuntimeError("ComfyUI terminó sin archivo de salida")
    requests.post(f"{COMFY}/interrupt", timeout=10)
    raise RuntimeError("Tardó demasiado en el servidor local")


# ───────── Trabajo ─────────

MIME = {"mp4": "video/mp4", "webm": "video/webm", "png": "image/png", "jpg": "image/jpeg",
        "jpeg": "image/jpeg", "webp": "image/webp"}


def procesar(job: dict):
    modelo = CFG["models"][job["model"]]
    p = job.get("params") or {}
    aspecto = p.get("aspect", "1:1")
    valores = {
        "PROMPT": job["prompt"],
        "NEGATIVE": modelo.get("negative", ""),
        "SEED": random.randint(1, 2**31 - 1),
        "PREFIX": f"studio/{job['id']}",
        "STEPS": int(modelo.get("steps", 20)),
    }

    # Cada modelo puede traer sus tamaños en config.json (p. ej. Wan 2.2 5B: 1280x704).
    if job["kind"] == "video":
        w, h = (modelo.get("video_size") or VIDEO_SIZE)[p.get("resolution", "720p")][aspecto]
        fps = int(modelo.get("fps", 16))
        valores.update({"WIDTH": w, "HEIGHT": h, "FPS": fps, "FRAMES": fps * int(p.get("duration", 5)) + 1})
    else:
        w, h = (modelo.get("image_size") or IMAGE_SIZE)[aspecto]
        valores.update({"WIDTH": w, "HEIGHT": h})

    if p.get("inputPath"):
        valores["IMAGE"] = subir_a_comfy(bajar_storage(p["inputPath"]), f"{job['id']}.jpg")
        plantilla = modelo["workflow_con_imagen"]
    else:
        plantilla = modelo["workflow"]

    workflow = rellenar(json.loads((AQUI / plantilla).read_text(encoding="utf-8")), valores)
    t0 = time.time()
    datos, ext = ejecutar(workflow)
    ruta = f"{job['user_id']}/{job['id']}.{ext}"
    subir_storage(ruta, datos, MIME[ext])
    if not actualizar(job["id"], {"status": "done", "output_path": ruta, "error": None}):
        log(f"   ⚠ {job['id']} ya no estaba en curso (la web lo dio por vencido); resultado descartado")
        return
    log(f"   ✓ {job['id']} listo en {time.time() - t0:.0f} s ({len(datos) // 1024} KB)")


def latido(modelos: list[str]):
    """Hilo aparte: avisa que el servidor está vivo cada 30 s, también durante un video largo.
    Sin ComfyUI no se anuncia, así la web manda esos modelos a fal.ai."""
    while True:
        try:
            gpu = comfy_vivo()
            if gpu:
                heartbeat(modelos, gpu)
        except Exception as e:  # noqa: BLE001
            log(f"heartbeat falló: {e}")
        time.sleep(HEARTBEAT_SEG)


def main():
    modelos = list(CFG["models"].keys())
    log(f"Servidor local '{WORKER_ID}' · modelos: {', '.join(modelos)} · ComfyUI: {COMFY}")
    threading.Thread(target=latido, args=(modelos,), daemon=True).start()
    while True:
        try:
            if not comfy_vivo():
                log("ComfyUI no responde; reintento en 15 s")
                time.sleep(15)
                continue
            jobs = rpc("ai_claim_job", {"p_worker": WORKER_ID, "p_models": modelos})
            if not jobs:
                time.sleep(3)
                continue
            job = jobs[0]
            log(f"→ {job['id']} · {job['model']} · {job['prompt'][:60]!r}")
            try:
                procesar(job)
            except Exception as e:  # noqa: BLE001 — cualquier fallo del trabajo se reembolsa
                fallar(job, f"Error en el servidor local: {e}")
        except KeyboardInterrupt:
            sys.exit(0)
        except Exception as e:  # noqa: BLE001 — red caída, Supabase, etc.: esperar y seguir
            log(f"error de conexión: {e}; reintento en 10 s")
            time.sleep(10)


if __name__ == "__main__":
    main()
