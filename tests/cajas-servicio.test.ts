import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registrarCaja, estadoCaja, latidoCaja } from '../app/lib/cajas/servicio.ts'
import { hashSecreto } from '../app/lib/cajas/secreto.ts'
import { crearDeps } from './cajas-mem.ts'

const T0 = new Date('2026-01-01T12:00:00Z')
const nuevo = () => { const ahora = { t: new Date(T0) }; return { ahora, ...crearDeps(ahora) } }

// ---- registrarCaja
test('registrarCaja: forma, código normalizado en el almacén, solo hash, expira en 15 min', async () => {
  const { m, deps } = nuevo()
  const r = await registrarCaja(deps, { ip: '1.1.1.1', version: '1.0' })
  assert.ok(r.ok)
  if (!r.ok) return
  assert.match(r.codigo, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  assert.equal(m.registros[0].codigo, r.codigo.replace('-', ''))
  assert.equal(m.registros[0].secretoHash, hashSecreto(r.secreto))
  assert.equal(r.registro_id, m.registros[0].id)
  assert.equal(r.expira_en, new Date(T0.getTime() + 15 * 60_000).toISOString())
  assert.ok(!JSON.stringify(m).includes(r.secreto))
})

test('registrarCaja: reintenta ante codigo_duplicado y falla con 500 tras 5', async () => {
  const a = nuevo()
  a.m.forzarDuplicados = 2
  const r = await registrarCaja(a.deps, { ip: 'x', version: 'v' })
  assert.ok(r.ok)
  assert.equal(a.m.intentosCrear, 3)
  const b = nuevo()
  b.m.forzarDuplicados = 99
  const f = await registrarCaja(b.deps, { ip: 'x', version: 'v' })
  assert.equal(f.ok, false)
  assert.equal((f as { status: number }).status, 500)
  assert.equal(b.m.intentosCrear, 5)
})

test('registrarCaja: límite 20 por IP por hora', async () => {
  const { deps } = nuevo()
  for (let i = 0; i < 20; i++) assert.ok((await registrarCaja(deps, { ip: '9.9.9.9', version: 'v' })).ok)
  const r = await registrarCaja(deps, { ip: '9.9.9.9', version: 'v' })
  assert.equal(r.ok, false)
  assert.equal((r as { status: number }).status, 429)
  assert.ok((await registrarCaja(deps, { ip: '8.8.8.8', version: 'v' })).ok)
})

test('registrarCaja: limpia y un fallo de limpieza no rompe', async () => {
  const a = nuevo()
  await registrarCaja(a.deps, { ip: 'x', version: 'v' })
  const dia = new Date(T0.getTime() - 86400_000).toISOString()
  assert.deepEqual([...a.m.limpiezas].sort(), ['i:' + dia, 'r:' + dia])
  const b = nuevo()
  b.m.fallaLimpieza = true
  assert.ok((await registrarCaja(b.deps, { ip: 'x', version: 'v' })).ok)
})

// ---- estadoCaja / latidoCaja
async function conRegistro(opts: { estado?: string; caja?: boolean; expira?: Date } = {}) {
  const c = nuevo()
  const r = await registrarCaja(c.deps, { ip: 'x', version: 'v' })
  if (!r.ok) throw new Error('registro falló')
  const reg = c.m.registros[0]
  reg.estado = opts.estado ?? 'pendiente'
  if (opts.expira) reg.expiraEn = opts.expira.toISOString()
  if (opts.caja) {
    c.m.cajas.push({ id: 'caja-1', slug: 'abcd1234', tunnelId: 'tun-1', ownerId: 'own-1' })
    c.m.emails['own-1'] = 'a@b.com'
    reg.cajaId = 'caja-1'
  }
  return { ...c, registroId: r.registro_id, secreto: r.secreto }
}

test('estadoCaja: 401 idéntico para inexistente, sin bearer y secreto equivocado', async () => {
  const c = await conRegistro()
  const a = await estadoCaja(c.deps, { registroId: 'no-existe', bearer: c.secreto, conToken: false })
  const b = await estadoCaja(c.deps, { registroId: c.registroId, bearer: null, conToken: false })
  const d = await estadoCaja(c.deps, { registroId: c.registroId, bearer: 'mal', conToken: false })
  assert.deepEqual(a, { status: 401, body: { error: 'No autorizado.' } })
  assert.deepEqual(b, a)
  assert.deepEqual(d, a)
})

test('estadoCaja: pendiente y vencida por reloj', async () => {
  const c = await conRegistro()
  const p = await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: false })
  assert.deepEqual(p, { status: 200, body: { estado: 'pendiente' } })
  c.ahora.t = new Date(T0.getTime() + 16 * 60_000)
  const v = await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: false })
  assert.deepEqual(v.body, { estado: 'vencida' })
})

