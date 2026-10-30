// Estudio para la caja: lógica de las rutas /api/cajas/estudio/* con las dependencias inyectadas
// (así se prueba con un motor y un almacén falsos). La caja se identifica con registro_id + Bearer;
// todo se cobra y se lee de la CUENTA dueña de esa caja (una billetera y una galería por cuenta).
import type { StartInput } from '../generations.ts'
import { evaluarTope, inicioDiaLima } from './estudio-tope.ts'
import { limitarIntentos, resolverCaja, type Respuesta, type ServicioDeps } from './servicio.ts'

export interface ModeloPublico {
  id: string
  kind: 'image' | 'video'
  nombre: string
  descripcion: string
  formatos: string[]
  /** Imagen: una sola opción {costo}. Video: cada duración × resolución válida. */
  opciones: Array<{ duracion?: number; resolucion?: string; costo: number }>
}

/** Lo que devuelve `publicGeneration` de generations.ts. */
export interface GenPublica {
  id: string
  kind: 'image' | 'video'
  model: string
  prompt: string
  params: object
  status: 'running' | 'done' | 'failed'
  cost: number
  error: string | null
  url: string | null
  createdAt: string
}

export interface EstudioStore {
  /** Créditos gastados por la caja desde `desdeIso` (sin contar fallidas). */
  gastoHoy(cajaId: string, desdeIso: string): Promise<number>
  /** Tope diario de esa caja (editable por un admin). */
  topeDe(cajaId: string): Promise<number>
  /** Candado por caja (una sola generación a la vez). false = ya hay otra en curso. Caduca solo. */
  tomarCandado(cajaId: string): Promise<boolean>
  soltarCandado(cajaId: string): Promise<void>
}

export interface EstudioMotor {
  balance(userId: string): Promise<number>
  /** Modelos disponibles ahora; los `adminOnly` solo para admins. */
  modelos(esAdmin: boolean): Promise<ModeloPublico[]>
  /** Costo en créditos, o null si el modelo o las opciones no son válidos para este usuario. */
  costo(a: { model: string; aspect: string; duration?: number; resolution?: string }, esAdmin: boolean): number | null
  iniciar(userId: string, gratis: boolean, input: StartInput): Promise<{ ok: true; generation: GenPublica } | { ok: false; error: string; status: number }>
  listar(userId: string, q: { kind?: 'image' | 'video'; limit?: number; before?: string }): Promise<GenPublica[]>
  /** null si no existe o no es de ese usuario. */
  obtener(userId: string, id: string): Promise<GenPublica | null>
}

export interface EstudioDeps {
  servicio: ServicioDeps
  store: EstudioStore
  motor: EstudioMotor
  esAdmin(email: string | null): boolean
  /** Peticiones por hora y por caja; solo las pruebas lo cambian. */
  limites?: { leer: number; generar: number }
}

export type Auth = { registroId: string; bearer: string | null | undefined }

const HORA = 3600_000
// Lecturas (saldo, lista, estado): el sondeo cada 8 s de 3 generaciones en curso son 1350/h, así que se deja holgura.
// Generar tiene su propio contador para que el sondeo nunca lo bloquee.
export const LIMITE_LECTURAS_POR_HORA = 3000
export const LIMITE_GENERAR_POR_HORA = 120
/** El candado de una generación dura lo que la ruta (maxDuration 120 s) más un margen; si el servidor muere, caduca solo. */
const CANDADO_SEGUNDOS = 150
const EN_CURSO = 'Ya hay una generación en curso en esta caja. Espera a que termine.'
const DEMASIADOS = 'Demasiados intentos. Espera un rato e inténtalo de nuevo.'
const LIMITE_POR_DEFECTO = 24
const LIMITE_MAXIMO = 60

type Contexto = { ok: true; userId: string; cajaId: string; admin: boolean } | { ok: false; r: Respuesta }

/** Autentica la caja y aplica el límite de peticiones por hora (contador distinto para generar y para leer). */
async function contexto(d: EstudioDeps, a: Auth, tipo: 'leer' | 'generar' = 'leer'): Promise<Contexto> {
  const c = await resolverCaja(d.servicio, a)
  if (!c.ok) return { ok: false, r: { status: c.status, body: { error: c.error } } }
  const max = tipo === 'generar' ? d.limites?.generar ?? LIMITE_GENERAR_POR_HORA : d.limites?.leer ?? LIMITE_LECTURAS_POR_HORA
  if (!(await limitarIntentos(d.servicio.store, `estudio-${tipo}:${c.registroId}`, max, HORA, d.servicio.now()))) {
    return { ok: false, r: { status: 429, body: { error: DEMASIADOS } } }
  }
  return { ok: true, userId: c.caja.ownerId, cajaId: c.caja.id, admin: d.esAdmin(c.ownerEmail) }
}

