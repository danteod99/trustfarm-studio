// Lado «caja» de la central: activar con la llave, renovar el código y los estados de una caja SIN dueño (preparada).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activarCaja, codigoCaja, estadoCaja, latidoCaja, registrarCaja, resolverCaja } from '../app/lib/cajas/servicio.ts'
import { hashSecreto } from '../app/lib/cajas/secreto.ts'
import { crearDeps } from './cajas-mem.ts'

const T0 = new Date('2026-10-31T15:00:00Z')
const LLAVE = 'llave-de-activacion-de-prueba-0123456789'
const ERR_LLAVE = 'La llave de activación no es válida o ya venció.'

/** Una caja preparada (sin dueño) con su llave sin usar. */
function preparada(opts: { llave?: string; venceEn?: Date } = {}) {
  const ahora = { t: new Date(T0) }
  const c = crearDeps(ahora)
  c.m.cajas.push({ id: 'caja-1', slug: 'abcd1234', tunnelId: 'tun-1', ownerId: null })
  c.m.activaciones.push({ cajaId: 'caja-1', llaveHash: hashSecreto(opts.llave ?? LLAVE), venceEn: (opts.venceEn ?? new Date(T0.getTime() + 30 * 86_400_000)).toISOString() })
  return { ...c, ahora }
}
/** La misma, ya activada: devuelve también el registro y el secreto de la caja. */
async function activada() {
  const p = preparada()
  const r = await activarCaja(p.deps, { llave: LLAVE, version: '1.0', ip: '1.1.1.1' })
  assert.equal(r.status, 200)
  const b = r.body as any
  return { ...p, registroId: b.registro_id as string, secreto: b.secreto as string, codigo: b.codigo as string }
}

test('activar: devuelve registro, secreto, caja, dirección y un código XXXX-XXXX que vence en 15 min; el almacén solo guarda hashes', async () => {
  const p = preparada()
  const r = await activarCaja(p.deps, { llave: LLAVE, version: '1.0', ip: '1.1.1.1' })
  assert.equal(r.status, 200)
  const b = r.body as any
  assert.equal(b.caja_id, 'caja-1')
  assert.equal(b.direccion, 'abcd1234.cajas.test')
  assert.match(b.codigo, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/)
  assert.equal(b.expira_en, new Date(T0.getTime() + 15 * 60_000).toISOString())
  assert.ok(typeof b.secreto === 'string' && b.secreto.length >= 32)
  const reg = p.m.registros.find((x) => x.id === b.registro_id)!
  assert.equal(reg.secretoHash, hashSecreto(b.secreto))
  assert.equal(reg.cajaId, 'caja-1')
  const guardado = JSON.stringify(p.m)
  assert.ok(!guardado.includes(b.secreto), 'el secreto en claro no debe estar en el almacén')
  assert.ok(!guardado.includes(LLAVE), 'la llave en claro no debe estar en el almacén')
})

test('activar: la MISMA llave dos veces → 400 genérico', async () => {
  const p = preparada()
  assert.equal((await activarCaja(p.deps, { llave: LLAVE, version: '1', ip: 'a' })).status, 200)
  const r = await activarCaja(p.deps, { llave: LLAVE, version: '1', ip: 'b' })
  assert.equal(r.status, 400)
  assert.deepEqual(r.body, { error: ERR_LLAVE })
})

test('activar: llave vencida, inexistente y de forma mala dan exactamente el mismo 400, y la forma mala ni toca el almacén', async () => {
  const vencida = preparada({ venceEn: new Date(T0.getTime() - 60_000) })
  const a = await activarCaja(vencida.deps, { llave: LLAVE, version: '1', ip: 'a' })
  const p = preparada()
  const b = await activarCaja(p.deps, { llave: 'otra-llave-que-no-existe-0123456789', version: '1', ip: 'a' })
  const llamadasAntes = p.m.activarLlamadas
  const malas = [undefined, null, 42, '', 'corta', 'con espacios dentro de la llave 0123456789', 'con/barra/0123456789012345', 'x'.repeat(129)]
  const resultados = [a, b]
  for (const llave of malas) resultados.push(await activarCaja(p.deps, { llave, version: '1', ip: 'a' }))
  for (const r of resultados) {
    assert.equal(r.status, 400)
    assert.deepEqual(r.body, { error: ERR_LLAVE })
  }
  assert.equal(p.m.activarLlamadas, llamadasAntes, 'las llaves de forma mala no deben llegar al almacén')
})

