// Servicio del Estudio para la caja: tope diario, cobro a la cuenta dueña, aislamiento entre cuentas y límite de peticiones.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registrarCaja } from '../app/lib/cajas/servicio.ts'
import { estudioGenerar, estudioListar, estudioMe, estudioObtener, type EstudioDeps, type EstudioMotor, type GenPublica, type ModeloPublico } from '../app/lib/cajas/estudio-servicio.ts'
import { crearDeps } from './cajas-mem.ts'

const T0 = new Date('2026-10-30T15:00:00Z') // 10:00 en Lima → el día de Lima empezó 2026-10-30T05:00:00Z

const MODELO: ModeloPublico = {
  id: 'nano-banana-2', kind: 'image', nombre: 'Nano Banana 2', descripcion: 'Rápido', formatos: ['1:1', '9:16', '16:9'], opciones: [{ costo: 3 }],
}
const GEN = (id: string, extra: Partial<GenPublica> = {}): GenPublica => ({
  id, kind: 'image', model: 'nano-banana-2', prompt: 'un gato', params: { aspect: '1:1' }, status: 'running', cost: 3, error: null, url: null, createdAt: T0.toISOString(), ...extra,
})

async function montar(o: { admin?: boolean; gasto?: number; tope?: number; costo?: number | null; saldo?: number } = {}) {
  const ahora = { t: new Date(T0) }
  const c = crearDeps(ahora)
  const r = await registrarCaja(c.deps, { ip: 'x', version: 'v' })
  if (!r.ok) throw new Error('registro falló')
  const reg = c.m.registros[0]
  reg.estado = 'vinculada'
  reg.cajaId = 'caja-1'
  c.m.cajas.push({ id: 'caja-1', slug: 'abcd1234', tunnelId: 'tun-1', ownerId: 'cuenta-1' })
  c.m.emails['cuenta-1'] = o.admin ? 'admin@trust.com' : 'dueno@negocio.com'

  const llamadas = { iniciar: [] as Array<{ userId: string; gratis: boolean; input: any }>, gastoHoy: [] as Array<{ cajaId: string; desde: string }>, listar: [] as any[] }
  let iniciarResp: any = { ok: true, generation: GEN('g1') }
  const propias: Record<string, GenPublica> = { g1: GEN('g1'), g2: GEN('g2', { status: 'done', url: 'https://x/g2.png' }) }
  const motor: EstudioMotor = {
    balance: async () => o.saldo ?? 50,
    modelos: async (esAdmin) => (esAdmin ? [MODELO, { ...MODELO, id: 'prueba-admin' }] : [MODELO]),
    costo: () => (o.costo === undefined ? 3 : o.costo),
    iniciar: async (userId, gratis, input) => { llamadas.iniciar.push({ userId, gratis, input }); return iniciarResp },
    listar: async (userId, q) => { llamadas.listar.push({ userId, q }); return Object.values(propias) },
    obtener: async (userId, id) => (userId === 'cuenta-1' ? propias[id] ?? null : null),
  }
  const d: EstudioDeps = {
    servicio: c.deps,
    store: { gastoHoy: async (cajaId, desde) => { llamadas.gastoHoy.push({ cajaId, desde }); return o.gasto ?? 0 }, topeDe: async () => o.tope ?? 100 },
    motor,
    esAdmin: (email) => email === 'admin@trust.com',
  }
  return { d, ahora, m: c.m, llamadas, a: { registroId: r.registro_id, bearer: r.secreto }, setIniciar: (v: any) => { iniciarResp = v } }
}
const BODY = { model: 'nano-banana-2', prompt: 'un gato astronauta', aspect: '1:1' }

test('me: saldo, tope de la caja, gasto de hoy y modelos', async () => {
  const t = await montar({ gasto: 40, tope: 100, saldo: 77 })
  const r = await estudioMe(t.d, t.a)
  assert.equal(r.status, 200)
  assert.deepEqual(r.body, { saldo: 77, admin: false, tope_diario: 100, gastado_hoy: 40, modelos: [MODELO] })
  assert.deepEqual(t.llamadas.gastoHoy[0], { cajaId: 'caja-1', desde: '2026-10-30T05:00:00.000Z' })
})

test('me: una cuenta admin ve los modelos de prueba y se marca admin', async () => {
  const t = await montar({ admin: true })
  const r = await estudioMe(t.d, t.a)
  assert.equal((r.body as any).admin, true)
  assert.equal((r.body as any).modelos.length, 2)
})

test('generar: con gasto 95 y costo 10 llega al tope → 429 con el mensaje y sin llamar a iniciar', async () => {
  const t = await montar({ gasto: 95, costo: 10 })
  const r = await estudioGenerar(t.d, t.a, BODY)
  assert.equal(r.status, 429)
  assert.equal((r.body as any).error, 'Llegaste al límite de hoy (100 créditos por caja). Se reinicia a medianoche.')
  assert.equal(t.llamadas.iniciar.length, 0)
})

test('generar: con gasto 90 y costo 10 cabe justo → 200 con la generación y el saldo', async () => {
  const t = await montar({ gasto: 90, costo: 10, saldo: 40 })
  const r = await estudioGenerar(t.d, t.a, BODY)
  assert.equal(r.status, 200)
  assert.equal((r.body as any).generacion.id, 'g1')
  assert.equal((r.body as any).saldo, 40)
})