test('estadoCaja: vinculada con campos; tunnel_token solo con conToken', async () => {
  const c = await conRegistro({ estado: 'vinculada', caja: true })
  const s = await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: false })
  assert.equal(s.status, 200)
  assert.deepEqual(s.body, { estado: 'vinculada', caja_id: 'caja-1', direccion: 'abcd1234.cajas.test', pase_publica: 'PUBKEY', owner_id: 'own-1', owner_email: 'a@b.com' })
  const t = await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: true })
  assert.equal((t.body as { tunnel_token?: string }).tunnel_token, 'tok-tun-1')
  assert.ok(!JSON.stringify(t.body).includes(c.secreto))
  assert.ok(!JSON.stringify(t.body).includes(hashSecreto(c.secreto)))
})

test('estadoCaja: Cloudflare falla -> 502 sin detalles', async () => {
  const c = await conRegistro({ estado: 'vinculada', caja: true })
  c.deps.cloudflare = { obtenerTokenTunel: async () => { throw new Error('secreto-interno CF 1000') } }
  const r = await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: true })
  assert.equal(r.status, 502)
  assert.deepEqual(r.body, { error: 'No se pudo preparar la conexión de la caja. Inténtalo de nuevo.' })
})

test('estadoCaja: desvinculada y huérfano', async () => {
  const d = await conRegistro({ estado: 'desvinculada' })
  assert.deepEqual((await estadoCaja(d.deps, { registroId: d.registroId, bearer: d.secreto, conToken: true })).body, { estado: 'desvinculada' })
  const h = await conRegistro({ estado: 'vinculada' })
  assert.deepEqual((await estadoCaja(h.deps, { registroId: h.registroId, bearer: h.secreto, conToken: true })).body, { estado: 'desvinculada' })
})

test('latidoCaja: vinculada toca la caja con versión y hora', async () => {
  const c = await conRegistro({ estado: 'vinculada', caja: true })
  const r = await latidoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, version: '2.0' })
  assert.deepEqual(r, { status: 200, body: { estado: 'vinculada' } })
  assert.deepEqual(c.m.toques, [{ cajaId: 'caja-1', version: '2.0', ahora: T0.toISOString() }])
})

test('latidoCaja: otros casos -> desvinculada sin tocar', async () => {
  const casos = [
    await conRegistro({ estado: 'desvinculada', caja: true }),
    await conRegistro({ estado: 'pendiente' }),
    await conRegistro({ estado: 'pendiente', expira: new Date(T0.getTime() - 1000) }),
    await conRegistro({ estado: 'vinculada' }),
  ]
  for (const c of casos) {
    const r = await latidoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, version: '2.0' })
    assert.deepEqual(r, { status: 200, body: { estado: 'desvinculada' } })
    assert.equal(c.m.toques.length, 0)
  }
})

