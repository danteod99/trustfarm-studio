// Editor de cortos: lo ya pagado (transcripción y retomas) se guarda por tomas, así reintentar tras
// un fallo del render, que corre después del cobro, no vuelve a cobrar. Funciones puras.

import type { SubSegment, SubWord } from "./ass.ts";
import type { Range } from "./cuts.ts";

export interface TomaId { name: string; size: number; lastModified: number }
export interface Transcripcion { words: SubWord[]; segments: SubSegment[] }
export interface Retomas { cuts: Range[]; warning: string | null }
export interface CacheCortos { clave: string; transcripcion?: Transcripcion; retomas?: Retomas & { condense: boolean } }

/** El orden importa: con otras tomas o en otro orden, el audio y sus tiempos son otros. */
const claveDe = (tomas: TomaId[]) => JSON.stringify(tomas.map((t) => [t.name, t.size, t.lastModified]));

const deEstas = (cache: CacheCortos | null, tomas: TomaId[]) => (cache?.clave === claveDe(tomas) ? cache : null);

export function transcripcionGuardada(cache: CacheCortos | null, tomas: TomaId[]): Transcripcion | null {
  return deEstas(cache, tomas)?.transcripcion ?? null;
}

export function retomasGuardadas(cache: CacheCortos | null, tomas: TomaId[], condense: boolean): Retomas | null {
  const r = deEstas(cache, tomas)?.retomas;
  return r && r.condense === condense ? { cuts: r.cuts, warning: r.warning } : null;
}

export function guardarTranscripcion(cache: CacheCortos | null, tomas: TomaId[], t: Transcripcion): CacheCortos {
  return { ...(deEstas(cache, tomas) ?? { clave: claveDe(tomas) }), transcripcion: t };
}

/** Sin cobro (la IA falló y se devolvió, o no está activa) no se guarda: se puede volver a intentar. */
export function guardarRetomas(cache: CacheCortos | null, tomas: TomaId[], condense: boolean, r: Retomas & { cost: number }): CacheCortos | null {
  if (r.cost <= 0) return cache;
  return { ...(deEstas(cache, tomas) ?? { clave: claveDe(tomas) }), retomas: { cuts: r.cuts, warning: r.warning, condense } };
}

export function costoCortos(
  precios: { transcripcion: number; retomas: number },
  cache: CacheCortos | null,
  tomas: TomaId[],
  o: { cutRetakes: boolean; subsOn: boolean; condense: boolean }
): number {
  const transcribe = (o.cutRetakes || o.subsOn) && !transcripcionGuardada(cache, tomas);
  const retoma = o.cutRetakes && !retomasGuardadas(cache, tomas, o.condense);
  return (transcribe ? precios.transcripcion : 0) + (retoma ? precios.retomas : 0);
}
