// Reclamar una caja preparada con su código (sin crear túnel) y «quitar» = liberar (la caja conserva dirección y túnel).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_CAJAS_POR_CUENTA, abrirCaja, listarMisCajas, quitarCaja, vincularCaja } from '../app/lib/cajas/cliente-servicio.ts'
import { crearClienteMem } from './cajas-cliente-mem.ts'

const T0 = new Date('2026-10-31T15:00:00Z')
const U1 = 'f2ebed30-50df-424c-a9e5-fd571cfcadf6'
const U2 = '0a0a0a0a-50df-424c-a9e5-fd571cfcadf6'
const ERR_CODIGO = { error: 'Ese código no es válido o ya venció.' }

/** Una caja preparada (sin dueño) con código vigente `ABCD2345`. */
function conPreparada() {
  const ahora = { t: new Date(T0) }
  const r = crearClienteMem(ahora)
  const id = '00000000-0000-4000-8000-0000000000aa'
  r.m.cajas.push({ id, ownerId: null, nombre: 'Mi caja', slug: 'prep0001', tunnelId: 'tun-prep', lastSeen: T0.toISOString(), etiqueta: 'Cliente Bodega López', creadaPor: 'admin-1' })
  r.m.codigosPreparadas.set('ABCD2345', id)
  return { ...r, ahora, id }
}

test('reclamar: el código de una caja preparada la asigna a la cuenta SIN crear túnel', async () => {
  const { m, deps, id } = conPreparada()
  const r = await vincularCaja(deps, { userId: U1, codigo: 'ABCD-2345' })
  assert.equal(r.status, 200)
  assert.deepEqual(r.body, { caja: { id, nombre: 'Mi caja', direccion: 'prep0001.cajas.test' } })
  assert.equal(m.tunelesCreados.length, 0)
  assert.deepEqual(m.eventos, [])
  assert.equal(m.cajas[0].ownerId, U1)
  assert.equal(m.exitos.length, 1)
})

test('reclamar: acepta minúsculas, sin guion y con espacios', async () => {
  const { deps } = conPreparada()
  assert.equal((await vincularCaja(deps, { userId: U1, codigo: '  abcd2345 ' })).status, 200)
})

test('reclamar: código inexistente, vencido o de una caja que ya tiene dueño → el mismo 400 y se cuenta el fallo', async () => {
  const { m, deps, id } = conPreparada()
  const respuestas = [
    await vincularCaja(deps, { userId: U1, codigo: 'ZZZZ-2222' }),            // no existe
    await vincularCaja(deps, { userId: U1, codigo: 'no-es-un-codigo' }),       // forma mala
    await vincularCaja(deps, { userId: U1, codigo: 12345 }),                   // ni texto
  ]
  m.cajas.find((c) => c.id === id)!.ownerId = U2                               // ya tiene dueño
  respuestas.push(await vincularCaja(deps, { userId: U1, codigo: 'ABCD-2345' }))
  m.codigosPreparadas.delete('ABCD2345')                                       // vencido (la central ya no lo ofrece)
  respuestas.push(await vincularCaja(deps, { userId: U1, codigo: 'ABCD-2345' }))
  for (const r of respuestas) {
    assert.equal(r.status, 400)
    assert.deepEqual(r.body, ERR_CODIGO)
  }
  assert.equal(m.fallos.length, 5)
  assert.equal(m.tunelesCreados.length, 0)
})

test('reclamar: el 11.º fallo en 10 minutos → 429', async () => {
  const { deps } = conPreparada()
  for (let i = 0; i < 10; i++) assert.equal((await vincularCaja(deps, { userId: U1, codigo: 'ZZZZ-2222' })).status, 400)
  assert.equal((await vincularCaja(deps, { userId: U1, codigo: 'ABCD-2345' })).status, 429)
})

test('reclamar: si pierde la carrera (codigo_invalido) → 400 genérico y se cuenta el fallo; si el almacén falla → 500 sin filtrar', async () => {
  const a = conPreparada()
  a.m.reclamarForzado.push({ ok: false, motivo: 'codigo_invalido' })
  const r = await vincularCaja(a.deps, { userId: U1, codigo: 'ABCD-2345' })
  assert.equal(r.status, 400)
  assert.deepEqual(r.body, ERR_CODIGO)
  assert.equal(a.m.fallos.length, 1)
  assert.equal(a.m.cajas[0].ownerId, null)

  const b = conPreparada()
  b.m.reclamarForzado.push({ ok: false, motivo: 'error' })
  const e = await vincularCaja(b.deps, { userId: U1, codigo: 'ABCD-2345' })
  assert.equal(e.status, 500)
  assert.equal((e.body as any).error, 'No se pudo vincular la caja. Inténtalo de nuevo.')
})