test('activar: espacios alrededor de la llave se ignoran', async () => {
  const p = preparada()
  assert.equal((await activarCaja(p.deps, { llave: `  ${LLAVE}\n`, version: '1', ip: 'a' })).status, 200)
})

test('activar: el 11.º intento en una hora desde la misma IP → 429, y pasada la hora vuelve a permitir', async () => {
  const p = preparada()
  for (let i = 0; i < 10; i++) assert.equal((await activarCaja(p.deps, { llave: `intento-${i}-de-llave-inexistente-0123456789`, version: '1', ip: '9.9.9.9' })).status, 400)
  const r = await activarCaja(p.deps, { llave: LLAVE, version: '1', ip: '9.9.9.9' })
  assert.equal(r.status, 429)
  assert.equal(p.m.activarLlamadas, 10)
  p.ahora.t = new Date(T0.getTime() + 3600_000 + 1000)
  assert.equal((await activarCaja(p.deps, { llave: LLAVE, version: '1', ip: '9.9.9.9' })).status, 200)
})

test('activar: probar la misma llave mala desde muchas IP también se frena (10 por hora por llave)', async () => {
  const p = preparada()
  const mala = 'llave-mala-repetida-desde-muchas-ip-0123456789'
  for (let i = 0; i < 10; i++) assert.equal((await activarCaja(p.deps, { llave: mala, version: '1', ip: `10.0.0.${i}` })).status, 400)
  assert.equal((await activarCaja(p.deps, { llave: mala, version: '1', ip: '10.0.0.99' })).status, 429)
})

test('código: devuelve el vigente sin cambiarlo; vencido, entrega uno nuevo con 15 min más', async () => {
  const c = await activada()
  const a = await codigoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto })
  assert.equal(a.status, 200)
  assert.equal((a.body as any).codigo, c.codigo)
  c.ahora.t = new Date(T0.getTime() + 16 * 60_000)
  const b = await codigoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto })
  assert.equal(b.status, 200)
  assert.notEqual((b.body as any).codigo, c.codigo)
  assert.match((b.body as any).codigo, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/)
  assert.equal((b.body as any).expira_en, new Date(c.ahora.t.getTime() + 15 * 60_000).toISOString())
})

test('código: con dueño → 409; secreto malo o registro inexistente → el mismo 401 que estado; más de 30 por hora → 429', async () => {
  const c = await activada()
  const malo = await codigoCaja(c.deps, { registroId: c.registroId, bearer: 'mal' })
  const noExiste = await codigoCaja(c.deps, { registroId: 'no-existe', bearer: c.secreto })
  const estado = await estadoCaja(c.deps, { registroId: c.registroId, bearer: 'mal', conToken: false })
  assert.equal(malo.status, 401)
  assert.deepEqual(malo.body, estado.body)
  assert.deepEqual(noExiste.body, estado.body)
  for (let i = 0; i < 30; i++) assert.equal((await codigoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto })).status, 200, `petición ${i + 1}`)
  assert.equal((await codigoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto })).status, 429)

  const d = await activada()
  d.m.cajas[0].ownerId = 'cuenta-1'
  assert.equal((await codigoCaja(d.deps, { registroId: d.registroId, bearer: d.secreto })).status, 409)
})

test('estado de una caja sin dueño: preparada, con dirección, clave pública y código vigente; token del túnel solo si se pide', async () => {
  const c = await activada()
  const s = await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: false })
  assert.equal(s.status, 200)
  const b = s.body as any
  assert.equal(b.estado, 'preparada')
  assert.equal(b.caja_id, 'caja-1')
  assert.equal(b.direccion, 'abcd1234.cajas.test')
  assert.equal(b.pase_publica, 'PUBKEY')
  assert.equal(b.codigo, c.codigo)
  assert.equal(b.vence_en, new Date(T0.getTime() + 15 * 60_000).toISOString())
  assert.equal(b.tunnel_token, undefined)
  assert.equal(b.owner_id, undefined)
  const t = await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: true })
  assert.equal((t.body as any).tunnel_token, 'tok-tun-1')
})

test('estado de una caja preparada: un código vencido no se devuelve', async () => {
  const c = await activada()
  c.ahora.t = new Date(T0.getTime() + 20 * 60_000)
  const b = (await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: false })).body as any
  assert.equal(b.estado, 'preparada')
  assert.equal(b.codigo, undefined)
  assert.equal(b.vence_en, undefined)
})

