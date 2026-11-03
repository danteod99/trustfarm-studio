// Pasarela de IA: la mini PC llama aquí como si fuera la API de Anthropic. Se autentica con su secreto, se reenvía con la llave
// del negocio y lo consumido se descuenta del saldo de la cuenta. La conversación solo pasa: nunca se guarda ni se registra.
import { createHash } from 'node:crypto'
import { resolverCaja, type ServicioDeps } from '../cajas/servicio.ts'
import { inicioDiaLima } from '../cajas/estudio-tope.ts'
import { aMicrocreditos, costoMicroUsd, type ModeloIA, type UsoIA } from './precios.ts'
import { validarCuerpo, type ParamsIA } from './reglas.ts'

const CHAT: ModeloIA = 'claude-haiku-5-5'
const VIDEO: ModeloIA = 'claude-sonnet-5-5'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MICRO = 1_000_000

export interface RegistroIA {
  cajaId: string
  userId: string
  dia: string
  modelo: ModeloIA
  entrada: number
  salida: number
  cacheLectura: number
  cacheEscritura: number
  costoMicroUsd: number
  microcreditos: number
  ipHash: string
  cobrar: boolean
}

export interface IaStore {
  estadoCaja(cajaId: string): Promise<{ bloqueada: boolean; topeIa: number; tope: number }>
  saldo(userId: string): Promise<number>
  /** Millonésimas de crédito gastadas ese día por la caja con ese modelo. */
  gastoIaHoy(cajaId: string, dia: string, modelo: ModeloIA): Promise<number>
  /** Créditos gastados hoy en el Estudio (imágenes y videos generados). */
  gastoEstudioHoy(cajaId: string, desdeIso: string): Promise<number>
  registrar(r: RegistroIA): Promise<{ saldo: number; cobrados: number }>
}

export interface DepsIA {
  servicio: ServicioDeps
  store: IaStore
  anthropic: { crear(params: ParamsIA): Promise<unknown> }
  esAdmin(email: string | null): boolean
  /** IA_PASARELA_ACTIVA: permite apagar la pasarela sin desplegar código. */
  activa: boolean
}

export interface Respuesta { status: number; body: object }
type Motivo = 'sin_saldo' | 'tope_diario'

/** Con la misma forma que los errores de Anthropic: el SDK de la caja los entrega en `error.error.type`. */
const fallo = (status: number, type: string, message: string): Respuesta => ({ status, body: { type: 'error', error: { type, message } } })
const NO_AUTORIZADO = () => fallo(401, 'authentication_error', 'No autorizado.')
const APAGADA = () => fallo(503, 'pasarela_apagada', 'La IA no está disponible en este momento.')
const SIN_SALDO = 'Se acabó tu saldo. Recarga en trustfarm.online.'
const TOPE = 'Esta caja llegó a su tope de hoy.'

type Contexto = { ok: true; cajaId: string; userId: string; admin: boolean; topeIa: number; tope: number } | { ok: false; r: Respuesta }

/** La llave es `<registroId>.<secreto>`: una sola cadena, para que también sirva a los scripts de video. */
async function identificar(d: DepsIA, llave: string | null): Promise<Contexto> {
  if (!d.activa) return { ok: false, r: APAGADA() }
  const punto = llave ? llave.indexOf('.') : -1
  const registroId = punto > 0 ? llave!.slice(0, punto) : ''
  const secreto = punto > 0 ? llave!.slice(punto + 1) : ''
  if (!UUID_REGEX.test(registroId) || !secreto) return { ok: false, r: NO_AUTORIZADO() }
  // 401 también para una caja sin cuenta dueña: la caja lo trata como «no disponible», sin pausar ni avisar al cliente
  const c = await resolverCaja(d.servicio, { registroId, bearer: secreto })
  if (!c.ok) return { ok: false, r: NO_AUTORIZADO() }
  const e = await d.store.estadoCaja(c.caja.id)
  if (e.bloqueada) return { ok: false, r: NO_AUTORIZADO() }
  return { ok: true, cajaId: c.caja.id, userId: c.caja.ownerId, admin: d.esAdmin(c.ownerEmail), topeIa: e.topeIa, tope: e.tope }
}

