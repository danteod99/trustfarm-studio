# Imagen de TrustFarm Studio para RunPod Serverless.
# BASE = runpod/worker-comfyui (target "base") construida con ComfyUI 0.43 por la GitHub Action.
# Los modelos y LoRAs NO van en la imagen: viven en el network volume (/runpod-volume/models).
ARG BASE
FROM ${BASE}

COPY worker/worker.py /worker/worker.py
COPY worker/workflows /worker/workflows
COPY runpod/config.json /worker/config.json
COPY runpod/handler.py /handler.py
COPY runpod/extra_model_paths.yaml /comfyui/extra_model_paths.yaml

ENV PYTHONPATH=/worker WORKER_CONFIG=/worker/config.json WORKER_ID=runpod
