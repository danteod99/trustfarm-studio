// Soporte a distancia: tickets, el permiso que da el dueño y los accesos de soporte.
// Las dependencias entran inyectadas para probarlas con un almacén en memoria.
import { firmarAceptacionSoporte, firmarPaseSoporte } from './pase.ts'
import { resolverCaja, type Respuesta, type ServicioDeps } from './servicio.ts'

export type NivelSoporte = 'app' | 'sistema'
export type EstadoTicket = 'abierto' | 'en_atencion' | 'cerrado'
export type MotivoCierre = 'vencio' | 'cliente' | 'soporte' | 'ticket'

export const MIN_MINUTOS = 15
export const MAX_MINUTOS = 10080
const MAX_ASUNTO = 2000

export interface TicketFila {
  id: string
  cajaId: string
  ownerId: string
  abiertoPor: 'cliente' | 'soporte'
  asunto: string
  estado: EstadoTicket
  notaCierre: string | null
  creadoEn: string
  cerradoEn: string | null
}

export interface PermisoFila {
  id: string
  ticketId: string
  cajaId: string
  nivel: NivelSoporte
  minutos: number
  concedidoEn: string
  aceptadoEn: string | null
  aceptadoPor: string | null
  venceEn: string | null
  cerradoEn: string | null
  motivoCierre: MotivoCierre | null
}

export interface AccesoFila {
  id: string
  permisoId: string
  nivel: NivelSoporte
  quien: string
  entroEn: string
  terminoEn: string | null
}

export interface SoporteStore {
  crearTicket(t: Pick<TicketFila, 'cajaId' | 'ownerId' | 'abiertoPor' | 'asunto' | 'estado' | 'creadoEn'>): Promise<TicketFila>
  ticket(id: string): Promise<TicketFila | null>
  /** Los del dueño actual: si la caja cambia de dueño, el nuevo no ve los anteriores. */
  ticketsDeCaja(cajaId: string, ownerId: string): Promise<TicketFila[]>
  ticketsPendientes(): Promise<TicketFila[]>
  actualizarTicket(id: string, cambios: Partial<Pick<TicketFila, 'estado' | 'notaCierre' | 'cerradoEn'>>): Promise<void>
  /** El permiso sin cerrar de la caja; la base garantiza que hay uno como máximo. */
  permisoAbierto(cajaId: string): Promise<PermisoFila | null>
  permisosDeTickets(ids: string[]): Promise<PermisoFila[]>
  crearPermiso(p: Pick<PermisoFila, 'ticketId' | 'cajaId' | 'nivel' | 'minutos' | 'concedidoEn'>): Promise<PermisoFila | 'ocupado'>
  actualizarPermiso(id: string, cambios: Partial<Pick<PermisoFila, 'aceptadoEn' | 'aceptadoPor' | 'venceEn' | 'cerradoEn' | 'motivoCierre'>>): Promise<void>
  accesosDePermisos(ids: string[]): Promise<AccesoFila[]>
  registrarAcceso(a: Pick<AccesoFila, 'permisoId' | 'nivel' | 'quien' | 'entroEn'>): Promise<void>
  terminarAccesos(permisoId: string, cuando: string): Promise<void>
}

export interface SoporteDeps extends ServicioDeps {
  soporte: SoporteStore
  paseKeyPrivada: string
  /** La dirección SSH temporal de una caja, por su túnel. */
  rutas: { abrir(tunnelId: string, slug: string): Promise<string>; cerrar(tunnelId: string, slug: string): Promise<void> }
}

export interface TicketVista {
  id: string
  asunto: string
  abierto_por: 'cliente' | 'soporte'
  estado: EstadoTicket
  nivel: NivelSoporte | null
  minutos: number | null
  aceptado_en: string | null
  vence_en: string | null
  permiso_abierto: boolean
  nota_cierre: string | null
  creado_en: string
  accesos: { nivel: NivelSoporte; entro_en: string; termino_en: string | null }[]
}

const NO_ENCONTRADO = (): Respuesta => ({ status: 404, body: { error: 'No encontré ese ticket.' } })
const OCUPADO = (): Respuesta => ({ status: 409, body: { error: 'Esta caja ya tiene un permiso de soporte activo. Ciérralo primero.' } })

export const nivelValido = (v: unknown): v is NivelSoporte => v === 'app' || v === 'sistema'
export const minutosValidos = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= MIN_MINUTOS && (v as number) <= MAX_MINUTOS

/** Devuelve el texto limpio o null si no sirve. */
export function asuntoValido(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length >= 1 && t.length <= MAX_ASUNTO ? t : null
}

