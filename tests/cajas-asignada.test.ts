// Caja asignada a una cuenta: validar el correo escrito en la mini PC, vínculo estricto y crear la caja con su correo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { correoCaja, registrarCaja } from '../app/lib/cajas/servicio.ts'
import { vincularCaja } from '../app/lib/cajas/cliente-servicio.ts'
import { prepararCaja } from '../app/lib/cajas/fabrica-servicio.ts'
import { correoDeGoogle, enmascararCorreo, normalizarCorreo } from '../app/lib/cajas/correo.ts'
import { crearDeps } from './cajas-mem.ts'
import { crearClienteMem } from './cajas-cliente-mem.ts'

const T0 = new Date('2026-11-03T12:00:00Z')
const MIN = 60_000
const HORA = 60 * MIN
const U1 = 'f2ebed30-50df-424c-a9e5-fd571cfcadf6'
const U2 = '0a0a0a0a-50df-424c-a9e5-fd571cfcadf6'
const CORREO = 'cliente@gmail.com'
const COD = 'ABCD2345'

// ---- correoCaja (la mini PC valida el correo que escribió el cliente)
async function cajaRegistrada() {
  const ahora = { t: new Date(T0) }
  const r = crearDeps(ahora)
  const reg = await registrarCaja(r.deps, { ip: '1.1.1.1', version: '1.0' })
  assert.ok(reg.ok)
  if (!reg.ok) throw new Error('sin registro')
  const pedir = (correo: unknown, ip = '1.1.1.1', bearer: string = reg.secreto) =>
    correoCaja(r.deps, { registroId: reg.registro_id, bearer, ip, correo })
  return { ahora, ...r, reg, pedir }
}

test('correoCaja: sin secreto válido → 401 y no guarda nada', async () => {
  const { m, pedir } = await cajaRegistrada()
  m.correosConCaja.add(CORREO)
  const r = await pedir(CORREO, '1.1.1.1', 'secreto-malo')
  assert.equal(r.status, 401)
  assert.equal(m.registros[0].emailValidado, undefined)
})

test('correoCaja: correo mal escrito → 400 sin gastar intentos', async () => {
  const { m, pedir } = await cajaRegistrada()
  for (const malo of ['', 'sin-arroba', 'a@b', 'con espacio@gmail.com', 123, null, 'x'.repeat(250) + '@gmail.com']) {
    const r = await pedir(malo)
    assert.equal(r.status, 400, String(malo))
    assert.match((r.body as { error: string }).error, /correo/i)
  }
  assert.equal(m.intentos.filter((i) => i.clave.startsWith('correo')).length, 0)
})

test('correoCaja: correo sin caja asignada libre → 404 con mensaje claro y no queda validado', async () => {
  const { m, pedir } = await cajaRegistrada()
  const r = await pedir('otro@gmail.com')
  assert.equal(r.status, 404)
  assert.match((r.body as { error: string }).error, /No hay una caja asignada/)
  assert.equal(m.registros[0].emailValidado, undefined)
})

test('correoCaja: correo con caja asignada → 200, se guarda en minúsculas y sin espacios', async () => {
  const { m, pedir } = await cajaRegistrada()
  m.correosConCaja.add(CORREO)
  const r = await pedir('  Cliente@GMAIL.com ')
  assert.equal(r.status, 200)
  assert.deepEqual(r.body, { ok: true, correo: CORREO })
  assert.equal(m.registros[0].emailValidado, CORREO)
})

test('correoCaja: máximo 5 intentos por hora por registro; pasada la hora vuelve a poder', async () => {
  const { ahora, m, pedir } = await cajaRegistrada()
  for (let i = 0; i < 5; i++) assert.equal((await pedir('nadie@gmail.com')).status, 404)
  m.correosConCaja.add(CORREO)
  assert.equal((await pedir(CORREO)).status, 429)
  ahora.t = new Date(T0.getTime() + 10 * MIN)
  assert.equal((await pedir(CORREO)).status, 429)
  // El código del registro vive 15 min: se renueva a mano para probar solo el límite
  m.registros[0].expiraEn = new Date(T0.getTime() + 3 * HORA).toISOString()
  ahora.t = new Date(T0.getTime() + HORA + 1)
  assert.equal((await pedir(CORREO)).status, 200)
})

