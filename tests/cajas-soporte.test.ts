// Soporte a distancia: tickets y permisos, vistos desde la caja que llama con su secreto.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, createPublicKey, verify } from 'node:crypto'
import { registrarCaja } from '../app/lib/cajas/servicio.ts'
import { soporteAdmin, soporteCaja } from '../app/lib/cajas/soporte-servicio.ts'
import { isSoporteEmail } from '../app/lib/cajas/soporte-acceso.ts'
import { firmarPase } from '../app/lib/cajas/pase.ts'
import { crearDeps } from './cajas-mem.ts'
import { crearSoporteMem } from './cajas-soporte-mem.ts'

const T0 = new Date('2026-11-05T12:00:00Z')
const OWNER = '00000000-0000-4000-8000-0000000000aa'
const OTRO = '00000000-0000-4000-8000-0000000000bb'
const pareja = generateKeyPairSync('ed25519')
const CLAVE = pareja.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')

function leerFirmado(token: string) {
  const [cuerpo, firma] = token.split('.')
  assert.ok(verify(null, Buffer.from(cuerpo), createPublicKey(pareja.privateKey), Buffer.from(firma, 'base64url')), 'firma válida')
  return JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'))
}

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
  const rutas = { abiertas: [] as string[], cerradas: [] as string[], falla: false }
  const deps = {
    ...base.deps,
    soporte: sop.store,
    paseKeyPrivada: CLAVE,
    rutas: {
      abrir: async (tunnelId: string, slug: string) => {
        if (rutas.falla) throw new Error('Cloudflare rechazó la operación')
        rutas.abiertas.push(tunnelId)
        return `soporte-${slug}.cajas.test`
      },
      cerrar: async (tunnelId: string) => {
        if (rutas.falla) throw new Error('Cloudflare rechazó la operación')
        rutas.cerradas.push(tunnelId)
      },
    },
  }
  return { ...base, deps, ahora, sop, rutas }
}

async function conCaja() {
  const e = entorno()
  const c = await nuevaCaja(e, 'caja-1', 'abcd1234')
  const pedir = (accion: string, datos: object = {}) => soporteCaja(e.deps, { ...c, accion, datos: datos as Record<string, unknown> })
  const crear = async (o: object = {}) => {
    const r = await pedir('crear', { asunto: 'No responde', nivel: 'app', minutos: 30, ...o })
    return { r, ticket: (r.body as any).ticket }
  }
  const admin = (accion: string, datos: object = {}) => soporteAdmin(e.deps, { quien: 'dante@test.pe', accion, datos: datos as Record<string, unknown> })
  return { ...e, c, pedir, crear, admin }
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

// ───────── Lado de soporte ─────────

test('isSoporteEmail no acepta a quien solo está en ADMIN_EMAILS', () => {
  const antes = { a: process.env.ADMIN_EMAILS, s: process.env.SOPORTE_EMAILS }
  process.env.ADMIN_EMAILS = 'gerente@test.pe, dante@test.pe'
  process.env.SOPORTE_EMAILS = ' Dante@Test.pe '
  assert.equal(isSoporteEmail('dante@test.pe'), true)
  assert.equal(isSoporteEmail('DANTE@test.pe'), true)
  assert.equal(isSoporteEmail('gerente@test.pe'), false)
  assert.equal(isSoporteEmail(null), false)
  delete process.env.SOPORTE_EMAILS
  assert.equal(isSoporteEmail('dante@test.pe'), false)
  process.env.ADMIN_EMAILS = antes.a
  if (antes.s !== undefined) process.env.SOPORTE_EMAILS = antes.s
})

test('aceptar sin permiso del cliente: 409; el ticket no cambia', async () => {
  const e = await conCaja()
  const creado = await e.admin('crear', { caja_id: 'caja-1', asunto: 'Revisar apagado' })
  assert.equal(creado.status, 200)
  const id = (creado.body as any).ticket.id
  assert.equal((creado.body as any).ticket.abierto_por, 'soporte')
  const r = await e.admin('aceptar', { ticket_id: id })
  assert.equal(r.status, 409)
  assert.equal(e.sop.m.tickets[0].estado, 'abierto')
})

test('aceptar: pasa a en_atencion y vence_en = ahora + minutos', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear({ minutos: 45 })
  e.ahora.t = new Date(T0.getTime() + 5 * 60_000) // el tiempo corre desde que soporte acepta
  assert.equal((await e.admin('aceptar', { ticket_id: ticket.id })).status, 200)
  assert.equal(e.sop.m.tickets[0].estado, 'en_atencion')
  const p = e.sop.m.permisos[0]
  assert.equal(p.aceptadoPor, 'dante@test.pe')
  assert.equal(p.venceEn, new Date(T0.getTime() + 50 * 60_000).toISOString())
  // Aceptar otra vez no alarga el tiempo
  e.ahora.t = new Date(T0.getTime() + 10 * 60_000)
  assert.equal((await e.admin('aceptar', { ticket_id: ticket.id })).status, 200)
  assert.equal(e.sop.m.permisos[0].venceEn, new Date(T0.getTime() + 50 * 60_000).toISOString())
})