/** Cierra un permiso y lo que cuelga de él. No toca lo ya cerrado: conserva la primera hora y el primer motivo. */
export async function cerrarPermiso(deps: SoporteDeps, p: PermisoFila, motivo: MotivoCierre): Promise<void> {
  if (p.cerradoEn !== null) return
  const cuando = deps.now().toISOString()
  await deps.soporte.actualizarPermiso(p.id, { cerradoEn: cuando, motivoCierre: motivo })
  await deps.soporte.terminarAccesos(p.id, cuando)
  p.cerradoEn = cuando
  p.motivoCierre = motivo
  // Si Cloudflare falla, igual queda cerrado: sin un acceso abierto, la caja no acepta la llave aunque la dirección siga
  if (p.nivel === 'sistema' && p.aceptadoEn !== null) {
    try {
      const caja = await deps.store.obtenerCaja(p.cajaId)
      if (caja) await deps.rutas.cerrar(caja.tunnelId, caja.slug)
    } catch {
      console.error('[soporte] no se pudo cerrar la ruta SSH')
    }
  }
}

/** Si el permiso ya venció lo cierra, y devuelve el que sigue vigente o por aceptar. */
export async function permisoAlDia(deps: SoporteDeps, cajaId: string): Promise<PermisoFila | null> {
  const p = await deps.soporte.permisoAbierto(cajaId)
  if (!p) return null
  if (p.venceEn !== null && Date.parse(p.venceEn) <= deps.now().getTime()) {
    await cerrarPermiso(deps, p, 'vencio')
    return null
  }
  return p
}

function vista(t: TicketFila, permisos: PermisoFila[], accesos: AccesoFila[]): TicketVista {
  const propios = permisos.filter((p) => p.ticketId === t.id).sort((a, b) => a.concedidoEn.localeCompare(b.concedidoEn))
  const ultimo = propios[propios.length - 1] ?? null
  const ids = new Set(propios.map((p) => p.id))
  return {
    id: t.id,
    asunto: t.asunto,
    abierto_por: t.abiertoPor,
    estado: t.estado,
    nivel: ultimo?.nivel ?? null,
    minutos: ultimo?.minutos ?? null,
    aceptado_en: ultimo?.aceptadoEn ?? null,
    vence_en: ultimo?.venceEn ?? null,
    permiso_abierto: ultimo !== null && ultimo.cerradoEn === null,
    nota_cierre: t.notaCierre,
    creado_en: t.creadoEn,
    accesos: accesos
      .filter((a) => ids.has(a.permisoId))
      .map((a) => ({ nivel: a.nivel, entro_en: a.entroEn, termino_en: a.terminoEn })),
  }
}

export async function vistasDe(deps: SoporteDeps, tickets: TicketFila[]): Promise<TicketVista[]> {
  const ids = tickets.map((t) => t.id)
  const permisos = ids.length ? await deps.soporte.permisosDeTickets(ids) : []
  const accesos = permisos.length ? await deps.soporte.accesosDePermisos(permisos.map((p) => p.id)) : []
  return tickets.map((t) => vista(t, permisos, accesos))
}