test('reclamar: respeta el máximo de cajas por cuenta y el de 5 éxitos por hora', async () => {
  const a = conPreparada()
  for (let i = 0; i < MAX_CAJAS_POR_CUENTA; i++) a.m.cajas.push({ id: `c${i}`, ownerId: U1, nombre: 'x', slug: `s${i}`, tunnelId: `t${i}`, lastSeen: null })
  assert.equal((await vincularCaja(a.deps, { userId: U1, codigo: 'ABCD-2345' })).status, 409)
  assert.equal(a.m.cajas.find((c) => c.id === '00000000-0000-4000-8000-0000000000aa')!.ownerId, null)

  const b = conPreparada()
  for (let i = 0; i < 5; i++) b.m.exitos.push({ userId: U1, creado: T0.toISOString() })
  assert.equal((await vincularCaja(b.deps, { userId: U1, codigo: 'ABCD-2345' })).status, 429)
})

test('el flujo antiguo sigue funcionando: un código de registro pendiente crea el túnel y la caja con dueño', async () => {
  const { m, deps } = conPreparada()
  m.vinculables.add('WXYZ2345')
  const r = await vincularCaja(deps, { userId: U1, codigo: 'WXYZ-2345' })
  assert.equal(r.status, 200)
  assert.equal(m.tunelesCreados.length, 1)
  assert.equal(m.cajas.filter((c) => c.ownerId === U1).length, 1)
})

test('quitar por el dueño: la caja se LIBERA (queda sin dueño) y NO se toca Cloudflare', async () => {
  const { m, deps, id } = conPreparada()
  await vincularCaja(deps, { userId: U1, codigo: 'ABCD-2345' })
  m.tunelesVivos.add('tun-prep')
  const r = await quitarCaja(deps, { userId: U1, esAdmin: false, cajaId: id })
  assert.deepEqual(r, { status: 200, body: { ok: true } })
  assert.deepEqual(m.eventos, ['liberar'])
  const c = m.cajas.find((x) => x.id === id)!
  assert.equal(c.ownerId, null)
  assert.equal(c.slug, 'prep0001')
  assert.equal(c.tunnelId, 'tun-prep')
  assert.ok(m.tunelesVivos.has('tun-prep'))
  // ya no es suya: no la ve, ni la abre
  assert.deepEqual((await listarMisCajas(deps, { userId: U1 })).body, { cajas: [] })
  assert.equal((await abrirCaja(deps, { userId: U1, cajaId: id })).status, 404)
})

test('quitar: si liberar falla → 500 sin filtrar y la caja no cambia', async () => {
  const { m, deps, id } = conPreparada()
  await vincularCaja(deps, { userId: U1, codigo: 'ABCD-2345' })
  m.liberarFalla = true
  const r = await quitarCaja(deps, { userId: U1, esAdmin: false, cajaId: id })
  assert.equal(r.status, 500)
  assert.equal(m.cajas.find((x) => x.id === id)!.ownerId, U1)
})

test('quitar: otro usuario → 404 idéntico y no se toca nada; un administrador la ELIMINA del todo (desvincula y borra el túnel)', async () => {
  const { m, deps, id } = conPreparada()
  await vincularCaja(deps, { userId: U1, codigo: 'ABCD-2345' })
  const antes = m.eventos.length
  assert.deepEqual(await quitarCaja(deps, { userId: U2, esAdmin: false, cajaId: id }), { status: 404, body: { error: 'No encontré esa caja.' } })
  assert.equal(m.eventos.length, antes)
  m.tunelesVivos.add('tun-prep')
  const r = await quitarCaja(deps, { userId: U2, esAdmin: true, cajaId: id })
  assert.equal(r.status, 200)
  assert.deepEqual(m.eventos.slice(antes), ['desvincular', 'borrar'])
  assert.equal(m.cajas.some((c) => c.id === id), false)
  assert.equal(m.tunelesVivos.size, 0)
})

test('un administrador puede eliminar también una caja SIN dueño', async () => {
  const { m, deps, id } = conPreparada()
  const r = await quitarCaja(deps, { userId: U2, esAdmin: true, cajaId: id })
  assert.equal(r.status, 200)
  assert.equal(m.cajas.length, 0)
})
