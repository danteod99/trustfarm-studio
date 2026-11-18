// «Poner en pantalla real» de Variaciones únicas: mete cada versión dentro de una plantilla (laptop, PC/monitor,
// TV, celular, tablet) en el navegador con ffmpeg.wasm. Funciones puras (sin DOM ni ffmpeg): se prueban con node --test.
//
// La matemática de `filterGraph` es un port 1:1 de `filter_graph` de danteod99/trustclip (engine/perfil.py), el mismo
// que usa Perfil de TikTok en el servidor. Si allá cambia, hay que volver a copiar el manifest y re-portar (ver
// public/plantillas-pantalla/README.md). tests/pantalla-real.test.ts lo compara con salidas reales del Python.

import { DISPOSITIVOS, esDispositivo, etiquetaPlantilla, type Dispositivo } from "./variacion.ts";

export const PLANTILLAS_BASE = "/plantillas-pantalla";
export const OUT_W = 1080;
export const OUT_H = 1920;
export const FPS = 24;
export const DEFAULT_FILL = 0.8;
/** Barrido de luz sobre la pantalla (trustclip: LIGHT_SWEEP). Entrada 2 del grafo. */
export const LIGHT_SWEEP =
  "nullsrc=s=90x160:r=24,geq=lum='128+16*sin(2*PI*T/8+X/22)+11*sin(2*PI*T/5.3-Y/35)+5*sin(2*PI*T*1.7)':cb=128:cr=128";

export interface Plantilla {
  id: string;
  kind: Dispositivo;
  plate: string;
  plateSize: [number, number];
  /** TL TR BL BR como x0,y0,x1,y1,x2,y2,x3,y3 */
  quad: number[];
}

/** Filtro de dispositivo de la UI: «cualquiera» o un tipo del manifest. */
export type FiltroDispositivo = "cualquiera" | Dispositivo;
export const FILTROS_DISPOSITIVO: { id: FiltroDispositivo; texto: string }[] = [
  { id: "cualquiera", texto: "Cualquiera" },
  { id: "laptop", texto: "Laptop" },
  { id: "monitor", texto: "PC / monitor" },
  { id: "tv", texto: "TV" },
  { id: "movil", texto: "Celular" },
  { id: "tablet", texto: "Tablet" },
];

// ───────── Redondeos que replican a Python ─────────
/** round() de Python: mitades al par (Math.round las manda hacia arriba). */
export function roundPy(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}
/** f"{x:.{d}f}" de Python (mitades exactas al par). */
export function fmt(x: number, d: number): string {
  const p = 10 ** d;
  const s = x * p;
  if (Math.abs(s % 1) === 0.5) {
    const lo = Math.floor(s);
    return ((lo % 2 === 0 ? lo : lo + 1) / p).toFixed(d);
  }
  return x.toFixed(d);
}
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const even = (v: number) => Math.max(2, roundPy(v / 2) * 2);

/** ¿Las 4 esquinas caen dentro de la placa? (trustclip: quad_is_sane) */
export function quadValido(quad: number[], w: number, h: number): boolean {
  if (!Array.isArray(quad) || quad.length !== 8 || quad.some((n) => typeof n !== "number" || !Number.isFinite(n))) return false;
  const pts = [0, 1, 2, 3].map((i) => [quad[2 * i], quad[2 * i + 1]]);
  return pts.every(([x, y]) => x >= 0 && x <= w && y >= 0 && y <= h) && w > 0 && h > 0 && dist(pts[0], pts[1]) > 8;
}