/** Rutas de la caja: autenticada con su secreto, solo alcanza los tickets de esa caja y de su dueño actual. */
export async function soporteCaja(
  deps: SoporteDeps,
  o: { registroId: string; bearer: string | null | undefined; accion: unknown; datos: Record<string, unknown> },
): Promise<Respuesta> {
  const r = await resolverCaja(deps, { registroId: o.registroId, bearer: o.bearer })
  if (!r.ok) {
    if (r.status === 409 && o.accion === 'listar') return { status: 200, body: { tickets: [] } }
    return { status: r.status, body: { error: r.error } }
  }
  const { caja } = r
  const d = o.datos

  // El ticket pedido, si es de esta caja y de su dueño actual
  const propio = async (): Promise<TicketFila | null> => {
    if (typeof d.ticket_id !== 'string') return null
    const t = await deps.soporte.ticket(d.ticket_id).catch(() => null)
    return t && t.cajaId === caja.id && t.ownerId === caja.ownerId ? t : null
  }

  switch (o.accion) {
    case 'listar': {
      await permisoAlDia(deps, caja.id)
      const tickets = await deps.soporte.ticketsDeCaja(caja.id, caja.ownerId)
      return { status: 200, body: { tickets: await vistasDe(deps, tickets) } }
    }
    case 'crear': {
      const asunto = asuntoValido(d.asunto)
      if (!asunto) return { status: 400, body: { error: 'Escribe qué pasa, en menos de 2000 caracteres.' } }
      if (!nivelValido(d.nivel)) return { status: 400, body: { error: 'Elige el nivel de acceso.' } }
      if (!minutosValidos(d.minutos)) return { status: 400, body: { error: 'El tiempo debe ser de 15 minutos a 7 días.' } }
      if (await permisoAlDia(deps, caja.id)) return OCUPADO()
      const ahora = deps.now().toISOString()
      const t = await deps.soporte.crearTicket({ cajaId: caja.id, ownerId: caja.ownerId, abiertoPor: 'cliente', asunto, estado: 'abierto', creadoEn: ahora })
      const p = await deps.soporte.crearPermiso({ ticketId: t.id, cajaId: caja.id, nivel: d.nivel, minutos: d.minutos, concedidoEn: ahora })
      if (p === 'ocupado') return OCUPADO()
      return { status: 200, body: { ticket: (await vistasDe(deps, [t]))[0] } }
    }
    case 'permitir': {
      const t = await propio()
      if (!t || t.estado === 'cerrado') return NO_ENCONTRADO()
      if (!nivelValido(d.nivel)) return { status: 400, body: { error: 'Elige el nivel de acceso.' } }
      if (!minutosValidos(d.minutos)) return { status: 400, body: { error: 'El tiempo debe ser de 15 minutos a 7 días.' } }
      if (await permisoAlDia(deps, caja.id)) return OCUPADO()
      const p = await deps.soporte.crearPermiso({ ticketId: t.id, cajaId: caja.id, nivel: d.nivel, minutos: d.minutos, concedidoEn: deps.now().toISOString() })
      if (p === 'ocupado') return OCUPADO()
      return { status: 200, body: { ticket: (await vistasDe(deps, [t]))[0] } }
    }
    case 'cerrar_acceso': {
      const t = await propio()
      if (!t) return NO_ENCONTRADO()
      const p = await deps.soporte.permisoAbierto(caja.id)
      if (p && p.ticketId === t.id) await cerrarPermiso(deps, p, 'cliente')
      return { status: 200, body: { ok: true } }
    }
    case 'sondear': {
      const t = await propio()
      if (!t) return NO_ENCONTRADO()
      const p = await permisoAlDia(deps, caja.id)
      if (t.estado === 'cerrado' || !p || p.ticketId !== t.id) return { status: 200, body: { estado: 'cerrado', nota: t.notaCierre } }
      if (p.aceptadoEn === null || p.venceEn === null) return { status: 200, body: { estado: 'esperando' } }
      const aceptacion = firmarAceptacionSoporte({ box: caja.id, ticket: t.id, nivel: p.nivel, venceEn: p.venceEn, now: deps.now(), privateKeyB64: deps.paseKeyPrivada })
      return { status: 200, body: { estado: 'aceptado', aceptacion } }
    }
    default:
      return { status: 400, body: { error: 'Acción desconocida.' } }
  }
}

const MAX_NOTA = 2000
const SIN_ACCESO = (): Respuesta => ({ status: 409, body: { error: 'No hay un acceso vigente en este ticket.' } })

