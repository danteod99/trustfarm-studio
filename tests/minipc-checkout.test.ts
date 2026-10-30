import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validarCompra, armarSesionMinipc } from '../app/lib/minipc-checkout.ts'
import { getPlan, PLANES } from '../app/lib/minipc.ts'

const SITE = 'https://ejemplo.test'

test('venta cerrada gana: 503 incluso sin usuario y con plan inválido', () => {
  const r = validarCompra({ venta: false, userId: null, planId: 'x' })
  assert.deepEqual(r, { ok: false, status: 503, error: 'Las ventas aún no están abiertas.' })
})

test('venta abierta sin usuario: 401', () => {
  for (const userId of [null, undefined, '']) {
    const r = validarCompra({ venta: true, userId, planId: 'pro' })
    assert.deepEqual(r, { ok: false, status: 401, error: 'Inicia sesión para continuar.' })
  }
  // 401 gana sobre plan inválido
  assert.equal((validarCompra({ venta: true, userId: null, planId: 'x' }) as { status: number }).status, 401)
})

test('plan inválido: 400', () => {
  const valores: unknown[] = ['x', undefined, 'toString', '__proto__', 7, null, {}, ['pro'], 'PRO', ' pro']
  for (const planId of valores) {
    const r = validarCompra({ venta: true, userId: 'u1', planId })
    assert.deepEqual(r, { ok: false, status: 400, error: 'Ese plan no está disponible.' }, String(planId))
  }
})

test('plan con activo:false: 400', () => {
  const pro = PLANES.find((p) => p.id === 'pro')!
  pro.activo = false
  try {
    const r = validarCompra({ venta: true, userId: 'u1', planId: 'pro' })
    assert.deepEqual(r, { ok: false, status: 400, error: 'Ese plan no está disponible.' })
  } finally {
    pro.activo = true
  }
})

test('todo bien: ok con el plan', () => {
  const r = validarCompra({ venta: true, userId: 'u1', planId: 'pro' })
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.plan, getPlan('pro'))
})

test('armarSesionMinipc para pro', () => {
  const plan = getPlan('pro')!
  const s = armarSesionMinipc({ plan, userId: 'u1', email: 'a@b.pe', siteUrl: SITE })
  assert.equal(s.mode, 'payment')
  assert.equal(s.customer_creation, 'always')
  assert.equal(s.client_reference_id, 'u1')
  assert.equal(s.customer_email, 'a@b.pe')
  assert.equal(s.line_items?.length, 1)
  const li = s.line_items![0]
  assert.equal(li.quantity, 1)
  assert.equal(li.price_data?.currency, 'usd')
  assert.equal(li.price_data?.unit_amount, 79000)
  assert.equal(li.price_data?.product_data?.name, 'TRUST Assistant — Plan Pro')
  const desc = li.price_data?.product_data?.description ?? ''
  assert.ok(desc.includes('AMD Ryzen 7 7735HS'))
  assert.ok(desc.includes('$79'))
  assert.deepEqual(s.shipping_address_collection?.allowed_countries, ['PE'])
  assert.equal(s.phone_number_collection?.enabled, true)
  assert.equal(s.payment_intent_data?.setup_future_usage, 'off_session')
  assert.deepEqual(s.metadata, { kind: 'minipc', plan_id: 'pro', user_id: 'u1' })
  assert.deepEqual(s.payment_intent_data?.metadata, s.metadata)
  assert.equal(s.success_url, `${SITE}/minipc/gracias`)
  assert.equal(s.cancel_url, `${SITE}/minipc`)
  assert.equal(s.locale, 'es-419')
})

test('sin descuentos ni códigos promocionales (cupón 100 % no se guardaría como pedido)', () => {
  const s = armarSesionMinipc({ plan: getPlan('pro')!, userId: 'u1', email: 'a@b.pe', siteUrl: SITE })
  assert.equal('allow_promotion_codes' in s, false)
  assert.equal('discounts' in s, false)
})

test('unit_amount de básico y negocio', () => {
  const b = armarSesionMinipc({ plan: getPlan('basico')!, userId: 'u', email: undefined, siteUrl: SITE })
  const n = armarSesionMinipc({ plan: getPlan('negocio')!, userId: 'u', email: undefined, siteUrl: SITE })
  assert.equal(b.line_items![0].price_data?.unit_amount, 49000)
  assert.equal(n.line_items![0].price_data?.unit_amount, 129000)
})

test('sin email no hay clave customer_email', () => {
  for (const email of [undefined, '']) {
    const s = armarSesionMinipc({ plan: getPlan('pro')!, userId: 'u1', email, siteUrl: SITE })
    assert.equal('customer_email' in s, false)
  }
})
