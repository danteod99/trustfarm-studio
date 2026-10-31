// «Crear caja» y «Regenerar llave» (administración): límites, llave de un solo uso guardada solo como hash y limpieza ante fallos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_CREACIONES_POR_HORA, MAX_PREPARADAS_SIN_DUENO, VIDA_LLAVE_DIAS, prepararCaja, regenerarLlave } from '../app/lib/cajas/fabrica-servicio.ts'
import { hashSecreto } from '../app/lib/cajas/secreto.ts'
import { crearClienteMem } from './cajas-cliente-mem.ts'

const T0 = new Date('2026-10-31T15:00:00Z')
const ADMIN = 'admin-1'
const nuevo = () => { const ahora = { t: new Date(T0) }; return { ahora, ...crearClienteMem(ahora) } }

test('constantes: 20 creaciones por hora, 100 cajas sin dueño y llave de 30 días', () => {
  assert.equal(MAX_CREACIONES_POR_HORA, 20)
  assert.equal(MAX_PREPARADAS_SIN_DUENO, 100)
  assert.equal(VIDA_LLAVE_DIAS, 30)
})

test('prepararCaja: crea túnel y caja sin dueño, devuelve la llave una vez y el almacén solo recibe su hash', async () => {
  const { m, deps } = nuevo()
  const r = await prepararCaja(deps, { adminId: ADMIN, etiqueta: '  Cliente Bodega López ' })
  assert.equal(r.status, 200)
  const b = r.body as any
  assert.equal(b.caja.etiqueta, 'Cliente Bodega López')
  assert.equal(b.caja.direccion, 'slug0001.cajas.test')
  assert.equal(b.vence_en, new Date(T0.getTime() + 30 * 86_400_000).toISOString())
  assert.match(b.llave, /^[A-Za-z0-9_-]{20,128}$/)
  assert.equal(m.tunelesCreados.length, 1)
  const caja = m.cajas.find((c) => c.id === b.caja.id)!
  assert.equal(caja.ownerId, null)
  assert.equal(caja.etiqueta, 'Cliente Bodega López')
  assert.equal(m.activaciones.length, 1)
  assert.equal(m.activaciones[0].llaveHash, hashSecreto(b.llave))
  assert.ok(!JSON.stringify(m).includes(b.llave), 'la llave en claro no debe estar en el almacén')
})

test('prepararCaja: etiqueta vacía, solo espacios, que no es texto o de más de 80 caracteres → 400 sin tocar Cloudflare', async () => {
  const { m, deps } = nuevo()
  for (const e of ['', '   ', undefined, null, 5, 'x'.repeat(81)]) {
    const r = await prepararCaja(deps, { adminId: ADMIN, etiqueta: e })
    assert.equal(r.status, 400, String(e))
  }
  assert.equal(m.tunelesCreados.length, 0)
  assert.equal(m.cajas.length, 0)
  assert.equal((await prepararCaja(deps, { adminId: ADMIN, etiqueta: 'x'.repeat(80) })).status, 200) // 80 sí entra
})

test('prepararCaja: la creación 21.ª en una hora → 429; pasada la hora vuelve a permitir; cada administrador tiene su cuenta', async () => {
  const { ahora, m, deps } = nuevo()
  for (let i = 0; i < 20; i++) assert.equal((await prepararCaja(deps, { adminId: ADMIN, etiqueta: `c${i}` })).status, 200, `creación ${i + 1}`)
  const r = await prepararCaja(deps, { adminId: ADMIN, etiqueta: 'una más' })
  assert.equal(r.status, 429)
  assert.equal(m.tunelesCreados.length, 20)
  assert.equal((await prepararCaja(deps, { adminId: 'admin-2', etiqueta: 'otro admin' })).status, 200)
  ahora.t = new Date(T0.getTime() + 3600_000 + 1000)
  assert.equal((await prepararCaja(deps, { adminId: ADMIN, etiqueta: 'ya pasó la hora' })).status, 200)
})

test('prepararCaja: los intentos que fallan también cuentan para el límite (no se puede martillar Cloudflare)', async () => {
  const { m, deps } = nuevo()
  m.crearFalla = true
  for (let i = 0; i < 20; i++) assert.equal((await prepararCaja(deps, { adminId: ADMIN, etiqueta: `c${i}` })).status, 502)
  m.crearFalla = false
  assert.equal((await prepararCaja(deps, { adminId: ADMIN, etiqueta: 'después' })).status, 429)
})

