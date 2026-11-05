// Almacén real del soporte sobre Supabase (service_role). Sin pruebas unitarias: se verifica con la mini PC real.
import { supabaseAdmin } from '../supabase/admin'
import type { AccesoFila, PermisoFila, SoporteStore, TicketFila } from './soporte-servicio'

const ticket = (f: any): TicketFila => ({
  id: f.id, cajaId: f.caja_id, ownerId: f.owner_id, abiertoPor: f.abierto_por, asunto: f.asunto, estado: f.estado,
  notaCierre: f.nota_cierre, creadoEn: f.creado_en, cerradoEn: f.cerrado_en,
})
const permiso = (f: any): PermisoFila => ({
  id: f.id, ticketId: f.ticket_id, cajaId: f.caja_id, nivel: f.nivel, minutos: f.minutos, concedidoEn: f.concedido_en,
  aceptadoEn: f.aceptado_en, aceptadoPor: f.aceptado_por, venceEn: f.vence_en, cerradoEn: f.cerrado_en, motivoCierre: f.motivo_cierre,
})
const acceso = (f: any): AccesoFila => ({
  id: f.id, permisoId: f.permiso_id, nivel: f.nivel, quien: f.quien, entroEn: f.entro_en, terminoEn: f.termino_en,
})

const OTRO_ABIERTO = '23505' // índice único: ya hay un permiso sin cerrar en esa caja

export function soporteStoreSupabase(): SoporteStore {
  const db = supabaseAdmin()
  const falla = (que: string) => new Error(`No se pudo ${que} el soporte.`)
  return {
    async crearTicket(t) {
      const { data, error } = await db.from('soporte_tickets').insert({
        caja_id: t.cajaId, owner_id: t.ownerId, abierto_por: t.abiertoPor, asunto: t.asunto, estado: t.estado, creado_en: t.creadoEn,
      }).select('*').single()
      if (error || !data) throw falla('guardar')
      return ticket(data)
    },
    async ticket(id) {
      const { data, error } = await db.from('soporte_tickets').select('*').eq('id', id).maybeSingle()
      if (error) throw falla('leer')
      return data ? ticket(data) : null
    },
    async ticketsDeCaja(cajaId, ownerId) {
      const { data, error } = await db.from('soporte_tickets').select('*').eq('caja_id', cajaId).eq('owner_id', ownerId).order('creado_en', { ascending: false }).limit(100)
      if (error) throw falla('leer')
      return (data ?? []).map(ticket)
    },
    async ticketsPendientes() {
      const { data, error } = await db.from('soporte_tickets').select('*').neq('estado', 'cerrado').order('creado_en', { ascending: false }).limit(200)
      if (error) throw falla('leer')
      return (data ?? []).map(ticket)
    },
    async actualizarTicket(id, c) {
      const { error } = await db.from('soporte_tickets').update({
        ...(c.estado !== undefined ? { estado: c.estado } : {}),
        ...(c.notaCierre !== undefined ? { nota_cierre: c.notaCierre } : {}),
        ...(c.cerradoEn !== undefined ? { cerrado_en: c.cerradoEn } : {}),
      }).eq('id', id)
      if (error) throw falla('guardar')
    },
    async permisoAbierto(cajaId) {
      const { data, error } = await db.from('soporte_permisos').select('*').eq('caja_id', cajaId).is('cerrado_en', null).maybeSingle()
      if (error) throw falla('leer')
      return data ? permiso(data) : null
    },
    async permisosDeTickets(ids) {
      const { data, error } = await db.from('soporte_permisos').select('*').in('ticket_id', ids)
      if (error) throw falla('leer')
      return (data ?? []).map(permiso)
    },
    async crearPermiso(p) {
      const { data, error } = await db.from('soporte_permisos').insert({
        ticket_id: p.ticketId, caja_id: p.cajaId, nivel: p.nivel, minutos: p.minutos, concedido_en: p.concedidoEn,
      }).select('*').single()
      if (error?.code === OTRO_ABIERTO) return 'ocupado'
      if (error || !data) throw falla('guardar')
      return permiso(data)
    },
    async actualizarPermiso(id, c) {
      const { error } = await db.from('soporte_permisos').update({
        ...(c.aceptadoEn !== undefined ? { aceptado_en: c.aceptadoEn } : {}),
        ...(c.aceptadoPor !== undefined ? { aceptado_por: c.aceptadoPor } : {}),
        ...(c.venceEn !== undefined ? { vence_en: c.venceEn } : {}),
        ...(c.cerradoEn !== undefined ? { cerrado_en: c.cerradoEn } : {}),
        ...(c.motivoCierre !== undefined ? { motivo_cierre: c.motivoCierre } : {}),
      }).eq('id', id)
      if (error) throw falla('guardar')
    },
    async accesosDePermisos(ids) {
      const { data, error } = await db.from('soporte_accesos').select('*').in('permiso_id', ids).order('entro_en', { ascending: true })
      if (error) throw falla('leer')
      return (data ?? []).map(acceso)
    },
    async registrarAcceso(a) {
      const { error } = await db.from('soporte_accesos').insert({ permiso_id: a.permisoId, nivel: a.nivel, quien: a.quien, entro_en: a.entroEn })
      if (error) throw falla('guardar')
    },
    async terminarAccesos(permisoId, cuando) {
      const { error } = await db.from('soporte_accesos').update({ termino_en: cuando }).eq('permiso_id', permisoId).is('termino_en', null)
      if (error) throw falla('guardar')
    },
  }
}
