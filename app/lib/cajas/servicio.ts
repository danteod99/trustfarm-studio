// Lógica de las rutas que usa la caja instalada (sin sesión, autenticada con su llave).
// Las dependencias entran inyectadas para poder probarlas con un almacén en memoria.
import { generarCodigo, normalizarCodigo } from './codigo.ts'
import { normalizarCorreo } from './correo.ts'
import { generarSecreto, hashSecreto, iguales } from './secreto.ts'

export type EstadoRegistro = 'pendiente' | 'vinculada' | 'desvinculada'

export interface RegistroCaja {
  id: string
  secretoHash: string
  estado: EstadoRegistro
  expiraEn: string
  cajaId: string | null
  /** Código de asociación vigente o vencido (8 caracteres normalizados); null si no hay. */
  codigo: string | null
}

/** `ownerId` null = caja PREPARADA: existe con su túnel y su dirección, pero todavía no es de ninguna cuenta. */
export interface CajaDatos { id: string; slug: string; tunnelId: string; ownerId: string | null }

export interface CajasStore {
  contarIntentos(clave: string, desdeIso: string): Promise<number>
  registrarIntento(clave: string): Promise<void>
  crearRegistro(r: { codigo: string; secretoHash: string; expiraEn: string; version: string; ip: string }): Promise<{ id: string } | 'codigo_duplicado'>
  buscarRegistro(id: string): Promise<RegistroCaja | null>
  obtenerCaja(id: string): Promise<CajaDatos | null>
  obtenerEmailDueno(ownerId: string): Promise<string | null>
  /** Consume la llave de activación (una sola vez) y deja a la caja con su secreto permanente; reactivar conserva al dueño. */
  activar(o: { llaveHash: string; secretoHash: string; codigo: string; expiraEn: string; version: string; ip: string }):
    Promise<{ registroId: string; cajaId: string } | 'llave_invalida' | 'codigo_duplicado'>
  /** Renueva el código de una caja SIN dueño; false si no aplica. */
  nuevoCodigo(registroId: string, codigo: string, expiraEn: string): Promise<boolean | 'codigo_duplicado'>
  tocarCaja(cajaId: string, version: string, ahoraIso: string): Promise<void>
  /** ¿Hay una caja asignada a ese correo, sin dueño y sin mini PC unida? */
  hayCajaAsignada(email: string): Promise<boolean>
  /** Anota en el registro (pendiente y sin caja) el correo validado; false si ya no aplica. */
  fijarEmailValidado(registroId: string, email: string): Promise<boolean>
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
const MAX_TOKENS_POR_REGISTRO = 10
const DEMASIADOS_INTENTOS = 'Demasiados intentos. Espera un rato e inténtalo de nuevo.'

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
    return { ok: false, status: 429, error: DEMASIADOS_INTENTOS }
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
export async function autenticar(store: Pick<CajasStore, 'buscarRegistro'>, registroId: string, bearer: string | null | undefined): Promise<RegistroCaja | null> {
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

/**
 * Identifica la caja que llama (para las rutas del Estudio): 401 igual para secreto malo, registro inexistente y caja
 * desvinculada (no se revela cuál); 409 si todavía no tiene cuenta dueña (pendiente o código vencido).
 */
export async function resolverCaja(
  deps: ServicioDeps,
  { registroId, bearer }: { registroId: string; bearer: string | null | undefined },
): Promise<
  | { ok: true; caja: CajaDatos & { ownerId: string }; registroId: string; ownerEmail: string | null }
  | { ok: false; status: 401 | 409; error: string }
> {
  const registro = await autenticar(deps.store, registroId, bearer)
  if (!registro) return { ok: false, status: 401, error: 'No autorizado.' }
  const c = await calcularEstado(deps, registro)
  if (c.estado === 'desvinculada') return { ok: false, status: 401, error: 'No autorizado.' }
  if (c.estado !== 'vinculada') return { ok: false, status: 409, error: 'Esta caja todavía no está vinculada.' }
  // Caja preparada (con dirección pero sin cuenta dueña): puede funcionar, pero el Estudio exige una cuenta con créditos.
  const owner = c.caja.ownerId
  if (owner === null) return { ok: false, status: 409, error: 'Asocia tu caja a tu cuenta para usar el Estudio.' }
  return { ok: true, caja: { ...c.caja, ownerId: owner }, registroId: registro.id, ownerEmail: await deps.store.obtenerEmailDueno(owner) }
}

export async function estadoCaja(
  deps: ServicioDeps,
  { registroId, bearer, conToken }: { registroId: string; bearer: string | null | undefined; conToken: boolean },
): Promise<Respuesta> {
  const registro = await autenticar(deps.store, registroId, bearer)
  if (!registro) return NO_AUTORIZADO()

  const c = await calcularEstado(deps, registro)
  if (c.estado !== 'vinculada') return { status: 200, body: { estado: c.estado } }

  // Protege la API de Cloudflare: solo cuenta cuando se pide el token y la caja está vinculada.
  // Al superarlo se responde 429 (no 'vinculada' sin token: la caja reintenta con espera creciente).
  if (conToken && !(await limitarIntentos(deps.store, `token:${registro.id}`, MAX_TOKENS_POR_REGISTRO, HORA, deps.now()))) {
    return { status: 429, body: { error: DEMASIADOS_INTENTOS } }
  }

  const body: Record<string, unknown> = {
    estado: c.caja.ownerId === null ? 'preparada' : 'vinculada',
    caja_id: c.caja.id,
    direccion: `${c.caja.slug}.${deps.env.dominio}`,
    pase_publica: deps.env.paseKeyPublica,
  }
  if (c.caja.ownerId === null) {
    // Sin dueño: se informa el código de asociación solo mientras está vigente (si venció, la caja pide uno nuevo).
    if (registro.codigo && new Date(registro.expiraEn).getTime() > deps.now().getTime()) {
      body.codigo = formatearCodigo(registro.codigo)
      body.vence_en = registro.expiraEn
    }
  } else {
    body.owner_id = c.caja.ownerId
    body.owner_email = await deps.store.obtenerEmailDueno(c.caja.ownerId)
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
  return { status: 200, body: { estado: c.caja.ownerId === null ? 'preparada' : 'vinculada' } }
}

// ───────── Caja de fábrica: activar con la llave y pedir/renovar el código de asociación ─────────

const ERR_LLAVE = 'La llave de activación no es válida o ya venció.'
const FORMA_LLAVE = /^[A-Za-z0-9_-]{20,128}$/
const MAX_ACTIVACIONES_POR_HORA = 10
const MAX_CODIGOS_POR_HORA = 30

/** "ABCD2345" → "ABCD-2345". */
const formatearCodigo = (normalizado: string) => `${normalizado.slice(0, 4)}-${normalizado.slice(4)}`

/**
 * La caja, recién preparada, presenta su llave de un solo uso y recibe su secreto permanente. Sin sesión: lo frenan los límites
 * por IP y por llave, y toda llave mala (mala forma, inexistente, usada o vencida) recibe exactamente la misma respuesta.
 */
export async function activarCaja(
  deps: ServicioDeps,
  { llave, version, ip }: { llave: unknown; version: string; ip: string },
): Promise<Respuesta> {
  const { store } = deps
  const ahora = deps.now()
  if (!(await limitarIntentos(store, `activar:${ip}`, MAX_ACTIVACIONES_POR_HORA, HORA, ahora))) {
    return { status: 429, body: { error: DEMASIADOS_INTENTOS } }
  }
  const limpia = typeof llave === 'string' ? llave.trim() : ''
  if (!FORMA_LLAVE.test(limpia)) return { status: 400, body: { error: ERR_LLAVE } }
  const llaveHash = hashSecreto(limpia)
  if (!(await limitarIntentos(store, `activar-llave:${llaveHash}`, MAX_ACTIVACIONES_POR_HORA, HORA, ahora))) {
    return { status: 429, body: { error: DEMASIADOS_INTENTOS } }
  }

  const secreto = generarSecreto()
  const secretoHash = hashSecreto(secreto)
  const expiraEn = new Date(ahora.getTime() + VIDA_CODIGO_MS).toISOString()
  for (let i = 0; i < MAX_REINTENTOS_CODIGO; i++) {
    const normalizado = normalizarCodigo(generarCodigo())
    if (!normalizado) continue
    const r = await store.activar({ llaveHash, secretoHash, codigo: normalizado, expiraEn, version: version.slice(0, 40), ip })
    if (r === 'codigo_duplicado') continue
    if (r === 'llave_invalida') return { status: 400, body: { error: ERR_LLAVE } }
    const caja = await store.obtenerCaja(r.cajaId)
    if (!caja) return { status: 500, body: { error: 'No se pudo activar la caja. Inténtalo de nuevo.' } }
    return {
      status: 200,
      body: {
        registro_id: r.registroId, secreto, caja_id: caja.id, direccion: `${caja.slug}.${deps.env.dominio}`,
        codigo: formatearCodigo(normalizado), expira_en: expiraEn,
      },
    }
  }
  return { status: 500, body: { error: 'No se pudo activar la caja. Inténtalo de nuevo.' } }
}

const MAX_CORREOS_POR_REGISTRO = 5
const MAX_CORREOS_POR_IP = 30

/**
 * La mini PC recién instalada valida el correo que escribió el cliente: debe tener una caja asignada libre.
 * Solo entonces la pantalla muestra el QR, y solo esa cuenta podrá vincularla (ver vincularCaja).
 */
export async function correoCaja(
  deps: ServicioDeps,
  { registroId, bearer, ip, correo }: { registroId: string; bearer: string | null | undefined; ip: string; correo: unknown },
): Promise<Respuesta> {
  const { store } = deps
  const registro = await autenticar(store, registroId, bearer)
  if (!registro) return NO_AUTORIZADO()
  const yaNoAplica = (): Respuesta => ({ status: 409, body: { error: 'Esta caja acaba de renovar su código. Inténtalo de nuevo en unos segundos.' } })
  if ((await calcularEstado(deps, registro)).estado !== 'pendiente') return yaNoAplica()

  const email = normalizarCorreo(correo)
  if (!email) return { status: 400, body: { error: 'Escribe un correo válido.' } }

  const ahora = deps.now()
  // Limitan cuántos correos se pueden probar: la respuesta dice si un correo tiene una caja asignada
  if (!(await limitarIntentos(store, `correo:${registro.id}`, MAX_CORREOS_POR_REGISTRO, HORA, ahora))
    || !(await limitarIntentos(store, `correo-ip:${ip}`, MAX_CORREOS_POR_IP, HORA, ahora))) {
    return { status: 429, body: { error: DEMASIADOS_INTENTOS } }
  }
  if (!(await store.hayCajaAsignada(email))) {
    return { status: 404, body: { error: 'No hay una caja asignada a ese correo. Revisa que sea el correo que diste al comprar.' } }
  }
  if (!(await store.fijarEmailValidado(registro.id, email))) return yaNoAplica()
  return { status: 200, body: { ok: true, correo: email } }
}

/** La caja sin dueño pide su código de asociación: devuelve el vigente o, si venció, uno nuevo (15 min). */
export async function codigoCaja(
  deps: ServicioDeps,
  { registroId, bearer }: { registroId: string; bearer: string | null | undefined },
): Promise<Respuesta> {
  const registro = await autenticar(deps.store, registroId, bearer)
  if (!registro) return NO_AUTORIZADO()
  const c = await calcularEstado(deps, registro)
  if (c.estado !== 'vinculada') return NO_AUTORIZADO()
  if (c.caja.ownerId !== null) return { status: 409, body: { error: 'Esta caja ya está asociada a una cuenta.' } }
  if (!(await limitarIntentos(deps.store, `codigo:${registro.id}`, MAX_CODIGOS_POR_HORA, HORA, deps.now()))) {
    return { status: 429, body: { error: DEMASIADOS_INTENTOS } }
  }

  if (registro.codigo && new Date(registro.expiraEn).getTime() > deps.now().getTime()) {
    return { status: 200, body: { codigo: formatearCodigo(registro.codigo), expira_en: registro.expiraEn } }
  }
  const expiraEn = new Date(deps.now().getTime() + VIDA_CODIGO_MS).toISOString()
  for (let i = 0; i < MAX_REINTENTOS_CODIGO; i++) {
    const normalizado = normalizarCodigo(generarCodigo())
    if (!normalizado) continue
    const r = await deps.store.nuevoCodigo(registro.id, normalizado, expiraEn)
    if (r === 'codigo_duplicado') continue
    if (r === false) return { status: 409, body: { error: 'Esta caja ya está asociada a una cuenta.' } }
    return { status: 200, body: { codigo: formatearCodigo(normalizado), expira_en: expiraEn } }
  }
  return { status: 500, body: { error: 'No se pudo crear el código. Inténtalo de nuevo.' } }
}
