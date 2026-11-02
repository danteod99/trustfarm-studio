import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registrarCaja } from '../app/lib/cajas/servicio.ts'
import { consultarActualizacion, registrarResultadoActualizacion, enTanda, type ReleaseRow, type ActualizacionStore } from '../app/lib/cajas/actualizacion-servicio.ts'
import { crearDeps } from './cajas-mem.ts'

const T0 = new Date('2026-11-02T12:00:00Z')
const R = (v: string, porcentaje = 100): ReleaseRow => ({
  version: v, url: `https://storage.test/releases/${v}.tgz`, sha256: 'a'.repeat(64), tamano: 1000, firma: 'f'.repeat(86) + '==', porcentaje,
})

function entorno(releases: ReleaseRow[] = []) {
  const ahora = { t: new Date(T0) }
  const base = crearDeps(ahora)
  const resultados: Array<{ registroId: string; version: string; ok: boolean; detalle: string | null }> = []
  const act: ActualizacionStore = {
    releases: async () => releases,
    registrarResultado: async (r) => { resultados.push(r) },
  }
  return { ...base, ahora, act, resultados, releases }
}

async function conCaja(e: ReturnType<typeof entorno>, vinculada = true) {
  const r = await registrarCaja(e.deps, { ip: 'x', version: '1.0.0' })
  if (!r.ok) throw new Error('registro falló')
  const reg = e.m.registros[0]
  if (vinculada) {
    reg.estado = 'vinculada'
    e.m.cajas.push({ id: 'caja-1', slug: 'abcd1234', tunnelId: 'tun-1', ownerId: 'own-1' })
    reg.cajaId = 'caja-1'
  }
  return { registroId: reg.id, secreto: r.secreto }
}

test('hay una versión mayor: se ofrece la más alta con su firma (sin el porcentaje de la tanda)', async () => {
  const e = entorno([R('1.0.1'), R('1.1.0'), R('0.9.0')])
  const c = await conCaja(e)
  const r = await consultarActualizacion({ ...e.deps, act: e.act }, { registroId: c.registroId, bearer: c.secreto, version: '1.0.0' })
  assert.equal(r.status, 200)
  const b = r.body as any
  assert.equal(b.disponible, true)
  assert.equal(b.release.version, '1.1.0')
  assert.deepEqual(Object.keys(b.release).sort(), ['firma', 'sha256', 'tamano', 'url', 'version'])
})

test('nada nuevo: misma versión o mayor ya instalada → disponible: false', async () => {
  const e = entorno([R('1.0.0'), R('1.1.0')])
  const c = await conCaja(e)
  const r = await consultarActualizacion({ ...e.deps, act: e.act }, { registroId: c.registroId, bearer: c.secreto, version: '1.1.0' })
  assert.deepEqual(r.body, { disponible: false })
})

test('tandas: con porcentaje 0 nadie recibe la versión; con 100 todos; con 5 solo ~5 %', async () => {
  assert.equal(enTanda('cualquier-id', 0), false)
  assert.equal(enTanda('cualquier-id', 100), true)
  const ids = Array.from({ length: 2000 }, (_, i) => `caja-${i}-${i * 7919}`)
  const dentro = ids.filter((id) => enTanda(id, 5)).length
  assert.ok(dentro > 40 && dentro < 180, `esperaba ~100 de 2000, salieron ${dentro}`)
  // determinista: la misma caja siempre cae del mismo lado
  assert.equal(enTanda('caja-estable', 30), enTanda('caja-estable', 30))
  // y crece de forma monótona: quien entra con 5 % sigue dentro con 50 %
  for (const id of ids.slice(0, 200)) if (enTanda(id, 5)) assert.equal(enTanda(id, 50), true)
})

test('una versión frenada (porcentaje 0) no se ofrece aunque sea la más alta; se ofrece la anterior', async () => {
  const e = entorno([R('1.0.1', 100), R('1.1.0', 0)])
  const c = await conCaja(e)
  const r = await consultarActualizacion({ ...e.deps, act: e.act }, { registroId: c.registroId, bearer: c.secreto, version: '1.0.0' })
  assert.equal((r.body as any).release.version, '1.0.1')
})

test('sin credenciales válidas: 401 idéntico y no se consulta nada', async () => {
  const e = entorno([R('1.1.0')])
  const c = await conCaja(e)
  let consultas = 0
  const act = { ...e.act, releases: async () => { consultas++; return e.releases } }
  const mal = await consultarActualizacion({ ...e.deps, act }, { registroId: c.registroId, bearer: 'secreto-malo', version: '1.0.0' })
  const inexistente = await consultarActualizacion({ ...e.deps, act }, { registroId: '00000000-0000-4000-8000-000000000000', bearer: c.secreto, version: '1.0.0' })
  assert.equal(mal.status, 401)
  assert.deepEqual(mal, inexistente)
  assert.equal(consultas, 0)
})

test('una caja sin vincular ni preparar (registro pendiente) no recibe actualizaciones', async () => {
  const e = entorno([R('1.1.0')])
  const c = await conCaja(e, false)
  const r = await consultarActualizacion({ ...e.deps, act: e.act }, { registroId: c.registroId, bearer: c.secreto, version: '1.0.0' })
  assert.equal(r.status, 401)
})

test('versión con formato raro → 400 (nada de inyección en la consulta)', async () => {
  const e = entorno([R('1.1.0')])
  const c = await conCaja(e)
  for (const v of ['', 'abc', '1.0', '1.0.0; drop table', '1.0.0\n2.0.0', '9'.repeat(30)]) {
    const r = await consultarActualizacion({ ...e.deps, act: e.act }, { registroId: c.registroId, bearer: c.secreto, version: v })
    assert.equal(r.status, 400, JSON.stringify(v))
  }
})

test('límite: más de 48 consultas al día por caja → 429', async () => {
  const e = entorno([])
  const c = await conCaja(e)
  let ultimo = 200
  for (let i = 0; i < 49; i++) {
    ultimo = (await consultarActualizacion({ ...e.deps, act: e.act }, { registroId: c.registroId, bearer: c.secreto, version: '1.0.0' })).status
  }
  assert.equal(ultimo, 429)
})

test('resultado: se registra con versión válida y detalle recortado; datos raros se rechazan', async () => {
  const e = entorno()
  const c = await conCaja(e)
  const ok = await registrarResultadoActualizacion({ ...e.deps, act: e.act }, { registroId: c.registroId, bearer: c.secreto, version: '1.1.0', ok: false, detalle: 'x'.repeat(500) })
  assert.equal(ok.status, 200)
  assert.equal(e.resultados.length, 1)
  assert.equal(e.resultados[0].detalle!.length, 120)
  assert.equal(e.resultados[0].ok, false)
  const raro = await registrarResultadoActualizacion({ ...e.deps, act: e.act }, { registroId: c.registroId, bearer: c.secreto, version: 'no-es-version', ok: true, detalle: null })
  assert.equal(raro.status, 400)
  const sinAuth = await registrarResultadoActualizacion({ ...e.deps, act: e.act }, { registroId: c.registroId, bearer: 'malo', version: '1.1.0', ok: true, detalle: null })
  assert.equal(sinAuth.status, 401)
  assert.equal(e.resultados.length, 1)
})
