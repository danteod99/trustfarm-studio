import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decidirRama } from '../app/lib/minipc-pedidos.ts'

test('decidirRama: sesión de créditos real (pack_id + user_id) ⇒ creditos', () => {
  assert.equal(decidirRama({ metadata: { pack_id: 'pack_100', user_id: 'u1' } }), 'creditos')
})

test('decidirRama: metadata nula o indefinida ⇒ creditos', () => {
  assert.equal(decidirRama({ metadata: null }), 'creditos')
  assert.equal(decidirRama({ metadata: undefined }), 'creditos')
  assert.equal(decidirRama({}), 'creditos')
})

test('decidirRama: kind distinto de minipc ⇒ creditos (solo coincidencia exacta)', () => {
  assert.equal(decidirRama({ metadata: { kind: 'otro' } }), 'creditos')
  assert.equal(decidirRama({ metadata: { kind: 'MINIPC' } }), 'creditos')
})

test('decidirRama: kind minipc ⇒ minipc, aunque traiga pack_id', () => {
  assert.equal(decidirRama({ metadata: { kind: 'minipc', plan_id: 'x' } }), 'minipc')
  assert.equal(decidirRama({ metadata: { kind: 'minipc', pack_id: 'pack_100', user_id: 'u1' } }), 'minipc')
})
