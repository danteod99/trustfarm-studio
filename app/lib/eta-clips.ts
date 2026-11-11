// Tiempo estimado de un trabajo de Multiclipping (cálculos puros: los usan el servidor y el navegador).
// Se aprende de los trabajos que ya terminaron: cuántos segundos tardó por cada segundo de video
// (o por cada MB, si no se sabe la duración), y se toma el percentil 70 para no prometer de menos.

export interface MuestraClip {
  /** Segundos desde que se creó el trabajo hasta que terminó. */
  seg: number;
  /** Duración del video original en segundos (si se conoce). */
  duracionSeg?: number | null;
  /** Peso del video original en bytes (si se conoce). */
  bytes?: number | null;
}

export interface RitmoClips {
  /** Segundos de proceso por cada segundo de video. */
  porSegVideo: number | null;
  /** Segundos de proceso por cada MB de video. */
  porMB: number | null;
}

const MB = 1048576;
/** Con menos trabajos que esto no se confía en el historial. */
const MIN_MUESTRAS = 3;
/** Trabajos válidos para estadística: descarta datos rotos o trabajos colgados. */
const MIN_TRABAJO_SEG = 20;
const MAX_TRABAJO_SEG = 8 * 3600;
/** Límites de lo que se le promete a la persona. */
const MIN_ETA = 120;
const MAX_ETA = 6 * 3600;
/** Sin historial: "un video de 30 min tarda entre 10 y 20 min" → la mitad de lo que dura, más 2 min. */
const DEFAULT_POR_SEG_VIDEO = 0.5;
const DEFAULT_FIJO = 120;
/** Sin historial ni duración: ~1 s por MB (un video de 30 min a 1080p pesa ~700 MB-1 GB). */
const DEFAULT_POR_MB = 1;
/** Sin ningún dato del video (link de YouTube que todavía no se descarga). */
const DEFAULT_SIN_DATOS = 15 * 60;

function p70(xs: number[]): number | null {
  const ok = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (ok.length < MIN_MUESTRAS) return null;
  return ok[Math.floor(0.7 * (ok.length - 1))];
}

/** Ritmo real de procesamiento según los últimos trabajos terminados. */
export function ritmoDe(muestras: MuestraClip[]): RitmoClips {
  const ok = muestras.filter((m) => Number.isFinite(m.seg) && m.seg >= MIN_TRABAJO_SEG && m.seg <= MAX_TRABAJO_SEG);
  return {
    porSegVideo: p70(ok.filter((m) => m.duracionSeg && m.duracionSeg >= 10).map((m) => m.seg / m.duracionSeg!)),
    porMB: p70(ok.filter((m) => m.bytes && m.bytes >= MB).map((m) => m.seg / (m.bytes! / MB))),
  };
}

const acotar = (s: number) => Math.round(Math.min(MAX_ETA, Math.max(MIN_ETA, s)));

/** Segundos estimados de principio a fin (cola + subida ya hecha + proceso) para un video. */
export function estimarClipSeg(ritmo: RitmoClips, video: { duracionSeg?: number | null; bytes?: number | null }): number {
  const dur = video.duracionSeg && video.duracionSeg > 0 ? video.duracionSeg : null;
  const mb = video.bytes && video.bytes > 0 ? video.bytes / MB : null;
  if (dur && ritmo.porSegVideo) return acotar(dur * ritmo.porSegVideo);
  if (mb && ritmo.porMB) return acotar(mb * ritmo.porMB);
  if (dur) return acotar(dur * DEFAULT_POR_SEG_VIDEO + DEFAULT_FIJO);
  if (mb) return acotar(mb * DEFAULT_POR_MB + DEFAULT_FIJO);
  return DEFAULT_SIN_DATOS;
}
