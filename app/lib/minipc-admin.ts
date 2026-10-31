// Lógica pura del listado de pedidos de la mini PC para el panel de admin.
// Se ejecuta directo con Node (strip-types): imports relativos con .ts, sin enum.

import type { EstadoPedido, PedidoFila } from './minipc-pedidos.ts'

/** Vista segura de un pedido: sin ids internos de otras tablas (user_id, sesión ni cliente de Stripe). */
export interface PedidoVista {
  id: string
  plan_id: string | null
  estado: EstadoPedido
  monto_usd: number
  moneda: string
  creado: string
  seguimiento: string | null
  nota_revision: string | null
  nombre: string
  direccion: string
  ciudad: string
  region: string
  pais: string
  telefono: string
  email: string
  stripe_payment_intent: string | null
}

export const PEDIDOS_POR_PAGINA = 100
const PAGINA_MAXIMA = 1_000_000

/** `pagina` de la URL: entero >= 0 y <= 10⁶; cualquier otra cosa vale 0. */
export function parsePagina(v: string | null): number {
  if (typeof v !== 'string') return 0
  const t = v.trim()
  if (!/^\d+$/.test(t)) return 0
  const n = Number(t)
  return n <= PAGINA_MAXIMA ? n : 0
}

function aVista(f: PedidoFila): PedidoVista {
  const e = f.envio
  const direccion = e ? [e.linea1, e.linea2].filter((x) => typeof x === 'string' && x.trim() !== '').join(', ') : ''
  return {
    id: f.id,
    plan_id: f.planId,
    estado: f.estado,
    monto_usd: f.montoCentavos / 100,
    moneda: f.moneda,
    creado: f.creado,
    seguimiento: f.seguimiento,
    nota_revision: f.notaRevision,
    nombre: e?.nombre ?? '',
    direccion,
    ciudad: e?.ciudad ?? '',
    region: e?.region ?? '',
    pais: e?.pais ?? '',
    telefono: f.telefono ?? '',
    email: f.email ?? '',
    stripe_payment_intent: f.stripePaymentIntent,
  }
}

/**
 * Recibe las filas pedidas con `limite + 1` y devuelve a lo más `limite` pedidos
 * (en el mismo orden) y si hay más. Un límite no válido (<= 0, NaN) devuelve vacío.
 */
export function paginaPedidos(filas: PedidoFila[], limite: number): { pedidos: PedidoVista[]; hay_mas: boolean } {
  if (!Number.isInteger(limite) || limite <= 0) return { pedidos: [], hay_mas: false }
  return { pedidos: filas.slice(0, limite).map(aVista), hay_mas: filas.length > limite }
}
