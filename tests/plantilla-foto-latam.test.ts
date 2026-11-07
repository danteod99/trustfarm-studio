import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MODELS } from '../app/lib/catalog.ts'
import { FOTO_LATAM } from '../app/lib/plantilla-foto-latam.ts'

const paso = (id: string) => {
  const s = FOTO_LATAM.steps.find((x) => x.id === id)
  assert.ok(s, `falta el paso ${id}`)
  return s
}

test('todos los pasos son imágenes en vertical con un modelo del catálogo', () => {
  assert.ok(FOTO_LATAM.steps.length > 0)
  for (const s of FOTO_LATAM.steps) {
    assert.equal(s.kind, 'image', s.id)
    assert.equal(s.aspect, '9:16', s.id)
    const m = MODELS.find((x) => x.id === s.model)
    assert.ok(m, `${s.id}: modelo inexistente ${s.model}`)
    assert.ok(m.aspects.includes(s.aspect), s.id)
  }
})

test('cada campo entre corchetes cabe en el límite de 80 caracteres del estudio', () => {
  for (const s of FOTO_LATAM.steps) {
    const abiertos = s.prompt.split('[').length - 1
    assert.ok(abiertos > 0, `${s.id}: sin campos para completar`)
    assert.equal(Array.from(s.prompt.matchAll(/\[([^\]]{1,80})\]/g)).length, abiertos, s.id)
  }
})

test('usa la frase medida y evita las que fallaron en las pruebas', () => {
  for (const s of FOTO_LATAM.steps) {
    assert.match(s.prompt, /Foto casual sin producción/, s.id)
    assert.match(s.prompt, /Sin texto\./, s.id)
    assert.doesNotMatch(s.prompt, /celular|mestiz|sin canas|aparenta|casa familiar/i, s.id)
  }
})

test('las personas van en un solo paso con Qwen, que respetó mejor la edad, y solo edades adultas', () => {
  const personas = FOTO_LATAM.steps.filter((x) => /años/.test(x.prompt))
  assert.deepEqual(personas.map((x) => x.id), ['persona'])
  const p = paso('persona')
  assert.equal(p.model, 'qwen-image')
  assert.match(p.title, /20 a 50 años/)
  assert.match(p.prompt, /\[edad adulta: 20 a 50\] años/)
  assert.match(p.prompt, /\[mujer latina \/ hombre latino\]/)
  assert.match(p.prompt, /piel morena, rostro redondo, ropa casual/)
})

test('el interior pide objetos concretos y una casa habitada', () => {
  const p = paso('interior').prompt
  assert.match(p, /\[objetos del ambiente:/)
  assert.match(p, /en Latinoamérica/)
  assert.match(p, /casa habitada, no es una foto de catálogo/)
  assert.match(p, /sin personas/)
})

test('calle y negocio nombran la región', () => {
  for (const id of ['calle', 'negocio']) assert.match(paso(id).prompt, /en Latinoamérica/, id)
})

test('aparece en el estudio como formato secundario, sin descuadrar los destacados', () => {
  assert.notEqual(FOTO_LATAM.featured, true)
  const fuente = readFileSync(new URL('../app/lib/templates.ts', import.meta.url), 'utf8')
  assert.match(fuente, /^\s*FOTO_LATAM,$/m)
})
