import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicKey, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { vincularCaja, listarMisCajas, abrirCaja, renombrarMiCaja, quitarCaja, slugAleatorio } from '../app/lib/cajas/cliente-servicio.ts'
import { SLUG_REGEX } from '../app/lib/cloudflare.ts'
import { crearClienteMem } from './cajas-cliente-mem.ts'

const vector = JSON.parse(readFileSync(new URL('./fixtures/pase-vector.json', import.meta.url), 'utf8'))
const T0 = new Date('2026-10-30T12:00:00Z')
const MIN = 60_000
const U1 = 'f2ebed30-50df-424c-a9e5-fd571cfcadf6'
const U2 = '0a0a0a0a-50df-424c-a9e5-fd571cfcadf6'
const COD = 'ABCD-2345'
const nuevo = () => {
  const ahora = { t: new Date(T0) }
  const r = crearClienteMem(ahora)
  r.deps.env.paseKeyPrivada = vector.privateKeyB64
  r.m.vinculables.add('ABCD2345')
  return { ahora, ...r }
}
type Nuevo = ReturnType<typeof nuevo>
const MSG_CODIGO = { error: 'Ese código no es válido o ya venció.' }
const NO_ENC = { status: 404, body: { error: 'No encontré esa caja.' } }

// Réplica del verificador de la caja.
function verificarPase(pase: string, pubB64: string): { sub: string; box: string; exp: number } | null {
  const [cuerpo, firma] = pase.split('.')
  const pub = createPublicKey({ key: Buffer.from(pubB64, 'base64'), format: 'der', type: 'spki' })
  if (!verify(null, Buffer.from(cuerpo), pub, Buffer.from(firma, 'base64url'))) return null
  return JSON.parse(Buffer.from(cuerpo, 'base64url').toString())
}

// ---- vincularCaja
test('vincularCaja: éxito, dirección, nombre y sin filtrar tunnelId/token', async () => {
  const { m, deps } = nuevo()
  const r = await vincularCaja(deps, { userId: U1, codigo: 'abcd 2345' })
  assert.equal(r.status, 200)
  const caja = (r.body as { caja: { id: string; nombre: string; direccion: string } }).caja
  assert.equal(caja.nombre, 'Mi caja')
  assert.equal(caja.direccion, 'slug0001.cajas.test')
  assert.equal(caja.id, m.cajas[0].id)
  assert.equal(m.cajas[0].ownerId, U1)
  const txt = JSON.stringify(r.body)
  assert.ok(!txt.includes(m.cajas[0].tunnelId) && !txt.includes('TOKEN-SECRETO'))
  assert.deepEqual(m.eventos, ['crear'])
})

const casosCodigo: [string, unknown, (x: Nuevo) => void][] = [
  ['inexistente', 'ZZZZ-2222', () => {}],
  ['mal escrito', 'ab', () => {}],
  ['no es texto', 42, () => {}],
  ['vencido o ya usado', COD, x => { x.m.vinculables.clear() }],
]
for (const [nombre, codigo, prep] of casosCodigo) {
  test(`vincularCaja: código ${nombre} => mismo 400, sin túnel y con fallo registrado`, async () => {
    const x = nuevo()
    prep(x)
    const r = await vincularCaja(x.deps, { userId: U1, codigo })
    assert.deepEqual(r, { status: 400, body: MSG_CODIGO })
    assert.equal(x.m.tunelesCreados.length, 0)
    assert.equal(x.m.vincularLlamadas, 0)
    assert.equal(x.m.fallos.length, 1)
  })
}

