// Lista paginada de cajas para el panel de administración (lógica pura, probada con el almacén simulado).
import { direccion, encendida, type ClienteDeps } from './cliente-servicio.ts'

export const TAM_PAGINA_ADMIN = 100

export interface CajaAdmin {
  id: string; nombre: string; owner_id: string; direccion: string
  estado: 'encendida' | 'apagada'; ultima_senal: string | null; version: string | null; vinculada_en: string | null
}

/** Pide `limite + 1` filas para saber si hay otra página. Nunca expone tunnel_id. */
export async function paginaAdminCajas(deps: ClienteDeps, pagina: number): Promise<{ cajas: CajaAdmin[]; hay_mas: boolean }> {
  const p = Number.isInteger(pagina) && pagina > 0 && pagina < 1_000_000 ? pagina : 0
  const filas = await deps.store.listarTodasLasCajas(p * TAM_PAGINA_ADMIN, TAM_PAGINA_ADMIN + 1)
  return {
    hay_mas: filas.length > TAM_PAGINA_ADMIN,
    cajas: filas.slice(0, TAM_PAGINA_ADMIN).map(c => ({
      id: c.id, nombre: c.nombre, owner_id: c.ownerId, direccion: direccion(c, deps),
      estado: encendida(c, deps) ? 'encendida' : 'apagada', ultima_senal: c.lastSeen,
      version: c.version ?? null, vinculada_en: c.creadaEn ?? null,
    })),
  }
}
