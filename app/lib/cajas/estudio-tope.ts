// Tope diario de créditos que una caja puede gastar en el Estudio. Lógica pura (sin base de datos).

export const TOPE_DIARIO_POR_DEFECTO = 100

// Lima es UTC-5 todo el año (sin horario de verano): la medianoche local son las 05:00 UTC.
const DESFASE_LIMA_MS = 5 * 3600_000
const DIA_MS = 24 * 3600_000

/** Medianoche (00:00 hora de Lima) del día en que cae `ahora`, como instante UTC. */
export function inicioDiaLima(ahora: Date): Date {
  const local = ahora.getTime() - DESFASE_LIMA_MS
  const inicioLocal = Math.floor(local / DIA_MS) * DIA_MS
  return new Date(inicioLocal + DESFASE_LIMA_MS)
}

export function evaluarTope(a: { gastado: number; costo: number; tope: number }): { ok: true } | { ok: false; error: string } {
  if (a.gastado + a.costo <= a.tope) return { ok: true }
  return { ok: false, error: `Llegaste al límite de hoy (${a.tope} créditos por caja). Se reinicia a medianoche.` }
}
