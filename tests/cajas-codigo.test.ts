import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CODIGO_ALFABETO, generarCodigo, normalizarCodigo } from '../app/lib/cajas/codigo.ts'

test('alfabeto exacto', () => {
  assert.equal(CODIGO_ALFABETO, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789')
  assert.equal(CODIGO_ALFABETO.length, 31)
})

test('generarCodigo da XXXX-XXXX con caracteres del alfabeto', () => {
  const c = generarCodigo()
  assert.match(c, /^[^-]{4}-[^-]{4}$/)
  for (const ch of c.replace('-', '')) assert.ok(CODIGO_ALFABETO.includes(ch))
})

test('1000 códigos seguidos sin repetirse', () => {
  const s = new Set<string>()
  for (let i = 0; i < 1000; i++) s.add(generarCodigo())
  assert.equal(s.size, 1000)
})

test('distribución: los 31 caracteres aparecen en 20000 muestras y sin sesgo grueso', () => {
  const cuenta = new Map<string, number>()
  let total = 0
  while (total < 20000) {
    for (const ch of generarCodigo().replace('-', '')) {
      cuenta.set(ch, (cuenta.get(ch) ?? 0) + 1)
      total++
    }
  }
  assert.equal(cuenta.size, 31)
  const esperado = total / 31
  for (const [, n] of cuenta) assert.ok(n > esperado * 0.7 && n < esperado * 1.3)
})

test('normalizarCodigo acepta variantes', () => {
  assert.equal(normalizarCodigo('8f3k-92qd'), '8F3K92QD')
  assert.equal(normalizarCodigo('8F3K92QD'), '8F3K92QD')
  assert.equal(normalizarCodigo(' 8F3K 92QD '), '8F3K92QD')
})

test('normalizarCodigo rechaza lo inválido', () => {
  for (const x of ['8F3K-92Q0', '8F3K-92QO', '8F3K-92Q1', '8F3K-92QI', '8F3K-92QL',
    '8F3K-92Q', '8F3K-92QDD', '8F3K-92Q!', '', '----'])
    assert.equal(normalizarCodigo(x), null, x)
  assert.equal(normalizarCodigo(null as unknown as string), null)
  assert.equal(normalizarCodigo(12345678 as unknown as string), null)
})
