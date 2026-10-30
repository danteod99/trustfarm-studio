"""Handler de RunPod Serverless: recibe {"gen_id": ...}, toma ese trabajo de Supabase y lo
genera con el mismo código que el servidor de casa (worker.py). ComfyUI ya lo arranca start.sh."""
import time

import runpod

import worker


def esperar_comfy(max_seg: int = 600):
    fin = time.time() + max_seg
    while time.time() < fin:
        if worker.comfy_vivo():
            return
        time.sleep(2)
    raise RuntimeError("ComfyUI no arrancó")


def handler(event):
    gen_id = (event.get("input") or {}).get("gen_id")
    if not gen_id:
        return {"error": "falta gen_id"}
    job = worker.reclamar(gen_id)
    if not job:
        return {"skipped": True}  # ya lo tomó otro servidor o se canceló
    worker.log(f"→ {gen_id} · {job['model']} · {job['prompt'][:60]!r}")
    try:
        esperar_comfy()
        worker.procesar(job)
    except Exception as e:  # noqa: BLE001 — cualquier fallo se marca y se reembolsa
        worker.fallar(job, f"Error en el servidor en la nube: {e}")
        return {"error": str(e)[:300]}
    return {"ok": True}


runpod.serverless.start({"handler": handler})
