// Actualizaciones automáticas de las mini PC: la caja pregunta si hay una versión nueva (ya firmada por el dueño) y avisa cómo le fue.
// La central NO firma nada ni decide qué es seguro: solo reparte versiones publicadas con `scripts/publicar-release.mjs` por tandas.
// La caja verifica la firma con su clave pública; sin firma válida no instala (ver docs del repo empleado-ia).
import { createHash } from 'node:crypto'
import { autenticar, limitarIntentos, type CajasStore, type Respuesta, type ServicioDeps } from './servicio.ts'

export interface ReleaseRow { version: string; url: string; sha256: string; tamano: number; firma: string; porcentaje: number }

export interface ActualizacionStore {
  releases(): Promise<ReleaseRow[]>
  registrarResultado(r: { registroId: string; version: string; ok: boolean; detalle: string | null }): Promise<void>
}

export type ActualizacionDeps = ServicioDeps & { act: ActualizacionStore }

const SEMVER = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/
const DIA = 24 * 60 * 60_000
const MAX_CONSULTAS_POR_DIA = 48
const MAX_RESULTADOS_POR_DIA = 20
const NO_AUTORIZADO = (): Respuesta => ({ status: 401, body: { error: 'No autorizado.' } })
const DEMASIADOS = (): Respuesta => ({ status: 429, body: { error: 'Demasiados intentos. Espera un rato e inténtalo de nuevo.' } })

function comparar(a: string, b: string): number {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}

/** Reparto por tandas: la caja cae siempre del mismo lado (huella de su registro) y quien entra con 5 % sigue dentro con 50 %. */
export function enTanda(registroId: string, porcentaje: number): boolean {
  if (!Number.isFinite(porcentaje) || porcentaje <= 0) return false
  if (porcentaje >= 100) return true
  const n = createHash('sha256').update(registroId).digest().readUInt32BE(0) % 100
  return n < porcentaje
}

/** Caja con registro vigente y con dirección (preparada o vinculada). */
async function cajaAutenticada(store: CajasStore, registroId: string, bearer: string | null | undefined) {
  const registro = await autenticar(store, registroId, bearer)
  return registro && registro.estado === 'vinculada' && registro.cajaId ? registro : null
}

export async function consultarActualizacion(
  deps: ActualizacionDeps,
  { registroId, bearer, version }: { registroId: string; bearer: string | null | undefined; version: string },
): Promise<Respuesta> {
  const registro = await cajaAutenticada(deps.store, registroId, bearer)
  if (!registro) return NO_AUTORIZADO()
  if (!SEMVER.test(version)) return { status: 400, body: { error: 'Versión no válida.' } }
  if (!(await limitarIntentos(deps.store, `actualizacion:${registro.id}`, MAX_CONSULTAS_POR_DIA, DIA, deps.now()))) return DEMASIADOS()

  const candidatas = (await deps.act.releases())
    .filter((r) => SEMVER.test(r.version) && comparar(r.version, version) > 0 && enTanda(registro.id, r.porcentaje))
    .sort((a, b) => comparar(b.version, a.version))
  const r = candidatas[0]
  if (!r) return { status: 200, body: { disponible: false } }
  return { status: 200, body: { disponible: true, release: { version: r.version, url: r.url, sha256: r.sha256, tamano: r.tamano, firma: r.firma } } }
}

export async function registrarResultadoActualizacion(
  deps: ActualizacionDeps,
  { registroId, bearer, version, ok, detalle }: { registroId: string; bearer: string | null | undefined; version: string; ok: boolean; detalle: string | null },
): Promise<Respuesta> {
  const registro = await cajaAutenticada(deps.store, registroId, bearer)
  if (!registro) return NO_AUTORIZADO()
  if (!SEMVER.test(version) || typeof ok !== 'boolean') return { status: 400, body: { error: 'Datos no válidos.' } }
  if (!(await limitarIntentos(deps.store, `actualizacion-resultado:${registro.id}`, MAX_RESULTADOS_POR_DIA, DIA, deps.now()))) return DEMASIADOS()
  await deps.act.registrarResultado({ registroId: registro.id, version, ok, detalle: typeof detalle === 'string' ? detalle.slice(0, 120) : null })
  return { status: 200, body: { ok: true } }
}
