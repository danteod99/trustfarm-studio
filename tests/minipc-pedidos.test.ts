import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  esSesionMinipc,
  extraerEnvio,
  procesarSesionMinipc,
  validarCambioEstado,
  cambiarEstadoPedido,
} from '../app/lib/minipc-pedidos.ts'
import type { NuevoPedido, PedidoFila, PedidosStore, SesionMinipc, EstadoPedido } from '../app/lib/minipc-pedidos.ts'

function crearStore(): PedidosStore & { filas: PedidoFila[]; parches: unknown[] } {
  const filas: PedidoFila[] = []
  const parches: unknown[] = []
  return {
    filas,
    parches,
    async guardarSiNoExiste(p: NuevoPedido) {
      if (filas.some((f) => f.stripeSessionId === p.stripeSessionId)) return 'duplicado'
      filas.push({ ...p, id: `ped_${filas.length + 1}`, seguimiento: null, creado: '2026-10-30T00:00:00Z', enviadoEn: null, entregadoEn: null })
      return 'creado'
    },
    async obtener(id: string) {
      return filas.find((f) => f.id === id) ?? null
    },
    async actualizarEstado(id, patch) {
      parches.push(patch)
      const f = filas.find((x) => x.id === id)
      if (f) Object.assign(f, patch)
    },
    async listar(desde, limite) {
      return filas.slice(desde, desde + limite)
    },
  }
}

function sesionOk(extra: Partial<SesionMinipc> = {}): SesionMinipc {
  return {
    id: 'cs_test_1',
    payment_status: 'paid',
    amount_total: 79000,
    currency: 'usd',
    payment_intent: 'pi_1',
    customer: 'cus_1',
    metadata: { kind: 'minipc', plan_id: 'pro', user_id: 'u-1' },
    customer_details: { email: 'a@b.pe', name: 'Ana Perez', phone: '+51999111222' },
    collected_information: {
      shipping_details: {
        name: 'Ana P.',
        address: { line1: 'Av. Brasil 123', line2: null, city: 'Lima', state: 'Lima', postal_code: '15084', country: 'PE' },
      },
    },
    ...extra,
  }
}

function deps(store = crearStore()) {
  const lineas: string[] = []
  return { store, lineas, d: { store, log: (l: string) => { lineas.push(l) } } }
}

test('sesión válida se crea con estado pagado y envío mapeado', async () => {
  const { store, d, lineas } = deps()
  const r = await procesarSesionMinipc(d, sesionOk())
  assert.equal(r.resultado, 'creado')
  assert.equal(store.filas.length, 1)
  const f = store.filas[0]
  assert.equal(f.estado, 'pagado')
  assert.equal(f.planId, 'pro')
  assert.equal(f.userId, 'u-1')
  assert.equal(f.montoCentavos, 79000)
  assert.equal(f.moneda, 'usd')
  assert.equal(f.telefono, '+51999111222')
  assert.equal(f.email, 'a@b.pe')
  assert.equal(f.stripePaymentIntent, 'pi_1')
  assert.equal(f.stripeCustomer, 'cus_1')
  assert.equal(f.notaRevision, null)
  assert.deepEqual(f.envio, { nombre: 'Ana P.', linea1: 'Av. Brasil 123', linea2: null, ciudad: 'Lima', region: 'Lima', codigoPostal: '15084', pais: 'PE' })
  assert.equal(lineas.length, 0)
})

test('payment_intent y customer como objeto guardan el id', async () => {
  const { store, d } = deps()
  await procesarSesionMinipc(d, sesionOk({ payment_intent: { id: 'pi_obj' }, customer: { id: 'cus_obj' } }))
  assert.equal(store.filas[0].stripePaymentIntent, 'pi_obj')
  assert.equal(store.filas[0].stripeCustomer, 'cus_obj')
})

test('misma sesión otra vez es duplicado y no se guarda de nuevo (foco 1)', async () => {
  const { store, d } = deps()
  assert.equal((await procesarSesionMinipc(d, sesionOk())).resultado, 'creado')
  assert.equal((await procesarSesionMinipc(d, sesionOk())).resultado, 'duplicado')
  assert.equal(store.filas.length, 1)
})

test('duplicado también gana sobre una sesión que iría a revisar', async () => {
  const { store, d } = deps()
  await procesarSesionMinipc(d, sesionOk({ amount_total: 1 }))
  const r = await procesarSesionMinipc(d, sesionOk({ amount_total: 1 }))
  assert.equal(r.resultado, 'duplicado')
  assert.equal(store.filas.length, 1)
})

test('payment_status unpaid es pendiente y no guarda nada', async () => {
  const { store, d } = deps()
  const r = await procesarSesionMinipc(d, sesionOk({ payment_status: 'unpaid' }))
  assert.equal(r.resultado, 'pendiente')
  assert.equal(store.filas.length, 0)
})

