"use client";

// Motor ffmpeg.wasm del navegador (self-hosted en /public/ffmpeg). Una sola instancia por pestaña.
// Usa el core de un hilo. El multihilo (core-mt) está apagado (MULTIHILO): carga, pero ffmpeg se
// queda colgado en cuanto hay dos entradas o una pista de audio (probado en Chrome, 04-11-2026).

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { FONTS_DIR } from "./ass.ts";
import { variationArgs, type VariationSpec } from "./profiles.ts";

export interface Engine {
  ffmpeg: FFmpeg;
  /** true si cargó el core multihilo. */
  multiThread: boolean;
}

type StatusFn = (msg: string) => void;

let loading: Promise<Engine> | null = null;
let engine: Engine | null = null;
const progressListeners = new Set<(ratio: number) => void>();
let logSink: string[] | null = null;

const LOAD_TIMEOUT_MS = 45_000;
/** Multihilo apagado: core-mt se cuelga con audio. Requiere además COOP/COEP en la página. */
const MULTIHILO = false;
/** Cambiarlo cuando cambien los archivos o headers de /public/ffmpeg (rompe la caché del navegador). */
const VERSION = "?v=0.12.10-1";
const MT_TIMEOUT_MS = 20_000;

/** Descarga el .wasm mostrando el % (luego load() lo toma de la caché del navegador). */
async function prefetch(url: string, onStatus?: StatusFn) {
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) return;
    const total = parseInt(res.headers.get("content-length") || "0", 10);
    const reader = res.body.getReader();
    let recv = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      recv += value?.length || 0;
      const mb = (recv / 1048576).toFixed(0);
      onStatus?.(total
        ? `Descargando motor de video ${Math.min(100, Math.round((recv / total) * 100))}% (${mb}/${(total / 1048576).toFixed(0)} MB)`
        : `Descargando motor de video ${mb} MB…`);
    }
  } catch {
    /* si falla, load() lo vuelve a intentar */
  }
}

async function tryLoad(base: string, multi: boolean, timeoutMs: number, onStatus?: StatusFn): Promise<FFmpeg> {
  const origin = window.location.origin;
  // Se importa la copia self-hosted (/ffmpeg/esm) en tiempo de ejecución: el bundler no puede
  // empaquetar el `new Worker(new URL(...))` dinámico de @ffmpeg/ffmpeg (el paquete npm solo
  // aporta los tipos).
  const esm = `${origin}/ffmpeg/esm/index.js${VERSION}`;
  const { FFmpeg: FFmpegClass } = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ esm)) as typeof import("@ffmpeg/ffmpeg");
  const ffmpeg = new FFmpegClass();
  ffmpeg.on("progress", ({ progress }) => {
    const r = Math.max(0, Math.min(1, progress));
    progressListeners.forEach((fn) => fn(r));
  });
  ffmpeg.on("log", ({ message }) => { logSink?.push(message); });
  await prefetch(`${origin}${base}/ffmpeg-core.wasm${VERSION}`, onStatus);
  onStatus?.("Iniciando el motor de video…");
  const cfg: Record<string, string> = {
    // URL real (no blob) para que el worker resuelva sus imports relativos.
    classWorkerURL: `${origin}/ffmpeg/esm/worker.js${VERSION}`,
    coreURL: `${origin}${base}/ffmpeg-core.js${VERSION}`,
    wasmURL: `${origin}${base}/ffmpeg-core.wasm${VERSION}`,
  };
  if (multi) cfg.workerURL = `${origin}${base}/ffmpeg-core.worker.js${VERSION}`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      ffmpeg.load(cfg),
      new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error("el motor no respondió a tiempo")), timeoutMs); }),
    ]);
  } catch (e) {
    try { ffmpeg.terminate(); } catch { /* noop */ }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  return ffmpeg;
}

/** ¿Se puede usar el core multihilo en esta página? */
export function canMultiThread(): boolean {
  return MULTIHILO && typeof window !== "undefined" && window.crossOriginIsolated === true && typeof SharedArrayBuffer !== "undefined";
}

