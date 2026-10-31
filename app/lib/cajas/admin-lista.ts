// Lista paginada de cajas para el panel de administración (lógica pura, probada con el almacén simulado).
import { direccion, encendida, type ClienteDeps } from './cliente-servicio.ts'
import { TOPE_DIARIO_POR_DEFECTO, inicioDiaLima } from './estudio-tope.ts'

export const TAM_PAGINA_ADMIN = 100

export interface CajaAdmin {
  id: string; nombre: string; owner_id: string | null; direccion: string
  estado: 'encendida' | 'apagada'; ultima_senal: string | null; version: string | null; vinculada_en: string | null
  /** Tope diario del Estudio y lo gastado hoy (día de Lima). */
  tope_diario: number; gastado_hoy: number
}

/** Pide `limite + 1` filas para saber si hay otra página. Nunca expone tunnel_id. */
export async function paginaAdminCajas(deps: ClienteDeps, pagina: number): Promise<{ cajas: CajaAdmin[]; hay_mas: boolean }> {
  const p = Number.isInteger(pagina) && pagina > 0 && pagina < 1_000_000 ? pagina : 0
  const filas = await deps.store.listarTodasLasCajas(p * TAM_PAGINA_ADMIN, TAM_PAGINA_ADMIN + 1)
  const visibles = filas.slice(0, TAM_PAGINA_ADMIN)
  const gasto = visibles.length ? await deps.store.gastoHoyPorCajas(visibles.map(c => c.id), inicioDiaLima(deps.now()).toISOString()) : {}
  return {
    hay_mas: filas.length > TAM_PAGINA_ADMIN,
    cajas: visibles.map(c => ({
      id: c.id, nombre: c.nombre, owner_id: c.ownerId, direccion: direccion(c, deps),
      estado: encendida(c, deps) ? 'encendida' : 'apagada', ultima_senal: c.lastSeen,
      version: c.version ?? null, vinculada_en: c.creadaEn ?? null,
      tope_diario: c.topeDiario ?? TOPE_DIARIO_POR_DEFECTO, gastado_hoy: gasto[c.id] ?? 0,
    })),
  }
}

export const TOPE_MAXIMO = 10_000

/** Cambia el tope diario de una caja. Solo enteros de 0 a 10000 (0 = la caja no puede gastar). */
export async function fijarTopeAdmin(
  deps: ClienteDeps,
  { cajaId, tope }: { cajaId: string; tope: unknown },
): Promise<{ ok: true } | { ok: false; status: 400 | 404; error: string }> {
  if (typeof tope !== 'number' || !Number.isInteger(tope) || tope < 0 || tope > TOPE_MAXIMO) {
    return { ok: false, status: 400, error: `El tope debe ser un número entero entre 0 y ${TOPE_MAXIMO}.` }
  }
  return (await deps.store.fijarTope(cajaId, tope)) ? { ok: true } : { ok: false, status: 404, error: 'No encontré esa caja.' }
}