const sinDireccion = (): Partial<SesionMinipc> => ({ collected_information: null, shipping_details: null })
const casosRevisar: Array<[string, Partial<SesionMinipc>, RegExp]> = [
  ['monto distinto', { amount_total: 78000 }, /monto/i],
  ['país distinto de PE', {
    collected_information: { shipping_details: { name: 'X', address: { line1: 'Calle 1', city: 'Bogotá', country: 'CO' } } },
  }, /país|pais/i],
  ['sin dirección', sinDireccion(), /direcci/i],
  ['sin teléfono', { customer_details: { email: 'a@b.pe', name: 'Ana' } }, /tel[eé]fono/i],
  ['plan desconocido', { metadata: { kind: 'minipc', plan_id: 'zzz', user_id: 'u-1' } }, /plan/i],
  ['sin usuario', { metadata: { kind: 'minipc', plan_id: 'pro' } }, /usuario/i],
  ['moneda eur', { currency: 'eur' }, /moneda/i],
]
for (const [nombre, extra, patron] of casosRevisar) {
  test(`foco 2: ${nombre} se guarda con estado revisar`, async () => {
    const { store, d, lineas } = deps()
    const r = await procesarSesionMinipc(d, sesionOk(extra))
    assert.equal(r.resultado, 'revisar')
    assert.equal(store.filas.length, 1)
    assert.equal(store.filas[0].estado, 'revisar')
    assert.match(store.filas[0].notaRevision ?? '', patron)
    assert.equal(lineas.length, 1)
    assert.ok(lineas[0].includes('cs_test_1'))
  })
}

test('detalles de revisar: plan desconocido deja planId null; sin usuario deja userId null; sin dirección envio null', async () => {
  const a = deps()
  await procesarSesionMinipc(a.d, sesionOk({ metadata: { kind: 'minipc', plan_id: 'zzz', user_id: 'u-1' } }))
  assert.equal(a.store.filas[0].planId, null)
  const b = deps()
  await procesarSesionMinipc(b.d, sesionOk({ metadata: { kind: 'minipc', plan_id: 'pro' } }))
  assert.equal(b.store.filas[0].userId, null)
  const c = deps()
  await procesarSesionMinipc(c.d, sesionOk(sinDireccion()))
  assert.equal(c.store.filas[0].envio, null)
})

test('varios motivos se listan separados por "; " y se conserva la moneda en minúsculas', async () => {
  const { store, d } = deps()
  await procesarSesionMinipc(d, sesionOk({ amount_total: 100, currency: 'EUR', customer_details: null }))
  const nota = store.filas[0].notaRevision ?? ''
  assert.equal(nota.split('; ').length, 3)
  assert.equal(store.filas[0].moneda, 'eur')
  assert.equal(store.filas[0].telefono, null)
  assert.equal(store.filas[0].email, null)
})

test('moneda en mayúsculas USD no genera revisión', async () => {
  const { d } = deps()
  assert.equal((await procesarSesionMinipc(d, sesionOk({ currency: 'USD' }))).resultado, 'creado')
})

test('datos faltantes de Stripe nunca lanzan', async () => {
  const { store, d } = deps()
  const r = await procesarSesionMinipc(d, { id: 'cs_vacia', payment_status: 'paid', amount_total: null, currency: null })
  assert.equal(r.resultado, 'revisar')
  assert.equal(store.filas[0].montoCentavos, 0)
  assert.equal(store.filas[0].moneda, 'usd')
})

test('esSesionMinipc', () => {
  assert.equal(esSesionMinipc({ metadata: { kind: 'minipc' } }), true)
  assert.equal(esSesionMinipc({ metadata: { pack_id: 'inicial' } }), false)
  assert.equal(esSesionMinipc({ metadata: null }), false)
  assert.equal(esSesionMinipc({}), false)
})

test('extraerEnvio lee collected_information y cae a shipping_details; null si no hay', () => {
  const dir = { line1: 'L1', line2: 'L2', city: 'C', state: 'R', postal_code: 'P', country: 'PE' }
  const base = { id: 's', payment_status: 'paid', amount_total: 1, currency: 'usd' }
  const nuevo = extraerEnvio({ ...base, collected_information: { shipping_details: { name: 'Nuevo', address: dir } } })
  assert.deepEqual(nuevo, { nombre: 'Nuevo', linea1: 'L1', linea2: 'L2', ciudad: 'C', region: 'R', codigoPostal: 'P', pais: 'PE' })
  const viejo = extraerEnvio({ ...base, shipping_details: { name: 'Viejo', address: dir } })
  assert.equal(viejo?.nombre, 'Viejo')
  const ambos = extraerEnvio({ ...base, collected_information: { shipping_details: { name: 'Nuevo', address: dir } }, shipping_details: { name: 'Viejo', address: dir } })
  assert.equal(ambos?.nombre, 'Nuevo')
  assert.equal(extraerEnvio(base), null)
})

