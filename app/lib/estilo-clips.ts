// Estilo de subtítulos, título y logo de los clips (Multiclipping).
// Lo valida de nuevo el servicio trustclip (engine/branding.py): aquí solo se limpia la forma y el tamaño.

export const SUB_PRESETS = [
  { id: "classic", label: "Clásico", hint: "Blanco con borde negro" },
  { id: "tiktok", label: "TikTok", hint: "Grande y amarillo" },
  { id: "box", label: "Caja", hint: "Texto sobre fondo sólido" },
  { id: "minimal", label: "Minimal", hint: "Chico y discreto" },
] as const;
export const SUB_POSITIONS = [
  { id: "bottom", label: "Abajo" },
  { id: "center", label: "Centro" },
  { id: "high", label: "Arriba" },
] as const;
export const FONTS = [
  { id: "sans", label: "Sans", css: "Arial, Helvetica, sans-serif" },
  { id: "serif", label: "Serif", css: "'Times New Roman', Georgia, serif" },
  { id: "condensed", label: "Condensada", css: "'Arial Narrow', 'Helvetica Neue Condensed', sans-serif" },
  { id: "mono", label: "Mono", css: "'Courier New', monospace" },
] as const;
export const TITLE_POSITIONS = [
  { id: "top", label: "Arriba" },
  { id: "upper", label: "Un poco más abajo" },
] as const;
export const LOGO_POSITIONS = [
  { id: "tl", label: "↖" },
  { id: "tr", label: "↗" },
  { id: "bl", label: "↙" },
  { id: "br", label: "↘" },
] as const;

export const SUB_PRESET_DEFAULTS: Record<string, { color: string; outline_color: string }> = {
  classic: { color: "#FFFFFF", outline_color: "#000000" },
  tiktok: { color: "#FFE600", outline_color: "#000000" },
  box: { color: "#FFFFFF", outline_color: "#000000" },
  minimal: { color: "#FFFFFF", outline_color: "#000000" },
};

export interface EstiloClips {
  subs: { preset: string; color: string; outline_color: string; position: string; font: string };
  title: { color: string; bg: string; bg_opacity: number; font: string; position: string };
  logo: { data: string; position: string; scale: number } | null;
}

export const ESTILO_DEFAULT: EstiloClips = {
  subs: { preset: "classic", color: "#FFFFFF", outline_color: "#000000", position: "bottom", font: "sans" },
  title: { color: "#FFFFFF", bg: "#000000", bg_opacity: 0.55, font: "sans", position: "top" },
  logo: null,
};

export const MAX_LOGO_B64 = 540_000; // ≈ 400 KB de PNG

const HEX = /^#[0-9a-fA-F]{6}$/;
const pick = <T extends readonly { id: string }[]>(list: T, v: unknown, d: string) =>
  list.some((o) => o.id === v) ? (v as string) : d;
const hex = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v.toUpperCase() : d);
const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** Limpia lo que llega del navegador. Cualquier valor raro vuelve al defecto. */
export function sanitizeEstilo(raw: unknown): EstiloClips {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const s = r.subs || {};
  const t = r.title || {};
  const preset = pick(SUB_PRESETS, s.preset, "classic");
  const lg = r.logo;
  const data = lg && typeof lg.data === "string" && lg.data.length <= MAX_LOGO_B64 && lg.data.startsWith("data:image/png;base64,") ? lg.data : null;
  return {
    subs: {
      preset,
      color: hex(s.color, SUB_PRESET_DEFAULTS[preset].color),
      outline_color: hex(s.outline_color, SUB_PRESET_DEFAULTS[preset].outline_color),
      position: pick(SUB_POSITIONS, s.position, "bottom"),
      font: pick(FONTS, s.font, "sans"),
    },
    title: {
      color: hex(t.color, "#FFFFFF"),
      bg: hex(t.bg, "#000000"),
      bg_opacity: num(t.bg_opacity, 0.55, 0, 1),
      font: pick(FONTS, t.font, "sans"),
      position: pick(TITLE_POSITIONS, t.position, "top"),
    },
    logo: data && lg ? { data, position: pick(LOGO_POSITIONS, lg.position, "tr"), scale: num(lg.scale, 0.18, 0.08, 0.4) } : null,
  };
}
