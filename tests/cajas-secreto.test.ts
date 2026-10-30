import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generarSecreto, hashSecreto, iguales } from '../app/lib/cajas/secreto.ts'

test('generarSecreto: distintos y base64url sin relleno de 32 bytes', () => {
  const a = generarSecreto(), b = generarSecreto()
  assert.notEqual(a, b)
  assert.match(a, /^[A-Za-z0-9_-]{43}$/)
})

test('hashSecreto: estable, 64 hex y distinto del secreto', () => {
  const s = generarSecreto()
  assert.equal(hashSecreto(s), hashSecreto(s))
  assert.match(hashSecreto(s), /^[0-9a-f]{64}$/)
  assert.notEqual(hashSecreto(s), s)
  assert.equal(hashSecreto('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('iguales', () => {
  assert.equal(iguales('abc', 'abc'), true)
  assert.equal(iguales('abc', 'abd'), false)
  assert.equal(iguales('abc', 'abcd'), false)
})
