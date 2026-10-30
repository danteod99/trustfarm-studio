// Almacén real del cliente sobre Supabase (service_role). Sin pruebas unitarias: se verifica con typecheck.
// Nunca se propagan mensajes crudos de Supabase.
import { supabaseAdmin } from '../supabase/admin'
import type { CajaCliente, ClienteStore } from './cliente-servicio'

const COLS = 'id, owner_id, nombre, slug, tunnel_id, last_seen, version, created_at, tope_diario'
type Fila = { id: string; owner_id: string; nombre: string; slug: string; tunnel_id: string; last_seen: string | null; version?: string | null; created_at?: string | null; tope_diario?: number | null }
const mapear = (f: Fila): CajaCliente => ({ id: f.id, ownerId: f.owner_id, nombre: f.nombre, slug: f.slug, tunnelId: f.tunnel_id, lastSeen: f.last_seen ?? null, version: f.version ?? null, creadaEn: f.created_at ?? null, topeDiario: f.tope_diario ?? undefined })

export function clienteStoreSupabase(): ClienteStore {
  const db = supabaseAdmin()
  return {
    async contarFallosVincular(userId, desdeIso) {
      const { count, error } = await db.from('caja_intentos').select('id', { count: 'exact', head: true }).eq('clave', `vincular:${userId}`).gte('creado', desdeIso)
      if (error) throw new Error('No se pudo contar los intentos.')
      return count ?? 0
    },
    async registrarFalloVincular(userId) {
      const { error } = await db.from('caja_intentos').insert({ clave: `vincular:${userId}` })
      if (error) throw new Error('No se pudo registrar el intento.')
    },
    async contarExitosVincular(userId, desdeIso) {
      const { count, error } = await db.from('caja_intentos').select('id', { count: 'exact', head: true }).eq('clave', `vincular_ok:${userId}`).gte('creado', desdeIso)
      if (error) throw new Error('No se pudo contar los intentos.')
      return count ?? 0
    },
    async registrarExitoVincular(userId) {
      const { error } = await db.from('caja_intentos').insert({ clave: `vincular_ok:${userId}` })
      if (error) throw new Error('No se pudo registrar el intento.')
    },
    async contarCajas(ownerId) {
      const { count, error } = await db.from('cajas').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId)
      if (error) throw new Error('No se pudo contar las cajas.')
      return count ?? 0
    },
    async buscarRegistroVinculable(codigo) {
      const { data, error } = await db.from('caja_registros').select('id').eq('codigo', codigo).eq('estado', 'pendiente').is('caja_id', null).gt('expira_en', new Date().toISOString()).maybeSingle()
      if (error) throw new Error('No se pudo leer el registro.')
      return data ? { id: data.id as string } : null
    },
    async vincular(o) {
      const { data, error } = await db.rpc('caja_vincular', { p_codigo: o.codigo, p_owner: o.ownerId, p_nombre: o.nombre, p_slug: o.slug, p_tunnel_id: o.tunnelId })
      if (!error && typeof data === 'string') return { ok: true, cajaId: data }
      const code = error?.code
      const msg = error?.message ?? ''
      if (code === '23505') return { ok: false, motivo: 'slug_repetido' }
      if (code === '40001' || (code === 'P0001' && msg.includes('codigo_invalido'))) return { ok: false, motivo: 'codigo_invalido' }
      return { ok: false, motivo: 'error' }
    },
    async listarCajas(ownerId) {
      const { data, error } = await db.from('cajas').select(COLS).eq('owner_id', ownerId).order('created_at', { ascending: true })
      if (error) throw new Error('No se pudo leer las cajas.')
      return (data as Fila[]).map(mapear)
    },
    async obtenerCaja(cajaId) {
      const { data, error } = await db.from('cajas').select(COLS).eq('id', cajaId).maybeSingle()
      if (error) throw new Error('No se pudo leer la caja.')
      return data ? mapear(data as Fila) : null
    },
    async renombrarCaja(cajaId, nombre) {
      const { error } = await db.from('cajas').update({ nombre }).eq('id', cajaId)
      if (error) throw new Error('No se pudo renombrar la caja.')
    },
    async desvincularCaja(cajaId) {
      const { error } = await db.rpc('caja_desvincular', { p_caja: cajaId })
      if (error) throw new Error('No se pudo desvincular la caja.')
    },
    async fijarTope(cajaId, tope) {
      const { data, error } = await db.from('cajas').update({ tope_diario: tope }).eq('id', cajaId).select('id')
      if (error) throw new Error('No se pudo guardar el tope.')
      return (data?.length ?? 0) > 0
    },
    async gastoHoyPorCajas(ids, desdeIso) {
      const total: Record<string, number> = Object.fromEntries(ids.map(i => [i, 0]))
      if (!ids.length) return total
      // Una sola consulta para toda la página; se suma aquí (misma regla que la función SQL caja_gasto_hoy).
      const { data, error } = await db.from('ai_generations').select('caja_id, cost_credits')
        .in('caja_id', ids).eq('charged', true).neq('status', 'failed').gte('created_at', desdeIso)
      if (error) throw new Error('No se pudo leer el gasto de las cajas.')
      for (const f of (data ?? []) as Array<{ caja_id: string; cost_credits: number }>) total[f.caja_id] = (total[f.caja_id] ?? 0) + f.cost_credits
      return total
    },
    async listarTodasLasCajas(desde, limite) {
      const { data, error } = await db.from('cajas').select(COLS).order('created_at', { ascending: false }).range(desde, desde + limite - 1)
      if (error) throw new Error('No se pudo leer las cajas.')
      return (data as Fila[]).map(mapear)
    },
  }
}