test('vincularCaja: 10 fallos en 10 min => 11.º es 429 sin tocar nada más', async () => {
  const { m, deps } = nuevo()
  for (let i = 0; i < 10; i++) assert.equal((await vincularCaja(deps, { userId: U1, codigo: 'ZZZZ-2222' })).status, 400)
  const r = await vincularCaja(deps, { userId: U1, codigo: COD })
  assert.equal(r.status, 429)
  assert.deepEqual(r.body, { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' })
  assert.equal(m.fallos.length, 10)
  assert.equal(m.tunelesCreados.length, 0)
  // otro usuario no se ve afectado
  assert.equal((await vincularCaja(deps, { userId: U2, codigo: COD })).status, 200)
})

test('vincularCaja: fallos de hace más de 10 min no cuentan', async () => {
  const { ahora, m, deps } = nuevo()
  for (let i = 0; i < 10; i++) await vincularCaja(deps, { userId: U1, codigo: 'ZZZZ-2222' })
  ahora.t = new Date(T0.getTime() + 10 * MIN + 1000)
  assert.equal((await vincularCaja(deps, { userId: U1, codigo: COD })).status, 200)
  assert.equal(m.cajas.length, 1)
})

test('vincularCaja: slug repetido => borra el túnel y reintenta con otro slug', async () => {
  const { m, deps } = nuevo()
  m.forzarVincular.push({ ok: false, motivo: 'slug_repetido' })
  const r = await vincularCaja(deps, { userId: U1, codigo: COD })
  assert.equal(r.status, 200)
  assert.equal(m.tunelesCreados.length, 2)
  assert.notEqual(m.tunelesCreados[0].slug, m.tunelesCreados[1].slug)
  assert.equal(m.tunelesVivos.size, 1)
  assert.equal(m.cajas[0].tunnelId, m.tunelesCreados[1].tunnelId)
  assert.equal(m.fallos.length, 0)
})

test('vincularCaja: 3 slugs repetidos => 500 genérico sin túneles vivos', async () => {
  const { m, deps } = nuevo()
  for (let i = 0; i < 5; i++) m.forzarVincular.push({ ok: false, motivo: 'slug_repetido' })
  const r = await vincularCaja(deps, { userId: U1, codigo: COD })
  assert.equal(r.status, 500)
  assert.deepEqual(r.body, { error: 'No se pudo vincular la caja. Inténtalo de nuevo.' })
  assert.equal(m.tunelesCreados.length, 3)
  assert.equal(m.tunelesVivos.size, 0)
})

test('vincularCaja: carrera perdida (codigo_invalido tras crear túnel) => borra túnel, 400 y fallo', async () => {
  const { m, deps } = nuevo()
  m.forzarVincular.push({ ok: false, motivo: 'codigo_invalido' })
  const r = await vincularCaja(deps, { userId: U1, codigo: COD })
  assert.deepEqual(r, { status: 400, body: MSG_CODIGO })
  assert.equal(m.tunelesCreados.length, 1)
  assert.equal(m.tunelesVivos.size, 0)
  assert.equal(m.fallos.length, 1)
  assert.deepEqual(m.eventos, ['crear', 'borrar'])
})

test('vincularCaja: error del almacén (o excepción) => borra túnel y 500 genérico', async () => {
  const a = nuevo()
  a.m.forzarVincular.push({ ok: false, motivo: 'error' })
  const r = await vincularCaja(a.deps, { userId: U1, codigo: COD })
  assert.equal(r.status, 500)
  assert.equal(a.m.tunelesVivos.size, 0)
  const b = nuevo()
  b.deps.store.vincular = async () => { throw new Error('crudo de supabase') }
  const r2 = await vincularCaja(b.deps, { userId: U1, codigo: COD })
  assert.equal(r2.status, 500)
  assert.ok(!JSON.stringify(r2.body).includes('crudo'))
  assert.equal(b.m.tunelesVivos.size, 0)
})

test('vincularCaja: crearTunel lanza => 502 sin detalles y no llama a vincular', async () => {
  const { m, deps } = nuevo()
  m.crearFalla = true
  const r = await vincularCaja(deps, { userId: U1, codigo: COD })
  assert.equal(r.status, 502)
  assert.deepEqual(r.body, { error: 'No se pudo preparar la conexión de tu caja. Inténtalo de nuevo.' })
  assert.ok(!JSON.stringify(r.body).includes('secreto-token'))
  assert.equal(m.vincularLlamadas, 0)
})

test('vincularCaja: si borrarTunel falla en la limpieza la respuesta no cambia', async () => {
  const { m, deps } = nuevo()
  m.borrarFalla = true
  const orig = console.error
  console.error = () => {}
  try {
    m.forzarVincular.push({ ok: false, motivo: 'codigo_invalido' })
    assert.deepEqual(await vincularCaja(deps, { userId: U1, codigo: COD }), { status: 400, body: MSG_CODIGO })
    m.forzarVincular.push({ ok: false, motivo: 'error' })
    assert.equal((await vincularCaja(deps, { userId: U1, codigo: COD })).status, 500)
  } finally { console.error = orig }
})

// ---- topes de cajas y de éxitos
const MSG_MAX = { error: 'Ya tienes el máximo de cajas vinculadas (10). Quita una para agregar otra.' }
const MSG_429 = { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }
const relleno = (x: Nuevo, owner: string, n: number) => {
  for (let i = 0; i < n; i++) x.m.cajas.push({ id: `r${owner}${i}`, ownerId: owner, nombre: 'x', slug: 'zz' + String(i).padStart(6, '0'), tunnelId: 't', lastSeen: null })
}

test('tope: con 10 cajas => 409, sin túnel y sin fallo registrado', async () => {
  const x = nuevo()
  relleno(x, U1, 10)
  const r = await vincularCaja(x.deps, { userId: U1, codigo: COD })
  assert.deepEqual(r, { status: 409, body: MSG_MAX })
  assert.equal(x.m.tunelesCreados.length, 0)
  assert.equal(x.m.fallos.length, 0)
  assert.equal(x.m.vincularLlamadas, 0)
})

test('tope: con 9 cajas vincula la décima; el tope es por usuario', async () => {
  const x = nuevo()
  relleno(x, U1, 9)
  relleno(x, U2, 10)
  assert.equal((await vincularCaja(x.deps, { userId: U1, codigo: COD })).status, 200)
  x.m.vinculables.add('ABCD2345')
  assert.deepEqual((await vincularCaja(x.deps, { userId: U1, codigo: COD })).body, MSG_MAX)
  const y = nuevo()
  relleno(y, U2, 10)
  assert.equal((await vincularCaja(y.deps, { userId: U1, codigo: COD })).status, 200)
})

test('éxitos: 5 en una hora, la 6.ª da 429 sin túnel; pasada la hora vuelve a permitir', async () => {
  const x = nuevo()
  for (let i = 0; i < 5; i++) {
    x.m.vinculables.add('ABCD2345')
    assert.equal((await vincularCaja(x.deps, { userId: U1, codigo: COD })).status, 200)
    x.m.cajas.pop() // evita el tope de cajas para aislar este límite
  }
  assert.equal(x.m.exitos.length, 5)
  x.m.vinculables.add('ABCD2345')
  const antes = x.m.tunelesCreados.length
  assert.deepEqual(await vincularCaja(x.deps, { userId: U1, codigo: COD }), { status: 429, body: MSG_429 })
  assert.equal(x.m.tunelesCreados.length, antes)
  assert.equal(x.m.fallos.length, 0)
  assert.equal(x.m.exitos.length, 5)
  // otro usuario no se ve afectado
  assert.equal((await vincularCaja(x.deps, { userId: U2, codigo: COD })).status, 200)
  x.m.vinculables.add('ABCD2345')
  x.ahora.t = new Date(T0.getTime() + 60 * MIN + 1000)
  assert.equal((await vincularCaja(x.deps, { userId: U1, codigo: COD })).status, 200)
})

test('éxitos y fallos no se mezclan; vincular fallido no registra éxito', async () => {
  const x = nuevo()
  for (let i = 0; i < 9; i++) await vincularCaja(x.deps, { userId: U1, codigo: 'ZZZZ-2222' })
  assert.equal(x.m.exitos.length, 0)
  assert.equal((await vincularCaja(x.deps, { userId: U1, codigo: COD })).status, 200)
  assert.equal(x.m.fallos.length, 9)
  assert.equal(x.m.exitos.length, 1)
  const y = nuevo()
  y.m.forzarVincular.push({ ok: false, motivo: 'error' })
  await vincularCaja(y.deps, { userId: U1, codigo: COD })
  assert.equal(y.m.exitos.length, 0)
})

test('orden: código inválido da 400 antes que el tope de cajas y el de éxitos', async () => {
  const x = nuevo()
  relleno(x, U1, 10)
  for (let i = 0; i < 5; i++) x.m.exitos.push({ userId: U1, creado: T0.toISOString() })
  assert.deepEqual(await vincularCaja(x.deps, { userId: U1, codigo: 'ZZZZ-2222' }), { status: 400, body: MSG_CODIGO })
  assert.equal(x.m.fallos.length, 1)
  // tope de cajas antes que el de éxitos
  assert.deepEqual((await vincularCaja(x.deps, { userId: U1, codigo: COD })).body, MSG_MAX)
})

// ---- listarMisCajas
test('listarMisCajas: solo las del usuario; encendida/apagada según la última señal', async () => {
  const { m, deps } = nuevo()
  const base = { tunnelId: 't', nombre: 'x' }
  m.cajas.push(
    { ...base, id: 'a', ownerId: U1, slug: 'aaaaaaaa', lastSeen: new Date(T0.getTime() - 9 * MIN).toISOString() },
    { ...base, id: 'b', ownerId: U1, slug: 'bbbbbbbb', lastSeen: new Date(T0.getTime() - 11 * MIN).toISOString() },
    { ...base, id: 'c', ownerId: U1, slug: 'cccccccc', lastSeen: null },
    { ...base, id: 'd', ownerId: U2, slug: 'dddddddd', lastSeen: T0.toISOString() },
  )
  const r = await listarMisCajas(deps, { userId: U1 })
  const cajas = (r.body as { cajas: { id: string; estado: string; direccion: string; ultima_senal: string | null }[] }).cajas
  assert.deepEqual(cajas.map(c => [c.id, c.estado]), [['a', 'encendida'], ['b', 'apagada'], ['c', 'apagada']])
  assert.equal(cajas[0].direccion, 'aaaaaaaa.cajas.test')
  assert.equal(cajas[2].ultima_senal, null)
  assert.ok(!JSON.stringify(r.body).includes('tunnel'))
})

// ---- abrirCaja
function conCaja(lastSeen: Date | null = T0) {
  const x = nuevo()
  const id = 'ec77e545-47f5-44c4-95c9-00dd7004a262'
  x.m.cajas.push({ id, ownerId: U1, nombre: 'n', slug: 'abril123', tunnelId: 't', lastSeen: lastSeen ? lastSeen.toISOString() : null })
  return { ...x, id }
}

test('abrirCaja: URL exacta y pase verificable con sub=usuario y box=caja', async () => {
  const { deps, id } = conCaja()
  const r = await abrirCaja(deps, { userId: U1, cajaId: id })
  assert.equal(r.status, 200)
  const url = (r.body as { url: string }).url
  const m = /^https:\/\/abril123\.cajas\.test\/auth\/central\?pase=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(url)
  assert.ok(m, url)
  const p = verificarPase(m[1], vector.publicKeyB64)
  assert.ok(p)
  assert.equal(p.sub, U1)
  assert.equal(p.box, id)
  assert.equal(p.exp, Math.floor(T0.getTime() / 1000) + 60)
})

test('abrirCaja: caja de otro usuario o inexistente o no UUID => 404 idéntico', async () => {
  const { deps, id } = conCaja()
  assert.deepEqual(await abrirCaja(deps, { userId: U2, cajaId: id }), NO_ENC)
  assert.deepEqual(await abrirCaja(deps, { userId: U1, cajaId: '00000000-0000-4000-8000-000000000099' }), NO_ENC)
  assert.deepEqual(await abrirCaja(deps, { userId: U1, cajaId: 'no-es-uuid' }), NO_ENC)
})

test('abrirCaja: apagada => 409 y no se firma pase', async () => {
  for (const ls of [null, new Date(T0.getTime() - 11 * MIN)]) {
    const { deps, id } = conCaja(ls)
    const r = await abrirCaja(deps, { userId: U1, cajaId: id })
    assert.deepEqual(r, { status: 409, body: { error: 'Tu caja está apagada. Enciéndela y vuelve a intentarlo.' } })
    assert.ok(!JSON.stringify(r.body).includes('pase='))
  }
})

// ---- renombrarMiCaja
test('renombrarMiCaja: recorta, rechaza vacío y >60, aísla por dueño', async () => {
  const { m, deps, id } = conCaja()
  const ok = await renombrarMiCaja(deps, { userId: U1, cajaId: id, nombre: '  Oficina  ' })
  assert.equal(ok.status, 200)
  assert.equal(m.cajas[0].nombre, 'Oficina')
  const err = { status: 400, body: { error: 'El nombre debe tener entre 1 y 60 caracteres.' } }
  assert.deepEqual(await renombrarMiCaja(deps, { userId: U1, cajaId: id, nombre: '   ' }), err)
  assert.deepEqual(await renombrarMiCaja(deps, { userId: U1, cajaId: id, nombre: 'a'.repeat(61) }), err)
  assert.deepEqual(await renombrarMiCaja(deps, { userId: U1, cajaId: id, nombre: 5 }), err)
  assert.equal((await renombrarMiCaja(deps, { userId: U1, cajaId: id, nombre: 'a'.repeat(60) })).status, 200)
  const antes = m.renombres.length
  assert.deepEqual(await renombrarMiCaja(deps, { userId: U2, cajaId: id, nombre: 'Hack' }), NO_ENC)
  assert.deepEqual(await renombrarMiCaja(deps, { userId: U1, cajaId: 'x', nombre: 'Hack' }), NO_ENC)
  assert.equal(m.renombres.length, antes)
})

// ---- quitarCaja
test('quitarCaja: dueño => LIBERA la caja (queda sin dueño) y NO borra el túnel; borrar del todo es de administradores', async () => {
  const { m, deps, id } = conCaja()
  m.cajas[0].tunnelId = '11111111-1111-4111-8111-000000000001'
  m.tunelesVivos.add(m.cajas[0].tunnelId)
  const r = await quitarCaja(deps, { userId: U1, esAdmin: false, cajaId: id })
  assert.deepEqual(r, { status: 200, body: { ok: true } })
  assert.deepEqual(m.eventos, ['liberar'])
  assert.equal(m.cajas.length, 1)
  assert.equal(m.cajas[0].ownerId, null)
  assert.equal(m.tunelesVivos.size, 1)
})

test('quitarCaja: admin puede quitar la de otro', async () => {
  const { m, deps, id } = conCaja()
  const r = await quitarCaja(deps, { userId: U2, esAdmin: true, cajaId: id })
  assert.equal(r.status, 200)
  assert.equal(m.cajas.length, 0)
  assert.deepEqual(await quitarCaja(deps, { userId: U2, esAdmin: true, cajaId: id }), NO_ENC)
})

test('quitarCaja: otro usuario => 404 idéntico y no se toca nada', async () => {
  const { m, deps, id } = conCaja()
  assert.deepEqual(await quitarCaja(deps, { userId: U2, esAdmin: false, cajaId: id }), NO_ENC)
  assert.deepEqual(await quitarCaja(deps, { userId: U2, esAdmin: false, cajaId: 'x' }), NO_ENC)
  assert.equal(m.cajas.length, 1)
  assert.deepEqual(m.eventos, [])
})

test('quitarCaja (administrador): si borrarTunel falla => 200 igualmente y registra túnel huérfano sin tokens', async () => {
  const { m, deps, id } = conCaja()
  m.borrarFalla = true
  const logs: unknown[][] = []
  const orig = console.error
  console.error = (...a: unknown[]) => { logs.push(a) }
  try {
    const r = await quitarCaja(deps, { userId: U2, esAdmin: true, cajaId: id })
    assert.deepEqual(r, { status: 200, body: { ok: true } })
  } finally { console.error = orig }
  assert.equal(m.cajas.length, 0)
  assert.deepEqual(logs, [['[cajas] túnel huérfano', 't']])
})

test('quitarCaja (administrador): si desvincularCaja falla => 500 y NO se llama a borrarTunel', async () => {
  const { m, deps, id } = conCaja()
  m.desvincularFalla = true
  const r = await quitarCaja(deps, { userId: U2, esAdmin: true, cajaId: id })
  assert.equal(r.status, 500)
  assert.ok(!m.eventos.includes('borrar'))
})

// ---- slugAleatorio
test('slugAleatorio: 500 slugs válidos y sin repetirse', () => {
  const vistos = new Set<string>()
  for (let i = 0; i < 500; i++) {
    const s = slugAleatorio()
    assert.match(s, SLUG_REGEX)
    vistos.add(s)
  }
  assert.equal(vistos.size, 500)
})
