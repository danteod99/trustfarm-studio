// Cálculos puros del tiempo estimado de una generación (sin dependencias: lo usan el servidor y el navegador).

/** Tiempos válidos para estadística: descarta datos rotos o trabajos que quedaron colgados. */
const MIN_SEG = 1;
const MAX_SEG = 30 * 60;
/** Con menos muestras que esto no se confía en el promedio y se usa el valor por defecto. */
export const MIN_MUESTRAS = 3;

/**
 * Percentil 70 de los tiempos reales: un poco por encima de la mediana para que la barra
 * no prometa de menos (es mejor terminar antes de lo dicho que después).
 */
export function percentil70(segundos: number[]): number | null {
  const ok = segundos.filter((s) => Number.isFinite(s) && s >= MIN_SEG && s <= MAX_SEG).sort((a, b) => a - b);
  if (ok.length < MIN_MUESTRAS) return null;
  return Math.round(ok[Math.floor(0.7 * (ok.length - 1))]);
}

export interface Progreso {
  /** 0 a 1. */
  fraccion: number;
  /** Segundos que faltan según la estimación (0 si ya se pasó). */
  restante: number;
  /** Ya pasó el tiempo estimado y sigue en curso. */
  tarde: boolean;
}

/**
 * Avanza en línea recta hasta el 95 % en el tiempo estimado. Si tarda más, sigue
 * acercándose al 99 % sin llegar nunca: la barra solo se llena cuando el video está listo.
 */
export function progreso(transcurrido: number, estimado: number): Progreso {
  const eta = Math.max(1, estimado);
  const t = Math.max(0, transcurrido);
  if (t < eta) return { fraccion: (t / eta) * 0.95, restante: Math.ceil(eta - t), tarde: false };
  const extra = 1 - Math.exp(-(t - eta) / eta);
  return { fraccion: 0.95 + 0.04 * extra, restante: 0, tarde: true };
}

/** "~1 min 20 s", "~45 s", "unos segundos". */
export function textoRestante(seg: number): string {
  if (seg <= 10) return "unos segundos";
  if (seg < 60) return `~${Math.ceil(seg / 5) * 5} s`;
  // Trabajos largos (Multiclipping): minutos redondos y horas.
  if (seg >= 3600) {
    const totalMin = Math.round(seg / 300) * 5;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m ? `~${h} h ${m} min` : `~${h} h`;
  }
  if (seg >= 600) return `~${Math.round(seg / 60)} min`;
  const min = Math.floor(seg / 60);
  const s = Math.round((seg % 60) / 10) * 10;
  if (s === 60) return `~${min + 1} min`;
  return s ? `~${min} min ${s} s` : `~${min} min`;
}