/** Acciones de soporte. La ruta ya comprobó que `quien` está en SOPORTE_EMAILS. */
export async function soporteAdmin(
  deps: SoporteDeps,
  o: { quien: string; accion: unknown; datos: Record<string, unknown> },
): Promise<Respuesta> {
  const d = o.datos
  const delTicket = async () => {
    if (typeof d.ticket_id !== 'string') return null
    const t = await deps.soporte.ticket(d.ticket_id)
    if (!t) return null
    const caja = await deps.store.obtenerCaja(t.cajaId)
    return caja ? { t, caja } : null
  }
  // El permiso vigente de este ticket, ya aceptado
  const acceso = async (cajaId: string, ticketId: string) => {
    const p = await permisoAlDia(deps, cajaId)
    return p && p.ticketId === ticketId && p.venceEn !== null ? p : null
  }

  switch (o.accion) {
    case 'listar': {
      const tickets = await deps.soporte.ticketsPendientes()
      const cajas = new Map<string, Awaited<ReturnType<SoporteDeps['store']['obtenerCaja']>>>()
      for (const t of tickets) {
        if (!cajas.has(t.cajaId)) {
          cajas.set(t.cajaId, await deps.store.obtenerCaja(t.cajaId))
          await permisoAlDia(deps, t.cajaId)
        }
      }
      const vistas = await vistasDe(deps, tickets)
      const correos = new Map<string, string | null>()
      for (const t of tickets) if (!correos.has(t.ownerId)) correos.set(t.ownerId, await deps.store.obtenerEmailDueno(t.ownerId))
      return {
        status: 200,
        body: {
          tickets: vistas.map((v, i) => ({
            ...v,
            caja: { id: tickets[i].cajaId, slug: cajas.get(tickets[i].cajaId)?.slug ?? null },
            cliente: correos.get(tickets[i].ownerId) ?? null,
          })),
        },
      }
    }
    case 'crear': {
      const asunto = asuntoValido(d.asunto)
      if (!asunto) return { status: 400, body: { error: 'Escribe el motivo, en menos de 2000 caracteres.' } }
      const caja = typeof d.caja_id === 'string' ? await deps.store.obtenerCaja(d.caja_id) : null
      if (!caja) return { status: 404, body: { error: 'No encontré esa caja.' } }
      if (caja.ownerId === null) return { status: 409, body: { error: 'Esa caja todavía no tiene dueño.' } }
      const t = await deps.soporte.crearTicket({ cajaId: caja.id, ownerId: caja.ownerId, abiertoPor: 'soporte', asunto, estado: 'abierto', creadoEn: deps.now().toISOString() })
      return { status: 200, body: { ticket: (await vistasDe(deps, [t]))[0] } }
    }
    case 'aceptar': {
      const x = await delTicket()
      if (!x) return NO_ENCONTRADO()
      if (x.t.estado === 'cerrado' || x.caja.ownerId !== x.t.ownerId) return { status: 409, body: { error: 'Este ticket ya no se puede aceptar.' } }
      const p = await permisoAlDia(deps, x.caja.id)
      if (!p || p.ticketId !== x.t.id) return { status: 409, body: { error: 'El cliente todavía no dio su permiso.' } }
      if (p.aceptadoEn !== null) return { status: 200, body: { ok: true, vence_en: p.venceEn } }
      if (p.nivel === 'sistema') {
        try {
          await deps.rutas.abrir(x.caja.tunnelId, x.caja.slug)
        } catch {
          return { status: 502, body: { error: 'No se pudo abrir la ruta de soporte. Inténtalo de nuevo.' } }
        }
      }
      const ahora = deps.now()
      const venceEn = new Date(ahora.getTime() + p.minutos * 60_000).toISOString()
      await deps.soporte.actualizarPermiso(p.id, { aceptadoEn: ahora.toISOString(), aceptadoPor: o.quien, venceEn })
      await deps.soporte.actualizarTicket(x.t.id, { estado: 'en_atencion' })
      return { status: 200, body: { ok: true, vence_en: venceEn } }
    }
    case 'cerrar_acceso': {
      const x = await delTicket()
      if (!x) return NO_ENCONTRADO()
      const p = await deps.soporte.permisoAbierto(x.caja.id)
      if (p && p.ticketId === x.t.id) await cerrarPermiso(deps, p, 'soporte')
      return { status: 200, body: { ok: true } }
    }
    case 'cerrar_ticket': {
      const x = await delTicket()
      if (!x) return NO_ENCONTRADO()
      const nota = typeof d.nota === 'string' ? d.nota.trim() : ''
      if (nota.length > MAX_NOTA) return { status: 400, body: { error: 'La nota es demasiado larga.' } }
      const p = await deps.soporte.permisoAbierto(x.caja.id)
      if (p && p.ticketId === x.t.id) await cerrarPermiso(deps, p, 'ticket')
      await deps.soporte.actualizarTicket(x.t.id, { estado: 'cerrado', notaCierre: nota || null, cerradoEn: deps.now().toISOString() })
      return { status: 200, body: { ok: true } }
    }
    case 'entrar_app': {
      const x = await delTicket()
      if (!x) return NO_ENCONTRADO()
      const p = await acceso(x.caja.id, x.t.id)
      if (!p) return SIN_ACCESO()
      const pase = firmarPaseSoporte({ sub: o.quien, box: x.caja.id, venceEn: p.venceEn!, now: deps.now(), privateKeyB64: deps.paseKeyPrivada })
      await deps.soporte.registrarAcceso({ permisoId: p.id, nivel: 'app', quien: o.quien, entroEn: deps.now().toISOString() })
      return { status: 200, body: { url: `https://${x.caja.slug}.${deps.env.dominio}/auth/soporte?pase=${pase}` } }
    }
    case 'comando_ssh': {
      const x = await delTicket()
      if (!x) return NO_ENCONTRADO()
      const p = await acceso(x.caja.id, x.t.id)
      if (!p || p.nivel !== 'sistema') return SIN_ACCESO()
      await deps.soporte.registrarAcceso({ permisoId: p.id, nivel: 'sistema', quien: o.quien, entroEn: deps.now().toISOString() })
      const comando = `ssh -o ProxyCommand="cloudflared access ssh --hostname %h" -i ~/.ssh/trust-soporte empleado@soporte-${x.caja.slug}.${deps.env.dominio}`
      return { status: 200, body: { comando } }
    }
    default:
      return { status: 400, body: { error: 'Acción desconocida.' } }
  }
}
