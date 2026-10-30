import { test } from 'node:test'
import assert from 'node:assert/strict'
import { limitarIntentos } from '../app/lib/cajas/servicio.ts'
import { crearMem } from './cajas-mem.ts'

const H = 3600_000
function nuevo(t0: Date) {
  const ref = { t: t0 }
  const { m, store } = crearMem(() => ref.t)
  return { ref, m, store }
}

test('limitarIntentos: permite hasta max y bloquea el siguiente sin registrarlo', async () => {
  const { ref, m, store } = nuevo(new Date('2026-01-01T00:00:00Z'))
  for (let i = 0; i < 3; i++) assert.equal(await limitarIntentos(store, 'k', 3, H, ref.t), true)
  assert.equal(await limitarIntentos(store, 'k', 3, H, ref.t), false)
  assert.equal(m.intentos.length, 3)
})

test('limitarIntentos: vuelve a permitir pasada la ventana', async () => {
  const { ref, store } = nuevo(new Date('2026-01-01T00:00:00Z'))
  for (let i = 0; i < 2; i++) await limitarIntentos(store, 'k', 2, H, ref.t)
  assert.equal(await limitarIntentos(store, 'k', 2, H, ref.t), false)
  ref.t = new Date(ref.t.getTime() + H + 1000)
  assert.equal(await limitarIntentos(store, 'k', 2, H, ref.t), true)
})

test('limitarIntentos: claves independientes', async () => {
  const { ref, store } = nuevo(new Date('2026-01-01T00:00:00Z'))
  assert.equal(await limitarIntentos(store, 'a', 1, H, ref.t), true)
  assert.equal(await limitarIntentos(store, 'a', 1, H, ref.t), false)
  assert.equal(await limitarIntentos(store, 'b', 1, H, ref.t), true)
})