test('correoCaja: máximo 30 intentos por hora por IP aunque cambie el registro', async () => {
  const ahora = { t: new Date(T0) }
  const { m, deps } = crearDeps(ahora)
  let ultima = 0
  for (let i = 0; i < 7; i++) {
    const reg = await registrarCaja(deps, { ip: `10.0.0.${i}`, version: '1.0' })
    assert.ok(reg.ok)
    if (!reg.ok) return
    for (let j = 0; j < 5; j++) {
      const r = await correoCaja(deps, { registroId: reg.registro_id, bearer: reg.secreto, ip: '9.9.9.9', correo: 'nadie@gmail.com' })
      ultima = r.status
      if (r.status === 429) break
    }
    if (ultima === 429) break
  }
  assert.equal(ultima, 429)
  assert.equal(m.intentos.filter((i) => i.clave === 'correo-ip:9.9.9.9').length, 30)
})

test('correoCaja: registro vencido o ya vinculado → 409', async () => {
  const a = await cajaRegistrada()
  a.m.correosConCaja.add(CORREO)
  a.ahora.t = new Date(T0.getTime() + 16 * MIN)
  assert.equal((await a.pedir(CORREO)).status, 409)

  const b = await cajaRegistrada()
  b.m.correosConCaja.add(CORREO)
  b.m.cajas.push({ id: 'c1', slug: 's', tunnelId: 't', ownerId: U1 })
  Object.assign(b.m.registros[0], { estado: 'vinculada', cajaId: 'c1' })
  assert.equal((await b.pedir(CORREO)).status, 409)
})

// ---- vincularCaja estricto
const estricto = () => {
  const ahora = { t: new Date(T0) }
  const r = crearClienteMem(ahora, { vinculoAbierto: false })
  r.m.vinculables.add(COD)
  return { ahora, ...r }
}
const cajaAsignada = (m: ReturnType<typeof estricto>['m'], id: string, email: string, creadaEn: string) =>
  m.cajas.push({ id, ownerId: null, nombre: 'Mi caja', slug: 'slug-' + id, tunnelId: 'tun-' + id, lastSeen: null, emailAsignado: email, creadaEn, creadaPor: 'admin' })

test('vincular estricto: sin correo validado en la mini PC → 403, pide escribirlo, y no crea nada', async () => {
  const { m, deps } = estricto()
  cajaAsignada(m, 'c1', CORREO, '2026-11-01')
  const r = await vincularCaja(deps, { userId: U1, email: CORREO, codigo: COD })
  assert.equal(r.status, 403)
  assert.match((r.body as { error: string }).error, /escribe tu correo en la pantalla de la mini PC/i)
  assert.equal(m.tunelesCreados.length, 0)
  assert.equal(m.vincularLlamadas, 0)
  assert.equal(m.cajas[0].ownerId, null)
  assert.equal(m.fallos.length, 1)
})

test('vincular estricto: la sesión es de otra cuenta → 403 y la caja sigue libre', async () => {
  const { m, deps } = estricto()
  cajaAsignada(m, 'c1', CORREO, '2026-11-01')
  m.emailsValidados.set(COD, CORREO)
  const r = await vincularCaja(deps, { userId: U2, email: 'intruso@gmail.com', codigo: COD })
  assert.equal(r.status, 403)
  assert.match((r.body as { error: string }).error, /cl\*\*\*@gmail\.com/)
  assert.ok(!(r.body as { error: string }).error.includes(CORREO), 'no muestra el correo completo a otra cuenta')
  assert.equal(m.cajas[0].ownerId, null)
  assert.equal(m.vincularAsignadaLlamadas, 0)
  assert.equal(m.fallos.length, 1)
})

test('vincular estricto: la cuenta correcta (sin importar mayúsculas) se queda con su caja y reutiliza su dirección, sin túnel nuevo', async () => {
  const { m, deps } = estricto()
  cajaAsignada(m, 'c1', CORREO, '2026-11-01')
  m.emailsValidados.set(COD, CORREO)
  const r = await vincularCaja(deps, { userId: U1, email: 'Cliente@Gmail.com', codigo: 'abcd-2345' })
  assert.equal(r.status, 200)
  const caja = (r.body as { caja: { id: string; nombre: string; direccion: string } }).caja
  assert.deepEqual(caja, { id: 'c1', nombre: 'Mi caja', direccion: 'slug-c1.cajas.test' })
  assert.equal(m.cajas[0].ownerId, U1)
  assert.equal(m.tunelesCreados.length, 0)
  assert.equal(m.exitos.length, 1)
})