test('generar: usa el tope propio de la caja', async () => {
  const t = await montar({ gasto: 10, costo: 10, tope: 15 })
  const r = await estudioGenerar(t.d, t.a, BODY)
  assert.equal(r.status, 429)
  assert.match((r.body as any).error, /\(15 créditos por caja\)/)
})

test('generar: cobra a la cuenta dueña y marca la caja; solo pasa los campos permitidos', async () => {
  const t = await montar()
  await estudioGenerar(t.d, t.a, { ...BODY, duration: 8, resolution: '720p', image: { data: 'xx', mime: 'image/png' }, characterId: 'p1', styleId: 's1', motion: 'm', fromGeneration: 'g0', cajaId: 'otra', userId: 'otra-cuenta' })
  assert.equal(t.llamadas.iniciar.length, 1)
  const l = t.llamadas.iniciar[0]
  assert.equal(l.userId, 'cuenta-1')
  assert.equal(l.gratis, false)
  assert.deepEqual(l.input, { model: 'nano-banana-2', prompt: 'un gato astronauta', aspect: '1:1', duration: 8, resolution: '720p', cajaId: 'caja-1' })
})

test('generar: una cuenta admin genera gratis y su gasto no cuenta para el tope', async () => {
  const t = await montar({ admin: true, gasto: 999, costo: 10 })
  const r = await estudioGenerar(t.d, t.a, BODY)
  assert.equal(r.status, 200)
  assert.equal(t.llamadas.iniciar[0].gratis, true)
})

test('generar: modelo u opciones inválidos (costo null) → 400 y sin cobrar', async () => {
  const t = await montar({ costo: null })
  const r = await estudioGenerar(t.d, t.a, BODY)
  assert.equal(r.status, 400)
  assert.equal((r.body as any).error, 'Modelo no válido.')
  assert.equal(t.llamadas.iniciar.length, 0)
})

test('generar: créditos insuficientes (402 del motor) llega tal cual', async () => {
  const t = await montar()
  t.setIniciar({ ok: false, error: 'Créditos insuficientes: esta generación cuesta 3 y tienes 1.', status: 402 })
  const r = await estudioGenerar(t.d, t.a, BODY)
  assert.equal(r.status, 402)
  assert.match((r.body as any).error, /Créditos insuficientes/)
})

test('generar: cuerpo que no es un objeto → 400 Solicitud inválida.', async () => {
  const t = await montar()
  for (const b of [null, undefined, 'hola', 42, []]) {
    const r = await estudioGenerar(t.d, t.a, b)
    assert.equal(r.status, 400, JSON.stringify(b))
    assert.equal((r.body as any).error, 'Solicitud inválida.')
  }
  assert.equal(t.llamadas.iniciar.length, 0)
})

test('listar: devuelve las generaciones (con pendientes) de la cuenta dueña y sanea los filtros', async () => {
  const t = await montar()
  const r = await estudioListar(t.d, t.a, { kind: 'video', limit: '500', before: '2026-10-30T00:00:00Z' })
  assert.equal(r.status, 200)
  assert.equal((r.body as any).generaciones.length, 2)
  assert.deepEqual(t.llamadas.listar[0], { userId: 'cuenta-1', q: { kind: 'video', limit: 60, before: '2026-10-30T00:00:00Z' } })
  await estudioListar(t.d, t.a, { kind: 'raro', limit: 'abc' })
  assert.deepEqual(t.llamadas.listar[1].q, { kind: undefined, limit: 24, before: undefined })
})

test('obtener: una generación propia → 200 con el saldo; de otra cuenta o inexistente → 404', async () => {
  const t = await montar({ saldo: 12 })
  const ok = await estudioObtener(t.d, t.a, 'g1')
  assert.equal(ok.status, 200)
  assert.equal((ok.body as any).saldo, 12)
  const no = await estudioObtener(t.d, t.a, 'ajena')
  assert.equal(no.status, 404)
})

test('autenticación: secreto malo → 401 en las cuatro rutas; caja pendiente → 409', async () => {
  const t = await montar()
  const mal = { registroId: t.a.registroId, bearer: 'mal' }
  for (const r of [await estudioMe(t.d, mal), await estudioGenerar(t.d, mal, BODY), await estudioListar(t.d, mal, {}), await estudioObtener(t.d, mal, 'g1')]) {
    assert.equal(r.status, 401)
  }
  t.m.registros[0].estado = 'pendiente'
  t.m.registros[0].cajaId = null
  const p = await estudioMe(t.d, t.a)
  assert.equal(p.status, 409)
})

test('una caja desvinculada deja de gastar de inmediato (401) y no llega a iniciar', async () => {
  const t = await montar()
  assert.equal((await estudioGenerar(t.d, t.a, BODY)).status, 200)
  t.m.registros[0].estado = 'desvinculada'
  assert.equal((await estudioGenerar(t.d, t.a, BODY)).status, 401)
  assert.equal(t.llamadas.iniciar.length, 1)
})

test('límite de peticiones: la 601.ª en una hora → 429 y vuelve a permitir pasada la ventana', async () => {
  const t = await montar()
  for (let i = 0; i < 600; i++) assert.equal((await estudioObtener(t.d, t.a, 'g1')).status, 200, `petición ${i + 1}`)
  const r = await estudioObtener(t.d, t.a, 'g1')
  assert.equal(r.status, 429)
  assert.equal((r.body as any).error, 'Demasiados intentos. Espera un rato e inténtalo de nuevo.')
  t.ahora.t = new Date(T0.getTime() + 3600_000 + 1000)
  assert.equal((await estudioObtener(t.d, t.a, 'g1')).status, 200)
})
