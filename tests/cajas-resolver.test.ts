// resolverCaja: identifica la caja (y su cuenta dueña) a partir de registro_id + Bearer, para las rutas del Estudio.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registrarCaja, resolverCaja } from '../app/lib/cajas/servicio.ts'
import { crearDeps } from './cajas-mem.ts'

const T0 = new Date('2026-01-01T12:00:00Z')

async function conRegistro(opts: { estado?: string; caja?: boolean; expira?: Date } = {}) {
  const ahora = { t: new Date(T0) }
  const c = crearDeps(ahora)
  const r = await registrarCaja(c.deps, { ip: 'x', version: 'v' })
  if (!r.ok) throw new Error('registro falló')
  const reg = c.m.registros[0]
  reg.estado = opts.estado ?? 'pendiente'
  if (opts.expira) reg.expiraEn = opts.expira.toISOString()
  if (opts.caja) {
    c.m.cajas.push({ id: 'caja-1', slug: 'abcd1234', tunnelId: 'tun-1', ownerId: 'own-1' })
    c.m.emails['own-1'] = 'dueno@negocio.com'
    reg.cajaId = 'caja-1'
  }
  return { ...c, ahora, registroId: r.registro_id, secreto: r.secreto }
}

test('resolverCaja: vinculada devuelve la caja, su dueña y su correo', async () => {
  const c = await conRegistro({ estado: 'vinculada', caja: true })
  const r = await resolverCaja(c.deps, { registroId: c.registroId, bearer: c.secreto })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.caja.id, 'caja-1')
  assert.equal(r.caja.ownerId, 'own-1')
  assert.equal(r.registroId, c.registroId)
  assert.equal(r.ownerEmail, 'dueno@negocio.com')
})

test('resolverCaja: secreto equivocado, sin Bearer, registro inexistente y desvinculada → el mismo 401', async () => {
  const c = await conRegistro({ estado: 'vinculada', caja: true })
  const malo = await resolverCaja(c.deps, { registroId: c.registroId, bearer: 'mal' })
  const sin = await resolverCaja(c.deps, { registroId: c.registroId, bearer: null })
  const noExiste = await resolverCaja(c.deps, { registroId: 'no-existe', bearer: c.secreto })
  c.m.registros[0].estado = 'desvinculada'
  const desvinculada = await resolverCaja(c.deps, { registroId: c.registroId, bearer: c.secreto })
  for (const r of [malo, sin, noExiste, desvinculada]) {
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.equal(r.status, 401)
      assert.equal(r.error, 'No autorizado.')
    }
  }
})

test('resolverCaja: una caja que apunta a una fila de caja borrada cuenta como desvinculada (401)', async () => {
  const c = await conRegistro({ estado: 'vinculada', caja: true })
  c.m.cajas.length = 0
  const r = await resolverCaja(c.deps, { registroId: c.registroId, bearer: c.secreto })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.status, 401)
})

test('resolverCaja: pendiente → 409 y vencida → 409, con el aviso de vinculación', async () => {
  const p = await conRegistro()
  const a = await resolverCaja(p.deps, { registroId: p.registroId, bearer: p.secreto })
  assert.equal(a.ok, false)
  if (!a.ok) {
    assert.equal(a.status, 409)
    assert.equal(a.error, 'Esta caja todavía no está vinculada.')
  }
  p.ahora.t = new Date(T0.getTime() + 16 * 60_000)
  const v = await resolverCaja(p.deps, { registroId: p.registroId, bearer: p.secreto })
  assert.equal(v.ok, false)
  if (!v.ok) assert.equal(v.status, 409)
})

test('generations.ts: startGeneration guarda caja_id al insertar (prueba estática del texto)', () => {
  const src = readFileSync(new URL('../app/lib/generations.ts', import.meta.url), 'utf8')
  assert.match(src, /cajaId\?: string/)
  assert.match(src, /caja_id: input\.cajaId \?\? null/)
})
