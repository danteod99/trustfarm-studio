// Soporte a distancia: tickets y permisos, vistos desde la caja que llama con su secreto.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registrarCaja } from '../app/lib/cajas/servicio.ts'
import { soporteCaja } from '../app/lib/cajas/soporte-servicio.ts'
import { crearDeps } from './cajas-mem.ts'
import { crearSoporteMem } from './cajas-soporte-mem.ts'

const T0 = new Date('2026-11-05T12:00:00Z')
const OWNER = '00000000-0000-4000-8000-0000000000aa'
const OTRO = '00000000-0000-4000-8000-0000000000bb'

async function nuevaCaja(e: ReturnType<typeof entorno>, id: string, slug: string, ownerId: string | null = OWNER) {
  const r = await registrarCaja(e.deps, { ip: id, version: '1.0.0' })
  if (!r.ok) throw new Error('registro falló')
  const reg = e.m.registros[e.m.registros.length - 1]
  reg.estado = 'vinculada'
  reg.cajaId = id
  e.m.cajas.push({ id, slug, tunnelId: `tun-${slug}`, ownerId })
  return { registroId: reg.id, bearer: r.secreto as string }
}

function entorno() {
  const ahora = { t: new Date(T0) }
  const base = crearDeps(ahora)
  const sop = crearSoporteMem()
  const deps = { ...base.deps, soporte: sop.store }
  return { ...base, deps, ahora, sop }
}

async function conCaja() {
  const e = entorno()
  const c = await nuevaCaja(e, 'caja-1', 'abcd1234')
  const pedir = (accion: string, datos: object = {}) => soporteCaja(e.deps, { ...c, accion, datos: datos as Record<string, unknown> })
  const crear = async (o: object = {}) => {
    const r = await pedir('crear', { asunto: 'No responde', nivel: 'app', minutos: 30, ...o })
    return { r, ticket: (r.body as any).ticket }
  }
  return { ...e, c, pedir, crear }
}

test('crear: asunto de 1 a 2000 caracteres; minutos fuera de 15-10080 o no enteros dan 400', async () => {
  const e = await conCaja()
  for (const minutos of [14, 10081, 30.5, '30', null]) {
    assert.equal((await e.crear({ minutos })).r.status, 400, String(minutos))
  }
  for (const asunto of ['', '   ', 'x'.repeat(2001), 5]) {
    assert.equal((await e.crear({ asunto })).r.status, 400, String(asunto).slice(0, 10))
  }
  assert.equal(e.sop.m.tickets.length, 0)
  const ok = await e.crear({ minutos: 15 })
  assert.equal(ok.r.status, 200)
  assert.equal(ok.ticket.estado, 'abierto')
  assert.equal(ok.ticket.abierto_por, 'cliente')
  assert.equal(ok.ticket.nivel, 'app')
  assert.equal(ok.ticket.minutos, 15)
  assert.equal(ok.ticket.vence_en, null)
})

test('nivel distinto de app o sistema da 400', async () => {
  const e = await conCaja()
  assert.equal((await e.crear({ nivel: 'root' })).r.status, 400)
  assert.equal(e.sop.m.tickets.length, 0)
})

test('secreto malo: 401 igual que en las demás rutas de caja', async () => {
  const e = await conCaja()
  const r = await soporteCaja(e.deps, { registroId: e.c.registroId, bearer: 'malo', accion: 'listar', datos: {} })
  assert.equal(r.status, 401)
  assert.deepEqual(r.body, { error: 'No autorizado.' })
})

test('accion desconocida: 400', async () => {
  const e = await conCaja()
  assert.equal((await e.pedir('borrar_todo')).status, 400)
})

test('listar solo trae los tickets de esa caja y de su dueño actual', async () => {
  const e = await conCaja()
  await e.crear()
  const otra = await nuevaCaja(e, 'caja-2', 'efgh5678')
  const deOtra = await soporteCaja(e.deps, { ...otra, accion: 'listar', datos: {} })
  assert.deepEqual((deOtra.body as any).tickets, [])
  assert.equal(((await e.pedir('listar')).body as any).tickets.length, 1)
  // La caja cambia de dueño: el nuevo no ve lo del anterior
  e.m.cajas.find((x: any) => x.id === 'caja-1')!.ownerId = OTRO
  assert.deepEqual(((await e.pedir('listar')).body as any).tickets, [])
})