test('aceptar nivel sistema abre la ruta; nivel app no la toca', async () => {
  const e = await conCaja()
  const a = await e.crear({ nivel: 'app' })
  await e.admin('aceptar', { ticket_id: a.ticket.id })
  assert.deepEqual(e.rutas.abiertas, [])
  await e.admin('cerrar_acceso', { ticket_id: a.ticket.id })
  const s = await e.crear({ nivel: 'sistema' })
  await e.admin('aceptar', { ticket_id: s.ticket.id })
  assert.deepEqual(e.rutas.abiertas, ['tun-abcd1234'])
})

test('si Cloudflare falla al aceptar: error y no queda aceptado', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear({ nivel: 'sistema' })
  e.rutas.falla = true
  const r = await e.admin('aceptar', { ticket_id: ticket.id })
  assert.equal(r.status, 502)
  assert.equal(e.sop.m.permisos[0].aceptadoEn, null)
  assert.equal(e.sop.m.tickets[0].estado, 'abierto')
})

test('el permiso de un dueño anterior no se puede aceptar', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear()
  e.m.cajas.find((x: any) => x.id === 'caja-1')!.ownerId = OTRO
  assert.equal((await e.admin('aceptar', { ticket_id: ticket.id })).status, 409)
})

test('sondear con permiso aceptado y vigente entrega aceptación firmada, nueva en cada llamada', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear({ nivel: 'sistema', minutos: 30 })
  await e.admin('aceptar', { ticket_id: ticket.id })
  const uno = (await e.pedir('sondear', { ticket_id: ticket.id })).body as any
  const dos = (await e.pedir('sondear', { ticket_id: ticket.id })).body as any
  assert.equal(uno.estado, 'aceptado')
  assert.notEqual(uno.aceptacion, dos.aceptacion)
  const p = leerFirmado(uno.aceptacion)
  assert.equal(p.uso, 'soporte-acepta')
  assert.equal(p.box, 'caja-1')
  assert.equal(p.ticket, ticket.id)
  assert.equal(p.nivel, 'sistema')
  assert.equal(p.vence, new Date(T0.getTime() + 30 * 60_000).toISOString())
  assert.equal(p.exp, Math.floor(T0.getTime() / 1000) + 120)
})

test('sondear sin aceptar no trae aceptación; cerrado trae estado cerrado y nota', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear()
  assert.deepEqual((await e.pedir('sondear', { ticket_id: ticket.id })).body, { estado: 'esperando' })
  await e.admin('aceptar', { ticket_id: ticket.id })
  assert.equal((await e.admin('cerrar_ticket', { ticket_id: ticket.id, nota: 'Listo, era el cable' })).status, 200)
  assert.deepEqual((await e.pedir('sondear', { ticket_id: ticket.id })).body, { estado: 'cerrado', nota: 'Listo, era el cable' })
  assert.equal(e.sop.m.tickets[0].estado, 'cerrado')
  assert.equal(e.sop.m.permisos[0].motivoCierre, 'ticket')
})

