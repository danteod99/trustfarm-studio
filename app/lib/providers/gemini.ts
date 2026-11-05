// Google Gemini API por REST: imagen con Nano Banana (generateContent) y video con
// Gemini Omni Flash (API de Interactions en segundo plano + polling).
import type { Aspect, Resolution } from "@/app/lib/catalog";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export class ProviderError extends Error {
  /** true = el proveedor rechazó el contenido (filtro de seguridad), no un fallo técnico. */
  constructor(message: string, public readonly blocked = false) {
    super(message);
  }
}

function key(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new ProviderError("GEMINI_API_KEY no configurada");
  return k;
}

function headers() {
  return { "x-goog-api-key": key(), "Content-Type": "application/json" };
}

async function fail(r: Response, what: string): Promise<never> {
  const txt = (await r.text()).slice(0, 400);
  const low = txt.toLowerCase();
  if (r.status === 400 && ["safety", "blocked", "policy", "prohibited", "responsible ai"].some((s) => low.includes(s))) {
    throw new ProviderError(`${what} rechazado por el filtro de seguridad de Google.`, true);
  }
  if (r.status === 429) throw new ProviderError(`${what}: límite de uso de Google alcanzado, intenta en unos minutos.`);
  throw new ProviderError(`${what}: HTTP ${r.status} ${txt}`);
}

export interface InputImage {
  data: string; // base64 sin prefijo
  mime: string;
}

function blockReason(data: any): string {
  const pf = data?.promptFeedback;
  if (pf?.blockReason) return `bloqueado: ${pf.blockReason}`;
  for (const c of data?.candidates ?? []) {
    if (c.finishReason && !["STOP", "MAX_TOKENS"].includes(c.finishReason)) return `terminó con ${c.finishReason}`;
  }
  const gv = data?.response?.generateVideoResponse;
  if (gv?.raiMediaFilteredCount || gv?.raiMediaFilteredReasons) {
    return "filtro de seguridad: " + (gv.raiMediaFilteredReasons ?? ["contenido filtrado"]).join("; ");
  }
  return "";
}

/** Nano Banana: genera una imagen y devuelve sus bytes. */
export async function generateImage(
  model: string,
  prompt: string,
  aspect: Aspect,
  ref?: InputImage
): Promise<{ bytes: Buffer; mime: string }> {
  const parts: any[] = [{ text: prompt }];
  if (ref) parts.push({ inlineData: { mimeType: ref.mime, data: ref.data } });
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect, imageSize: "2K" } },
  };
  const r = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) await fail(r, "Imagen");
  const data = await r.json();
  for (const c of data?.candidates ?? []) {
    for (const p of c?.content?.parts ?? []) {
      const inline = p.inlineData ?? p.inline_data;
      if (inline?.data) {
        return { bytes: Buffer.from(inline.data, "base64"), mime: inline.mimeType ?? inline.mime_type ?? "image/png" };
      }
    }
  }
  throw new ProviderError(`La imagen no se generó (${blockReason(data) || "respuesta vacía"}).`, true);
}

/** Gemini Omni Flash (reemplazo de Veo 3.1 Preview, apagado el 2026-10-22): lanza la
 *  generación en segundo plano por la API de Interactions y devuelve "interactions/<id>". */
export async function startVeo(
  model: string,
  prompt: string,
  opts: { aspect: Aspect; resolution: Resolution; duration: number },
  image?: InputImage
): Promise<string> {
  const input = image
    ? [
        { type: "image", data: image.data, mime_type: image.mime },
        { type: "text", text: prompt },
      ]
    : prompt;
  const body = {
    model,
    input,
    background: true,
    response_format: {
      type: "video",
      aspect_ratio: opts.aspect,
      resolution: opts.resolution,
      duration: `${opts.duration}s`,
      delivery: "uri",
    },
  };
  const r = await fetch(`${BASE}/interactions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) await fail(r, "Video");
  const data = await r.json();
  if (!data?.id) throw new ProviderError("Google no devolvió la generación del video.");
  return `interactions/${data.id}`;
}

export type PollResult = { state: "running" } | { state: "done"; uri: string } | { state: "failed"; error: string; blocked: boolean };

export async function pollVeo(operation: string): Promise<PollResult> {
  const r = await fetch(`${BASE}/${operation}`, { headers: headers() });
  if (!r.ok) {
    // Errores transitorios del polling: se reintenta en la próxima consulta.
    if (r.status >= 500 || r.status === 429) return { state: "running" };
    return { state: "failed", error: `polling HTTP ${r.status}`, blocked: false };
  }
  const d = await r.json();
  if (d.status === "in_progress" || d.status === "queued") return { state: "running" };
  for (const step of d.steps ?? []) {
    for (const c of step?.content ?? []) {
      if (c?.type === "video" && c.uri) return { state: "done", uri: c.uri };
    }
  }
  const msg = `${d.error?.code ?? ""} ${d.error?.message ?? ""}`.trim() || `estado ${d.status ?? "desconocido"}, sin video`;
  const blocked = ["safety", "blocked", "policy", "filtered", "prohibited"].some((s) => msg.toLowerCase().includes(s));
  return { state: "failed", error: blocked ? "El video fue rechazado por el filtro de seguridad de Google." : `Video sin resultado (${msg}).`, blocked };
}

export async function downloadVeo(uri: string): Promise<Buffer> {
  const r = await fetch(uri, { headers: { "x-goog-api-key": key() }, redirect: "follow" });
  if (!r.ok) throw new ProviderError(`Descarga del video falló: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 10_000) throw new ProviderError("Descarga del video incompleta.");
  return buf;
}
