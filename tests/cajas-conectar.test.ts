// «Continuar con Google» desde la propia mini PC: vincula o comprueba la caja y devuelve el pase solo hacia la propia máquina.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { conectarCaja } from '../app/lib/cajas/cliente-servicio.ts'
import { urlCancelar, volverValido } from '../app/lib/cajas/volver.ts'
import { crearClienteMem } from './cajas-cliente-mem.ts'

const vector = JSON.parse(readFileSync(new URL('./fixtures/pase-vector.json', import.meta.url), 'utf8'))
const T0 = new Date('2026-11-03T12:00:00Z')
const U1 = 'f2ebed30-50df-424c-a9e5-fd571cfcadf6'
const U2 = '0a0a0a0a-50df-424c-a9e5-fd571cfcadf6'
const CAJA = '11111111-50df-424c-a9e5-fd571cfcadf6'
const CORREO = 'cliente@gmail.com'
const COD = 'ABCD2345'
const BASE = { volver: 'http://localhost:8080', sello: 'a'.repeat(32) }

function entorno(o: { abierto?: boolean } = {}) {
  const r = crearClienteMem({ t: new Date(T0) }, { vinculoAbierto: o.abierto ?? false })
  r.deps.env.paseKeyPrivada = vector.privateKeyB64
  r.m.vinculables.add(COD)
  const asignar = (email = CORREO, id = CAJA) => r.m.cajas.push({ id, ownerId: null, nombre: 'Mi caja', slug: 's-' + id, tunnelId: 't-' + id, lastSeen: null, emailAsignado: email, creadaEn: T0.toISOString(), creadaPor: 'admin' })
  return { ...r, asignar }
}

const paseDe = (url: string) => JSON.parse(Buffer.from(new URL(url).searchParams.get('pase')!.split('.')[0], 'base64url').toString())

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

test('volver fuera de la máquina o sello raro: 400 sin vincular ni firmar', async () => {
  const { deps, m, asignar } = entorno()
  asignar()
  for (const extra of [{ volver: 'https://malo.com' }, { sello: 'x' }, { sello: 'a b'.repeat(10) }]) {
    const r = await conectarCaja(deps, { userId: U1, email: CORREO, codigo: COD, ...BASE, ...extra })
    assert.equal(r.status, 400)
    assert.equal('url' in r.body, false)
  }
  assert.equal(m.vincularAsignadaLlamadas, 0)
  assert.equal(m.emailsValidados.size, 0)
})

test('sin correo previo en la mini PC: Google dice la cuenta, se vincula a su caja asignada y vuelve con el pase', async () => {
  const { deps, m, asignar } = entorno()
  asignar()
  const r = await conectarCaja(deps, { userId: U1, email: 'Cliente@Gmail.com', codigo: 'abcd-2345', ...BASE })
  assert.equal(r.status, 200)
  const url = new URL((r.body as { url: string }).url)
  assert.equal(url.origin + url.pathname, 'http://localhost:8080/conectado')
  assert.equal(url.searchParams.get('sello'), BASE.sello)
  const p = paseDe(url.href)
  assert.equal(p.sub, U1)
  assert.equal(p.box, CAJA)
  assert.equal(m.emailsValidados.get(COD), CORREO)
  assert.equal(m.cajas[0].ownerId, U1)
})

test('sin caja asignada a esa cuenta: lo dice y no toca el registro', async () => {
  const { deps, m, asignar } = entorno()
  asignar('otra@gmail.com')
  m.emailsValidados.set(COD, 'otra@gmail.com')
  const r = await conectarCaja(deps, { userId: U1, email: CORREO, codigo: COD, ...BASE })
  assert.equal(r.status, 409)
  assert.match((r.body as { error: string }).error, /cliente@gmail\.com/)
  assert.equal(m.emailsValidados.get(COD), 'otra@gmail.com')
  assert.equal(m.cajas[0].ownerId, null)
  assert.equal(m.fallos.length, 1, 'cuenta como intento fallido')
})

test('sin identidad de Google: no vincula', async () => {
  const { deps, m, asignar } = entorno()
  asignar()
  const r = await conectarCaja(deps, { userId: U1, email: null, codigo: COD, ...BASE })
  assert.equal(r.status, 403)
  assert.match((r.body as { error: string }).error, /Google/)
  assert.equal(m.emailsValidados.size, 0)
})

test('código inválido: cuenta como fallo; con demasiados fallos ni siquiera escribe el correo', async () => {
  const { deps, m, asignar } = entorno()
  asignar()
  assert.equal((await conectarCaja(deps, { userId: U1, email: CORREO, codigo: 'ZZZZ9999', ...BASE })).status, 400)
  assert.equal(m.fallos.length, 1)
  for (let i = 0; i < 10; i++) await deps.store.registrarFalloVincular(U1)
  assert.equal((await conectarCaja(deps, { userId: U1, email: CORREO, codigo: COD, ...BASE })).status, 429)
  assert.equal(m.emailsValidados.size, 0)
})

test('caja de fábrica con correo asignado: solo esa cuenta y devuelve el pase', async () => {
  const { deps, m, asignar } = entorno()
  asignar()
  m.vinculables.clear()
  m.codigosPreparadas.set(COD, CAJA)
  assert.equal((await conectarCaja(deps, { userId: U2, email: 'intruso@gmail.com', codigo: COD, ...BASE })).status, 403)
  const r = await conectarCaja(deps, { userId: U1, email: CORREO, codigo: COD, ...BASE })
  assert.equal(r.status, 200)
  assert.equal(paseDe((r.body as { url: string }).url).box, CAJA)
})

test('entrar a la caja propia: pase de esa caja, sin tocar nada más; con otra cuenta no hay pase', async () => {
  const { deps, m, asignar } = entorno()
  asignar()
  m.cajas[0].ownerId = U1
  const r = await conectarCaja(deps, { userId: U1, email: CORREO, caja: CAJA, ...BASE })
  assert.equal(r.status, 200)
  assert.equal(paseDe((r.body as { url: string }).url).sub, U1)
  const otra = await conectarCaja(deps, { userId: U2, email: 'otra@gmail.com', caja: CAJA, ...BASE })
  assert.equal(otra.status, 403)
  assert.equal('url' in otra.body, false)
  assert.match((otra.body as { error: string }).error, /otra cuenta/)
})

test('la ventana lanza Google directo pidiendo elegir cuenta, una sola vez; y la página de conectar confirma antes de vincular', () => {
  const a = readFileSync(new URL('../app/entrar/AuthForm.tsx', import.meta.url), 'utf8')
  assert.match(a, /params\.get\("google"\) === "1"/)
  assert.match(a, /prompt: "select_account"/)
  const c = readFileSync(new URL('../app/cajas/conectar/Conectar.tsx', import.meta.url), 'utf8')
  assert.match(c, /Sí, es esta mini PC/)
  assert.match(c, /\/api\/cajas\/conectar/)
  const r = readFileSync(new URL('../app/api/cajas/conectar/route.ts', import.meta.url), 'utf8')
  assert.match(r, /correoDeGoogle\(user\)/)
})
