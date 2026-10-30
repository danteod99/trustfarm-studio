import { test } from 'node:test'
import assert from 'node:assert/strict'
import { errorGenerico } from '../app/lib/minipc-errores.ts'

test('errorGenerico: incluye el código', () => {
  assert.equal(errorGenerico('No pude guardar el pedido.', { code: '42P01' }), 'No pude guardar el pedido. (código 42P01)')
})

test('errorGenerico: sin código => "?"', () => {
  assert.equal(errorGenerico('X.', {}), 'X. (código ?)')
  assert.equal(errorGenerico('X.', null), 'X. (código ?)')
  assert.equal(errorGenerico('X.', { code: 42 }), 'X. (código ?)')
})

test('errorGenerico: nunca incluye message, details ni hint', () => {
  const e = { code: '23505', message: 'juan@correo.com', details: 'Key (email)=(juan@correo.com)', hint: 'secreto' }
  const t = errorGenerico('No pude guardar el pedido.', e)
  assert.ok(!t.includes('juan') && !t.includes('secreto'))
  assert.equal(t, 'No pude guardar el pedido. (código 23505)')
})
