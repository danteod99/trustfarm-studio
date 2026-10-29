// fal.ai por su API de cola (queue.fal.run): Qwen-Image y Wan 2.2.
// Se guardan las URLs de estado/resultado que devuelve fal; así no hay que
// reconstruirlas para endpoints con subruta (fal-ai/wan/v2.2-a14b/...).
import { ProviderError, type PollResult } from "@/app/lib/providers/gemini";
import type { Aspect, Resolution } from "@/app/lib/catalog";

const QUEUE = "https://queue.fal.run";

export interface FalRef {
  request_id: string;
  status_url: string;
  response_url: string;
}

function headers() {
  const k = process.env.FAL_KEY;
  if (!k) throw new ProviderError("FAL_KEY no configurada");
  return { Authorization: `Key ${k}`, "Content-Type": "application/json" };
}

const QWEN_SIZE: Record<Aspect, string> = {
  "1:1": "square_hd",
  "9:16": "portrait_16_9",
  "16:9": "landscape_16_9",
};

export async function submit(endpoint: string, input: Record<string, unknown>): Promise<FalRef> {
  const r = await fetch(`${QUEUE}/${endpoint}`, { method: "POST", headers: headers(), body: JSON.stringify(input) });
  if (!r.ok) throw new ProviderError(`fal ${endpoint}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  const d = await r.json();
  if (!d.request_id || !d.status_url || !d.response_url) throw new ProviderError("fal no devolvió la cola del trabajo.");
  return { request_id: d.request_id, status_url: d.status_url, response_url: d.response_url };
}

export function qwenInput(prompt: string, aspect: Aspect) {
  return { prompt, image_size: QWEN_SIZE[aspect], num_images: 1, enable_safety_checker: true };
}

export function wanInput(prompt: string, aspect: Aspect, resolution: Resolution, imageDataUri?: string) {
  const input: Record<string, unknown> = { prompt, resolution, aspect_ratio: aspect, enable_safety_checker: true };
  if (imageDataUri) input.image_url = imageDataUri;
  return input;
}

export async function poll(ref: FalRef): Promise<PollResult> {
  const r = await fetch(ref.status_url, { headers: headers() });
  if (!r.ok) {
    if (r.status >= 500 || r.status === 429) return { state: "running" };
    return { state: "failed", error: `fal estado HTTP ${r.status}`, blocked: false };
  }
  const s = await r.json();
  if (s.status !== "COMPLETED") return { state: "running" };

  const res = await fetch(ref.response_url, { headers: headers() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = JSON.stringify(body?.detail ?? body).slice(0, 300);
    const blocked = /nsfw|safety|content/i.test(detail);
    return { state: "failed", error: blocked ? "Rechazado por el filtro de contenido." : `fal: ${detail}`, blocked };
  }
  const url: string | undefined = body?.video?.url ?? body?.images?.[0]?.url;
  if (!url) return { state: "failed", error: "fal no devolvió archivo.", blocked: false };
  if (body?.has_nsfw_concepts?.[0]) return { state: "failed", error: "Rechazado por el filtro de contenido.", blocked: true };
  return { state: "done", uri: url };
}

export async function download(url: string): Promise<{ bytes: Buffer; mime: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new ProviderError(`Descarga desde fal falló: HTTP ${r.status}`);
  return { bytes: Buffer.from(await r.arrayBuffer()), mime: r.headers.get("content-type") || "application/octet-stream" };
}
