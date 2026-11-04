// «Continuar con Google» desde la propia mini PC. El navegador solo recibe un reto que viaja a la propia máquina;
// quien vincula es la caja, con su secreto. Así un enlace enviado por mensaje no puede unir tu caja a la máquina de otro.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { conectarCaja, vincularDesdeCaja } from '../app/lib/cajas/cliente-servicio.ts'
import { firmarReto, verificarReto } from '../app/lib/cajas/reto.ts'
import { urlCancelar, volverValido } from '../app/lib/cajas/volver.ts'
import { siguienteSeguro } from '../app/lib/siguiente.ts'
import { hashSecreto } from '../app/lib/cajas/secreto.ts'
import type { CajasStore } from '../app/lib/cajas/servicio.ts'
import { crearClienteMem } from './cajas-cliente-mem.ts'

const vector = JSON.parse(readFileSync(new URL('./fixtures/pase-vector.json', import.meta.url), 'utf8'))
const T0 = new Date('2026-11-03T12:00:00Z')
const U1 = 'f2ebed30-50df-424c-a9e5-fd571cfcadf6'
const U2 = '0a0a0a0a-50df-424c-a9e5-fd571cfcadf6'
const CAJA = '11111111-50df-424c-a9e5-fd571cfcadf6'
const REG = '22222222-50df-424c-a9e5-fd571cfcadf6'
const CORREO = 'cliente@gmail.com'
const COD = 'ABCD2345'
const SECRETO = 'secreto-de-la-caja'
const BASE = { volver: 'http://localhost:8080', sello: 'a'.repeat(32) }

function entorno(o: { abierto?: boolean; registro?: Partial<{ estado: string; cajaId: string | null; codigo: string | null }> } = {}) {
  const ahora = { t: new Date(T0) }
  const r = crearClienteMem(ahora, { vinculoAbierto: o.abierto ?? false })
  r.deps.env.paseKeyPrivada = vector.privateKeyB64
  r.m.vinculables.add(COD)
  const asignar = (email = CORREO, id = CAJA) => r.m.cajas.push({ id, ownerId: null, nombre: 'Mi caja', slug: 's-' + id, tunnelId: 't-' + id, lastSeen: null, emailAsignado: email, creadaEn: T0.toISOString(), creadaPor: 'admin' })
  const cajas = {
    async buscarRegistro(id: string) {
      return id === REG ? { id: REG, secretoHash: hashSecreto(SECRETO), estado: 'pendiente', expiraEn: '2099-01-01T00:00:00Z', cajaId: null, codigo: COD, ...o.registro } : null
    },
  } as unknown as CajasStore
  const reto = (email: string | null = CORREO, userId = U1) => firmarReto({ sub: userId, email, now: ahora.t, clave: vector.privateKeyB64 })
  const desdeCaja = (t: unknown, bearer: string | null = SECRETO, registroId = REG) => vincularDesdeCaja(r.deps, cajas, { registroId, bearer, reto: t })
  return { ...r, ahora, asignar, reto, desdeCaja }
}

const paseDe = (p: string) => JSON.parse(Buffer.from(p.split('.')[0], 'base64url').toString())

test('volver: solo la propia máquina, sin ruta ni credenciales', () => {
  for (const v of ['http://localhost:8080', 'http://127.0.0.1:8080']) assert.equal(volverValido(v), true, v)
  for (const v of ['https://localhost:8080', 'http://localhost', 'http://localhost:8080/x', 'http://localhost:8080@malo.com', 'http://malo.com:8080', 'http://localhost.malo.com:8080', 'javascript:alert(1)', '', null, 8080]) {
    assert.equal(volverValido(v), false, String(v))
  }
})

test('cancelar vuelve a la propia máquina con el sello; con otra dirección no hay a dónde volver', () => {
  assert.equal(urlCancelar('http://localhost:8080', 'abc'), 'http://localhost:8080/conectado?cancelado=1&sello=abc')
  assert.equal(urlCancelar('https://malo.com', 'abc'), null)
})

