#!/usr/bin/python3
"""Sincroniza las plantillas de pantalla real desde danteod99/trustclip (fuente de verdad) hacia Studio.

Uso:   /usr/bin/python3 scripts/sincronizar-plantillas.py /ruta/a/trustclip
Hace:  1) copia screen-templates/manifest.json tal cual a public/plantillas-pantalla/
       2) re-guarda cada PNG sin pérdida (optimize) y comprueba pixel a pixel que es idéntico (el verde #00FF00 intacto)
       3) genera miniaturas JPG 120x213 (solo vista previa de la UI; nunca pasan por el chromakey)
       4) regenera tests/fixtures/pantalla-real-python.json con el filter_graph REAL de trustclip (lo compara el test)
Requiere Pillow (python3 del sistema) y, para el paso 4, nada más: importa engine/perfil.py de trustclip.
"""
import glob, json, os, shutil, sys
from PIL import Image

src = os.path.join(sys.argv[1], "screen-templates")
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dst = os.path.join(raiz, "public", "plantillas-pantalla")
os.makedirs(os.path.join(dst, "miniaturas"), exist_ok=True)
for viejo in glob.glob(os.path.join(dst, "*.png")) + glob.glob(os.path.join(dst, "miniaturas", "*.jpg")):
    os.remove(viejo)
shutil.copy(os.path.join(src, "manifest.json"), os.path.join(dst, "manifest.json"))
antes = despues = 0
for p in sorted(glob.glob(os.path.join(src, "*.png"))):
    n = os.path.basename(p)
    im = Image.open(p).convert("RGB")
    out = os.path.join(dst, n)
    im.save(out, optimize=True, compress_level=9)
    assert list(Image.open(out).convert("RGB").getdata()) == list(im.getdata()), f"{n}: el PNG cambió"
    im.resize((120, 213), Image.LANCZOS).save(os.path.join(dst, "miniaturas", n[:-4] + ".jpg"), quality=70, optimize=True)
    antes += os.path.getsize(p); despues += os.path.getsize(out)
print(f"PNG: {antes/1e6:.1f} MB -> {despues/1e6:.1f} MB (sin pérdida)")

sys.path.insert(0, sys.argv[1])
from engine import perfil as P  # noqa: E402
T = P.load_templates()
fx = {
    "light_sweep": P.LIGHT_SWEEP, "fps": P.FPS, "fill": P.DEFAULT_FILL,
    "casos": [{"id": i, "quad": t["quad"], "plateSize": t["plateSize"], "graph": P.filter_graph(t["quad"], *t["plateSize"])} for i, t in T.items()],
    "seleccion": {"todas": P.elegir_plantillas(T), "tv": P.elegir_plantillas(T, "tv"), "monitor": P.elegir_plantillas(T, "monitor"),
                  "una": P.elegir_plantillas(T, None, "tv_hotel"), "malo": P.elegir_plantillas(T, "xx")},
}
with open(os.path.join(raiz, "tests", "fixtures", "pantalla-real-python.json"), "w", encoding="utf-8") as f:
    json.dump(fx, f, ensure_ascii=False)
print(f"fixture: {len(fx['casos'])} plantillas")
