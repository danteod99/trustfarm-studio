import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paginaPedidos, parsePagina } from '../app/lib/minipc-admin.ts'
import type { PedidoFila } from '../app/lib/minipc-pedidos.ts'

function fila(i: number, extra: Partial<PedidoFila> = {}): PedidoFila {
  return {
    id: `id-${i}`,
    userId: 'user-secreto',
    planId: 'basico',
    stripeSessionId: 'cs_secreta',
    stripePaymentIntent: 'pi_123',
    stripeCustomer: 'cus_secreto',
    montoCentavos: 14950,
    moneda: 'usd',
    estado: 'pagado',
    envio: { nombre: 'Ana', linea1: 'Jr. Lima 123', linea2: 'Dpto 4', ciudad: 'Lima', region: 'Lima', codigoPostal: '15001', pais: 'PE' },
    telefono: '+51970912014',
    email: 'ana@example.com',
    notaRevision: null,
    seguimiento: null,
    creado: '2026-10-30T10:00:00.000Z',
    enviadoEn: null,
    entregadoEn: null,
    ...extra,
  }
}
const filas = (n: number) => Array.from({ length: n }, (_, i) => fila(i))

test('101 filas y límite 100 => 100 pedidos y hay_mas', () => {
  const r = paginaPedidos(filas(101), 100)
  assert.equal(r.pedidos.length, 100)
  assert.equal(r.hay_mas, true)
})
test('exactamente 100 => hay_mas false', () => {
  const r = paginaPedidos(filas(100), 100)
  assert.equal(r.pedidos.length, 100)
  assert.equal(r.hay_mas, false)
})
test('vacío', () => {
  assert.deepEqual(paginaPedidos([], 100), { pedidos: [], hay_mas: false })
})
test('monto_usd, dirección en una línea y campos mapeados', () => {
  const p = paginaPedidos([fila(1)], 100).pedidos[0]
  assert.equal(p.monto_usd, 149.5)
  assert.equal(p.direccion, 'Jr. Lima 123, Dpto 4')
  assert.equal(p.nombre, 'Ana')
  assert.equal(p.pais, 'PE')
  assert.equal(p.telefono, '+51970912014')
  assert.equal(p.stripe_payment_intent, 'pi_123')
  assert.equal(p.id, 'id-1')
  assert.equal(p.creado, '2026-10-30T10:00:00.000Z')
})
test('sin línea 2 la dirección es solo la línea 1', () => {
  const f = fila(1)
  f.envio!.linea2 = null
  assert.equal(paginaPedidos([f], 100).pedidos[0].direccion, 'Jr. Lima 123')
})
test('envío null no lanza y deja campos vacíos', () => {
  const p = paginaPedidos([fila(1, { envio: null, telefono: null, email: null, planId: null, stripePaymentIntent: null })], 100).pedidos[0]
  assert.equal(p.nombre, '')
  assert.equal(p.direccion, '')
  assert.equal(p.ciudad, '')
  assert.equal(p.region, '')
  assert.equal(p.pais, '')
  assert.equal(p.telefono, '')
  assert.equal(p.email, '')
  assert.equal(p.plan_id, null)
})
test('revisar conserva nota_revision', () => {
  const p = paginaPedidos([fila(1, { estado: 'revisar', notaRevision: 'sin teléfono' })], 100).pedidos[0]
  assert.equal(p.estado, 'revisar')
  assert.equal(p.nota_revision, 'sin teléfono')
})
test('no filtra ids internos de otras tablas', () => {
  const p = paginaPedidos([fila(1)], 100).pedidos[0] as unknown as Record<string, unknown>
  for (const k of ['user_id', 'userId', 'stripe_session_id', 'stripeSessionId', 'stripe_customer', 'stripeCustomer']) {
    assert.ok(!(k in p), k)
  }
  assert.ok(!JSON.stringify(p).includes('user-secreto'))
  assert.ok(!JSON.stringify(p).includes('cs_secreta'))
  assert.ok(!JSON.stringify(p).includes('cus_secreto'))
})
test('conserva el orden de entrada', () => {
  const r = paginaPedidos(filas(5), 100)
  assert.deepEqual(r.pedidos.map((p) => p.id), ['id-0', 'id-1', 'id-2', 'id-3', 'id-4'])
})
test('límite 0 o negativo no rompe: vacío y sin más', () => {
  assert.deepEqual(paginaPedidos(filas(3), 0), { pedidos: [], hay_mas: false })
  assert.deepEqual(paginaPedidos(filas(3), -5), { pedidos: [], hay_mas: false })
  assert.deepEqual(paginaPedidos(filas(3), NaN), { pedidos: [], hay_mas: false })
})

test('parsePagina', () => {
  assert.equal(parsePagina('abc'), 0)
  assert.equal(parsePagina('-1'), 0)
  assert.equal(parsePagina('1.5'), 0)
  assert.equal(parsePagina(''), 0)
  assert.equal(parsePagina(null), 0)
  assert.equal(parsePagina('1000001'), 0)
  assert.equal(parsePagina('2'), 2)
  assert.equal(parsePagina(' 3 '), 3)
  assert.equal(parsePagina('1000000'), 1000000)
  assert.equal(parsePagina('0'), 0)
})