test('reto: dura poco, no se puede alterar y no vale con otra clave', () => {
  const ahora = { t: new Date(T0) }
  const r = firmarReto({ sub: U1, email: CORREO, now: ahora.t, clave: 'clave' })
  assert.deepEqual(verificarReto(r, { now: ahora.t, clave: 'clave' }), { sub: U1, email: CORREO })
  assert.equal(verificarReto(r, { now: ahora.t, clave: 'otra' }), null)
  const [cuerpo, firma] = r.split('.')
  const alterado = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(cuerpo, 'base64url').toString()), sub: U2 })).toString('base64url')
  assert.equal(verificarReto(`${alterado}.${firma}`, { now: ahora.t, clave: 'clave' }), null)
  assert.equal(verificarReto(r, { now: new Date(T0.getTime() + 121_000), clave: 'clave' }), null)
  for (const malo of ['', 'x', 'a.b.c', null, 5]) assert.equal(verificarReto(malo, { now: ahora.t, clave: 'clave' }), null)
})

test('el navegador no vincula: solo recibe un reto dirigido a la propia máquina, y sin tocar nada', async () => {
  const { deps, m, asignar } = entorno()
  asignar()
  const r = await conectarCaja(deps, { userId: U1, email: 'Cliente@Gmail.com', vincular: true, ...BASE })
  assert.equal(r.status, 200)
  const url = new URL((r.body as { url: string }).url)
  assert.equal(url.origin + url.pathname, 'http://localhost:8080/conectado')
  assert.equal(url.searchParams.get('sello'), BASE.sello)
  assert.equal(url.searchParams.get('pase'), null, 'sin pase: todavía no hay vínculo')
  assert.deepEqual(verificarReto(url.searchParams.get('reto'), { now: T0, clave: vector.privateKeyB64 }), { sub: U1, email: CORREO })
  assert.equal(m.emailsValidados.size, 0)
  assert.equal(m.cajas[0].ownerId, null)
  assert.equal(m.vincularAsignadaLlamadas, 0)
})

test('volver fuera de la máquina o sello raro: 400 y sin reto', async () => {
  const { deps } = entorno()
  for (const extra of [{ volver: 'https://malo.com' }, { sello: 'x' }, { sello: 'a b'.repeat(10) }]) {
    const r = await conectarCaja(deps, { userId: U1, email: CORREO, vincular: true, ...BASE, ...extra })
    assert.equal(r.status, 400)
    assert.equal('url' in r.body, false)
  }
})

test('sin identidad de Google: no hay reto', async () => {
  const { deps } = entorno()
  const r = await conectarCaja(deps, { userId: U1, email: null, vincular: true, ...BASE })
  assert.equal(r.status, 403)
  assert.match((r.body as { error: string }).error, /Google/)
})

test('la caja con su secreto vincula su propio código a la caja asignada de esa cuenta y recibe el pase', async () => {
  const { m, asignar, reto, desdeCaja } = entorno()
  asignar()
  const r = await desdeCaja(reto())
  assert.equal(r.status, 200)
  const p = paseDe((r.body as { pase: string }).pase)
  assert.equal(p.sub, U1)
  assert.equal(p.box, CAJA)
  assert.equal(m.emailsValidados.get(COD), CORREO)
  assert.equal(m.cajas[0].ownerId, U1)
})

test('SIN LA CAJA NO HAY VÍNCULO: quien tiene el enlace pero no el secreto no toca nada', async () => {
  const { m, asignar, reto, desdeCaja } = entorno()
  asignar()
  for (const r of [await desdeCaja(reto(), 'secreto-malo'), await desdeCaja(reto(), null), await desdeCaja(reto(), SECRETO, '33333333-50df-424c-a9e5-fd571cfcadf6')]) {
    assert.equal(r.status, 401)
  }
  assert.equal(m.emailsValidados.size, 0)
  assert.equal(m.cajas[0].ownerId, null)
})

test('reto inválido o vencido: la caja no vincula con él', async () => {
  const { m, ahora, asignar, reto, desdeCaja } = entorno()
  asignar()
  const t = reto()
  assert.equal((await desdeCaja('inventado.xx')).status, 400)
  ahora.t = new Date(T0.getTime() + 121_000)
  assert.equal((await desdeCaja(t)).status, 400)
  assert.equal(m.cajas[0].ownerId, null)
})

