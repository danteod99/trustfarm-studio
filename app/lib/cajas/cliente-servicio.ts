// Lógica de las rutas del CLIENTE (con sesión) para vincular, listar, abrir, renombrar y quitar cajas.
// Las dependencias entran inyectadas para poder probarlas con un almacén y Cloudflare simulados.
import { randomInt } from 'node:crypto'
import { normalizarCodigo } from './codigo.ts'
import { enmascararCorreo, normalizarCorreo } from './correo.ts'
import { firmarPase } from './pase.ts'
import { firmarReto, verificarReto } from './reto.ts'
import { autenticar, type CajasStore } from './servicio.ts'
import { selloValido, volverValido } from './volver.ts'
import { inicioDiaLima } from './estudio-tope.ts'
import { RESUMEN_VACIO, diaDesde, respuestasRestantes, resumirConsumo, type FilaConsumo } from '../ia/alertas.ts'

export interface CajaCliente { id: string; ownerId: string | null; nombre: string; slug: string; tunnelId: string; lastSeen: string | null; version?: string | null; creadaEn?: string | null; topeDiario?: number; etiqueta?: string | null; activada?: boolean; /** Administrador que la creó en fábrica (null/ausente = flujo antiguo de vincular con código). */ creadaPor?: string | null; /** Correo de la cuenta a la que va dirigida (null = sin asignar). */ emailAsignado?: string | null; iaBloqueada?: boolean; topeDiarioIa?: number }

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
  buscarRegistroVinculable(codigoNormalizado: string): Promise<{ id: string; emailValidado: string | null } | null>
  /** ¿Ese correo tiene alguna caja asignada, sin dueño y sin una mini PC unida? */
  hayCajaAsignada(email: string): Promise<boolean>
  /** Guarda el correo en el registro pendiente; false si ya no aplica. */
  fijarEmailValidado(registroId: string, email: string): Promise<boolean>
  /** Une el registro (con ese correo validado) a la caja asignada más antigua y libre de ese correo (atómico). */
  vincularAsignada(o: { codigo: string; ownerId: string; email: string; nombre: string }):
    Promise<{ ok: true; cajaId: string } | { ok: false; motivo: 'codigo_invalido' | 'sin_caja_asignada' | 'error' }>
  asignarEmail(cajaId: string, email: string): Promise<void>
  contarCajasConEmail(email: string): Promise<number>
  /** Filas de consumo de IA de esas cajas desde ese día (YYYY-MM-DD). */
  consumoIa(ids: string[], desdeDia: string): Promise<FilaConsumo[]>
  saldoDe(userId: string): Promise<number>
  /** Cambia bloqueo y tope de la IA; false si la caja no existe. */
  fijarIa(cajaId: string, o: { bloqueada?: boolean; topeIa?: number }): Promise<boolean>
  /** Cuentas registradas cuyo correo contiene el texto (máximo 8). */
  buscarCuentas(texto: string): Promise<{ id: string; email: string; con_google: boolean }[]>
  /** El correo con que se vinculará esa cuenta (el de Google si lo tiene); null si la cuenta no existe. */
  cuentaPorId(id: string): Promise<{ email: string } | null>
  vincular(o: { codigo: string; ownerId: string; nombre: string; slug: string; tunnelId: string }): Promise<ResultadoVincular>
  listarCajas(ownerId: string): Promise<CajaCliente[]>
  obtenerCaja(cajaId: string): Promise<CajaCliente | null>
  renombrarCaja(cajaId: string, nombre: string): Promise<void>
  desvincularCaja(cajaId: string): Promise<void>
  /** Para el panel de administración: más recientes primero, `limite` filas desde la posición `desde`. */
  listarTodasLasCajas(desde: number, limite: number): Promise<CajaCliente[]>
  /** Cambia el tope diario del Estudio; false si la caja no existe. */
  fijarTope(cajaId: string, tope: number): Promise<boolean>
  /** Créditos gastados hoy por cada caja (sin contar generaciones fallidas), desde `desdeIso`. */
  gastoHoyPorCajas(ids: string[], desdeIso: string): Promise<Record<string, number>>
  // ── Caja de fábrica (cajas preparadas sin dueño) ──
  contarPreparadasSinDueno(): Promise<number>
  contarCreacionesAdmin(adminId: string, desdeIso: string): Promise<number>
  registrarCreacionAdmin(adminId: string): Promise<void>
  /** Crea la caja SIN dueño y su llave de activación (solo el hash). */
  preparar(o: { slug: string; tunnelId: string; etiqueta: string; adminId: string; llaveHash: string; venceEn: string }):
    Promise<{ ok: true; cajaId: string } | { ok: false; motivo: 'slug_repetido' | 'limite_preparadas' | 'error' }>
  /** Llave nueva (invalida las que no se usaron); false si la caja no existe. */
  nuevaLlave(cajaId: string, llaveHash: string, venceEn: string): Promise<boolean>
  /** Una caja SIN dueño cuyo código de asociación (normalizado) está vigente. */
  buscarCajaPreparadaPorCodigo(codigoNormalizado: string): Promise<{ cajaId: string; emailAsignado: string | null } | null>
  /** Asigna la caja preparada a la cuenta (atómico). */
  reclamar(o: { codigo: string; ownerId: string; nombre: string }): Promise<{ ok: true; cajaId: string } | { ok: false; motivo: 'codigo_invalido' | 'error' }>
  /** El dueño la quita de su cuenta: queda sin dueño y conserva dirección y túnel. */
  liberarCaja(cajaId: string): Promise<void>
}

