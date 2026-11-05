// Lógica pura del pedido de la mini PC (TRUST Assistant).
// Se ejecuta directo con Node (strip-types): imports relativos con .ts, sin enum.
// No importa `stripe`: usa tipos mínimos propios.

import { getPlan, precioCentavos, reservaCentavos, PAISES_ENVIO } from './minipc.ts'

export type EstadoPedido = 'pagado' | 'revisar' | 'enviado' | 'entregado' | 'reembolsado' | 'cancelado'

export interface Envio {
  nombre: string
  linea1: string
  linea2: string | null
  ciudad: string
  region: string
  codigoPostal: string
  pais: string
}

export interface NuevoPedido {
  userId: string | null
  planId: string | null
  stripeSessionId: string
  stripePaymentIntent: string | null
  stripeCustomer: string | null
  montoCentavos: number
  moneda: string
  estado: 'pagado' | 'revisar'
  envio: Envio | null
  telefono: string | null
  email: string | null
  notaRevision: string | null
}

export type PedidoFila = Omit<NuevoPedido, 'estado'> & {
  id: string
  estado: EstadoPedido
  seguimiento: string | null
  creado: string
  enviadoEn: string | null
  entregadoEn: string | null
}

export interface PedidosStore {
  guardarSiNoExiste(p: NuevoPedido): Promise<'creado' | 'duplicado'>
  obtener(id: string): Promise<PedidoFila | null>
  /** Condicional: update ... where id = ? and estado = estadoEsperado. true si afectó una fila. */
  actualizarEstado(
    id: string,
    patch: { estado: EstadoPedido; seguimiento?: string | null; enviadoEn?: string | null; entregadoEn?: string | null },
    estadoEsperado: EstadoPedido,
  ): Promise<boolean>
  listar(desde: number, limite: number): Promise<PedidoFila[]>
}

export type DireccionStripe = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}

export interface SesionMinipc {
  id: string
  payment_status: string
  amount_total: number | null
  currency: string | null
  payment_intent?: string | { id: string } | null
  customer?: string | { id: string } | null
  client_reference_id?: string | null
  metadata?: Record<string, string> | null
  customer_details?: {
    email?: string | null
    name?: string | null
    phone?: string | null
    address?: DireccionStripe | null
  } | null
  collected_information?: { shipping_details?: { name?: string | null; address?: DireccionStripe | null } | null } | null
  shipping_details?: { name?: string | null; address?: DireccionStripe | null } | null
}

export function esSesionMinipc(s: { metadata?: Record<string, string> | null }): boolean {
  return s?.metadata?.kind === 'minipc'
}

/** Decide a qué rama va una sesión del webhook. Solo `metadata.kind === 'minipc'` exacto es mini PC. */
export function decidirRama(s: { metadata?: Record<string, string> | null }): 'minipc' | 'creditos' {
  return esSesionMinipc(s) ? 'minipc' : 'creditos'
}

export function extraerEnvio(s: SesionMinipc): Envio | null {
  // stripe 18.5.0 trae el envío en collected_information.shipping_details;
  // versiones anteriores del API lo traen en shipping_details.
  const sd = s.collected_information?.shipping_details ?? s.shipping_details ?? null
  if (!sd || !sd.address) return null
  const a = sd.address
  return {
    nombre: sd.name || s.customer_details?.name || '',
    linea1: (a.line1 ?? '').trim(),
    linea2: a.line2 ? a.line2 : null,
    ciudad: a.city ?? '',
    region: a.state ?? '',
    codigoPostal: a.postal_code ?? '',
    pais: (a.country ?? '').trim().toUpperCase(),
  }
}

function idDe(v: string | { id: string } | null | undefined): string | null {
  if (typeof v === 'string') return v || null
  if (v && typeof v === 'object' && typeof v.id === 'string') return v.id || null
  return null
}

