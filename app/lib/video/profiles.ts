// Perfiles de variación de Multiediting (portados de TrustMind) y armado de los argumentos
// de ffmpeg para renderizar una variación. Funciones puras (se prueban con node --test).

import { FONTS_DIR } from "./ass.ts";

export interface Profile {
  /** brillo (-0.06..0.06) */ br: number;
  /** contraste */ co: number;
  /** saturación */ sa: number;
  /** gamma */ ga: number;
  /** volumen */ vo: number;
  /** tono en grados */ hue: number;
}

/** 10 perfiles calibrados a mano. El 1.º es el original sin cambios. */
export const PROFILES: Profile[] = [
  { br: 0.00, co: 1.00, sa: 1.00, ga: 1.00, vo: 1.00, hue: 0 },
  { br: 0.04, co: 1.06, sa: 1.12, ga: 0.94, vo: 0.94, hue: 3 },
  { br: -0.04, co: 0.94, sa: 0.88, ga: 1.06, vo: 1.06, hue: -3 },
  { br: 0.06, co: 1.10, sa: 0.82, ga: 1.09, vo: 0.88, hue: 5 },
  { br: -0.06, co: 0.90, sa: 1.18, ga: 0.91, vo: 1.12, hue: -5 },
  { br: 0.02, co: 1.04, sa: 1.06, ga: 1.02, vo: 0.96, hue: 2 },
  { br: -0.02, co: 0.97, sa: 0.94, ga: 0.98, vo: 1.04, hue: -2 },
  { br: 0.05, co: 1.08, sa: 1.09, ga: 0.88, vo: 0.91, hue: 4 },
  { br: -0.03, co: 0.92, sa: 0.91, ga: 1.12, vo: 1.09, hue: -4 },
  { br: 0.01, co: 1.03, sa: 1.14, ga: 0.96, vo: 1.02, hue: 1 },
];

/** Número pseudoaleatorio determinista en [0,1) para (i, salt). */
export function hashRand(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Perfil i (0-based). Del 11 en adelante se generan dentro de los mismos rangos seguros. */
export function getProfile(i: number): Profile {
  if (i < PROFILES.length) return PROFILES[i];
  const r = (salt: number, min: number, max: number, dec = 2) =>
    parseFloat((min + hashRand(i, salt) * (max - min)).toFixed(dec));
  return {
    br: r(1, -0.06, 0.06),
    co: r(2, 0.90, 1.10),
    sa: r(3, 0.82, 1.18),
    ga: r(4, 0.88, 1.12),
    vo: r(5, 0.88, 1.12),
    hue: r(6, -5, 5, 1),
  };
}

export type LogoPos = "tr" | "tl" | "br" | "bl";
/** Posiciones del logo (overlay) con margen de 30 px. */
export const LOGO_POSITIONS: Record<LogoPos, { label: string; expr: string }> = {
  tr: { label: "Arriba derecha", expr: "main_w-overlay_w-30:30" },
  tl: { label: "Arriba izquierda", expr: "30:30" },
  br: { label: "Abajo derecha", expr: "main_w-overlay_w-30:main_h-overlay_h-30" },
  bl: { label: "Abajo izquierda", expr: "30:main_h-overlay_h-30" },
};

export interface VariationSpec {
  profile: Profile;
  /** Archivo de entrada en el FS de ffmpeg (por defecto "in.mp4"). */
  input?: string;
  /** Archivo de salida (por defecto "out.mp4"). */
  output?: string;
  /** ASS ya escrito en el FS de ffmpeg (subtítulos y/o gancho). Requiere engine.mountFont(). */
  assPath?: string;
  /** Imagen de marca de agua ya escrita en el FS de ffmpeg. */
  logoPath?: string;
  logoPos?: LogoPos;
  /** Velocidad (0.97–1.03 recomendado). 1 = igual. */
  speed?: number;
  /** Zoom/recorte central leve (1 = sin recorte, 1.04 = 4 %). */
  zoom?: number;
  /** Calidad x264 (por defecto 23). */
  crf?: number;
}

const r3 = (n: number) => Number(n.toFixed(3));

/** Cadena de filtros de video de una variación (sin logo). */
export function videoFilter(spec: VariationSpec): string {
  const p = spec.profile;
  const f = [`eq=brightness=${p.br}:contrast=${p.co}:saturation=${p.sa}:gamma=${p.ga}`, `hue=h=${p.hue}`];
  const z = spec.zoom && spec.zoom > 1 ? r3(spec.zoom) : 0;
  if (z) f.push(`scale=trunc(iw*${z}/2)*2:trunc(ih*${z}/2)*2`, `crop=trunc(iw/${z}/2)*2:trunc(ih/${z}/2)*2`);
  const s = spec.speed && spec.speed !== 1 ? r3(spec.speed) : 0;
  if (s) f.push(`setpts=PTS/${s}`);
  if (spec.assPath) f.push(`ass=${spec.assPath}:fontsdir=${FONTS_DIR}`);
  return f.join(",");
}

/** Filtro de audio de una variación (volumen y velocidad). */
export function audioFilter(spec: VariationSpec): string {
  const f = [`volume=${spec.profile.vo}`];
  const s = spec.speed && spec.speed !== 1 ? r3(spec.speed) : 0;
  if (s) f.push(`atempo=${s}`);
  return f.join(",");
}

/**
 * Argumentos de ffmpeg para una variación: `primary` con audio y `noAudio` como reintento
 * (videos sin pista de audio). Re-codifica con x264 y borra los metadatos del original.
 */
export function variationArgs(spec: VariationSpec): { primary: string[]; noAudio: string[] } {
  const input = spec.input ?? "in.mp4";
  const output = spec.output ?? "out.mp4";
  const vf = videoFilter(spec);
  const tail = ["-map_metadata", "-1", "-c:v", "libx264", "-preset", "veryfast", "-crf", String(spec.crf ?? 23), "-movflags", "+faststart", "-y", output];
  const audio = ["-af", audioFilter(spec), "-c:a", "aac", "-b:a", "128k"];
  if (spec.logoPath) {
    const pos = LOGO_POSITIONS[spec.logoPos ?? "tr"].expr;
    const fc = `[0:v]${vf}[bg];[1:v]scale=200:-1[wm];[bg][wm]overlay=${pos}[v]`;
    const inputs = ["-i", input, "-i", spec.logoPath, "-filter_complex", fc, "-map", "[v]"];
    return { primary: [...inputs, "-map", "0:a?", ...audio, ...tail], noAudio: [...inputs, "-an", ...tail] };
  }
  return {
    primary: ["-i", input, "-vf", vf, ...audio, ...tail],
    noAudio: ["-i", input, "-vf", vf, "-an", ...tail],
  };
}