test('extraerEnvio: sin nombre de envío usa el del cliente', () => {
  const e = extraerEnvio({ id: 's', payment_status: 'paid', amount_total: 1, currency: 'usd', customer_details: { name: 'Cliente' }, shipping_details: { address: { line1: 'x', country: 'PE' } } })
  assert.equal(e?.nombre, 'Cliente')
  assert.equal(e?.linea2, null)
  assert.equal(e?.ciudad, '')
})

test('foco 6: validarCambioEstado', () => {
  const ok: Array<[EstadoPedido, EstadoPedido]> = [
    ['pagado', 'enviado'], ['pagado', 'cancelado'], ['pagado', 'reembolsado'],
    ['revisar', 'pagado'], ['revisar', 'enviado'], ['revisar', 'cancelado'], ['revisar', 'reembolsado'],
    ['enviado', 'entregado'], ['enviado', 'reembolsado'], ['entregado', 'reembolsado'],
  ]
  for (const [a, b] of ok) assert.equal(validarCambioEstado(a, b), true, `${a}->${b}`)
  const no: Array<[EstadoPedido, EstadoPedido]> = [
    ['enviado', 'pagado'], ['entregado', 'pagado'], ['cancelado', 'enviado'], ['reembolsado', 'entregado'],
    ['pagado', 'pagado'], ['pagado', 'entregado'], ['enviado', 'cancelado'], ['entregado', 'enviado'],
    ['pagado', 'revisar'], ['cancelado', 'pagado'],
  ]
  for (const [a, b] of no) assert.equal(validarCambioEstado(a, b), false, `${a}->${b}`)
})

async function pedidoEn(estado: EstadoPedido) {
  const store = crearStore()
  await store.guardarSiNoExiste({
    userId: 'u', planId: 'pro', stripeSessionId: 's1', stripePaymentIntent: null, stripeCustomer: null,
    montoCentavos: 79000, moneda: 'usd', estado: 'pagado', envio: null, telefono: null, email: null, notaRevision: null,
  })
  store.filas[0].estado = estado
  return store
}
const ahora = () => new Date('2026-11-01T10:00:00.000Z')

test('cambiarEstadoPedido: 404, 409 y 400', async () => {
  const store = await pedidoEn('pagado')
  assert.deepEqual(await cambiarEstadoPedido({ store, ahora }, { id: 'nope', estado: 'enviado' }), { ok: false, status: 404, error: 'No encontré ese pedido.' })
  assert.deepEqual(await cambiarEstadoPedido({ store, ahora }, { id: 'ped_1', estado: 'entregado' }), { ok: false, status: 409, error: 'Ese cambio de estado no es posible.' })
  const largo = await cambiarEstadoPedido({ store, ahora }, { id: 'ped_1', estado: 'enviado', seguimiento: 'x'.repeat(121) })
  assert.equal(largo.ok, false)
  assert.equal(!largo.ok && largo.status, 400)
  assert.equal(store.parches.length, 0)
  assert.equal(store.filas[0].estado, 'pagado')
})

test('cambiarEstadoPedido: seguimiento de 120 tras recortar es válido', async () => {
  const store = await pedidoEn('pagado')
  const r = await cambiarEstadoPedido({ store, ahora }, { id: 'ped_1', estado: 'enviado', seguimiento: ' ' + 'x'.repeat(120) + ' ' })
  assert.deepEqual(r, { ok: true })
})

test('cambiarEstadoPedido: pagado a enviado recorta seguimiento y fija enviadoEn', async () => {
  const store = await pedidoEn('pagado')
  const r = await cambiarEstadoPedido({ store, ahora }, { id: 'ped_1', estado: 'enviado', seguimiento: ' ABC123 ' })
  assert.deepEqual(r, { ok: true })
  assert.equal(store.filas[0].estado, 'enviado')
  assert.equal(store.filas[0].seguimiento, 'ABC123')
  assert.equal(store.filas[0].enviadoEn, '2026-11-01T10:00:00.000Z')
  assert.equal(store.filas[0].entregadoEn, null)
})

test('cambiarEstadoPedido: enviado a entregado fija entregadoEn y no toca seguimiento', async () => {
  const store = await pedidoEn('enviado')
  store.filas[0].seguimiento = 'ABC'
  const r = await cambiarEstadoPedido({ store, ahora }, { id: 'ped_1', estado: 'entregado' })
  assert.deepEqual(r, { ok: true })
  assert.equal(store.filas[0].entregadoEn, '2026-11-01T10:00:00.000Z')
  assert.equal(store.filas[0].seguimiento, 'ABC')
  assert.equal(store.filas[0].enviadoEn, null)
})

test('foco 6: pedido cancelado no puede marcarse enviado', async () => {
  const store = await pedidoEn('cancelado')
  const r = await cambiarEstadoPedido({ store, ahora }, { id: 'ped_1', estado: 'enviado' })
  assert.equal(!r.ok && r.status, 409)
  assert.equal(store.filas[0].estado, 'cancelado')
})
