// «Crear caja» y «Regenerar llave» (solo administradores): la caja se prepara ANTES de enviarla, con su túnel y su dirección,
// y una llave de activación de un solo uso. Las dependencias entran inyectadas (almacén y Cloudflare simulables en las pruebas).
import { normalizarCorreo } from './correo.ts'
import { generarSecreto, hashSecreto } from './secreto.ts'
import { MAX_CAJAS_POR_CUENTA, type ClienteDeps, type Respuesta } from './cliente-servicio.ts'

export const MAX_CREACIONES_POR_HORA = 20
export const MAX_PREPARADAS_SIN_DUENO = 100
export const VIDA_LLAVE_DIAS = 30

const HORA_MS = 3600_000
const DIA_MS = 86_400_000
const MAX_INTENTOS_SLUG = 3
const MAX_ETIQUETA = 80
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ERR_ETIQUETA = `Escribe una etiqueta de 1 a ${MAX_ETIQUETA} caracteres (por ejemplo, el nombre del cliente).`
const ERR_CORREO = 'Ese correo no parece válido. Revísalo o déjalo vacío.'
const ERR_MAX_POR_CORREO = `Ese correo ya tiene el máximo de cajas asignadas (${MAX_CAJAS_POR_CUENTA}).`
const ERR_SIN_CUENTA = 'Elige una cuenta registrada en trustfarm.online.'
const ERR_RITMO = 'Creaste demasiadas cajas en la última hora. Espera un rato e inténtalo de nuevo.'
const ERR_CUPO = `Ya hay ${MAX_PREPARADAS_SIN_DUENO} cajas sin dueño. Asigna o elimina alguna antes de crear otra.`
const ERR_TUNEL = 'No se pudo preparar el túnel de la caja. Inténtalo de nuevo.'
const ERR_CREAR = 'No se pudo crear la caja. Inténtalo de nuevo.'
const NO_ENCONTRADA = (): Respuesta => ({ status: 404, body: { error: 'No encontré esa caja.' } })

async function limpiarTunel(deps: ClienteDeps, tunnelId: string, slug: string): Promise<void> {
  try { await deps.cloudflare.borrarTunel(tunnelId, slug) } catch { console.error('[cajas] túnel huérfano', tunnelId) }
}

const vencimiento = (deps: ClienteDeps) => new Date(deps.now().getTime() + VIDA_LLAVE_DIAS * DIA_MS).toISOString()

