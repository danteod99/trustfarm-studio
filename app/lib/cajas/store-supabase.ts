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
      const { data, error } = await db.from('caja_registros').select('id, secreto_hash, estado, expira_en, caja_id, codigo').eq('id', id).maybeSingle()
      if (error) throw new Error('No se pudo leer el registro.')
      if (!data) return null
      return { id: data.id, secretoHash: data.secreto_hash, estado: data.estado, expiraEn: data.expira_en, cajaId: data.caja_id ?? null, codigo: data.codigo ?? null }
    },
    async obtenerCaja(id) {
      const { data, error } = await db.from('cajas').select('id, slug, tunnel_id, owner_id').eq('id', id).maybeSingle()
      if (error) throw new Error('No se pudo leer la caja.')
      return data ? { id: data.id, slug: data.slug, tunnelId: data.tunnel_id, ownerId: data.owner_id ?? null } : null
    },
    async activar(o) {
      const { data, error } = await db.rpc('caja_activar', {
        p_llave_hash: o.llaveHash, p_secreto_hash: o.secretoHash, p_codigo: o.codigo, p_expira: o.expiraEn, p_version: o.version, p_ip: o.ip,
      })
      if (error) {
        if ((error.message ?? '').includes('llave_invalida')) return 'llave_invalida'
        if (error.code === '23505') return 'codigo_duplicado'
        throw new Error('No se pudo activar la caja.')
      }
      const fila = Array.isArray(data) ? data[0] : data
      if (!fila?.registro_id || !fila?.caja_id) throw new Error('No se pudo activar la caja.')
      return { registroId: fila.registro_id as string, cajaId: fila.caja_id as string }
    },
    async nuevoCodigo(registroId, codigo, expiraEn) {
      const { data, error } = await db.rpc('caja_nuevo_codigo', { p_registro: registroId, p_codigo: codigo, p_expira: expiraEn })
      if (error) {
        if (error.code === '23505') return 'codigo_duplicado'
        throw new Error('No se pudo renovar el código.')
      }
      return data === true
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
