// Almacén real de las actualizaciones sobre Supabase (service_role). Sin pruebas unitarias: se verifica con typecheck.
import { supabaseAdmin } from '../supabase/admin'
import type { ActualizacionStore } from './actualizacion-servicio'

export function actualizacionStoreSupabase(): ActualizacionStore {
  const db = supabaseAdmin()
  return {
    async releases() {
      const { data, error } = await db.from('cajas_releases').select('version, url, sha256, tamano, firma, porcentaje').order('creada_en', { ascending: false }).limit(50)
      if (error) throw new Error('No se pudieron leer las versiones.')
      return data ?? []
    },
    async registrarResultado(r) {
      const { error } = await db.from('cajas_actualizaciones').insert({ registro_id: r.registroId, version: r.version, ok: r.ok, detalle: r.detalle })
      if (error) throw new Error('No se pudo registrar el resultado.')
    },
  }
}