export async function prepararCaja(deps: ClienteDeps, { adminId, etiqueta, email }: { adminId: string; etiqueta: unknown; email?: unknown }): Promise<Respuesta> {
  const { store } = deps
  const limpia = typeof etiqueta === 'string' ? etiqueta.trim() : ''
  if (limpia.length < 1 || limpia.length > MAX_ETIQUETA) return { status: 400, body: { error: ERR_ETIQUETA } }
  // Correo de la cuenta a la que va dirigida; vacío = caja sin asignar (caja de fábrica con llave)
  const sinCorreo = email === undefined || email === null || (typeof email === 'string' && email.trim() === '')
  const correo = sinCorreo ? null : normalizarCorreo(email)
  if (!sinCorreo && !correo) return { status: 400, body: { error: ERR_CORREO } }
  if (correo && (await store.contarCajasConEmail(correo)) >= MAX_CAJAS_POR_CUENTA) return { status: 409, body: { error: ERR_MAX_POR_CORREO } }

  const desde = new Date(deps.now().getTime() - HORA_MS).toISOString()
  if ((await store.contarCreacionesAdmin(adminId, desde)) >= MAX_CREACIONES_POR_HORA) return { status: 429, body: { error: ERR_RITMO } }
  if ((await store.contarPreparadasSinDueno()) >= MAX_PREPARADAS_SIN_DUENO) return { status: 429, body: { error: ERR_CUPO } }
  // Cuenta el intento antes de hablar con Cloudflare: los que fallan también gastan cupo (no se puede martillar su API).
  await store.registrarCreacionAdmin(adminId)

  for (let i = 0; i < MAX_INTENTOS_SLUG; i++) {
    const slug = deps.nuevoSlug()
    let tunel: { tunnelId: string; tunnelToken: string; hostname: string }
    try {
      tunel = await deps.cloudflare.crearTunel(slug)
    } catch {
      return { status: 502, body: { error: ERR_TUNEL } }
    }

    const llave = generarSecreto()
    const venceEn = vencimiento(deps)
    let r: Awaited<ReturnType<typeof store.preparar>>
    try {
      r = await store.preparar({ slug, tunnelId: tunel.tunnelId, etiqueta: limpia, adminId, llaveHash: hashSecreto(llave), venceEn })
    } catch {
      r = { ok: false, motivo: 'error' }
    }
    if (r.ok) {
      if (correo) {
        try {
          await store.asignarEmail(r.cajaId, correo)
        } catch {
          // Sin el correo sería una caja suelta que nadie puede vincular: se deshace
          try { await store.desvincularCaja(r.cajaId) } catch { console.error('[cajas] caja sin correo', r.cajaId) }
          await limpiarTunel(deps, tunel.tunnelId, slug)
          return { status: 500, body: { error: ERR_CREAR } }
        }
      }
      const caja = { id: r.cajaId, etiqueta: limpia, direccion: `${slug}.${deps.env.dominio}`, email: correo }
      // Con correo no hace falta llave ni comando: la mini PC del ISO se vincula sola con esa cuenta
      return { status: 200, body: correo ? { caja } : { caja, llave, vence_en: venceEn } }
    }
    await limpiarTunel(deps, tunel.tunnelId, slug)
    if (r.motivo === 'slug_repetido') continue
    if (r.motivo === 'limite_preparadas') return { status: 429, body: { error: ERR_CUPO } }
    return { status: 500, body: { error: ERR_CREAR } }
  }
  return { status: 500, body: { error: ERR_CREAR } }
}

const MIN_BUSQUEDA = 2
const MAX_BUSQUEDA = 100

/** Buscador del panel: cuentas registradas cuyo correo contiene el texto. */
export async function buscarCuentas(deps: ClienteDeps, { texto }: { texto: unknown }): Promise<Respuesta> {
  const limpio = typeof texto === 'string' ? texto.trim().slice(0, MAX_BUSQUEDA) : ''
  if (limpio.length < MIN_BUSQUEDA) return { status: 200, body: { cuentas: [] } }
  return { status: 200, body: { cuentas: await deps.store.buscarCuentas(limpio) } }
}

/** Crea la caja para una cuenta que ya existe: así nunca se asigna a un correo sin cuenta o mal escrito. */
export async function prepararCajaParaCuenta(deps: ClienteDeps, { adminId, etiqueta, usuarioId }: { adminId: string; etiqueta: unknown; usuarioId: unknown }): Promise<Respuesta> {
  const cuenta = typeof usuarioId === 'string' && UUID_REGEX.test(usuarioId) ? await deps.store.cuentaPorId(usuarioId) : null
  if (!cuenta) return { status: 400, body: { error: ERR_SIN_CUENTA } }
  return prepararCaja(deps, { adminId, etiqueta, email: cuenta.email })
}

export async function regenerarLlave(deps: ClienteDeps, { cajaId }: { cajaId: string }): Promise<Respuesta> {
  if (typeof cajaId !== 'string' || !UUID_REGEX.test(cajaId)) return NO_ENCONTRADA()
  const llave = generarSecreto()
  const venceEn = vencimiento(deps)
  let ok: boolean
  try {
    ok = await deps.store.nuevaLlave(cajaId, hashSecreto(llave), venceEn)
  } catch {
    return { status: 500, body: { error: 'No se pudo generar la llave. Inténtalo de nuevo.' } }
  }
  return ok ? { status: 200, body: { llave, vence_en: venceEn } } : NO_ENCONTRADA()
}