test('caja sin dueño: 409 al crear, listar vacío; desvinculada: 401', async () => {
  const e = entorno()
  const c = await nuevaCaja(e, 'caja-1', 'abcd1234', null)
  const listar = await soporteCaja(e.deps, { ...c, accion: 'listar', datos: {} })
  assert.equal(listar.status, 200)
  assert.deepEqual((listar.body as any).tickets, [])
  assert.equal((await soporteCaja(e.deps, { ...c, accion: 'crear', datos: { asunto: 'x', nivel: 'app', minutos: 30 } })).status, 409)
  e.m.registros[0].estado = 'desvinculada'
  assert.equal((await soporteCaja(e.deps, { ...c, accion: 'listar', datos: {} })).status, 401)
})

test('permitir sobre un ticket cerrado o de otra caja: 404', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear()
  await e.pedir('cerrar_acceso', { ticket_id: ticket.id })
  const otra = await nuevaCaja(e, 'caja-2', 'efgh5678')
  const ajeno = await soporteCaja(e.deps, { ...otra, accion: 'permitir', datos: { ticket_id: ticket.id, nivel: 'app', minutos: 30 } })
  assert.equal(ajeno.status, 404)
  e.sop.m.tickets[0].estado = 'cerrado'
  assert.equal((await e.pedir('permitir', { ticket_id: ticket.id, nivel: 'app', minutos: 30 })).status, 404)
})

test('un segundo permiso activo en la misma caja: 409, sin dejar otro ticket suelto', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear()
  assert.equal((await e.crear()).r.status, 409)
  assert.equal(e.sop.m.tickets.length, 1)
  assert.equal((await e.pedir('permitir', { ticket_id: ticket.id, nivel: 'sistema', minutos: 60 })).status, 409)
})

test('permitir tras cerrar el acceso anterior da un permiso nuevo en el mismo ticket', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear()
  await e.pedir('cerrar_acceso', { ticket_id: ticket.id })
  const r = await e.pedir('permitir', { ticket_id: ticket.id, nivel: 'sistema', minutos: 60 })
  assert.equal(r.status, 200)
  assert.equal((r.body as any).ticket.nivel, 'sistema')
  assert.equal((r.body as any).ticket.minutos, 60)
})

test('cerrar_acceso marca el permiso cerrado y es idempotente', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear()
  assert.equal((await e.pedir('cerrar_acceso', { ticket_id: ticket.id })).status, 200)
  const p = e.sop.m.permisos[0]
  assert.equal(p.motivoCierre, 'cliente')
  assert.equal(p.cerradoEn, T0.toISOString())
  e.ahora.t = new Date(T0.getTime() + 60_000)
  assert.equal((await e.pedir('cerrar_acceso', { ticket_id: ticket.id })).status, 200)
  assert.equal(e.sop.m.permisos[0].cerradoEn, T0.toISOString(), 'no pisa la primera hora')
})

test('ticket abierto por soporte: el cliente lo ve pendiente, sin permiso', async () => {
  const e = await conCaja()
  await e.sop.store.crearTicket({ cajaId: 'caja-1', ownerId: OWNER, abiertoPor: 'soporte', asunto: 'Revisar apagado', estado: 'abierto', creadoEn: T0.toISOString() })
  const t = ((await e.pedir('listar')).body as any).tickets[0]
  assert.equal(t.abierto_por, 'soporte')
  assert.equal(t.nivel, null)
  assert.equal(t.minutos, null)
})

test('sondear: sin permiso, sin aceptar y de otra caja', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear()
  assert.deepEqual((await e.pedir('sondear', { ticket_id: ticket.id })).body, { estado: 'esperando' })
  await e.pedir('cerrar_acceso', { ticket_id: ticket.id })
  assert.deepEqual((await e.pedir('sondear', { ticket_id: ticket.id })).body, { estado: 'cerrado', nota: null })
  const otra = await nuevaCaja(e, 'caja-2', 'efgh5678')
  assert.equal((await soporteCaja(e.deps, { ...otra, accion: 'sondear', datos: { ticket_id: ticket.id } })).status, 404)
})

test('la vista trae los accesos y nunca datos de otra cuenta', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear()
  await e.sop.store.registrarAcceso({ permisoId: e.sop.m.permisos[0].id, nivel: 'app', quien: 'soporte', entroEn: T0.toISOString() })
  const t = ((await e.pedir('listar')).body as any).tickets[0]
  assert.deepEqual(t.accesos, [{ nivel: 'app', entro_en: T0.toISOString(), termino_en: null }])
  assert.equal('ownerId' in t || 'owner_id' in t, false)
  assert.equal(t.id, ticket.id)
})
