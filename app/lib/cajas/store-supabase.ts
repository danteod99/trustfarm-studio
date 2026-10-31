// Almacén real de cajas sobre Supabase (service_role). Sin pruebas unitarias: se verifica con typecheck.
import { supabaseAdmin } from '../supabase/admin'
import type { CajasStore } from './servicio'

export function supabaseStore(): CajasStore {
  const db = supabaseAdmin()
  return {
    async contarIntentos(clave, desdeIso) {
      const { count, error } = await db.from('caja_intentos').select('id', { count: 'exact', head: true }).eq('clave', clave).gte('creado', desdeIso)
      if (error) throw new Error('No se pudo contar los intentos.')
      return count ?? 0
    },
    async registrarIntento(clave) {
      const { error } = await db.from('caja_intentos').insert({ clave })
      if (error) throw new Error('No se pudo registrar el intento.')
    },
    async crearRegistro(r) {
      const { data, error } = await db
        .from('caja_registros')
        .insert({ codigo: r.codigo, secreto_hash: r.secretoHash, expira_en: r.expiraEn, version: r.version, ip: r.ip })
        .select('id')
        .single()
      if (error) {
        if (error.code === '23505') return 'codigo_duplicado'
        throw new Error('No se pudo crear el registro.')
      }
      return { id: data.id as string }
    },
    async buscarRegistro(id) {
      const { data, error } = await db.from('caja_registros').select('id, secreto_hash, estado, expira_en, caja_id').eq('id', id).maybeSingle()
      if (error) throw new Error('No se pudo leer el registro.')
      if (!data) return null
      return { id: data.id, secretoHash: data.secreto_hash, estado: data.estado, expiraEn: data.expira_en, cajaId: data.caja_id ?? null }
    },
    async obtenerCaja(id) {
      const { data, error } = await db.from('cajas').select('id, slug, tunnel_id, owner_id').eq('id', id).maybeSingle()
      if (error) throw new Error('No se pudo leer la caja.')
      return data ? { id: data.id, slug: data.slug, tunnelId: data.tunnel_id, ownerId: data.owner_id } : null
    },
    async obtenerEmailDueno(ownerId) {
      const { data, error } = await db.auth.admin.getUserById(ownerId)
      if (error) return null
      return data.user?.email ?? null
    },
    async tocarCaja(cajaId, version, ahoraIso) {
      const { error } = await db.from('cajas').update({ last_seen: ahoraIso, version }).eq('id', cajaId)
      if (error) throw new Error('No se pudo actualizar la caja.')
    },
    async borrarRegistrosVencidos(antesIso) {
      const { error } = await db.from('caja_registros').delete().eq('estado', 'pendiente').lt('expira_en', antesIso)
      if (error) throw new Error('No se pudo limpiar los registros.')
    },
    async borrarIntentosViejos(antesIso) {
      const { error } = await db.from('caja_intentos').delete().lt('creado', antesIso)
      if (error) throw new Error('No se pudo limpiar los intentos.')
    },
  }
}
