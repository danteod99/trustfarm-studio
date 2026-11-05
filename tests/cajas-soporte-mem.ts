// Almacén en memoria de los tickets de soporte, para las pruebas.
import type { AccesoFila, PermisoFila, SoporteStore, TicketFila } from '../app/lib/cajas/soporte-servicio.ts'

export function crearSoporteMem() {
  const m = { tickets: [] as TicketFila[], permisos: [] as PermisoFila[], accesos: [] as AccesoFila[] }
  let n = 0
  const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
  const store: SoporteStore = {
    async crearTicket(t) {
      const fila: TicketFila = { ...t, id: uid(), notaCierre: null, cerradoEn: null }
      m.tickets.push(fila)
      return fila
    },
    async ticket(id) {
      return m.tickets.find((t) => t.id === id) ?? null
    },
    async ticketsDeCaja(cajaId, ownerId) {
      return m.tickets.filter((t) => t.cajaId === cajaId && t.ownerId === ownerId)
    },
    async ticketsPendientes() {
      return m.tickets.filter((t) => t.estado !== 'cerrado')
    },
    async actualizarTicket(id, cambios) {
      Object.assign(m.tickets.find((t) => t.id === id)!, cambios)
    },
    async permisoAbierto(cajaId) {
      return m.permisos.find((p) => p.cajaId === cajaId && p.cerradoEn === null) ?? null
    },
    async permisosDeTickets(ids) {
      return m.permisos.filter((p) => ids.includes(p.ticketId))
    },
    async crearPermiso(p) {
      if (m.permisos.some((x) => x.cajaId === p.cajaId && x.cerradoEn === null)) return 'ocupado'
      const fila: PermisoFila = { ...p, id: uid(), aceptadoEn: null, aceptadoPor: null, venceEn: null, cerradoEn: null, motivoCierre: null }
      m.permisos.push(fila)
      return fila
    },
    async actualizarPermiso(id, cambios) {
      Object.assign(m.permisos.find((p) => p.id === id)!, cambios)
    },
    async aceptarPermiso(id, cambios) {
      const p = m.permisos.find((x) => x.id === id)!
      if (p.cerradoEn !== null || p.aceptadoEn !== null) return false
      Object.assign(p, cambios)
      return true
    },
    async accesosDePermisos(ids) {
      return m.accesos.filter((a) => ids.includes(a.permisoId))
    },
    async registrarAcceso(a) {
      m.accesos.push({ ...a, id: uid(), terminoEn: null })
    },
    async terminarAccesos(permisoId, cuando) {
      for (const a of m.accesos) if (a.permisoId === permisoId && a.terminoEn === null) a.terminoEn = cuando
    },
  }
  return { m, store }
}