test('latidoCaja: mismo 401', async () => {
  const c = await conRegistro({ estado: 'vinculada', caja: true })
  const e = await estadoCaja(c.deps, { registroId: 'zzz', bearer: null, conToken: false })
  assert.deepEqual(await latidoCaja(c.deps, { registroId: 'zzz', bearer: null, version: 'v' }), e)
  assert.deepEqual(await latidoCaja(c.deps, { registroId: c.registroId, bearer: 'mal', version: 'v' }), e)
  assert.equal(c.m.toques.length, 0)
})

// ---- límite de tunnel_token por registro
const LIM = 'Demasiados intentos. Espera un rato e inténtalo de nuevo.'

test('estadoCaja token: 10 pasan, la 11.ª da 429 sin llamar a Cloudflare ni al email', async () => {
  const c = await conRegistro({ estado: 'vinculada', caja: true })
  let cf = 0
  c.deps.cloudflare = { obtenerTokenTunel: async () => { cf++; return 'tok' } }
  for (let i = 0; i < 10; i++) {
    const r = await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: true })
    assert.equal(r.status, 200)
    assert.equal((r.body as { tunnel_token?: string }).tunnel_token, 'tok')
  }
  const r = await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: true })
  assert.deepEqual(r, { status: 429, body: { error: LIM } })
  assert.equal(cf, 10)
  assert.equal(c.m.emailLookups, 10)
})

test('estadoCaja token: el límite es por registro', async () => {
  const a = await conRegistro({ estado: 'vinculada', caja: true })
  for (let i = 0; i < 10; i++) await estadoCaja(a.deps, { registroId: a.registroId, bearer: a.secreto, conToken: true })
  assert.equal((await estadoCaja(a.deps, { registroId: a.registroId, bearer: a.secreto, conToken: true })).status, 429)
  // segundo registro en el mismo almacén
  const r2 = await registrarCaja(a.deps, { ip: 'otra', version: 'v' })
  if (!r2.ok) throw new Error('x')
  a.m.registros[1].estado = 'vinculada'
  a.m.registros[1].cajaId = 'caja-1'
  const o = await estadoCaja(a.deps, { registroId: r2.registro_id, bearer: r2.secreto, conToken: true })
  assert.equal(o.status, 200)
})

test('estadoCaja sin conToken no consume el límite', async () => {
  const c = await conRegistro({ estado: 'vinculada', caja: true })
  for (let i = 0; i < 50; i++) {
    const r = await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: false })
    assert.equal(r.status, 200)
    assert.ok(!('tunnel_token' in r.body))
  }
  assert.equal(c.m.intentos.filter(i => i.clave.startsWith('token:')).length, 0)
  assert.equal((await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: true })).status, 200)
})

test('estadoCaja token: pasada la hora vuelve a permitir', async () => {
  const c = await conRegistro({ estado: 'vinculada', caja: true })
  for (let i = 0; i < 10; i++) await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: true })
  assert.equal((await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: true })).status, 429)
  c.ahora.t = new Date(T0.getTime() + 3600_000 + 1000)
  assert.equal((await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: true })).status, 200)
})

test('estadoCaja token: secreto incorrecto da el mismo 401 y no consume cupo; estados no vinculados tampoco', async () => {
  const c = await conRegistro({ estado: 'vinculada', caja: true })
  const ref = await estadoCaja(c.deps, { registroId: 'zzz', bearer: null, conToken: true })
  for (let i = 0; i < 20; i++) assert.deepEqual(await estadoCaja(c.deps, { registroId: c.registroId, bearer: 'mal', conToken: true }), ref)
  assert.equal(c.m.intentos.filter(i => i.clave.startsWith('token:')).length, 0)
  for (let i = 0; i < 10; i++) assert.equal((await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: true })).status, 200)
  const p = await conRegistro({ estado: 'pendiente' })
  await estadoCaja(p.deps, { registroId: p.registroId, bearer: p.secreto, conToken: true })
  assert.equal(p.m.intentos.filter(i => i.clave.startsWith('token:')).length, 0)
})