test('sin caja asignada a esa cuenta: lo dice, cuenta como fallo y no toca el registro', async () => {
  const { m, asignar, reto, desdeCaja } = entorno()
  asignar('otra@gmail.com')
  m.emailsValidados.set(COD, 'otra@gmail.com')
  const r = await desdeCaja(reto())
  assert.equal(r.status, 409)
  assert.match((r.body as { error: string }).error, /cliente@gmail\.com/)
  assert.equal(m.emailsValidados.get(COD), 'otra@gmail.com')
  assert.equal(m.cajas[0].ownerId, null)
  assert.equal(m.fallos.length, 1)
})

test('con demasiados fallos de esa cuenta ni siquiera escribe el correo', async () => {
  const { deps, m, asignar, reto, desdeCaja } = entorno()
  asignar()
  for (let i = 0; i < 10; i++) await deps.store.registrarFalloVincular(U1)
  assert.equal((await desdeCaja(reto())).status, 429)
  assert.equal(m.emailsValidados.size, 0)
})

test('caja sin código pendiente: pide volver a intentarlo', async () => {
  const { asignar, reto, desdeCaja } = entorno({ registro: { codigo: null } })
  asignar()
  assert.equal((await desdeCaja(reto())).status, 409)
})

test('caja de fábrica con correo asignado: solo esa cuenta', async () => {
  const { m, asignar, reto, desdeCaja } = entorno({ registro: { cajaId: CAJA } })
  asignar()
  m.vinculables.clear()
  m.codigosPreparadas.set(COD, CAJA)
  assert.equal((await desdeCaja(reto('intruso@gmail.com', U2))).status, 403)
  const r = await desdeCaja(reto())
  assert.equal(r.status, 200)
  assert.equal(paseDe((r.body as { pase: string }).pase).box, CAJA)
})

test('entrar a la caja propia: el pase va directo a la propia máquina; con otra cuenta no hay pase', async () => {
  const { deps, m, asignar } = entorno()
  asignar()
  m.cajas[0].ownerId = U1
  const r = await conectarCaja(deps, { userId: U1, email: CORREO, caja: CAJA, ...BASE })
  assert.equal(r.status, 200)
  const url = new URL((r.body as { url: string }).url)
  assert.equal(url.origin, 'http://localhost:8080')
  assert.equal(paseDe(url.searchParams.get('pase')!).sub, U1)
  const otra = await conectarCaja(deps, { userId: U2, email: 'otra@gmail.com', caja: CAJA, ...BASE })
  assert.equal(otra.status, 403)
  assert.equal('url' in otra.body, false)
  assert.match((otra.body as { error: string }).error, /otra cuenta/)
})

test('después de iniciar sesión solo se navega dentro del propio sitio', () => {
  for (const malo of ['/\\evil.com', '/\t/evil.com', '//evil.com', 'https://evil.com', '/\n/evil.com', '', null, undefined]) {
    assert.equal(siguienteSeguro(malo), '/estudio', String(malo))
  }
  assert.equal(siguienteSeguro('/cajas/conectar?vincular=1&volver=http%3A%2F%2Flocalhost%3A8080'), '/cajas/conectar?vincular=1&volver=http%3A%2F%2Flocalhost%3A8080')
  assert.equal(siguienteSeguro('/creditos'), '/creditos')
  for (const f of ['../app/auth/callback/route.ts', '../app/entrar/AuthForm.tsx']) {
    assert.match(readFileSync(new URL(f, import.meta.url), 'utf8'), /siguienteSeguro\(/, f)
  }
})

test('la ventana lanza Google directo pidiendo elegir cuenta, una sola vez; y la página de conectar confirma antes', () => {
  const a = readFileSync(new URL('../app/entrar/AuthForm.tsx', import.meta.url), 'utf8')
  assert.match(a, /params\.get\("google"\) === "1"/)
  assert.match(a, /prompt: "select_account"/)
  const c = readFileSync(new URL('../app/cajas/conectar/Conectar.tsx', import.meta.url), 'utf8')
  assert.match(c, /Sí, es esta mini PC/)
  assert.match(c, /\/api\/cajas\/conectar/)
  assert.match(readFileSync(new URL('../app/api/cajas/conectar/route.ts', import.meta.url), 'utf8'), /correoDeGoogle\(user\)/)
  assert.match(readFileSync(new URL('../app/api/cajas/conectar/caja/route.ts', import.meta.url), 'utf8'), /leerBearer\(req\)/)
})
