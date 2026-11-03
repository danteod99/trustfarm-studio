// Almacén real del cliente sobre Supabase (service_role). Sin pruebas unitarias: se verifica con typecheck.
// Nunca se propagan mensajes crudos de Supabase.
import { supabaseAdmin } from '../supabase/admin'
import type { CajaCliente, ClienteStore } from './cliente-servicio'

const COLS = 'id, owner_id, nombre, slug, tunnel_id, last_seen, version, created_at, tope_diario, etiqueta, creada_por, email_asignado'
type Fila = { id: string; owner_id: string | null; etiqueta?: string | null; nombre: string; slug: string; tunnel_id: string; last_seen: string | null; version?: string | null; created_at?: string | null; tope_diario?: number | null; creada_por?: string | null; email_asignado?: string | null }
const mapear = (f: Fila): CajaCliente => ({ id: f.id, ownerId: f.owner_id, nombre: f.nombre, slug: f.slug, tunnelId: f.tunnel_id, lastSeen: f.last_seen ?? null, version: f.version ?? null, creadaEn: f.created_at ?? null, topeDiario: f.tope_diario ?? undefined, etiqueta: f.etiqueta ?? null, creadaPor: f.creada_por ?? null, emailAsignado: f.email_asignado ?? null })

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
      const { data, error } = await db.from('caja_registros').select('id, email_validado').eq('codigo', codigo).eq('estado', 'pendiente').is('caja_id', null).gt('expira_en', new Date().toISOString()).maybeSingle()
      if (error) throw new Error('No se pudo leer el registro.')
      return data ? { id: data.id as string, emailValidado: (data.email_validado as string | null) ?? null } : null
    },
    async vincularAsignada(o) {
      const { data, error } = await db.rpc('caja_vincular_asignada', { p_codigo: o.codigo, p_owner: o.ownerId, p_email: o.email, p_nombre: o.nombre })
      if (!error && typeof data === 'string') return { ok: true, cajaId: data }
      const msg = error?.message ?? ''
      if (msg.includes('codigo_invalido')) return { ok: false, motivo: 'codigo_invalido' }
      if (msg.includes('sin_caja_asignada')) return { ok: false, motivo: 'sin_caja_asignada' }
      return { ok: false, motivo: 'error' }
    },
    async asignarEmail(cajaId, email) {
      const { error } = await db.from('cajas').update({ email_asignado: email }).eq('id', cajaId)
      if (error) throw new Error('No se pudo guardar el correo.')
    },
    async contarCajasConEmail(email) {
      const { count, error } = await db.from('cajas').select('id', { count: 'exact', head: true }).eq('email_asignado', email)
      if (error) throw new Error('No se pudo contar las cajas.')
      return count ?? 0
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
      // Una sola implementación de la suma (la función SQL), agrupada en la base: sin el corte de 1000 filas de PostgREST.
      const { data, error } = await db.rpc('caja_gasto_hoy_varias', { p_cajas: ids, p_desde: desdeIso })
      if (error) throw new Error('No se pudo leer el gasto de las cajas.')
      for (const f of (data ?? []) as Array<{ caja_id: string; total: number }>) total[f.caja_id] = Number(f.total) || 0
      return total
    },
    // ── Caja de fábrica ──
    async contarPreparadasSinDueno() {
      const { count, error } = await db.from('cajas').select('id', { count: 'exact', head: true }).is('owner_id', null).not('creada_por', 'is', null)
      if (error) throw new Error('No se pudo contar las cajas.')
      return count ?? 0
    },
    async contarCreacionesAdmin(adminId, desdeIso) {
      const { count, error } = await db.from('caja_intentos').select('id', { count: 'exact', head: true }).eq('clave', `preparar:${adminId}`).gte('creado', desdeIso)
      if (error) throw new Error('No se pudo contar los intentos.')
      return count ?? 0
    },
    async registrarCreacionAdmin(adminId) {
      const { error } = await db.from('caja_intentos').insert({ clave: `preparar:${adminId}` })
      if (error) throw new Error('No se pudo registrar el intento.')
    },
    async preparar(o) {
      const { data, error } = await db.rpc('caja_preparar', {
        p_slug: o.slug, p_tunnel_id: o.tunnelId, p_etiqueta: o.etiqueta, p_admin: o.adminId, p_llave_hash: o.llaveHash, p_vence: o.venceEn,
      })
      if (!error && typeof data === 'string') return { ok: true, cajaId: data }
      const msg = error?.message ?? ''
      if (msg.includes('slug_repetido')) return { ok: false, motivo: 'slug_repetido' }
      if (msg.includes('limite_preparadas')) return { ok: false, motivo: 'limite_preparadas' }
      return { ok: false, motivo: 'error' }
    },
    async nuevaLlave(cajaId, llaveHash, venceEn) {
      const { error } = await db.rpc('caja_nueva_llave', { p_caja: cajaId, p_llave_hash: llaveHash, p_vence: venceEn })
      if (!error) return true
      if ((error.message ?? '').includes('caja_inexistente')) return false
      throw new Error('No se pudo generar la llave.')
    },
    async buscarCajaPreparadaPorCodigo(codigo) {
      const { data, error } = await db.from('caja_registros').select('caja_id').eq('codigo', codigo).not('caja_id', 'is', null).gt('expira_en', new Date().toISOString()).maybeSingle()
      if (error) throw new Error('No se pudo leer el registro.')
      if (!data?.caja_id) return null
      const { data: caja, error: e2 } = await db.from('cajas').select('id, email_asignado').eq('id', data.caja_id).is('owner_id', null).maybeSingle()
      if (e2) throw new Error('No se pudo leer la caja.')
      return caja ? { cajaId: caja.id as string, emailAsignado: (caja.email_asignado as string | null) ?? null } : null
    },
    async reclamar(o) {
      const { data, error } = await db.rpc('caja_reclamar', { p_codigo: o.codigo, p_owner: o.ownerId, p_nombre: o.nombre })
      if (!error && typeof data === 'string') return { ok: true, cajaId: data }
      return { ok: false, motivo: (error?.message ?? '').includes('codigo_invalido') ? 'codigo_invalido' : 'error' }
    },
    async liberarCaja(cajaId) {
      const { error } = await db.rpc('caja_liberar', { p_caja: cajaId })
      if (error) throw new Error('No se pudo quitar la caja.')
    },
    async listarTodasLasCajas(desde, limite) {
      const { data, error } = await db.from('cajas').select(COLS).order('created_at', { ascending: false }).range(desde, desde + limite - 1)
      if (error) throw new Error('No se pudo leer las cajas.')
      const cajas = (data as Fila[]).map(mapear)
      // «Activada» = ya tiene su registro (la caja usó su llave o el flujo antiguo); una consulta para toda la página.
      const ids = cajas.map((c) => c.id)
      if (ids.length) {
        const { data: regs, error: e2 } = await db.from('caja_registros').select('caja_id').in('caja_id', ids)
        if (e2) throw new Error('No se pudo leer los registros.')
        const activas = new Set((regs ?? []).map((r) => r.caja_id as string))
        for (const c of cajas) c.activada = activas.has(c.id)
      }
      return cajas
    },
  }
}