const desdeHoy = (d: EstudioDeps) => inicioDiaLima(d.servicio.now()).toISOString()

export async function estudioMe(d: EstudioDeps, a: Auth): Promise<Respuesta> {
  const x = await contexto(d, a)
  if (!x.ok) return x.r
  const [saldo, tope, gastado, modelos] = await Promise.all([
    d.motor.balance(x.userId),
    d.store.topeDe(x.cajaId),
    d.store.gastoHoy(x.cajaId, desdeHoy(d)),
    d.motor.modelos(x.admin),
  ])
  return { status: 200, body: { saldo, admin: x.admin, tope_diario: tope, gastado_hoy: gastado, modelos } }
}

export async function estudioGenerar(d: EstudioDeps, a: Auth, body: unknown): Promise<Respuesta> {
  const x = await contexto(d, a, 'generar')
  if (!x.ok) return x.r
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { status: 400, body: { error: 'Solicitud inválida.' } }
  const b = body as Record<string, unknown>
  // Solo estos campos viajan al motor: la imagen de referencia, personajes, estilos y «Animar» no están en esta entrega.
  const input: StartInput = {
    model: String(b.model ?? ''),
    prompt: String(b.prompt ?? ''),
    aspect: String(b.aspect ?? '') as StartInput['aspect'],
    duration: b.duration === undefined || b.duration === null ? undefined : Number(b.duration),
    resolution: b.resolution === undefined || b.resolution === null ? undefined : (String(b.resolution) as StartInput['resolution']),
    cajaId: x.cajaId,
  }
  const costo = d.motor.costo({ model: input.model, aspect: input.aspect, duration: input.duration, resolution: input.resolution }, x.admin)
  if (costo === null) return { status: 400, body: { error: 'Modelo no válido.' } }

  // Una cuenta admin genera gratis: no consume tope ni necesita candado.
  if (x.admin) return iniciar(d, x, input, true)

  // Leer el gasto, compararlo con el tope y cobrar no es atómico: sin candado, 20 peticiones simultáneas pasarían todas
  // el chequeo. El candado deja entrar una generación a la vez por caja y se suelta siempre al terminar.
  if (!(await d.store.tomarCandado(x.cajaId))) return { status: 429, body: { error: EN_CURSO } }
  try {
    const [gastado, tope] = await Promise.all([d.store.gastoHoy(x.cajaId, desdeHoy(d)), d.store.topeDe(x.cajaId)])
    const t = evaluarTope({ gastado, costo, tope })
    if (!t.ok) return { status: 429, body: { error: t.error } }
    return await iniciar(d, x, input, false)
  } finally {
    await d.store.soltarCandado(x.cajaId)
  }
}

async function iniciar(d: EstudioDeps, x: Extract<Contexto, { ok: true }>, input: StartInput, gratis: boolean): Promise<Respuesta> {
  const r = await d.motor.iniciar(x.userId, gratis, input)
  if (!r.ok) return { status: r.status, body: { error: r.error } }
  return { status: 200, body: { generacion: r.generation, saldo: await d.motor.balance(x.userId) } }
}

export async function estudioListar(d: EstudioDeps, a: Auth, q: { kind?: string; limit?: string; before?: string }): Promise<Respuesta> {
  const x = await contexto(d, a)
  if (!x.ok) return x.r
  const limite = Number(q.limit)
  const generaciones = await d.motor.listar(x.userId, {
    kind: q.kind === 'image' || q.kind === 'video' ? q.kind : undefined,
    limit: Number.isFinite(limite) && limite >= 1 ? Math.min(Math.floor(limite), LIMITE_MAXIMO) : LIMITE_POR_DEFECTO,
    before: q.before || undefined,
  })
  return { status: 200, body: { generaciones } }
}

export async function estudioObtener(d: EstudioDeps, a: Auth, id: string): Promise<Respuesta> {
  const x = await contexto(d, a)
  if (!x.ok) return x.r
  const generacion = await d.motor.obtener(x.userId, id)
  if (!generacion) return { status: 404, body: { error: 'No encontrada.' } }
  return { status: 200, body: { generacion, saldo: await d.motor.balance(x.userId) } }
}
