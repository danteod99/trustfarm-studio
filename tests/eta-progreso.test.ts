import { test } from 'node:test'
import assert from 'node:assert/strict'
import { percentil70, progreso, textoRestante } from '../app/lib/eta-progreso.ts'

test('percentil70: necesita al menos 3 muestras válidas', () => {
  assert.equal(percentil70([]), null)
  assert.equal(percentil70([60, 90]), null)
  // Las negativas y las de más de 30 min no cuentan.
  assert.equal(percentil70([60, -5, 4000, 90]), null)
})

test('percentil70: queda algo por encima de la mediana', () => {
  assert.equal(percentil70([100, 60, 80, 120, 90, 70, 110, 130, 140, 150, 50]), 120)
})

test('progreso: avanza lineal hasta 95 % en el tiempo estimado', () => {
  assert.deepEqual(progreso(0, 100), { fraccion: 0, restante: 100, tarde: false })
  const mitad = progreso(50, 100)
  assert.equal(mitad.fraccion, 0.475)
  assert.equal(mitad.restante, 50)
})

test('progreso: si se pasa del estimado nunca llega al 100 %', () => {
  const p = progreso(1000, 100)
  assert.equal(p.tarde, true)
  assert.equal(p.restante, 0)
  assert.ok(p.fraccion >= 0.95 && p.fraccion < 0.99)
  assert.ok(progreso(150, 100).fraccion < progreso(300, 100).fraccion)
})

test('textoRestante: formato corto en español', () => {
  assert.equal(textoRestante(5), 'unos segundos')
  assert.equal(textoRestante(42), '~45 s')
  assert.equal(textoRestante(80), '~1 min 20 s')
  assert.equal(textoRestante(120), '~2 min')
  assert.equal(textoRestante(178), '~3 min')
})