export async function procesarSesionMinipc(
  deps: { store: PedidosStore; log: (linea: string) => void },
  s: SesionMinipc,
): Promise<{ resultado: 'creado' | 'duplicado' | 'revisar' | 'pendiente'; motivo?: string }> {
  if (s.payment_status !== 'paid') return { resultado: 'pendiente', motivo: 'El pago aún no está completo.' }

  const motivos: string[] = []
  const plan = getPlan(s.metadata?.plan_id)
  const userId = s.metadata?.user_id || s.client_reference_id || null
  const envio = extraerEnvio(s)
  const telefono = s.customer_details?.phone?.trim() || null
  const email = s.customer_details?.email ? s.customer_details.email : null
  const montoCentavos = s.amount_total ?? 0
  const monedaRaw = typeof s.currency === 'string' && s.currency ? s.currency.toLowerCase() : null

  if (!plan) motivos.push('plan desconocido')
  else if (!plan.activo) motivos.push('plan inactivo')
  // Las reservas cobran solo RESERVA_USD; las compras completas, el precio del plan.
  const esperado = plan ? (s.metadata?.tipo === 'reserva' ? reservaCentavos() : precioCentavos(plan)) : null
  if (esperado !== null && s.amount_total !== esperado) {
    motivos.push(`monto distinto al esperado (${s.amount_total ?? 'sin monto'} vs ${esperado})`)
  }
  if (!userId) motivos.push('sin usuario')
  if (monedaRaw !== 'usd') motivos.push(`moneda inesperada (${monedaRaw ?? 'ausente'})`)
  if (!envio || !envio.linea1) motivos.push('sin dirección de envío')
  else if (!PAISES_ENVIO.includes(envio.pais)) motivos.push(`país de envío no permitido (${envio.pais || 'vacío'})`)
  if (!telefono) motivos.push('sin teléfono')

  const revisar = motivos.length > 0
  const nota = revisar ? motivos.join('; ') : null

  const res = await deps.store.guardarSiNoExiste({
    userId,
    planId: plan ? plan.id : null,
    stripeSessionId: s.id,
    stripePaymentIntent: idDe(s.payment_intent),
    stripeCustomer: idDe(s.customer),
    montoCentavos,
    moneda: monedaRaw ?? 'usd',
    estado: revisar ? 'revisar' : 'pagado',
    envio,
    telefono,
    email,
    notaRevision: nota,
  })

  if (res === 'duplicado') return { resultado: 'duplicado' }
  if (revisar) {
    deps.log(`minipc: pedido de la sesión ${s.id} guardado para revisar: ${nota}`)
    return { resultado: 'revisar', motivo: nota ?? undefined }
  }
  return { resultado: 'creado' }
}

const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  pagado: ['enviado', 'cancelado', 'reembolsado'],
  revisar: ['pagado', 'enviado', 'cancelado', 'reembolsado'],
  enviado: ['entregado', 'reembolsado'],
  entregado: ['reembolsado'],
  cancelado: [],
  reembolsado: [],
}

export function validarCambioEstado(actual: EstadoPedido, nuevo: EstadoPedido): boolean {
  const permitidos = TRANSICIONES[actual]
  return Array.isArray(permitidos) && permitidos.includes(nuevo)
}

const CONTROL_Y_BIDI = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g

export async function cambiarEstadoPedido(
  deps: { store: PedidosStore; ahora: () => Date },
  o: { id: string; estado: EstadoPedido; seguimiento?: string | null },
): Promise<{ ok: true } | { ok: false; status: 400 | 404 | 409; error: string }> {
  let seguimiento: string | undefined
  if (o.seguimiento !== undefined && o.seguimiento !== null) {
    if (typeof o.seguimiento !== 'string') {
      return { ok: false, status: 400, error: 'El seguimiento no es válido.' }
    }
    const limpio = o.seguimiento.replace(CONTROL_Y_BIDI, '').trim()
    if (limpio.length > 120) {
      return { ok: false, status: 400, error: 'El seguimiento no puede pasar de 120 caracteres.' }
    }
    if (limpio) seguimiento = limpio // vacío no borra el guardado
  }
  const pedido = await deps.store.obtener(o.id)
  if (!pedido) return { ok: false, status: 404, error: 'No encontré ese pedido.' }
  if (!validarCambioEstado(pedido.estado, o.estado)) {
    return { ok: false, status: 409, error: 'Ese cambio de estado no es posible.' }
  }
  const patch: { estado: EstadoPedido; seguimiento?: string | null; enviadoEn?: string | null; entregadoEn?: string | null } = {
    estado: o.estado,
  }
  if (seguimiento !== undefined) patch.seguimiento = seguimiento
  if (o.estado === 'enviado') patch.enviadoEn = deps.ahora().toISOString()
  if (o.estado === 'entregado') patch.entregadoEn = deps.ahora().toISOString()
  const afectado = await deps.store.actualizarEstado(o.id, patch, pedido.estado)
  if (!afectado) return { ok: false, status: 409, error: 'Ese cambio de estado no es posible.' }
  return { ok: true }
}
