// Une varios videos en uno solo dentro del navegador (ffmpeg.wasm). Lo usan /editar/unir y la Galería.
// Solo cliente.
import { execLogged, loadEngine, onProgress, readBlob, safeDelete, writeInput } from "./engine.ts";
import { fetchAsFile, getVideoInfo } from "./media.ts";
import { argsConcat, argsNormalizar, listaConcat, tamanoSalida } from "./unir.ts";

export interface AvisosUnir {
  /** Texto de la etapa actual ("Descargando escena 2 de 4…"). */
  onStatus: (s: string) => void;
  /** Avance 0–1 de la etapa actual. */
  onPct: (r: number) => void;
}

/**
 * Descarga cada video, los lleva al tamaño del primero (bandas negras si el formato difiere),
 * les pone silencio a los que no traen audio y los pega en el orden recibido. Devuelve el MP4.
 */
export async function unirVideos(urls: string[], { onStatus, onPct }: AvisosUnir): Promise<Blob> {
  if (urls.length < 2) throw new Error("Elige al menos 2 videos.");
  const off = onProgress(onPct);
  let ffmpeg: Awaited<ReturnType<typeof loadEngine>>["ffmpeg"] | null = null;
  const nombres: string[] = [];
  try {
    ffmpeg = (await loadEngine(onStatus)).ffmpeg;
    // El tamaño del primer video manda; los demás se ajustan con bandas negras si difieren.
    const first = await getVideoInfo(urls[0]);
    const { w, h } = tamanoSalida(first.w, first.h);
    for (const [i, url] of urls.entries()) {
      onStatus(`Descargando video ${i + 1} de ${urls.length}…`);
      onPct(0);
      const file = await fetchAsFile(url, `e${i}.mp4`, onPct);
      await writeInput(ffmpeg, "in.mp4", file);
      onStatus(`Preparando video ${i + 1} de ${urls.length}…`);
      onPct(0);
      const out = `n${i}.mp4`;
      // Primero con su audio; si no tiene (p. ej. Wan), con silencio.
      let { code } = await execLogged(ffmpeg, argsNormalizar("in.mp4", out, w, h, true));
      if (code !== 0) ({ code } = await execLogged(ffmpeg, argsNormalizar("in.mp4", out, w, h, false)));
      await safeDelete(ffmpeg, "in.mp4");
      if (code !== 0) throw new Error(`No se pudo preparar el video ${i + 1}.`);
      nombres.push(out);
    }
    onStatus("Uniendo videos…");
    await writeInput(ffmpeg, "lista.txt", listaConcat(nombres));
    const { code } = await execLogged(ffmpeg, argsConcat("lista.txt", "historia.mp4"));
    if (code !== 0) throw new Error("No se pudieron unir los videos.");
    return await readBlob(ffmpeg, "historia.mp4");
  } finally {
    off();
    if (ffmpeg) await safeDelete(ffmpeg, ...nombres, "lista.txt", "historia.mp4", "in.mp4");
  }
}
