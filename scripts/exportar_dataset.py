#!/usr/bin/env python3
"""Exporta generaciones de trustfarm.online como dataset para entrenar (LoRAs, fine-tunes).

Junta cada generación terminada con sus señales de calidad (supabase/14_senales_generaciones.sql),
le pone un puntaje y baja las que pasan el filtro: archivo + .txt con el prompt + manifest.csv.

Puntaje: descargó +1 · animó +2 · la guardó como personaje +2 · repitió el prompt al rato -2.

Uso (en la Mac mini, credenciales en ~/.config/truststudio/cron.env):
  python3 exportar_dataset.py                          # imágenes con puntaje >= 1
  python3 exportar_dataset.py --filtro "iphone|granja" --nombre granjas
  python3 exportar_dataset.py --tipo video --min-puntaje 2
  python3 exportar_dataset.py --min-puntaje 0 --solo-contar   # ver cuántas hay, sin bajar nada
Salida: ~/lora/datasets/<fecha>_<nombre>/
"""
import argparse
import csv
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

PUNTOS = {"download": 1, "animate": 2, "character": 2, "regenerate": -2}
BUCKET = "ai-media"


def cargar_env():
    f = Path.home() / ".config/truststudio/cron.env"
    if f.exists():
        for linea in f.read_text().splitlines():
            if "=" in linea and not linea.lstrip().startswith("#"):
                k, v = linea.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (~/.config/truststudio/cron.env)")
    return url.rstrip("/"), key


def pedir(url, key, ruta, crudo=False):
    req = urllib.request.Request(url + ruta, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read() if crudo else json.load(r)


def todo(url, key, tabla, query):
    """Lee una tabla completa en páginas de 1000."""
    filas, desde = [], 0
    while True:
        lote = pedir(url, key, f"/rest/v1/{tabla}?{query}&limit=1000&offset={desde}")
        filas += lote
        if len(lote) < 1000:
            return filas
        desde += 1000


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tipo", choices=["image", "video"], default="image")
    ap.add_argument("--modelo", help="id del modelo (z-image, qwen-image, veo-lite…)")
    ap.add_argument("--filtro", help="regex sobre el prompt (sin distinguir mayúsculas)")
    ap.add_argument("--min-puntaje", type=int, default=1)
    ap.add_argument("--desde", help="fecha AAAA-MM-DD")
    ap.add_argument("--nombre", default="dataset")
    ap.add_argument("--solo-contar", action="store_true")
    a = ap.parse_args()
    url, key = cargar_env()

    q = f"select=id,user_id,model,prompt,params,output_path,created_at&status=eq.done&kind=eq.{a.tipo}&order=created_at.asc"
    if a.modelo:
        q += f"&model=eq.{urllib.parse.quote(a.modelo)}"
    if a.desde:
        q += f"&created_at=gte.{a.desde}"
    gens = todo(url, key, "ai_generations", q)

    senales = {}
    try:
        for e in todo(url, key, "ai_generation_events", "select=generation_id,event"):
            senales.setdefault(e["generation_id"], []).append(e["event"])
    except urllib.error.HTTPError as e:
        print(f"⚠ Sin tabla de señales todavía (HTTP {e.code}): falta correr supabase/14_senales_generaciones.sql. Todas puntúan 0.")

    filtro = re.compile(a.filtro, re.I) if a.filtro else None
    elegidas = []
    for g in gens:
        ev = sorted(senales.get(g["id"], []))
        g["eventos"], g["puntaje"] = ev, sum(PUNTOS.get(x, 0) for x in ev)
        if g["output_path"] and g["puntaje"] >= a.min_puntaje and (not filtro or filtro.search(g["prompt"])):
            elegidas.append(g)

    print(f"{len(gens)} generaciones {a.tipo} terminadas · {len(senales)} con señales · {len(elegidas)} pasan el filtro "
          f"(puntaje >= {a.min_puntaje}{', regex ' + a.filtro if a.filtro else ''})")
    if a.solo_contar or not elegidas:
        return

    out = Path.home() / "lora/datasets" / f"{date.today().isoformat()}_{a.nombre}"
    out.mkdir(parents=True, exist_ok=True)
    with open(out / "manifest.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["archivo", "generation_id", "user_id", "modelo", "puntaje", "senales", "aspecto", "fecha", "prompt"])
        for i, g in enumerate(elegidas, 1):
            ext = g["output_path"].rsplit(".", 1)[-1]
            nombre = f"{i:04d}.{ext}"
            try:
                datos = pedir(url, key, f"/storage/v1/object/{BUCKET}/{urllib.parse.quote(g['output_path'])}", crudo=True)
            except urllib.error.HTTPError as e:
                print(f"  ✗ {g['id']}: HTTP {e.code}")
                continue
            (out / nombre).write_bytes(datos)
            (out / f"{i:04d}.txt").write_text(g["prompt"].replace("\n", " ").strip(), encoding="utf-8")
            w.writerow([nombre, g["id"], g["user_id"], g["model"], g["puntaje"], " ".join(g["eventos"]),
                        (g.get("params") or {}).get("aspect", ""), g["created_at"][:10], g["prompt"]])
            print(f"  ✓ {nombre} · {g['model']} · puntaje {g['puntaje']} · {g['prompt'][:60]!r}")
    print(f"Listo: {out}")


if __name__ == "__main__":
    main()