/** Carga (una vez) y devuelve el motor. `onStatus` recibe mensajes para mostrar al usuario. */
export function loadEngine(onStatus?: StatusFn): Promise<Engine> {
  if (engine) return Promise.resolve(engine);
  if (loading) return loading;
  loading = (async () => {
    try {
      if (canMultiThread()) {
        try {
          const ffmpeg = await tryLoad("/ffmpeg/core-mt", true, MT_TIMEOUT_MS, onStatus);
          engine = { ffmpeg, multiThread: true };
          return engine;
        } catch (e) {
          console.warn("[video] multihilo no disponible, uso un hilo:", e);
        }
      }
      const ffmpeg = await tryLoad("/ffmpeg/core", false, LOAD_TIMEOUT_MS, onStatus);
      engine = { ffmpeg, multiThread: false };
      return engine;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`No se pudo cargar el motor de video (${msg}). Prueba en Chrome o Edge actualizado.`);
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Descarta el motor (p. ej. tras un error grave); el próximo loadEngine() lo vuelve a crear. */
export function resetEngine() {
  try { engine?.ffmpeg.terminate(); } catch { /* noop */ }
  engine = null;
}

/** Se suscribe al avance (0–1) del exec en curso. Devuelve la función para desuscribirse. */
export function onProgress(fn: (ratio: number) => void): () => void {
  progressListeners.add(fn);
  return () => progressListeners.delete(fn);
}

/** Corre ffmpeg y devuelve el código de salida y las líneas del log de esa ejecución. */
export async function execLogged(ffmpeg: FFmpeg, args: string[]): Promise<{ code: number; logs: string[] }> {
  const logs: string[] = [];
  logSink = logs;
  try {
    const code = await ffmpeg.exec(args);
    return { code, logs };
  } finally {
    logSink = null;
  }
}

export async function writeInput(ffmpeg: FFmpeg, name: string, src: Blob | Uint8Array | string) {
  const data = typeof src === "string" ? new TextEncoder().encode(src)
    : src instanceof Uint8Array ? src : new Uint8Array(await src.arrayBuffer());
  await ffmpeg.writeFile(name, data);
}

/** Lee un archivo del FS de ffmpeg como Blob (copiado fuera del heap wasm). */
export async function readBlob(ffmpeg: FFmpeg, name: string, mime = "video/mp4"): Promise<Blob> {
  const data = (await ffmpeg.readFile(name)) as Uint8Array;
  return new Blob([new Uint8Array(data).buffer as ArrayBuffer], { type: mime });
}

export async function safeDelete(ffmpeg: FFmpeg, ...names: string[]) {
  for (const n of names) { try { await ffmpeg.deleteFile(n); } catch { /* no existe */ } }
}

let fontMounted: FFmpeg | null = null;
/** Deja la fuente Anton en /customfonts para los filtros `ass` (una vez por motor). */
export async function mountFont(ffmpeg: FFmpeg) {
  if (fontMounted === ffmpeg) return;
  const buf = new Uint8Array(await (await fetch("/fonts/Anton-Regular.ttf")).arrayBuffer());
  try { await ffmpeg.createDir(FONTS_DIR); } catch { /* ya existe */ }
  await ffmpeg.writeFile(`${FONTS_DIR}/Anton-Regular.ttf`, buf);
  fontMounted = ffmpeg;
}

/** Audio mono 16 kHz en MP3 (para transcribir). */
export async function extractAudioMp3(ffmpeg: FFmpeg, input = "in.mp4"): Promise<Blob | null> {
  const code = await ffmpeg.exec(["-i", input, "-vn", "-ar", "16000", "-ac", "1", "-b:a", "64k", "-y", "audio.mp3"]);
  if (code !== 0) return null;
  const blob = await readBlob(ffmpeg, "audio.mp3", "audio/mpeg");
  await safeDelete(ffmpeg, "audio.mp3");
  return blob;
}

/**
 * Renderiza una variación (ver profiles.variationArgs) y devuelve el MP4.
 * Si el video no tiene audio, reintenta sin pista de audio. Lanza si ffmpeg falla.
 */
export async function renderVariation(ffmpeg: FFmpeg, spec: VariationSpec): Promise<Blob> {
  const { primary, noAudio } = variationArgs(spec);
  let code = await ffmpeg.exec(primary);
  if (code !== 0) code = await ffmpeg.exec(noAudio);
  if (code !== 0) throw new Error("ffmpeg no pudo renderizar la variación");
  const out = spec.output ?? "out.mp4";
  const blob = await readBlob(ffmpeg, out);
  await safeDelete(ffmpeg, out);
  return blob;
}
