import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import * as C from '../app/lib/minipc-contenido.ts'
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
  const dir = new URL('../app/', import.meta.url)
  const fuentes = ['minipc/page.tsx', 'minipc/PlanCard.tsx', 'minipc/gracias/page.tsx'].map((f) =>
    readFileSync(new URL(f, dir), 'utf8'),
  )
  const todo = (JSON.stringify(C) + fuentes.join(' ')).toLowerCase()
  for (const frase of ['sin que hagas nada', 'días que elijas', 'recibe las mejoras', 'actualizaciones automáticas']) {
    assert.ok(!todo.includes(frase), frase)
  }
  assert.ok(!/3\s?gb/i.test(todo))
  assert.ok(!todo.replaceAll('limpieza automática', '').includes('automática'))
  assert.ok(!C.DESCRIPCION.toLowerCase().includes('compra en línea'))
  assert.ok(!C.DESCRIPCION.toLowerCase().includes('edita tus videos'))
  assert.ok(C.DESCRIPCION.includes('Elige el plan que va con tu negocio.'))
})

test('título y descripción compartidos', () => {
  assert.equal(C.TITULO, 'TRUST Assistant — Mini PC con vendedor IA')
})

test('negocios: 9 rubros del catálogo más "Y más"', () => {
  assert.equal(NEGOCIOS.length, 10)
  assert.equal(NEGOCIOS[9], 'Y más')
})

test('las fotos referenciadas existen en public/ y traen dimensiones', () => {
  const fotos = [...USOS, ...C.EQUIPO.fotos, ...Object.values(C.FOTOS)]
  for (const f of fotos) {
    assert.ok(existsSync(new URL('../public' + f.src, import.meta.url)), f.src)
    assert.ok(f.ancho > 0 && f.alto > 0, f.src)
    assert.ok(f.alt.length > 10)
  }
})
