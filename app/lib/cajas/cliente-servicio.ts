// Lógica de las rutas del CLIENTE (con sesión) para vincular, listar, abrir, renombrar y quitar cajas.
// Las dependencias entran inyectadas para poder probarlas con un almacén y Cloudflare simulados.
import { randomInt } from 'node:crypto'
import { normalizarCodigo } from './codigo.ts'
import { firmarPase } from './pase.ts'

export interface CajaCliente { id: string; ownerId: string; nombre: string; slug: string; tunnelId: string; lastSeen: string | null; version?: string | null; creadaEn?: string | null }

export type ResultadoVincular =
  | { ok: true; cajaId: string }
  | { ok: false; motivo: 'codigo_invalido' | 'slug_repetido' | 'error' }

export interface ClienteStore {
  contarFallosVincular(userId: string, desdeIso: string): Promise<number>
  registrarFalloVincular(userId: string): Promise<void>
  contarExitosVincular(userId: string, desdeIso: string): Promise<number>
  registrarExitoVincular(userId: string): Promise<void>
  contarCajas(ownerId: string): Promise<number>
  /** SELECT barato: estado pendiente, caja_id null y no vencido. */
  buscarRegistroVinculable(codigoNormalizado: string): Promise<{ id: string } | null>
  vincular(o: { codigo: string; ownerId: string; nombre: string; slug: string; tunnelId: string }): Promise<ResultadoVincular>
  listarCajas(ownerId: string): Promise<CajaCliente[]>
  obtenerCaja(cajaId: string): Promise<CajaCliente | null>
  renombrarCaja(cajaId: string, nombre: string): Promise<void>
  desvincularCaja(cajaId: string): Promise<void>
  /** Para el panel de administración: más recientes primero, `limite` filas desde la posición `desde`. */
  listarTodasLasCajas(desde: number, limite: number): Promise<CajaCliente[]>
}

export interface ClienteDeps {
  store: ClienteStore
  now: () => Date
  env: { dominio: string; paseKeyPrivada: string }
  cloudflare: {
    crearTunel(slug: string): Promise<{ tunnelId: string; tunnelToken: string; hostname: string }>
    borrarTunel(tunnelId: string, slug: string): Promise<void>
  }
  nuevoSlug: () => string
}

export interface Respuesta { status: number; body: object }

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MIN = 60_000
const VENTANA_FALLOS_MS = 10 * MIN
const MAX_FALLOS = 10
const MAX_INTENTOS_SLUG = 3
export const MAX_CAJAS_POR_CUENTA = 10
const MAX_EXITOS_HORA = 5
const HORA_MS = 60 * MIN
const ENCENDIDA_MS = 10 * MIN
const NOMBRE_INICIAL = 'Mi caja'

const ERR_LIMITE = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
const ERR_MAX_CAJAS = `Ya tienes el máximo de cajas vinculadas (${MAX_CAJAS_POR_CUENTA}). Quita una para agregar otra.`
const ERR_CODIGO = 'Ese código no es válido o ya venció.'
const ERR_TUNEL = 'No se pudo preparar la conexión de tu caja. Inténtalo de nuevo.'
const ERR_VINCULAR = 'No se pudo vincular la caja. Inténtalo de nuevo.'
const NO_ENCONTRADA = (): Respuesta => ({ status: 404, body: { error: 'No encontré esa caja.' } })

const ALFABETO_SLUG = 'abcdefghijklmnopqrstuvwxyz0123456789'
/** Slug de 8 caracteres [a-z0-9] con CSPRNG (randomInt no tiene sesgo de módulo). */
export function slugAleatorio(): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += ALFABETO_SLUG[randomInt(ALFABETO_SLUG.length)]
  return s
}

async function limpiarTunel(deps: ClienteDeps, tunnelId: string, slug: string): Promise<void> {
  try { await deps.cloudflare.borrarTunel(tunnelId, slug) } catch { console.error('[cajas] túnel huérfano', tunnelId) }
}

