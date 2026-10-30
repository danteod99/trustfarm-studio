# Imagen de TrustFarm Studio para RunPod Serverless (la construye RunPod desde este repo,
# o la GitHub Action). Parte de la imagen oficial worker-comfyui y sube ComfyUI a la versión
# que necesitan Qwen-Image 2.1, Z-Image y LTX-2.5.
# Los modelos y LoRAs NO van en la imagen: viven en el network volume (/runpod-volume/models).
FROM runpod/worker-comfyui:5.10.0-base

# ComfyUI 0.43 pide PyTorch con CUDA 13 (la base trae cu128). Todo va al venv de la imagen
# (/opt/venv): un "uv pip install" sin --python lo instala fuera y ComfyUI no arranca.
ARG COMFYUI_VERSION=v0.43.0
RUN cd /comfyui \
 && git fetch --depth 1 origin tag "${COMFYUI_VERSION}" \
 && git checkout -f "${COMFYUI_VERSION}" \
 && uv pip install --python /opt/venv/bin/python "torch>=2.12" torchvision torchaudio \
      --index-url https://download.pytorch.org/whl/cu130 \
 && uv pip install --python /opt/venv/bin/python -r requirements.txt \
 && /opt/venv/bin/python -c "import torch, comfy_aimdo.storage; print('torch', torch.__version__)"

COPY worker/worker.py /worker/worker.py
COPY worker/workflows /worker/workflows
COPY runpod/config.json /worker/config.json
COPY runpod/handler.py /handler.py
COPY runpod/extra_model_paths.yaml /comfyui/extra_model_paths.yaml

ENV PYTHONPATH=/worker WORKER_CONFIG=/worker/config.json WORKER_ID=runpod
