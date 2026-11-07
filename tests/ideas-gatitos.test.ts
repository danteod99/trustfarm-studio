import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IDEAS, IDEA_CATEGORIES } from '../app/lib/ideas.ts'
import { IDEAS_GATITOS as IMAGENES, VIDEOS_GATITOS_POR_PROBAR as VIDEOS } from '../app/lib/ideas-gatitos.ts'
import { IDEAS_ANIME_TEMPORADAS, VIDEOS_ANIME_TEMPORADAS_POR_PROBAR } from '../app/lib/ideas-anime-temporadas.ts'
import { IDEAS_ECOMMERCE, VIDEOS_ECOMMERCE_POR_PROBAR } from '../app/lib/ideas-ecommerce.ts'
import { IDEAS_TENDENCIA, VIDEOS_POR_PROBAR } from '../app/lib/ideas-tendencias.ts'
import { IDS_PUBLICADOS, VIDEOS_PUBLICADOS } from '../app/lib/ideas-publicadas.ts'
import { validarIdea } from '../app/lib/ideas-datos.ts'

const nuevas = [...IMAGENES, ...VIDEOS]
const base = IDEAS.filter((i) => !IDS_PUBLICADOS.includes(i.id))

test('van dentro de Mascotas, sin categoría aparte, con imágenes y videos', () => {
  assert.ok(!(IDEA_CATEGORIES as readonly string[]).includes('Gatitos'))
  assert.ok(nuevas.length >= 10)
  assert.ok(IMAGENES.length > 0 && VIDEOS.length > 0)
  for (const i of nuevas) assert.equal(i.category, 'Mascotas', i.id)
})

test('siempre son gatitos pequeños: en el prompt y en cada variación', () => {
  for (const i of nuevas) {
    assert.match(i.prompt, /gatitos? .*(diminuto|pequeñ)|gatitos diminutos/i, i.id)
    for (const v of i.variaciones ?? []) assert.match(v.prompt, /gatito.*diminuto/i, `${i.id}: ${v.titulo}`)
  }
})

test('todas pasan la misma validación que admin', () => {
  const malas = nuevas.map((i) => [i.id, validarIdea(i)] as const).filter(([, r]) => 'error' in r)
  assert.deepEqual(malas, [])
})

test('ningún id se repite con ninguna otra tanda', () => {
  const ids = nuevas.map((i) => i.id)
  assert.equal(new Set(ids).size, ids.length)
  const otras = new Set([...base, ...IDEAS_TENDENCIA, ...VIDEOS_POR_PROBAR, ...IDEAS_ECOMMERCE, ...VIDEOS_ECOMMERCE_POR_PROBAR, ...IDEAS_ANIME_TEMPORADAS, ...VIDEOS_ANIME_TEMPORADAS_POR_PROBAR].map((i) => i.id))
  assert.deepEqual(ids.filter((id) => otras.has(id)), [])
})

test('cada idea trae variaciones, fuente interna y etiqueta', () => {
  for (const i of nuevas) {
    assert.ok((i.variaciones?.length ?? 0) >= 3, i.id)
    assert.ok(i.fuente, i.id)
    assert.equal(i.tendencia, true, i.id)
  }
})

test('los videos no listados como publicados no están en el archivo público', () => {
  const publicos = new Set(IDEAS.map((i) => i.id))
  assert.deepEqual(VIDEOS.filter((v) => publicos.has(v.id) && !VIDEOS_PUBLICADOS.includes(v.id)).map((v) => v.id), [])
})
