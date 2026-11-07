// Unir escenas de una historia en un solo MP4 (puro: solo arma argumentos de ffmpeg).
//
// Las escenas pueden venir de modelos distintos (Veo 720p/1080p con audio, Wan 480p sin audio),
// así que cada una se normaliza primero al mismo tamaño, cuadros por segundo y formato de audio,
// y después se pegan con el demuxer concat sin volver a codificar.

/** Cuadros por segundo de salida: el de Veo, para no re-temporizar las escenas más comunes. */
export const UNIR_FPS = 24;
/** Máximo de escenas por video (cada una son hasta 8 s). */
export const MAX_ESCENAS = 30;

/** Tamaño de salida: el de la primera escena, en números pares (H.264 lo exige). */
export function tamanoSalida(w: number, h: number): { w: number; h: number } {
  const par = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return { w: par(w || 720), h: par(h || 1280) };
}

/**
 * Normaliza una escena. Con `conAudio` usa la pista del video; sin audio (o si falló con audio)
 * le pone silencio de la misma duración, porque concat necesita que todas tengan audio.
 */
export function argsNormalizar(input: string, output: string, w: number, h: number, conAudio: boolean): string[] {
  const vf =
    `scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${UNIR_FPS},format=yuv420p`;
  const audioIn = conAudio ? [] : ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];
  const maps = conAudio ? ["-map", "0:v:0", "-map", "0:a:0"] : ["-map", "0:v:0", "-map", "1:a:0", "-shortest"];
  return [
    "-i", input,
    ...audioIn,
    ...maps,
    "-vf", vf,
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20",
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
    "-map_metadata", "-1",
    "-y", output,
  ];
}

/** Lista para el demuxer concat. */
export function listaConcat(nombres: string[]): string {
  return nombres.map((n) => `file '${n.replace(/'/g, "'\\''")}'`).join("\n") + "\n";
}

/** Pega las escenas ya normalizadas sin volver a codificar. */
export function argsConcat(lista: string, output: string): string[] {
  return ["-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", "-movflags", "+faststart", "-y", output];
}

/** Mueve el elemento `de` a la posición `a` (para reordenar la línea de tiempo). */
export function mover<T>(lista: T[], de: number, a: number): T[] {
  if (de === a || de < 0 || de >= lista.length) return lista;
  const copia = lista.slice();
  const [x] = copia.splice(de, 1);
  copia.splice(Math.max(0, Math.min(a, copia.length)), 0, x);
  return copia;
}