export async function vincularCaja(deps: ClienteDeps, { userId, codigo }: { userId: string; codigo: unknown }): Promise<Respuesta> {
  const { store } = deps
  const desde = new Date(deps.now().getTime() - VENTANA_FALLOS_MS).toISOString()
  if ((await store.contarFallosVincular(userId, desde)) >= MAX_FALLOS) {
    return { status: 429, body: { error: ERR_LIMITE } }
  }
  const fallo = async (): Promise<Respuesta> => {
    await store.registrarFalloVincular(userId)
    return { status: 400, body: { error: ERR_CODIGO } }
  }

  const normalizado = typeof codigo === 'string' ? normalizarCodigo(codigo) : null
  if (!normalizado) return fallo()
  if (!(await store.buscarRegistroVinculable(normalizado))) return fallo()

  if ((await store.contarCajas(userId)) >= MAX_CAJAS_POR_CUENTA) return { status: 409, body: { error: ERR_MAX_CAJAS } }
  const desdeHora = new Date(deps.now().getTime() - HORA_MS).toISOString()
  if ((await store.contarExitosVincular(userId, desdeHora)) >= MAX_EXITOS_HORA) return { status: 429, body: { error: ERR_LIMITE } }

  for (let i = 0; i < MAX_INTENTOS_SLUG; i++) {
    const slug = deps.nuevoSlug()
    let tunel: { tunnelId: string; tunnelToken: string; hostname: string }
    try {
      tunel = await deps.cloudflare.crearTunel(slug)
    } catch {
      return { status: 502, body: { error: ERR_TUNEL } }
    }

    let r: ResultadoVincular
    try {
      r = await store.vincular({ codigo: normalizado, ownerId: userId, nombre: NOMBRE_INICIAL, slug, tunnelId: tunel.tunnelId })
    } catch {
      r = { ok: false, motivo: 'error' }
    }
    if (r.ok) {
      try { await store.registrarExitoVincular(userId) } catch { /* la caja ya está vinculada */ }
      return { status: 200, body: { caja: { id: r.cajaId, nombre: NOMBRE_INICIAL, direccion: `${slug}.${deps.env.dominio}` } } }
    }
    await limpiarTunel(deps, tunel.tunnelId, slug)
    if (r.motivo === 'slug_repetido') continue
    if (r.motivo === 'codigo_invalido') return fallo()
    return { status: 500, body: { error: ERR_VINCULAR } }
  }
  return { status: 500, body: { error: ERR_VINCULAR } }
}

export const direccion = (c: CajaCliente, deps: ClienteDeps) => `${c.slug}.${deps.env.dominio}`
export function encendida(c: CajaCliente, deps: ClienteDeps): boolean {
  if (!c.lastSeen) return false
  const t = new Date(c.lastSeen).getTime()
  return Number.isFinite(t) && deps.now().getTime() - t <= ENCENDIDA_MS
}

export async function listarMisCajas(deps: ClienteDeps, { userId }: { userId: string }): Promise<Respuesta> {
  const cajas = (await deps.store.listarCajas(userId)).filter(c => c.ownerId === userId)
  return {
    status: 200,
    body: {
      cajas: cajas.map(c => ({
        id: c.id, nombre: c.nombre, direccion: direccion(c, deps),
        estado: encendida(c, deps) ? 'encendida' : 'apagada', ultima_senal: c.lastSeen,
      })),
    },
  }
}

/** Devuelve la caja solo si es del usuario; si no existe o es de otro, null (misma respuesta). */
async function cajaPropia(deps: ClienteDeps, userId: string, cajaId: string): Promise<CajaCliente | null> {
  if (typeof cajaId !== 'string' || !UUID_REGEX.test(cajaId)) return null
  const c = await deps.store.obtenerCaja(cajaId)
  return c && c.ownerId === userId ? c : null
}

export async function abrirCaja(deps: ClienteDeps, { userId, cajaId }: { userId: string; cajaId: string }): Promise<Respuesta> {
  const c = await cajaPropia(deps, userId, cajaId)
  if (!c) return NO_ENCONTRADA()
  if (!encendida(c, deps)) return { status: 409, body: { error: 'Tu caja está apagada. Enciéndela y vuelve a intentarlo.' } }
  const pase = firmarPase({ sub: userId, box: c.id, now: deps.now(), privateKeyB64: deps.env.paseKeyPrivada })
  return { status: 200, body: { url: `https://${direccion(c, deps)}/auth/central?pase=${pase}` } }
}

export async function renombrarMiCaja(deps: ClienteDeps, { userId, cajaId, nombre }: { userId: string; cajaId: string; nombre: unknown }): Promise<Respuesta> {
  const limpio = typeof nombre === 'string' ? nombre.trim() : ''
  if (limpio.length < 1 || limpio.length > 60) return { status: 400, body: { error: 'El nombre debe tener entre 1 y 60 caracteres.' } }
  const c = await cajaPropia(deps, userId, cajaId)
  if (!c) return NO_ENCONTRADA()
  await deps.store.renombrarCaja(c.id, limpio)
  return { status: 200, body: { ok: true, nombre: limpio } }
}

export async function quitarCaja(deps: ClienteDeps, { userId, esAdmin, cajaId }: { userId: string; esAdmin: boolean; cajaId: string }): Promise<Respuesta> {
  let c: CajaCliente | null
  if (esAdmin) {
    c = typeof cajaId === 'string' && UUID_REGEX.test(cajaId) ? await deps.store.obtenerCaja(cajaId) : null
  } else {
    c = await cajaPropia(deps, userId, cajaId)
  }
  if (!c) return NO_ENCONTRADA()
  try {
    await deps.store.desvincularCaja(c.id)
  } catch {
    return { status: 500, body: { error: 'No se pudo quitar la caja. Inténtalo de nuevo.' } }
  }
  await limpiarTunel(deps, c.tunnelId, c.slug)
  return { status: 200, body: { ok: true } }
}
