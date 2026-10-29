# Servidor local (GPU en casa)

Genera **Wan 2.2** (video) y **Qwen-Image** (imagen) en tu propia GPU con ComfyUI.
Mientras está encendido, la web le manda esos trabajos; si se apaga, la web usa fal.ai sola.
Veo 3.1 y Nano Banana siempre van por la API de Google (no existen en local).

## Hardware recomendado
- NVIDIA RTX 5090 (32 GB) o 4090 (24 GB), 64 GB de RAM, SSD de 1 TB (los modelos pesan ~60-80 GB).
- Windows 11 o Ubuntu. Internet estable (solo conexiones de salida, no hay que abrir puertos).

## Instalación (una vez)
1. Instalar **ComfyUI** (en Windows, la versión portable) y abrirlo: queda en http://127.0.0.1:8188
2. En ComfyUI → *Workflow → Browse Templates*: abrir **"Wan 2.2 14B Text to Video"**, **"Wan 2.2 14B Image to Video"**
   y **"Qwen-Image"**. ComfyUI ofrece descargar los modelos que faltan; aceptar.
3. Probar cada plantilla a mano una vez (que genere algo).
4. Exportar cada una en formato API: *Workflow → Export (API)* y guardarlas como
   `workflows/wan22_t2v.json`, `workflows/wan22_i2v.json`, `workflows/qwen_image.json`.
5. En cada JSON exportado, cambiar los valores por estos marcadores (con comillas):

| Marcador | Dónde va |
|---|---|
| `"{{PROMPT}}"` | texto del prompt positivo |
| `"{{NEGATIVE}}"` | texto del prompt negativo |
| `"{{SEED}}"` | `seed` / `noise_seed` del sampler |
| `"{{WIDTH}}"`, `"{{HEIGHT}}"` | ancho y alto del latent / imagen vacía |
| `"{{FRAMES}}"` | `length` (cantidad de frames) — solo video |
| `"{{FPS}}"` | `fps` del nodo que crea/guarda el video — solo video |
| `"{{IMAGE}}"` | `image` del nodo **LoadImage** — solo `wan22_i2v.json` |
| `"{{PREFIX}}"` | `filename_prefix` del nodo que guarda |

   El nodo que guarda el video debe producir **MP4** (SaveVideo con formato mp4).
6. Copiar `config.example.json` a `config.json` y pegar la *service role key* de Supabase.
   Esa clave da acceso total a la base: **no compartirla ni subirla a GitHub**.
7. `pip install -r requirements.txt` y luego `python worker.py`.

## Arranque automático
- **Windows:** Programador de tareas → al iniciar sesión → `python C:\ruta\worker\worker.py` (y ComfyUI igual).
- **Linux:** un servicio systemd para ComfyUI y otro para el worker.

## Cómo saber si funciona
En trustfarm.online/admin → *Servidores locales*: punto verde = en línea. La tabla de uso
muestra cuántas generaciones salieron del servidor local.
