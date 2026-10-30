import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PASOS,
  QUE_HACE,
  USOS,
  FAQ,
  NEGOCIOS,
  ESTUDIO_VIDEO,
  CAJAS_WEB,
  TEXTO_ACTUALIZACIONES,
  TEXTO_BORRADO_CLIPS,
} from '../app/lib/minipc-contenido.ts'

test('longitudes del catálogo', () => {
  assert.equal(QUE_HACE.length, 6)
  assert.equal(PASOS.length, 4)
  assert.equal(USOS.length, 4)
  assert.equal(ESTUDIO_VIDEO.herramientas.length, 3)
  assert.equal(FAQ.length, 4)
  assert.ok(NEGOCIOS.length > 0)
})

test('textos variables por defecto (tabla de brechas)', () => {
  assert.equal(TEXTO_ACTUALIZACIONES, 'Nosotros te instalamos las mejoras.')
  assert.equal(TEXTO_BORRADO_CLIPS, 'Los clips se borran solos a los 7 días.')
})

test('ningún texto promete lo que las brechas marcan como no cumplible', () => {
  const todo = JSON.stringify([QUE_HACE, PASOS, USOS, FAQ, ESTUDIO_VIDEO, CAJAS_WEB]).toLowerCase()
  assert.ok(!todo.includes('sin que hagas nada'))
  assert.ok(!todo.includes('3 gb'))
  assert.ok(!todo.includes('días que elijas'))
})

test('las fotos de usos viven en /minipc/ y tienen alt', () => {
  for (const u of USOS) {
    assert.ok(u.foto.startsWith('/minipc/'))
    assert.ok(u.alt.length > 10)
  }
})