/** Grafo -filter_complex. Entradas: 0 = video, 1 = placa (en bucle), 2 = barrido de luz. Port de `filter_graph`. */
export function filterGraph(quad: number[], plateW: number, plateH: number, outW = OUT_W, outH = OUT_H, fill = DEFAULT_FILL): string {
  const q = [0, 1, 2, 3].map((i) => [quad[2 * i], quad[2 * i + 1]]); // TL TR BL BR
  const cw = outW, ch = outH;
  const sh = (dist(q[0], q[2]) + dist(q[1], q[3])) / 2;
  const cx = q.reduce((a, p) => a + p[0], 0) / 4;
  const cy = q.reduce((a, p) => a + p[1], 0) / 4;
  const chei = sh / fill;
  const cwid = (chei * cw) / ch;
  const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
  const bx0 = Math.min(...xs) - 12, bx1 = Math.max(...xs) + 12;
  const by0 = Math.min(...ys) - 12, by1 = Math.max(...ys) + 12;
  const rx0 = Math.min(cx - cwid / 2, bx0), rx1 = Math.max(cx + cwid / 2, bx1);
  const ry0 = Math.min(cy - chei / 2, by0), ry1 = Math.max(cy + chei / 2, by1);
  const rx0c = Math.max(rx0, 0), ry0c = Math.max(ry0, 0);
  const rx1c = Math.min(rx1, plateW), ry1c = Math.min(ry1, plateH);
  const zf = ch / chei;
  const fw = even((rx1c - rx0c) * zf), fh = even((ry1c - ry0c) * zf);
  const sx = fw / (rx1c - rx0c), sy = fh / (ry1c - ry0c);
  const qw = q.map(([x, y]) => [(x - rx0c) * sx, (y - ry0c) * sy]);
  const cxw = (cx - rx0c) * sx, cyw = (cy - ry0c) * sy;
  const e = qw.map(([x, y]) => [x + (x > cxw ? 7 * sx : -7 * sx), y + (y > cyw ? 7 * sy : -7 * sy)]);
  const qwid = (dist(qw[0], qw[1]) + dist(qw[2], qw[3])) / 2;
  const qhei = (dist(qw[0], qw[2]) + dist(qw[1], qw[3])) / 2;
  const k = ((cw / ch) * qhei) / qwid;
  const [fx, fy] = k > 1 ? [1, 1 / k] : [k, 1];
  const tw = even(fw * fx * 0.97), th = even(fh * fy * 0.97);
  const fx0 = (cx - cwid / 2 - rx0c) * sx, fy0 = (cy - chei / 2 - ry0c) * sy;
  const winW = cwid * sx, winH = chei * sy;
  const p2 = (n: number) => fmt(n, 2);
  return (
    `[1:v]crop=${p2(rx1c - rx0c)}:${p2(ry1c - ry0c)}:${p2(rx0c)}:${p2(ry0c)},fps=${FPS},split=2[a][b];` +
    `[a]scale=${fw}:${fh}:flags=lanczos,format=yuv420p[fa0];` +
    `[2:v]scale=${fw}:${fh}:flags=bicubic,format=yuv420p[lg];` +
    `[fa0][lg]blend=all_mode=overlay:all_opacity=0.55,format=yuv420p[fa];` +
    `[b]format=yuva420p,chromakey=color=0x00ff00:similarity=0.12:blend=0.03,alphaextract,erosion,erosion,erosion,erosion,format=gray,scale=${fw}:${fh}:flags=bicubic[mk];` +
    `[0:v]crop='min(iw,ih*${outW}/${outH})':'min(ih,iw*${outH}/${outW})',setsar=1,fps=${FPS},scale=${tw}:${th}:flags=lanczos,` +
    `pad=${fw}:${fh}:(ow-iw)/2:(oh-ih)/2:0x0b0b0d,format=yuv420p,` +
    `perspective=x0=${p2(e[0][0])}:y0=${p2(e[0][1])}:x1=${p2(e[1][0])}:y1=${p2(e[1][1])}:x2=${p2(e[2][0])}:y2=${p2(e[2][1])}:x3=${p2(e[3][0])}:y3=${p2(e[3][1])}:sense=destination:interpolation=cubic[pantalla];` +
    `[fa][mk]alphamerge[laptop];[pantalla][laptop]overlay=0:0:shortest=1:format=auto,format=yuv420p,` +
    `crop=${fmt(winW, 0)}:${fmt(winH, 0)}:${fmt(Math.max(fx0, 0), 0)}:${fmt(Math.max(fy0, 0), 0)},scale=${outW}:${outH}:flags=lanczos[v]`
  );
}

export interface ArgsComposicion {
  /** Video de entrada en el FS de ffmpeg (la versión ya con color/volumen distintos). */
  input: string;
  /** Placa PNG en el FS de ffmpeg. */
  plate: string;
  output: string;
  graph: string;
  /** Tope de duración en segundos: las fuentes de bucle y lavfi son infinitas. */
  duracion?: number;
}

