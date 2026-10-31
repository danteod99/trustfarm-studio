import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateSteps } from '../app/lib/flujos-validar.ts'

const img = { model: 'qwen-image', aspect: '9:16', prompt: 'Una fresa con cara en una heladería' }
const vid = { model: 'ltx-25', aspect: '9:16', duration: 5, resolution: '720p', prompt: 'La fresa se voltea y dice hola', input: 'previous' }

test('flujo imagen → animar es válido', () => {
  const r = validateSteps([img, vid])
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.steps[0].input, 'none')
    assert.equal(r.steps[1].input, 'previous')
    assert.equal(r.steps[1].duration, 5)
  }
})

test('rechaza vacío, demasiados pasos y modelos inexistentes', () => {
  assert.equal(validateSteps([]).ok, false)
  assert.equal(validateSteps(Array(7).fill(img)).ok, false)
  assert.equal(validateSteps([{ ...img, model: 'nope' }]).ok, false)
})

test('el primer paso no puede usar un resultado anterior', () => {
  assert.equal(validateSteps([{ ...img, input: 'previous' }]).ok, false)
})

test('no se puede encadenar desde un video ni a un modelo sin imagen de entrada', () => {
  assert.equal(validateSteps([vid, { ...vid }]).ok, false)
  assert.equal(validateSteps([img, { ...img, model: 'z-image', input: 'previous' }]).ok, false)
})

test('opciones de video inválidas y corchetes sin completar', () => {
  assert.equal(validateSteps([img, { ...vid, duration: 3 }]).ok, false)
  assert.equal(validateSteps([{ ...img, prompt: 'Una [fruta] con cara' }]).ok, false)
})