test('estado: una caja CON dueño sigue siendo «vinculada» con los datos del dueño (también la del flujo antiguo)', async () => {
  const c = await activada()
  c.m.cajas[0].ownerId = 'cuenta-1'
  c.m.emails['cuenta-1'] = 'dueno@negocio.com'
  const b = (await estadoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, conToken: false })).body as any
  assert.equal(b.estado, 'vinculada')
  assert.equal(b.owner_id, 'cuenta-1')
  assert.equal(b.owner_email, 'dueno@negocio.com')

  // flujo antiguo: registrar → el cliente la vincula (la fila de la caja nace con dueño)
  const ahora = { t: new Date(T0) }
  const v = crearDeps(ahora)
  const reg = await registrarCaja(v.deps, { ip: 'x', version: 'v' })
  if (!reg.ok) throw new Error('registro falló')
  v.m.registros[0].estado = 'vinculada'
  v.m.registros[0].cajaId = 'caja-vieja'
  v.m.cajas.push({ id: 'caja-vieja', slug: 'vieja123', tunnelId: 'tun-v', ownerId: 'own-1' })
  v.m.emails['own-1'] = 'a@b.com'
  const e = (await estadoCaja(v.deps, { registroId: reg.registro_id, bearer: reg.secreto, conToken: false })).body as any
  assert.equal(e.estado, 'vinculada')
  assert.equal(e.owner_email, 'a@b.com')
})

test('latido: preparada → «preparada» y actualiza last_seen; con dueño → «vinculada»; desvinculada → «desvinculada»', async () => {
  const c = await activada()
  const a = await latidoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, version: '1.2.3' })
  assert.deepEqual(a.body, { estado: 'preparada' })
  assert.equal(c.m.toques.length, 1)
  assert.equal(c.m.toques[0].version, '1.2.3')
  c.m.cajas[0].ownerId = 'cuenta-1'
  assert.deepEqual((await latidoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, version: '1' })).body, { estado: 'vinculada' })
  c.m.registros[0].estado = 'desvinculada'
  assert.deepEqual((await latidoCaja(c.deps, { registroId: c.registroId, bearer: c.secreto, version: '1' })).body, { estado: 'desvinculada' })
})

test('resolverCaja: una caja sin dueño → 409 con el aviso de asociar; con dueño sigue resolviendo', async () => {
  const c = await activada()
  const r = await resolverCaja(c.deps, { registroId: c.registroId, bearer: c.secreto })
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.status, 409)
    assert.equal(r.error, 'Asocia tu caja a tu cuenta para usar el Estudio.')
  }
  c.m.cajas[0].ownerId = 'cuenta-1'
  c.m.emails['cuenta-1'] = 'dueno@negocio.com'
  const ok = await resolverCaja(c.deps, { registroId: c.registroId, bearer: c.secreto })
  assert.equal(ok.ok, true)
})

test('reactivar con una llave nueva cambia el secreto (el anterior deja de servir), conserva al dueño y la caja sigue siendo la misma', async () => {
  const c = await activada()
  c.m.cajas[0].ownerId = 'cuenta-1'
  c.m.emails['cuenta-1'] = 'dueno@negocio.com'
  const viejoSecreto = c.secreto
  c.m.activaciones.push({ cajaId: 'caja-1', llaveHash: hashSecreto('llave-nueva-para-reactivar-0123456789'), venceEn: new Date(T0.getTime() + 86_400_000).toISOString() })
  const r = await activarCaja(c.deps, { llave: 'llave-nueva-para-reactivar-0123456789', version: '1.1', ip: 'z' })
  assert.equal(r.status, 200)
  const nuevo = (r.body as any).secreto as string
  assert.notEqual(nuevo, viejoSecreto)
  assert.equal((r.body as any).registro_id, c.registroId, 'el registro es el mismo')
  assert.equal(c.m.registros.filter((x) => x.cajaId === 'caja-1').length, 1)
  assert.equal((await estadoCaja(c.deps, { registroId: c.registroId, bearer: viejoSecreto, conToken: false })).status, 401)
  const e = (await estadoCaja(c.deps, { registroId: c.registroId, bearer: nuevo, conToken: false })).body as any
  assert.equal(e.estado, 'vinculada')
  assert.equal(e.owner_id, 'cuenta-1')
})