/** Argumentos ffmpeg de la composición (mismo esquema que `ffmpeg_args` de trustclip; `-t` como tope de seguridad). */
export function ffmpegArgs(a: ArgsComposicion): string[] {
  return [
    "-i", a.input, "-loop", "1", "-framerate", String(FPS), "-i", a.plate,
    "-f", "lavfi", "-i", LIGHT_SWEEP, "-filter_complex", a.graph,
    "-map", "[v]", "-map", "0:a?", "-shortest",
    ...(a.duracion && a.duracion > 0 ? ["-t", (a.duracion + 0.1).toFixed(2)] : []),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-y", a.output,
  ];
}

// ───────── Manifest y elección de plantillas ─────────
/** Valida el JSON del manifest: descarta plantillas incompletas o con esquinas fuera de la placa. */
export function leerManifest(json: unknown): Plantilla[] {
  const lista = (json as { templates?: unknown })?.templates;
  if (!Array.isArray(lista)) return [];
  const out: Plantilla[] = [];
  for (const t of lista as Record<string, unknown>[]) {
    const size = t.plateSize as number[] | undefined;
    if (typeof t.id !== "string" || !/^[a-z0-9_]+$/.test(t.id) || !esDispositivo(t.kind) || typeof t.plate !== "string" || !/^[a-z0-9_]+\.png$/.test(t.plate)) continue;
    if (!Array.isArray(size) || size.length !== 2 || !quadValido(t.quad as number[], size[0], size[1])) continue;
    out.push({ id: t.id, kind: t.kind, plate: t.plate, plateSize: [size[0], size[1]], quad: t.quad as number[] });
  }
  return out;
}

/** Plantillas permitidas por el filtro, ordenadas por id (igual que `elegir_plantillas` de trustclip). */
export function plantillasPermitidas(todas: Plantilla[], filtro: FiltroDispositivo = "cualquiera"): Plantilla[] {
  const kind = (DISPOSITIVOS as readonly string[]).includes(filtro) ? filtro : null;
  return todas.filter((t) => !kind || t.kind === kind).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Plantilla de la versión `indice` (0-based) del video nº `video` (0-based): rotación determinista que además
 * desplaza el arranque por video, para que el video 2 no repita siempre la misma plantilla que el 1.
 */
export function plantillaParaVersion(permitidas: Plantilla[], video: number, indice: number): Plantilla | null {
  if (!permitidas.length) return null;
  const n = permitidas.length;
  return permitidas[(((video * 7 + indice) % n) + n) % n];
}

/** Nombre del archivo de salida: «base_v3_laptop-cuarto.mp4» (sin caracteres raros). */
export function nombreSalida(base: string, version: number, plantilla: Plantilla | null): string {
  return `${base}_v${version}${plantilla ? `_${plantilla.id.replace(/_/g, "-")}` : ""}.mp4`;
}

/** Etiqueta legible de una plantilla («Laptop · cuarto»; el monitor se muestra como «PC / monitor»). */
export function etiquetaPlantillaUi(p: Plantilla): string {
  return p.kind === "monitor" ? `PC / monitor${p.id.includes("_") ? ` · ${p.id.split("_").slice(1).join(" ")}` : ""}` : etiquetaPlantilla(p.id);
}

export type ValidacionPantalla = { ok: true } | { ok: false; error: string };
/** Valida la elección antes de empezar: debe haber al menos una plantilla para el dispositivo. */
export function validarPantalla(activo: boolean, todas: Plantilla[], filtro: FiltroDispositivo): ValidacionPantalla {
  if (!activo) return { ok: true };
  if (!todas.length) return { ok: false, error: "No se pudieron cargar las plantillas de pantalla. Recarga la página e inténtalo otra vez." };
  if (!plantillasPermitidas(todas, filtro).length) return { ok: false, error: "No hay plantillas para ese dispositivo. Elige otro o «Cualquiera»." };
  return { ok: true };
}

export const urlPlaca = (p: Plantilla) => `${PLANTILLAS_BASE}/${p.plate}`;
export const urlMiniatura = (p: Plantilla) => `${PLANTILLAS_BASE}/miniaturas/${p.id}.jpg`;