test('vincular estricto: un cliente con dos mini PC usa primero la más antigua y luego la otra, ambas en su cuenta', async () => {
  const { m, deps } = estricto()
  cajaAsignada(m, 'nueva', CORREO, '2026-11-02')
  cajaAsignada(m, 'vieja', CORREO, '2026-11-01')
  m.emailsValidados.set(COD, CORREO)
  m.vinculables.add('WXYZ2345')
  m.emailsValidados.set('WXYZ2345', CORREO)
  const a = await vincularCaja(deps, { userId: U1, email: CORREO, codigo: COD })
  const b = await vincularCaja(deps, { userId: U1, email: CORREO, codigo: 'WXYZ2345' })
  assert.equal((a.body as { caja: { id: string } }).caja.id, 'vieja')
  assert.equal((b.body as { caja: { id: string } }).caja.id, 'nueva')
  assert.equal(m.cajas.filter((c) => c.ownerId === U1).length, 2)
})

test('vincular estricto: se acabaron sus cajas libres entre validar y vincular → 409 con mensaje claro', async () => {
  const { m, deps } = estricto()
  m.emailsValidados.set(COD, CORREO)
  const r = await vincularCaja(deps, { userId: U1, email: CORREO, codigo: COD })
  assert.equal(r.status, 409)
  assert.match((r.body as { error: string }).error, /no tiene cajas libres/i)
})

test('vincular estricto: sigue respetando el máximo de cajas por cuenta', async () => {
  const { m, deps } = estricto()
  cajaAsignada(m, 'c1', CORREO, '2026-11-01')
  m.emailsValidados.set(COD, CORREO)
  for (let i = 0; i < 10; i++) m.cajas.push({ id: `o${i}`, ownerId: U1, nombre: 'x', slug: `o${i}`, tunnelId: 't', lastSeen: null })
  const r = await vincularCaja(deps, { userId: U1, email: CORREO, codigo: COD })
  assert.equal(r.status, 409)
  assert.equal(m.vincularAsignadaLlamadas, 0)
})

test('vincular estricto: la sesión sin correo no puede vincular', async () => {
  const { m, deps } = estricto()
  m.emailsValidados.set(COD, CORREO)
  const r = await vincularCaja(deps, { userId: U1, email: null, codigo: COD })
  assert.equal(r.status, 403)
  assert.match((r.body as { error: string }).error, /cuenta de Google/)
  assert.equal(m.vincularAsignadaLlamadas, 0)
})

// ---- quién es el dueño del correo
test('correoDeGoogle: solo vale el correo que Google confirma, no el que se escribió al registrarse', () => {
  const google = (email: unknown, email_verified: unknown = true) => ({ provider: 'google', identity_data: { email, email_verified } })
  assert.equal(correoDeGoogle({ identities: [google('Cliente@Gmail.com')] }), CORREO)
  assert.equal(correoDeGoogle({ identities: [{ provider: 'email', identity_data: { email: 'x@y.com' } }, google('dueno@empresa.pe')] }), 'dueno@empresa.pe')
  // Se registró con contraseña usando un correo ajeno
  assert.equal(correoDeGoogle({ identities: [{ provider: 'email', identity_data: { email: CORREO, email_verified: true } }] }), null)
  assert.equal(correoDeGoogle({ identities: [google(CORREO, false)] }), null)
  assert.equal(correoDeGoogle({ identities: [] }), null)
  assert.equal(correoDeGoogle({ identities: null }), null)
  assert.equal(correoDeGoogle({}), null)
})

test('normalizarCorreo: en Gmail los puntos y el +etiqueta no cuentan; en otros dominios sí se respetan', () => {
  assert.equal(normalizarCorreo(' Juan.Perez@Gmail.com '), 'juanperez@gmail.com')
  assert.equal(normalizarCorreo('juanperez+tienda@gmail.com'), 'juanperez@gmail.com')
  assert.equal(normalizarCorreo('juan.perez@googlemail.com'), 'juanperez@gmail.com')
  assert.equal(normalizarCorreo('+x@gmail.com'), null)
  assert.equal(normalizarCorreo('Juan.Perez+a@Empresa.pe'), 'juan.perez+a@empresa.pe')
  assert.equal(enmascararCorreo('juanperez@gmail.com'), 'ju***@gmail.com')
})