test('cerrar_acceso de soporte cierra la ruta; un fallo de Cloudflare no impide cerrar', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear({ nivel: 'sistema' })
  await e.admin('aceptar', { ticket_id: ticket.id })
  e.rutas.falla = true
  assert.equal((await e.admin('cerrar_acceso', { ticket_id: ticket.id })).status, 200)
  assert.equal(e.sop.m.permisos[0].motivoCierre, 'soporte')
  assert.deepEqual((await e.pedir('sondear', { ticket_id: ticket.id })).body, { estado: 'cerrado', nota: null })
})

test('al vencer se cierra el permiso y la ruta, y el cliente también al cerrar', async () => {
  const e = await conCaja()
  const a = await e.crear({ nivel: 'sistema', minutos: 30 })
  await e.admin('aceptar', { ticket_id: a.ticket.id })
  e.ahora.t = new Date(T0.getTime() + 30 * 60_000)
  assert.equal(((await e.pedir('sondear', { ticket_id: a.ticket.id })).body as any).estado, 'cerrado')
  assert.equal(e.sop.m.permisos[0].motivoCierre, 'vencio')
  assert.deepEqual(e.rutas.cerradas, ['tun-abcd1234'])
  const b = await e.pedir('permitir', { ticket_id: a.ticket.id, nivel: 'sistema', minutos: 30 })
  assert.equal(b.status, 200)
  await e.admin('aceptar', { ticket_id: a.ticket.id })
  await e.pedir('cerrar_acceso', { ticket_id: a.ticket.id })
  assert.equal(e.rutas.cerradas.length, 2)
})

test('entrar_app y comando_ssh: 409 sin acceso vigente, y comando_ssh 409 si es solo app', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear({ nivel: 'app' })
  assert.equal((await e.admin('entrar_app', { ticket_id: ticket.id })).status, 409)
  await e.admin('aceptar', { ticket_id: ticket.id })
  assert.equal((await e.admin('comando_ssh', { ticket_id: ticket.id })).status, 409)
  e.ahora.t = new Date(T0.getTime() + 31 * 60_000)
  assert.equal((await e.admin('entrar_app', { ticket_id: ticket.id })).status, 409)
})

test('entrar_app y comando_ssh registran el acceso y entregan lo necesario', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear({ nivel: 'sistema' })
  await e.admin('aceptar', { ticket_id: ticket.id })
  const app = (await e.admin('entrar_app', { ticket_id: ticket.id })).body as any
  const u = new URL(app.url)
  assert.equal(u.origin + u.pathname, 'https://abcd1234.cajas.test/auth/soporte')
  const p = leerFirmado(u.searchParams.get('pase')!)
  assert.equal(p.uso, 'soporte')
  assert.equal(p.box, 'caja-1')
  assert.equal(p.sub, 'dante@test.pe')
  assert.equal(p.exp, Math.floor(T0.getTime() / 1000) + 60)
  assert.equal(p.vence, new Date(T0.getTime() + 30 * 60_000).toISOString())
  const ssh = (await e.admin('comando_ssh', { ticket_id: ticket.id })).body as any
  assert.equal(ssh.comando, 'ssh -o ProxyCommand="cloudflared access ssh --hostname %h" -i ~/.ssh/trust-soporte trust-soporte@soporte-abcd1234.cajas.test')
  assert.deepEqual(e.sop.m.accesos.map((a) => [a.nivel, a.quien]), [['app', 'dante@test.pe'], ['sistema', 'dante@test.pe']])
  const vista = ((await e.pedir('listar')).body as any).tickets[0]
  assert.equal(vista.accesos.length, 2)
})

test('un pase normal no lleva uso', () => {
  const p = firmarPase({ sub: 's', box: 'b', now: T0, privateKeyB64: CLAVE })
  assert.equal(leerFirmado(p).uso, undefined)
})

