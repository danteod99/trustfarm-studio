// Precios de Anthropic y conversión a créditos. Es el ÚNICO lugar donde se cambian: las cajas no los conocen.
// Fuente: https://platform.claude.com/docs/en/about-claude/pricing (revisado el 2026-11-03).

export type ModeloIA = 'claude-haiku-5-5' | 'claude-sonnet-5-5'
export type UsoIA = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }

// Milésimas de microdólar por token (equivale a $/millón × 1000): enteros, para no acumular errores de redondeo.
type Tarifa = { entrada: number; salida: number; lectura: number; escritura: number }
const TARIFAS: Record<ModeloIA, Tarifa> = {
  'claude-haiku-5-5': { entrada: 100, salida: 500, lectura: 10, escritura: 125 },
  'claude-sonnet-5-5': { entrada: 2000, salida: 10000, lectura: 100, escritura: 2500 },
}
// Haiku 5.5 cobra toda la solicitud a esta tarifa si la entrada total pasa de 100,000 tokens
const HAIKU_LARGO: Tarifa = { entrada: 500, salida: 2500, lectura: 50, escritura: 625 }
const LIMITE_HAIKU = 100_000

// 2.5 veces el costo, contando 1 crédito = $0.10: 1 crédito cubre $0.04 de Anthropic
const MULTIPLO = 2.5
const USD_POR_CREDITO = 0.1

export function esModeloIA(v: unknown): v is ModeloIA {
  return typeof v === 'string' && Object.hasOwn(TARIFAS, v)
}

const fichas = (n: number | undefined) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)

/** Costo en microdólares, redondeado hacia arriba. */
export function costoMicroUsd(modelo: ModeloIA, u: UsoIA): number {
  const entrada = fichas(u.input_tokens)
  const lectura = fichas(u.cache_read_input_tokens)
  const escritura = fichas(u.cache_creation_input_tokens)
  const t = modelo === 'claude-haiku-5-5' && entrada + lectura + escritura > LIMITE_HAIKU ? HAIKU_LARGO : TARIFAS[modelo]
  const total = entrada * t.entrada + fichas(u.output_tokens) * t.salida + lectura * t.lectura + escritura * t.escritura
  return Math.ceil(total / 1000)
}

/** Millonésimas de crédito por ese costo, redondeadas hacia arriba. */
export function aMicrocreditos(microUsd: number): number {
  return Math.ceil((microUsd * MULTIPLO) / USD_POR_CREDITO)
}
