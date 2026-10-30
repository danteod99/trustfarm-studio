// Catálogo único de modelos, precios en créditos y paquetes.
// 1 crédito = US$0.10 al precio base (paquete Inicial). Los paquetes grandes
// regalan créditos extra, así que el margen mínimo se calcula con el de Agencia.
//
// Costos reales de proveedor (oficiales Google 2026-10-15; fal.ai por verificar
// en la página de cada modelo antes de lanzar):
//   Nano Banana 2 (gemini-3.1-flash-image) $0.101/img · Nano Banana Pro $0.134/img
//   Veo 3.1 Lite  $0.05/s 720p · $0.08/s 1080p (con audio)
//   Veo 3.1 Fast  $0.10/s 720p · $0.12/s 1080p (con audio)
//   Qwen-Image (fal) ~$0.02/img · Wan 2.2 A14B (fal) ~$0.40 por clip 720p de 5 s

export type Kind = "image" | "video";
export type Provider = "gemini-image" | "veo" | "fal" | "local";
export type Aspect = "16:9" | "9:16" | "1:1";
export type Resolution = "480p" | "720p" | "1080p";

export interface ModelDef {
  id: string;
  kind: Kind;
  provider: Provider;
  name: string;
  tagline: string;
  /** ID del modelo en el proveedor. Para fal: { t2v, i2v } o el endpoint de imagen. */
  providerModel: string;
  providerModelImage?: string;
  aspects: Aspect[];
  /** Solo video */
  durations?: number[];
  resolutions?: Resolution[];
  /** Créditos por imagen, o créditos por segundo según resolución. */
  credits: number | Partial<Record<Resolution, number>>;
  acceptsImage: boolean;
  badge?: string;
  /** Lo genera el servidor local (GPU en casa) cuando está en línea; si no, fal.ai. */
  localCapable?: boolean;
}

/** Sin respaldo en la nube: solo se puede usar con el servidor local encendido. */
export function needsLocal(m: ModelDef, falConfigured: boolean): boolean {
  return m.provider === "local" || (!!m.localCapable && !falConfigured);
}

export const MODELS: ModelDef[] = [
  {
    id: "nano-banana-2",
    kind: "image",
    provider: "gemini-image",
    name: "Nano Banana 2",
    tagline: "Rápido y fotorrealista. Ideal para anuncios y producto.",
    providerModel: "gemini-3.1-flash-image",
    aspects: ["1:1", "9:16", "16:9"],
    credits: 3,
    acceptsImage: true,
  },
  {
    id: "nano-banana-pro",
    kind: "image",
    provider: "gemini-image",
    name: "Nano Banana Pro",
    tagline: "Máxima calidad de Google, texto legible dentro de la imagen.",
    providerModel: "gemini-3-pro-image",
    aspects: ["1:1", "9:16", "16:9"],
    credits: 4,
    acceptsImage: true,
    badge: "Calidad",
  },
  {
    id: "qwen-image",
    kind: "image",
    provider: "fal",
    name: "Qwen-Image",
    tagline: "Open source, el más económico. Bueno para volumen y texto en la imagen.",
    providerModel: "fal-ai/qwen-image",
    aspects: ["1:1", "9:16", "16:9"],
    credits: 1,
    acceptsImage: false,
    badge: "Económico",
    localCapable: true,
  },
  {
    id: "z-image",
    kind: "image",
    provider: "local",
    name: "Z-Image Turbo",
    tagline: "Open source, fotos realistas en segundos. Corre en nuestro servidor.",
    providerModel: "z_image_turbo",
    aspects: ["1:1", "9:16", "16:9"],
    credits: 1,
    acceptsImage: false,
    badge: "Económico",
    localCapable: true,
  },
  {
    id: "veo-lite",
    kind: "video",
    provider: "veo",
    name: "Veo 3.1 Lite",
    tagline: "Video con audio de Google al menor costo.",
    providerModel: "veo-3.1-lite-generate-preview",
    aspects: ["9:16", "16:9"],
    durations: [4, 6, 8],
    resolutions: ["720p", "1080p"],
    credits: { "720p": 1.25, "1080p": 1.75 },
    acceptsImage: true,
    badge: "Económico",
  },
  {
    id: "veo-fast",
    kind: "video",
    provider: "veo",
    name: "Veo 3.1 Fast",
    tagline: "Mejor movimiento, diálogo y lip-sync en español.",
    providerModel: "veo-3.1-fast-generate-preview",
    aspects: ["9:16", "16:9"],
    durations: [4, 6, 8],
    resolutions: ["720p", "1080p"],
    credits: { "720p": 2.25, "1080p": 2.75 },
    acceptsImage: true,
    badge: "Calidad",
  },
  {
    id: "wan-22",
    kind: "video",
    provider: "fal",
    name: "Wan 2.2",
    tagline: "Open source. Clips de 5 s sin audio, perfecto para B-roll.",
    providerModel: "fal-ai/wan/v2.2-a14b/text-to-video",
    providerModelImage: "fal-ai/wan/v2.2-a14b/image-to-video",
    aspects: ["9:16", "16:9", "1:1"],
    durations: [5],
    resolutions: ["480p", "720p"],
    credits: { "480p": 1.2, "720p": 2 },
    acceptsImage: true,
    localCapable: true,
  },
];

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

export interface GenOptions {
  aspect: Aspect;
  duration?: number;
  resolution?: Resolution;
}

/** En Veo, 1080p solo existe para clips de 8 s. */
export function validOptions(m: ModelDef, o: GenOptions): string | null {
  if (!m.aspects.includes(o.aspect)) return "Formato no disponible para este modelo.";
  if (m.kind === "video") {
    if (!o.duration || !m.durations?.includes(o.duration)) return "Duración no válida.";
    if (!o.resolution || !m.resolutions?.includes(o.resolution)) return "Resolución no válida.";
    if (m.provider === "veo" && o.resolution === "1080p" && o.duration !== 8) return "En 1080p el clip debe durar 8 s.";
  }
  return null;
}

export function creditCost(m: ModelDef, o: GenOptions): number {
  if (typeof m.credits === "number") return m.credits;
  const perSec = m.credits[o.resolution ?? "720p"] ?? 0;
  return Math.ceil(perSec * (o.duration ?? 0));
}

export interface Pack {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  bonus?: string;
  popular?: boolean;
}

export const PACKS: Pack[] = [
  { id: "inicial", name: "Inicial", credits: 100, priceUsd: 10 },
  { id: "creador", name: "Creador", credits: 275, priceUsd: 25, bonus: "+10 %" },
  { id: "estudio", name: "Estudio", credits: 600, priceUsd: 50, bonus: "+20 %", popular: true },
  { id: "agencia", name: "Agencia", credits: 1300, priceUsd: 100, bonus: "+30 %" },
];

export function getPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id);
}

export const MAX_PROMPT = 2000;
export const MAX_ACTIVE_JOBS = 3;