const diaLima = (d: DepsIA) => inicioDiaLima(d.servicio.now()).toISOString().slice(0, 10)

/** Los chats tienen su propio tope; el video suma con el Estudio: gastar ahí no debe apagar el vendedor de WhatsApp. */
async function pasoElTope(d: DepsIA, x: Extract<Contexto, { ok: true }>, modelo: ModeloIA): Promise<boolean> {
  const gasto = await d.store.gastoIaHoy(x.cajaId, diaLima(d), modelo)
  if (modelo === CHAT) return gasto >= x.topeIa * MICRO
  const estudio = await d.store.gastoEstudioHoy(x.cajaId, inicioDiaLima(d.servicio.now()).toISOString())
  return estudio * MICRO + gasto >= x.tope * MICRO
}

async function impedimento(d: DepsIA, x: Extract<Contexto, { ok: true }>, modelo: ModeloIA): Promise<Motivo | null> {
  if (x.admin) return null
  if ((await d.store.saldo(x.userId)) <= 0) return 'sin_saldo'
  return (await pasoElTope(d, x, modelo)) ? 'tope_diario' : null
}

export async function atenderMensajes(d: DepsIA, e: { llave: string | null; ip: string; cuerpo: unknown }): Promise<Respuesta> {
  const x = await identificar(d, e.llave)
  if (!x.ok) return x.r
  const v = validarCuerpo(e.cuerpo)
  if (!v.ok) return fallo(v.status, 'invalid_request_error', v.error)

  const motivo = await impedimento(d, x, v.modelo)
  if (motivo === 'sin_saldo') return fallo(402, 'sin_saldo', SIN_SALDO)
  if (motivo === 'tope_diario') return fallo(402, 'tope_diario', TOPE)

  let respuesta: unknown
  try {
    respuesta = await d.anthropic.crear(v.params)
  } catch (err) {
    // Mismo estado para que el SDK de la caja reintente, pero sin el texto original: puede traer datos de la cuenta
    const status = (err as { status?: unknown }).status
    if (typeof status !== 'number') return fallo(502, 'api_error', 'La IA no respondió. Inténtalo de nuevo.')
    return fallo(status, status === 429 ? 'rate_limit_error' : 'api_error', 'La IA no pudo responder. Inténtalo de nuevo.')
  }

  const uso = ((respuesta as { usage?: UsoIA } | null)?.usage ?? {}) as UsoIA
  const costo = costoMicroUsd(v.modelo, uso)
  try {
    await d.store.registrar({
      cajaId: x.cajaId, userId: x.userId, dia: diaLima(d), modelo: v.modelo,
      entrada: uso.input_tokens ?? 0, salida: uso.output_tokens ?? 0,
      cacheLectura: uso.cache_read_input_tokens ?? 0, cacheEscritura: uso.cache_creation_input_tokens ?? 0,
      costoMicroUsd: costo, microcreditos: aMicrocreditos(costo),
      ipHash: createHash('sha256').update(e.ip).digest('hex'),
      cobrar: !x.admin,
    })
  } catch {
    // Anthropic ya respondió: el cliente recibe su respuesta aunque este cobro se pierda. Sin datos de la conversación.
    console.error('[ia] no se pudo registrar el consumo de la caja', x.cajaId)
  }
  return { status: 200, body: respuesta as object }
}

/** Para que una caja en pausa sepa cuándo volvió el saldo, sin gastar una llamada a la IA. */
export async function consultarEstadoIa(d: DepsIA, e: { llave: string | null }): Promise<Respuesta> {
  const x = await identificar(d, e.llave)
  if (!x.ok) return x.r
  const saldo = await d.store.saldo(x.userId)
  const motivo = await impedimento(d, x, CHAT)
  return { status: 200, body: { puede: motivo === null, motivo: motivo ?? 'ok', saldo } }
}

export { VIDEO as MODELO_VIDEO, CHAT as MODELO_CHAT }