test('prepararCaja: con 100 cajas sin dueño → 429 y no crea ningún túnel', async () => {
  const { m, deps } = nuevo()
  for (let i = 0; i < 100; i++) m.cajas.push({ id: `c${i}`, ownerId: null, nombre: 'x', slug: `s${i}`, tunnelId: `t${i}`, lastSeen: null })
  const r = await prepararCaja(deps, { adminId: ADMIN, etiqueta: 'una más' })
  assert.equal(r.status, 429)
  assert.equal(m.tunelesCreados.length, 0)
})

test('prepararCaja: si Cloudflare falla → 502 y no queda ninguna caja', async () => {
  const { m, deps } = nuevo()
  m.crearFalla = true
  const r = await prepararCaja(deps, { adminId: ADMIN, etiqueta: 'x' })
  assert.equal(r.status, 502)
  assert.equal(m.cajas.length, 0)
  assert.ok(!JSON.stringify(r.body).includes('secreto-token-123'))
})

test('prepararCaja: si el almacén falla se borra el túnel creado y responde 500 sin filtrar nada', async () => {
  const { m, deps } = nuevo()
  m.prepararForzado.push({ ok: false, motivo: 'error' })
  const r = await prepararCaja(deps, { adminId: ADMIN, etiqueta: 'x' })
  assert.equal(r.status, 500)
  assert.equal(m.tunelesVivos.size, 0)
  assert.equal(m.cajas.length, 0)
  assert.ok(!JSON.stringify(r.body).includes('llave'))
})

test('prepararCaja: slug repetido → borra el túnel de ese intento y reintenta con otro slug; tres seguidos → 500 sin túneles huérfanos', async () => {
  const a = nuevo()
  a.m.prepararForzado.push({ ok: false, motivo: 'slug_repetido' })
  const ok = await prepararCaja(a.deps, { adminId: ADMIN, etiqueta: 'x' })
  assert.equal(ok.status, 200)
  assert.equal(a.m.tunelesCreados.length, 2)
  assert.equal(a.m.tunelesVivos.size, 1)
  assert.notEqual(a.m.tunelesCreados[0].slug, a.m.tunelesCreados[1].slug)

  const b = nuevo()
  for (let i = 0; i < 3; i++) b.m.prepararForzado.push({ ok: false, motivo: 'slug_repetido' })
  assert.equal((await prepararCaja(b.deps, { adminId: ADMIN, etiqueta: 'x' })).status, 500)
  assert.equal(b.m.tunelesVivos.size, 0)
})

test('prepararCaja: si otro administrador llenó el cupo justo ahora (limite_preparadas) → 429 y se borra el túnel', async () => {
  const { m, deps } = nuevo()
  m.prepararForzado.push({ ok: false, motivo: 'limite_preparadas' })
  assert.equal((await prepararCaja(deps, { adminId: ADMIN, etiqueta: 'x' })).status, 429)
  assert.equal(m.tunelesVivos.size, 0)
})

test('regenerarLlave: devuelve una llave nueva (el almacén solo recibe su hash), con vencimiento a 30 días', async () => {
  const { m, deps } = nuevo()
  const c = (await prepararCaja(deps, { adminId: ADMIN, etiqueta: 'x' })).body as any
  const r = await regenerarLlave(deps, { cajaId: c.caja.id })
  assert.equal(r.status, 200)
  const b = r.body as any
  assert.notEqual(b.llave, c.llave)
  assert.equal(b.vence_en, new Date(T0.getTime() + 30 * 86_400_000).toISOString())
  assert.equal(m.activaciones.filter((a) => a.cajaId === c.caja.id && !a.usadaEn).length, 1, 'solo queda una llave sin usar')
  assert.equal(m.activaciones.find((a) => a.cajaId === c.caja.id && !a.usadaEn)!.llaveHash, hashSecreto(b.llave))
  assert.ok(!JSON.stringify(m).includes(b.llave))
})

test('regenerarLlave: caja inexistente o id que no es uuid → 404 igual', async () => {
  const { deps } = nuevo()
  for (const id of ['00000000-0000-4000-8000-0000000000ff', 'no-es-uuid', '', '../x']) {
    const r = await regenerarLlave(deps, { cajaId: id })
    assert.equal(r.status, 404, id)
    assert.deepEqual(r.body, { error: 'No encontré esa caja.' })
  }
})
