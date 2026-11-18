// Mete un video dentro de una plantilla de pantalla real (laptop, PC/monitor, TV, celular, tablet) con ffmpeg.wasm.
// Solo cliente. La matemática vive en app/lib/pantalla-real.ts (pura y con tests).
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { readBlob, safeDelete, writeInput } from "./engine.ts";
import { getVideoInfo } from "./media.ts";
import {
  PLANTILLAS_BASE, ffmpegArgs, filterGraph, leerManifest, quadValido, urlPlaca,
  type Plantilla,
} from "../pantalla-real.ts";

let manifest: Promise<Plantilla[]> | null = null;
/** Lee el manifest de plantillas (una vez por pestaña). Lista vacía si falla (la UI lo avisa). */
export function cargarPlantillas(): Promise<Plantilla[]> {
  if (!manifest) {
    manifest = fetch(`${PLANTILLAS_BASE}/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => leerManifest(j))
      .catch(() => []);
    manifest.then((l) => { if (!l.length) manifest = null; });
  }
  return manifest;
}

const placas = new Map<string, Uint8Array>();
/** Descarga la placa PNG de una plantilla (solo cuando se usa; ~1 MB) y la guarda en memoria. */
async function placaPng(p: Plantilla): Promise<Uint8Array> {
  const hit = placas.get(p.id);
  if (hit) return hit;
  const res = await fetch(urlPlaca(p));
  if (!res.ok) throw new Error(`No se pudo cargar la plantilla ${p.id}.`);
  const data = new Uint8Array(await res.arrayBuffer());
  placas.set(p.id, data);
  return data;
}

/** Compone `video` (la versión ya hecha) dentro de la plantilla y devuelve el MP4 1080x1920. */
export async function componerEnPantalla(ffmpeg: FFmpeg, video: Blob, p: Plantilla): Promise<Blob> {
  if (!quadValido(p.quad, p.plateSize[0], p.plateSize[1])) throw new Error(`La plantilla ${p.id} tiene las esquinas mal.`);
  const [placa, info] = await Promise.all([placaPng(p), getVideoInfo(video)]);
  await writeInput(ffmpeg, "pant_in.mp4", video);
  await writeInput(ffmpeg, "pant_placa.png", placa);
  try {
    const args = ffmpegArgs({
      input: "pant_in.mp4", plate: "pant_placa.png", output: "pant_out.mp4",
      graph: filterGraph(p.quad, p.plateSize[0], p.plateSize[1]),
      // Las fuentes de bucle y de luz son infinitas: tope = duración del video (el duration del navegador puede venir en 0).
      duracion: info.dur > 0 ? info.dur : undefined,
    });
    const code = await ffmpeg.exec(args);
    if (code !== 0) throw new Error(`ffmpeg no pudo poner el video en la plantilla ${p.id}.`);
    return await readBlob(ffmpeg, "pant_out.mp4");
  } finally {
    await safeDelete(ffmpeg, "pant_in.mp4", "pant_placa.png", "pant_out.mp4");
  }
}
