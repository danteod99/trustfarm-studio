# Plantillas de pantalla real

Copia de `danteod99/trustclip/screen-templates` (la fuente de verdad). NO editar a mano.

Sincronizar tras un cambio en trustclip:

    git clone --depth=1 https://github.com/danteod99/trustclip /tmp/trustclip
    /usr/bin/python3 scripts/sincronizar-plantillas.py /tmp/trustclip
    node --experimental-strip-types --test tests/pantalla-real.test.ts

El script copia `manifest.json`, re-guarda los PNG sin pérdida (la zona verde #00FF00 queda idéntica; se comprueba
pixel a pixel), genera `miniaturas/*.jpg` y regenera `tests/fixtures/pantalla-real-python.json` con el `filter_graph`
real de trustclip. Si `engine/perfil.py` cambia el grafo, el test falla y hay que re-portar `app/lib/pantalla-real.ts`.

La web solo descarga el manifest y las miniaturas; cada PNG (~1 MB) se pide únicamente cuando una versión lo usa.
