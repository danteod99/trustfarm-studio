import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashApiKey, newApiKey, nextRunAt, readApiKey } from '../app/lib/automatizacion.ts'

const h = (pairs: Record<string, string>) => ({ get: (n: string) => pairs[n.toLowerCase()] ?? null })

test('nextRunAt: hoy más tarde si todavía no pasó la hora (Lima = UTC-5)', () => {
  // jueves 30-10-2026 08:00 en Lima = 13:00 UTC
  const r = nextRunAt(9, [0, 1, 2, 3, 4, 5, 6], new Date('2026-10-30T13:00:00Z'))
  assert.equal(r.toISOString(), '2026-10-30T14:00:00.000Z')
})

test('nextRunAt: mañana si la hora ya pasó', () => {
  const r = nextRunAt(9, [0, 1, 2, 3, 4, 5, 6], new Date('2026-10-30T14:00:00Z'))
  assert.equal(r.toISOString(), '2026-10-31T14:00:00.000Z')
})

test('nextRunAt: salta a un día permitido y respeta el cambio de día en UTC', () => {
  // viernes 30-10 23:30 Lima (sábado 04:30 UTC); solo lunes a las 21 h Lima = martes 02:00 UTC
  const r = nextRunAt(21, [1], new Date('2026-10-31T04:30:00Z'))
  assert.equal(r.toISOString(), '2026-11-03T02:00:00.000Z')
})

test('nextRunAt: lista vacía = todos los días', () => {
  const r = nextRunAt(0, [], new Date('2026-10-30T12:00:00Z'))
  assert.equal(r.toISOString(), '2026-10-31T05:00:00.000Z')
})

test('newApiKey: formato, hash y prefijo', () => {
  const k = newApiKey()
  assert.match(k.key, /^tsk_[A-Za-z0-9]{40}$/)
  assert.equal(k.hash, hashApiKey(k.key))
  assert.equal(k.prefix, k.key.slice(0, 12))
  assert.notEqual(newApiKey().key, k.key)
})

test('readApiKey: Bearer, x-api-key y basura', () => {
  const k = newApiKey().key
  assert.equal(readApiKey(h({ authorization: `Bearer ${k}` })), k)
  assert.equal(readApiKey(h({ 'x-api-key': k })), k)
  assert.equal(readApiKey(h({ authorization: 'Bearer sb_secret_xx' })), null)
  assert.equal(readApiKey(h({})), null)
})
