// Cortes de tiempo (retomas y silencios) para el editor de cortos. Funciones puras.

export interface Range { start: number; end: number }

/** Duración total de las tomas, o null si alguna no se pudo leer (el navegador no la decodifica). */
export function duracionTotal(durs: number[]): number | null {
  if (!durs.length || durs.some((d) => !Number.isFinite(d) || d <= 0)) return null;
  return durs.reduce((a, d) => a + d, 0);
}

/** Complemento de los cortes = tramos a CONSERVAR (con un pequeño margen). */
export function keepSegments(cuts: Range[], duration: number, pad = 0.04): Range[] {
  const merged: Range[] = [];
  for (const c of [...cuts].sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && c.start <= last.end + 0.05) last.end = Math.max(last.end, c.end);
    else merged.push({ ...c });
  }
  const keep: Range[] = [];
  let cursor = 0;
  for (const c of merged) {
    const end = Math.min(duration, c.start + pad);
    if (end > cursor) keep.push({ start: cursor, end });
    cursor = Math.max(cursor, c.end - pad);
  }
  if (cursor < duration) keep.push({ start: cursor, end: duration });
  return keep.filter((k) => k.end - k.start > 0.1);
}

/** Tiempo del video ORIGINAL → tiempo en el video ya CORTADO (null si cae en un tramo eliminado). */
export function mapTime(t: number, keep: Range[]): number | null {
  let acc = 0;
  for (const k of keep) {
    if (t < k.start) return null;
    if (t <= k.end) return acc + (t - k.start);
    acc += k.end - k.start;
  }
  return acc;
}

/** Lee los rangos de silencio del log de `-af silencedetect`. */
export function parseSilences(logLines: string[], duration: number): Range[] {
  const cuts: Range[] = [];
  let start: number | null = null;
  for (const line of logLines) {
    const ms = line.match(/silence_start:\s*(-?[\d.]+)/);
    const me = line.match(/silence_end:\s*([\d.]+)/);
    if (ms) start = Math.max(0, parseFloat(ms[1]));
    else if (me && start !== null) { cuts.push({ start, end: parseFloat(me[1]) }); start = null; }
  }
  if (start !== null && duration > start) cuts.push({ start, end: duration }); // silencio final
  return cuts;
}

/** Expresión de `select`/`aselect` que conserva solo los tramos dados. */
export function selectExpr(keep: Range[]): string {
  return keep.map((k) => `between(t,${k.start.toFixed(3)},${k.end.toFixed(3)})`).join("+");
}
