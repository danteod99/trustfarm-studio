#!/usr/bin/env bash
# Baja todos los modelos al network volume de RunPod. Se corre UNA vez dentro de un pod temporal
# con el volumen montado (en pods el volumen está en /workspace; en serverless se ve como /runpod-volume).
# LTX-2.5 exige aceptar su licencia en Hugging Face: exportar HF_TOKEN antes de correrlo.
#   HF_TOKEN=hf_xxx bash bajar_modelos.sh
set -euo pipefail
M=${MODELS_DIR:-/workspace/models}
HF=https://huggingface.co

bajar() {  # bajar <carpeta> <repo/resolve/main/ruta>
  local dir="$M/$1" url="$HF/$2" f
  f="$dir/$(basename "$2")"
  mkdir -p "$dir"
  [ -f "$f.ok" ] && { echo "✓ ya estaba $(basename "$f")"; return; }
  echo "↓ $(basename "$f")"
  curl -fL --retry 5 -C - ${HF_TOKEN:+-H "Authorization: Bearer $HF_TOKEN"} -o "$f" "$url"
  touch "$f.ok"
}

# ── Los mismos del servidor de casa (para el desborde) ──
bajar diffusion_models Comfy-Org/Z-Image-Turbo/resolve/main/split_files/diffusion_models/z_image_turbo_int8_convrot.safetensors
bajar text_encoders    Comfy-Org/Z-Image-Turbo/resolve/main/split_files/text_encoders/qwen_3_4b_fp8_mixed.safetensors
bajar vae              Comfy-Org/Z-Image-Turbo/resolve/main/split_files/vae/ae.safetensors
bajar diffusion_models Comfy-Org/Qwen-Image-2.1/resolve/main/diffusion_models/qwen_image_2.1_turbo_int8_convrot.safetensors
bajar text_encoders    Comfy-Org/Qwen-Image-2.1/resolve/main/text_encoders/qwen3vl_8b_int8_convrot.safetensors
bajar vae              Comfy-Org/Qwen-Image-2.1/resolve/main/vae/qwen_image_2.1_vae_bf16.safetensors
bajar diffusion_models Comfy-Org/Wan-2.2/resolve/main/split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors
bajar text_encoders    Comfy-Org/Wan-2.2/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors
bajar vae              Comfy-Org/Wan-2.2/resolve/main/split_files/vae/wan2.2_vae.safetensors

# ── Modelos grandes (solo en la nube) ──
# Qwen-Image 2.1 completo
bajar diffusion_models Comfy-Org/Qwen-Image-2.1/resolve/main/diffusion_models/qwen_image_2.1_bf16.safetensors
bajar text_encoders    Comfy-Org/Qwen-Image-2.1/resolve/main/text_encoders/qwen3vl_8b_bf16.safetensors
# Z-Image base (más calidad y la mejor base para entrenar LoRAs)
bajar diffusion_models Comfy-Org/Z-Image/resolve/main/split_files/diffusion_models/z_image_bf16.safetensors
bajar text_encoders    Comfy-Org/Z-Image/resolve/main/split_files/text_encoders/qwen_3_4b.safetensors
# Wan 2.2 14B texto→video e imagen→video + LoRAs LightX2V de 4 pasos. Los workflows usan fp8 (05-11: carga la
# mitad y arranca más rápido); los fp16 quedan en el volumen para volver atrás si hiciera falta.
for t in t2v i2v; do for n in high low; do
  bajar diffusion_models Comfy-Org/Wan-2.2/resolve/main/split_files/diffusion_models/wan2.2_${t}_${n}_noise_14B_fp16.safetensors
  bajar diffusion_models Comfy-Org/Wan-2.2/resolve/main/split_files/diffusion_models/wan2.2_${t}_${n}_noise_14B_fp8_scaled.safetensors
done; done
bajar text_encoders Comfy-Org/Wan-2.2/resolve/main/split_files/text_encoders/umt5_xxl_fp16.safetensors
bajar vae           Comfy-Org/Wan-2.2/resolve/main/split_files/vae/wan_2.1_vae.safetensors
bajar loras         Comfy-Org/Wan-2.2/resolve/main/split_files/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors
bajar loras         Comfy-Org/Wan-2.2/resolve/main/split_files/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors
bajar loras         Comfy-Org/Wan-2.2/resolve/main/split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors
bajar loras         Comfy-Org/Wan-2.2/resolve/main/split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors
# LTX-2.5 22B (video + audio). Licencia: gratis bajo US$10M de facturación anual.
# Repo con licencia que hay que aceptar en Hugging Face: sin HF_TOKEN se salta.
if [ -n "${HF_TOKEN:-}" ]; then
bajar diffusion_models     Lightricks/LTX-2.5/resolve/main/diffusion_models/ltx-2.5-22b-distilled-transformer-bf16.safetensors
bajar text_encoders        Lightricks/LTX-2.5/resolve/main/text_encoders/gemma4-12b-with-proj-ltx-2.5-bf16.safetensors
bajar vae                  Lightricks/LTX-2.5/resolve/main/vae/ltx-2.5-video-vae-bf16.safetensors
bajar vae                  Lightricks/LTX-2.5/resolve/main/vae/ltx-2.5-audio-vae-bf16.safetensors
bajar latent_upscale_models Lightricks/LTX-2.5/resolve/main/latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors
else
  echo "⚠ LTX-2.5 saltado: falta HF_TOKEN"
fi

mkdir -p "$M/loras/propias"   # aquí van las LoRAs entrenadas por nosotros
echo "LISTO: $(du -sh "$M" | cut -f1)"