test('listar de soporte trae lo pendiente con su caja; crear exige caja con dueño; acción desconocida 400', async () => {
  const e = await conCaja()
  await e.crear()
  const l = (await e.admin('listar')).body as any
  assert.equal(l.tickets.length, 1)
  assert.equal(l.tickets[0].caja.slug, 'abcd1234')
  assert.equal((await e.admin('crear', { caja_id: 'no-existe', asunto: 'x' })).status, 404)
  await nuevaCaja(e, 'caja-2', 'efgh5678', null)
  assert.equal((await e.admin('crear', { caja_id: 'caja-2', asunto: 'x' })).status, 409)
  assert.equal((await e.admin('crear', { caja_id: 'caja-1', asunto: '' })).status, 400)
  assert.equal((await e.admin('otra')).status, 400)
})

test('listar de soporte cierra lo vencido', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear({ nivel: 'sistema', minutos: 30 })
  await e.admin('aceptar', { ticket_id: ticket.id })
  e.ahora.t = new Date(T0.getTime() + 31 * 60_000)
  await e.admin('listar')
  assert.equal(e.sop.m.permisos[0].motivoCierre, 'vencio')
  assert.deepEqual(e.rutas.cerradas, ['tun-abcd1234'])
})

// ───────── Hallazgos de la revisión ─────────

test('cambio de dueño con permiso abierto: el nuevo no queda bloqueado y soporte ya no entra', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear({ nivel: 'sistema' })
  await e.admin('aceptar', { ticket_id: ticket.id })
  e.m.cajas.find((x: any) => x.id === 'caja-1')!.ownerId = OTRO
  assert.equal((await e.admin('entrar_app', { ticket_id: ticket.id })).status, 409)
  assert.equal((await e.admin('comando_ssh', { ticket_id: ticket.id })).status, 409)
  assert.equal(e.sop.m.permisos[0].motivoCierre, 'ticket')
  assert.deepEqual(e.rutas.cerradas, ['tun-abcd1234'])
  assert.equal((await e.crear()).r.status, 200, 'el dueño nuevo puede pedir soporte')
})

test('cambio de dueño con permiso sin aceptar: el nuevo no queda bloqueado', async () => {
  const e = await conCaja()
  await e.crear()
  e.m.cajas.find((x: any) => x.id === 'caja-1')!.ownerId = OTRO
  assert.equal((await e.crear()).r.status, 200)
})

test('un fallo al leer el ticket no parece un 404', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear()
  e.sop.store.ticket = async () => { throw new Error('supabase caído') }
  await assert.rejects(e.pedir('sondear', { ticket_id: ticket.id }))
})

test('ticket_id que no es un identificador: 404 sin consultar la base', async () => {
  const e = await conCaja()
  e.sop.store.ticket = async () => { throw new Error('no debe consultar') }
  assert.equal((await e.pedir('sondear', { ticket_id: "x'; drop" })).status, 404)
})

test('cerrar_acceso de un permiso vencido queda como vencido, no como cerrado por el cliente', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear({ nivel: 'sistema', minutos: 30 })
  await e.admin('aceptar', { ticket_id: ticket.id })
  e.ahora.t = new Date(T0.getTime() + 31 * 60_000)
  assert.equal((await e.pedir('cerrar_acceso', { ticket_id: ticket.id })).status, 200)
  assert.equal(e.sop.m.permisos[0].motivoCierre, 'vencio')
  assert.deepEqual(e.rutas.cerradas, ['tun-abcd1234'])
})

test('el cliente cancela mientras se abre la ruta: aceptar falla y la ruta se cierra', async () => {
  const e = await conCaja()
  const { ticket } = await e.crear({ nivel: 'sistema' })
  const abrir = e.deps.rutas.abrir
  e.deps.rutas.abrir = async (t: string, s: string) => {
    const r = await abrir(t, s)
    await e.pedir('cerrar_acceso', { ticket_id: ticket.id })
    return r
  }
  const r = await e.admin('aceptar', { ticket_id: ticket.id })
  assert.equal(r.status, 409)
  assert.deepEqual(e.rutas.cerradas, ['tun-abcd1234'])
  assert.equal(e.sop.m.permisos[0].aceptadoEn, null)
  assert.equal(e.sop.m.tickets[0].estado, 'abierto')
})
