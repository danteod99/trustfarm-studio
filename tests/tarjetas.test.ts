import { test } from 'node:test'
import assert from 'node:assert/strict'
import type Stripe from 'stripe'
import { aTarjetas, clienteGuardado } from '../app/lib/tarjetas.ts'

test('clienteGuardado: usa stripe_customer, si no el del plan, si no null', () => {
  assert.equal(clienteGuardado({ stripe_customer: 'cus_A', studio_sub: { customer: 'cus_B', subscription: 'sub_1' } }), 'cus_A')
  assert.equal(clienteGuardado({ studio_sub: { customer: 'cus_B', subscription: 'sub_1' } }), 'cus_B')
  assert.equal(clienteGuardado({}), null)
  assert.equal(clienteGuardado(null), null)
  // Basura en app_metadata no se usa como cliente.
  assert.equal(clienteGuardado({ stripe_customer: 'x' }), null)
})

test('aTarjetas: solo tarjetas, vencimiento MM/AA y marca la principal', () => {
  const pm = (id: string, card?: object, type = 'card') => ({ id, type, card }) as unknown as Stripe.PaymentMethod
  const r = aTarjetas(
    [pm('pm_1', { brand: 'visa', last4: '4242', exp_month: 3, exp_year: 2029 }), pm('pm_2', { brand: 'mastercard', last4: '4444', exp_month: 11, exp_year: 2030 }), pm('pm_3', undefined, 'link')],
    'pm_2'
  )
  assert.deepEqual(r, [
    { id: 'pm_1', marca: 'visa', ultimos4: '4242', vence: '03/29', principal: false },
    { id: 'pm_2', marca: 'mastercard', ultimos4: '4444', vence: '11/30', principal: true },
  ])
})
