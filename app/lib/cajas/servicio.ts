// Lógica de las rutas que usa la caja instalada (sin sesión, autenticada con su llave).
// Las dependencias entran inyectadas para poder probarlas con un almacén en memoria.
import { generarCodigo, normalizarCodigo } from './codigo.ts'
import { generarSecreto, hashSecreto, iguales } from './secreto.ts'

export type EstadoRegistro = 'pendiente' | 'vinculada' | 'desvinculada'

export interface RegistroCaja {
  id: string
  secretoHash: string
  estado: EstadoRegistro
  expiraEn: string
  cajaId: string | null
}

export interface CajaDatos { id: string; slug: string; tunnelId: string; ownerId: string }

export interface CajasStore {
  contarIntentos(clave: string, desdeIso: string): Promise<number>
  registrarIntento(clave: string): Promise<void>
  crearRegistro(r: { codigo: string; secretoHash: string; expiraEn: string; version: string; ip: string }): Promise<{ id: string } | 'codigo_duplicado'>
  buscarRegistro(id: string): Promise<RegistroCaja | null>
  obtenerCaja(id: string): Promise<CajaDatos | null>
  obtenerEmailDueno(ownerId: string): Promise<string | null>
  tocarCaja(cajaId: string, version: string, ahoraIso: string): Promise<void>
  /** Solo registros `pendiente` vencidos antes de `antesIso`. */
  borrarRegistrosVencidos(antesIso: string): Promise<void>
  borrarIntentosViejos(antesIso: string): Promise<void>
}

export interface ServicioDeps {
  store: CajasStore
  now: () => Date
  env: { dominio: string; paseKeyPublica: string }
  cloudflare: { obtenerTokenTunel(tunnelId: string): Promise<string> }
}

export interface Respuesta { status: number; body: object }

const MIN = 60_000
const HORA = 60 * MIN
const DIA = 24 * HORA
const VIDA_CODIGO_MS = 15 * MIN
const MAX_REGISTROS_POR_IP = 20
const MAX_REINTENTOS_CODIGO = 5

const NO_AUTORIZADO = (): Respuesta => ({ status: 401, body: { error: 'No autorizado.' } })

/** true = permitido (y registra el intento); false = superó `max` en la ventana (no registra). */
export async function limitarIntentos(store: CajasStore, clave: string, max: number, ventanaMs: number, ahora: Date): Promise<boolean> {
  const desde = new Date(ahora.getTime() - ventanaMs).toISOString()
  if ((await store.contarIntentos(clave, desde)) >= max) return false
  await store.registrarIntento(clave)
  return true
}

export type ResultadoRegistro =
  | { ok: true; registro_id: string; codigo: string; secreto: string; expira_en: string }
  | { ok: false; status: 429 | 500; error: string }

export async function registrarCaja(deps: ServicioDeps, { ip, version }: { ip: string; version: string }): Promise<ResultadoRegistro> {
  const { store } = deps
  const ahora = deps.now()

  if (!(await limitarIntentos(store, `registrar:${ip}`, MAX_REGISTROS_POR_IP, HORA, ahora))) {
    return { ok: false, status: 429, error: 'Demasiados intentos. Espera un rato e inténtalo de nuevo.' }
  }

  // Limpieza oportunista: un fallo aquí nunca rompe la respuesta.
  const hace1Dia = new Date(ahora.getTime() - DIA).toISOString()
  try { await store.borrarRegistrosVencidos(hace1Dia) } catch { /* ignorado */ }
  try { await store.borrarIntentosViejos(hace1Dia) } catch { /* ignorado */ }

  const secreto = generarSecreto()
  const secretoHash = hashSecreto(secreto)
  const expiraEn = new Date(ahora.getTime() + VIDA_CODIGO_MS).toISOString()

  for (let i = 0; i < MAX_REINTENTOS_CODIGO; i++) {
    const codigo = generarCodigo()
    const normalizado = normalizarCodigo(codigo)
    if (!normalizado) continue
    const r = await store.crearRegistro({ codigo: normalizado, secretoHash, expiraEn, version, ip })
    if (r === 'codigo_duplicado') continue
    return { ok: true, registro_id: r.id, codigo, secreto, expira_en: expiraEn }
  }
  return { ok: false, status: 500, error: 'No se pudo crear el registro de la caja. Inténtalo de nuevo.' }
}

/** Autentica con el Bearer. Misma respuesta (null) si no existe, falta el Bearer o no coincide. */
async function autenticar(store: CajasStore, registroId: string, bearer: string | null | undefined): Promise<RegistroCaja | null> {
  const registro = await store.buscarRegistro(registroId)
  const hash = hashSecreto(typeof bearer === 'string' ? bearer : '')
  // Se compara siempre (aunque no exista) para no diferenciar los casos por tiempo.
  const ok = iguales(hash, registro?.secretoHash ?? '0'.repeat(64))
  return registro && ok && typeof bearer === 'string' && bearer.length > 0 ? registro : null
}

type Calculado =
  | { estado: 'pendiente' | 'vencida' | 'desvinculada' }
  | { estado: 'vinculada'; caja: CajaDatos }

async function calcularEstado(deps: ServicioDeps, registro: RegistroCaja): Promise<Calculado> {
  if (registro.estado === 'desvinculada') return { estado: 'desvinculada' }
  if (registro.estado === 'vinculada') {
    const caja = registro.cajaId ? await deps.store.obtenerCaja(registro.cajaId) : null
    return caja ? { estado: 'vinculada', caja } : { estado: 'desvinculada' }
  }
  if (new Date(registro.expiraEn).getTime() <= deps.now().getTime()) return { estado: 'vencida' }
  return { estado: 'pendiente' }
}

export async function estadoCaja(
  deps: ServicioDeps,
  { registroId, bearer, conToken }: { registroId: string; bearer: string | null | undefined; conToken: boolean },
): Promise<Respuesta> {
  const registro = await autenticar(deps.store, registroId, bearer)
  if (!registro) return NO_AUTORIZADO()

  const c = await calcularEstado(deps, registro)
  if (c.estado !== 'vinculada') return { status: 200, body: { estado: c.estado } }

  const ownerEmail = await deps.store.obtenerEmailDueno(c.caja.ownerId)
  const body: Record<string, unknown> = {
    estado: 'vinculada',
    caja_id: c.caja.id,
    direccion: `${c.caja.slug}.${deps.env.dominio}`,
    pase_publica: deps.env.paseKeyPublica,
    owner_id: c.caja.ownerId,
    owner_email: ownerEmail,
  }
  if (conToken) {
    try {
      body.tunnel_token = await deps.cloudflare.obtenerTokenTunel(c.caja.tunnelId)
    } catch {
      return { status: 502, body: { error: 'No se pudo preparar la conexión de la caja. Inténtalo de nuevo.' } }
    }
  }
  return { status: 200, body }
}

export async function latidoCaja(
  deps: ServicioDeps,
  { registroId, bearer, version }: { registroId: string; bearer: string | null | undefined; version: string },
): Promise<Respuesta> {
  const registro = await autenticar(deps.store, registroId, bearer)
  if (!registro) return NO_AUTORIZADO()

  const c = await calcularEstado(deps, registro)
  if (c.estado !== 'vinculada') return { status: 200, body: { estado: 'desvinculada' } }

  await deps.store.tocarCaja(c.caja.id, version, deps.now().toISOString())
  return { status: 200, body: { estado: 'vinculada' } }
}