test('CAJAS_VINCULO_ABIERTO (pruebas del dueño): el flujo antiguo sigue creando túnel y caja', async () => {
  const ahora = { t: new Date(T0) }
  const { m, deps } = crearClienteMem(ahora, { vinculoAbierto: true })
  m.vinculables.add(COD)
  const r = await vincularCaja(deps, { userId: U1, email: 'cualquiera@gmail.com', codigo: COD })
  assert.equal(r.status, 200)
  assert.equal(m.tunelesCreados.length, 1)
  assert.equal(m.vincularLlamadas, 1)
})

// ---- caja de fábrica ya activada (con su código): si tiene correo asignado, debe coincidir
const preparada = (email: string | null) => {
  const r = estricto()
  r.m.cajas.push({ id: 'p1', ownerId: null, nombre: 'Mi caja', slug: 'p1', tunnelId: 't', lastSeen: null, emailAsignado: email, creadaPor: 'admin' })
  r.m.codigosPreparadas.set('PREP2345', 'p1')
  return r
}

test('caja preparada con correo asignado: otra cuenta → 403; la correcta la reclama', async () => {
  const a = preparada(CORREO)
  const mal = await vincularCaja(a.deps, { userId: U2, email: 'intruso@gmail.com', codigo: 'PREP2345' })
  assert.equal(mal.status, 403)
  assert.equal(a.m.cajas[0].ownerId, null)
  const bien = await vincularCaja(a.deps, { userId: U1, email: CORREO, codigo: 'PREP2345' })
  assert.equal(bien.status, 200)
  assert.equal(a.m.cajas[0].ownerId, U1)
})

test('caja preparada sin correo asignado: se sigue reclamando con su código, como hoy', async () => {
  const { m, deps } = preparada(null)
  const r = await vincularCaja(deps, { userId: U1, email: 'quien@gmail.com', codigo: 'PREP2345' })
  assert.equal(r.status, 200)
  assert.equal(m.cajas[0].ownerId, U1)
})

// ---- crear la caja con su correo (administración)
const admin = () => { const ahora = { t: new Date(T0) }; return { ahora, ...crearClienteMem(ahora, { vinculoAbierto: false }) } }

test('prepararCaja con correo: lo guarda normalizado y lo devuelve', async () => {
  const { m, deps } = admin()
  const r = await prepararCaja(deps, { adminId: 'a1', etiqueta: 'Bodega López', email: ' Cliente@Gmail.COM ' })
  assert.equal(r.status, 200)
  const b = r.body as { caja: { id: string; email: string | null } }
  assert.equal(b.caja.email, CORREO)
  assert.equal(m.cajas[0].emailAsignado, CORREO)
  assert.equal((r.body as { llave?: string }).llave, undefined, 'sin llave ni comando: la vincula la cuenta')
})

test('prepararCaja sin correo: sigue funcionando y queda sin asignar', async () => {
  const { m, deps } = admin()
  for (const email of [undefined, '', '   ']) {
    const r = await prepararCaja(deps, { adminId: 'a1', etiqueta: 'Fábrica', email })
    assert.equal(r.status, 200)
    assert.equal((r.body as { caja: { email: string | null } }).caja.email, null)
  }
  assert.equal(m.cajas[0].emailAsignado, undefined)
})

test('prepararCaja con correo mal escrito → 400 sin crear túnel', async () => {
  const { m, deps } = admin()
  for (const email of ['sin-arroba', 'a@b', 42]) {
    const r = await prepararCaja(deps, { adminId: 'a1', etiqueta: 'X', email })
    assert.equal(r.status, 400)
  }
  assert.equal(m.tunelesCreados.length, 0)
  assert.equal(m.creaciones.length, 0)
})

test('prepararCaja: máximo 10 cajas por correo', async () => {
  const { m, deps } = admin()
  for (let i = 0; i < 10; i++) m.cajas.push({ id: `c${i}`, ownerId: null, nombre: 'x', slug: `c${i}`, tunnelId: 't', lastSeen: null, emailAsignado: CORREO })
  const r = await prepararCaja(deps, { adminId: 'a1', etiqueta: 'X', email: CORREO })
  assert.equal(r.status, 409)
  assert.equal(m.tunelesCreados.length, 0)
})

test('prepararCaja: si falla guardar el correo no deja una caja suelta: la borra junto con su túnel', async () => {
  const { m, deps } = admin()
  m.asignarFalla = true
  const r = await prepararCaja(deps, { adminId: 'a1', etiqueta: 'X', email: CORREO })
  assert.equal(r.status, 500)
  assert.equal(m.cajas.length, 0)
  assert.equal(m.tunelesVivos.size, 0)
})