export interface ClienteDeps {
  store: ClienteStore
  now: () => Date
  /** vinculoAbierto (CAJAS_VINCULO_ABIERTO=1, solo para pruebas del dueño): cualquier cuenta vincula con el código y se crea una caja nueva. */
  env: { dominio: string; paseKeyPrivada: string; vinculoAbierto?: boolean }
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
const ERR_SIN_CORREO = 'Primero escribe tu correo en la pantalla de la mini PC y luego vuelve a escanear el QR.'
const ERR_SOLO_GOOGLE = 'Para vincular tu caja entra a trustfarm.online con tu cuenta de Google. Cierra sesión y usa «Continuar con Google».'
const ERR_SIN_LIBRES = 'Tu cuenta no tiene cajas libres. Escríbenos si compraste otra mini PC.'
const ERR_CODIGO_RENOVADO = 'Esta mini PC acaba de renovar su código.'
const ERR_ENLACE = 'Este enlace no es válido. Vuelve a empezar desde la pantalla de tu mini PC.'
const ERR_CAJA_AJENA = 'Esta mini PC está vinculada a otra cuenta. Cancela y entra con la cuenta dueña.'
const errOtraCuenta = (correo: string) => `Esta caja es de otra cuenta (${enmascararCorreo(correo)}). Cierra sesión y entra con ese correo.`
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

export async function vincularCaja(deps: ClienteDeps, { userId, email, codigo }: { userId: string; email?: string | null; codigo: unknown }): Promise<Respuesta> {
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
  // Caja de fábrica: ya existe (con su túnel y su dirección) y solo hay que asignarla. Si no, es una mini PC del ISO genérico.
  const preparada = await store.buscarCajaPreparadaPorCodigo(normalizado)
  const registro = preparada ? null : await store.buscarRegistroVinculable(normalizado)
  if (!preparada && !registro) return fallo()

  // Vínculo estricto: solo la cuenta a la que se asignó la caja
  const correo = normalizarCorreo(email)
  const rechazar = async (error: string): Promise<Respuesta> => {
    await store.registrarFalloVincular(userId)
    return { status: 403, body: { error } }
  }
  if (preparada?.emailAsignado && preparada.emailAsignado !== correo) return rechazar(correo ? errOtraCuenta(preparada.emailAsignado) : ERR_SOLO_GOOGLE)
  const asignada = Boolean(correo && registro?.emailValidado === correo)
  if (registro && !asignada && !deps.env.vinculoAbierto) {
    if (!registro.emailValidado) return rechazar(ERR_SIN_CORREO)
    return rechazar(correo ? errOtraCuenta(registro.emailValidado) : ERR_SOLO_GOOGLE)
  }

  if ((await store.contarCajas(userId)) >= MAX_CAJAS_POR_CUENTA) return { status: 409, body: { error: ERR_MAX_CAJAS } }
  const desdeHora = new Date(deps.now().getTime() - HORA_MS).toISOString()
  if ((await store.contarExitosVincular(userId, desdeHora)) >= MAX_EXITOS_HORA) return { status: 429, body: { error: ERR_LIMITE } }

  if (preparada) {
    let r: Awaited<ReturnType<typeof store.reclamar>>
    try {
      r = await store.reclamar({ codigo: normalizado, ownerId: userId, nombre: NOMBRE_INICIAL })
    } catch {
      r = { ok: false, motivo: 'error' }
    }
    if (!r.ok) return r.motivo === 'codigo_invalido' ? fallo() : { status: 500, body: { error: ERR_VINCULAR } }
    try { await store.registrarExitoVincular(userId) } catch { /* la caja ya está asignada */ }
    const c = await store.obtenerCaja(r.cajaId)
    return { status: 200, body: { caja: { id: r.cajaId, nombre: NOMBRE_INICIAL, direccion: c ? direccion(c, deps) : '' } } }
  }

  if (asignada && correo) {
    // La caja ya existe con su túnel y su dirección: no se crea nada en Cloudflare
    let r: Awaited<ReturnType<typeof store.vincularAsignada>>
    try {
      r = await store.vincularAsignada({ codigo: normalizado, ownerId: userId, email: correo, nombre: NOMBRE_INICIAL })
    } catch {
      r = { ok: false, motivo: 'error' }
    }
    if (!r.ok) {
      if (r.motivo === 'codigo_invalido') return fallo()
      return r.motivo === 'sin_caja_asignada' ? { status: 409, body: { error: ERR_SIN_LIBRES } } : { status: 500, body: { error: ERR_VINCULAR } }
    }
    try { await store.registrarExitoVincular(userId) } catch { /* la caja ya está vinculada */ }
    const c = await store.obtenerCaja(r.cajaId)
    return { status: 200, body: { caja: { id: r.cajaId, nombre: NOMBRE_INICIAL, direccion: c ? direccion(c, deps) : '' } } }
  }

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

/**
 * «Continuar con Google» en la propia mini PC, primera parte (con la sesión del navegador). Para una caja propia devuelve el pase.
 * Para vincular NO toca nada: solo firma un reto con la cuenta, dirigido a la propia máquina. Quien vincula es la caja (vincularDesdeCaja),
 * porque un enlace puede llegarle por mensaje a cualquiera, y el reto solo le sirve a una caja que esté en la máquina de quien inició sesión.
 */
export async function conectarCaja(deps: ClienteDeps, o: { userId: string; email?: string | null; vincular?: unknown; caja?: unknown; volver: unknown; sello: unknown }): Promise<Respuesta> {
  if (!volverValido(o.volver) || !selloValido(o.sello)) return { status: 400, body: { error: ERR_ENLACE } }
  const vuelta = (campo: string, valor: string): Respuesta => ({ status: 200, body: { url: `${o.volver}/conectado?${campo}=${encodeURIComponent(valor)}&sello=${encodeURIComponent(o.sello as string)}` } })
  if (typeof o.caja === 'string') {
    const c = await cajaPropia(deps, o.userId, o.caja)
    if (!c) return { status: 403, body: { error: ERR_CAJA_AJENA } }
    return vuelta('pase', firmarPase({ sub: o.userId, box: c.id, now: deps.now(), privateKeyB64: deps.env.paseKeyPrivada }))
  }
  if (o.vincular !== true) return { status: 400, body: { error: ERR_ENLACE } }
  const correo = normalizarCorreo(o.email)
  if (!correo) return { status: 403, body: { error: 'Esta mini PC se vincula con tu cuenta de Google. Cancela y entra con «Continuar con Google».' } }
  return vuelta('reto', firmarReto({ sub: o.userId, email: correo, now: deps.now(), clave: deps.env.paseKeyPrivada }))
}

/** Segunda parte: la caja, autenticada con su secreto, canjea el reto y vincula SU código con la cuenta que inició sesión. */
export async function vincularDesdeCaja(deps: ClienteDeps, cajas: Pick<CajasStore, 'buscarRegistro'>, o: { registroId: string; bearer: string | null | undefined; reto: unknown }): Promise<Respuesta> {
  const registro = await autenticar(cajas, o.registroId, o.bearer)
  if (!registro) return { status: 401, body: { error: 'No autorizado.' } }
  const quien = verificarReto(o.reto, { now: deps.now(), clave: deps.env.paseKeyPrivada })
  if (!quien) return { status: 400, body: { error: 'Ese intento venció.' } }
  const correo = normalizarCorreo(quien.email)
  if (!correo) return { status: 403, body: { error: ERR_SOLO_GOOGLE } }
  const codigo = registro.codigo
  if (!codigo) return { status: 409, body: { error: ERR_CODIGO_RENOVADO } }

  const { store } = deps
  const desde = new Date(deps.now().getTime() - VENTANA_FALLOS_MS).toISOString()
  if ((await store.contarFallosVincular(quien.sub, desde)) >= MAX_FALLOS) return { status: 429, body: { error: ERR_LIMITE } }

  // El correo lo dice Google: no hace falta que lo hayan escrito antes en la caja
  const pendiente = (await store.buscarCajaPreparadaPorCodigo(codigo)) ? null : await store.buscarRegistroVinculable(codigo)
  if (pendiente && pendiente.emailValidado !== correo && !deps.env.vinculoAbierto) {
    if (!(await store.hayCajaAsignada(correo))) {
      await store.registrarFalloVincular(quien.sub)
      return { status: 409, body: { error: `La cuenta ${correo} no tiene una mini PC asignada. Entra con el correo que diste al comprar o escríbenos.` } }
    }
    if (!(await store.fijarEmailValidado(pendiente.id, correo))) return { status: 409, body: { error: ERR_CODIGO_RENOVADO } }
  }
  const r = await vincularCaja(deps, { userId: quien.sub, email: correo, codigo })
  if (r.status !== 200) return r
  const cajaId = (r.body as { caja: { id: string } }).caja.id
  return { status: 200, body: { pase: firmarPase({ sub: quien.sub, box: cajaId, now: deps.now(), privateKeyB64: deps.env.paseKeyPrivada }) } }
}

export const direccion = (c: CajaCliente, deps: ClienteDeps) => `${c.slug}.${deps.env.dominio}`
export function encendida(c: CajaCliente, deps: ClienteDeps): boolean {
  if (!c.lastSeen) return false
  const t = new Date(c.lastSeen).getTime()
  return Number.isFinite(t) && deps.now().getTime() - t <= ENCENDIDA_MS
}

const redondear = (n: number) => Math.round(n * 10) / 10

export async function listarMisCajas(deps: ClienteDeps, { userId }: { userId: string }): Promise<Respuesta> {
  const cajas = (await deps.store.listarCajas(userId)).filter(c => c.ownerId === userId)
  const hoy = inicioDiaLima(deps.now()).toISOString().slice(0, 10)
  const [filas, saldo] = await Promise.all([
    cajas.length ? deps.store.consumoIa(cajas.map(c => c.id), diaDesde(hoy)) : Promise.resolve([]),
    deps.store.saldoDe(userId),
  ])
  const resumen = resumirConsumo(filas, hoy)
  const deLaCuenta = Object.values(resumen).reduce((t, r) => ({ creditosMes: t.creditosMes + r.creditosMes, solicitudesMes: t.solicitudesMes + r.solicitudesMes }), { creditosMes: 0, solicitudesMes: 0 })
  return {
    status: 200,
    body: {
      saldo,
      ia_respuestas_restantes: respuestasRestantes(saldo, deLaCuenta),
      cajas: cajas.map(c => {
        const r = resumen[c.id] ?? RESUMEN_VACIO
        return {
          id: c.id, nombre: c.nombre, direccion: direccion(c, deps),
          estado: encendida(c, deps) ? 'encendida' : 'apagada', ultima_senal: c.lastSeen,
          ia_creditos_hoy: redondear(r.creditosHoy), ia_creditos_mes: redondear(r.creditosMes),
        }
      }),
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
  if (!esAdmin && c.creadaPor) {
    // Caja de fábrica: el dueño solo la «quita» de su cuenta; queda sin dueño y CONSERVA su dirección y su túnel.
    // (Las del flujo antiguo se borran del todo más abajo: si no, cualquier cuenta podría acumular túneles y DNS sin límite.)
    try {
      await deps.store.liberarCaja(c.id)
    } catch {
      return { status: 500, body: { error: 'No se pudo quitar la caja. Inténtalo de nuevo.' } }
    }
    return { status: 200, body: { ok: true } }
  }
  // Un administrador la elimina del todo: la fila, el túnel y el DNS.
  try {
    await deps.store.desvincularCaja(c.id)
  } catch {
    return { status: 500, body: { error: 'No se pudo quitar la caja. Inténtalo de nuevo.' } }
  }
  await limpiarTunel(deps, c.tunnelId, c.slug)
  return { status: 200, body: { ok: true } }
}
