// Lista de ideas nuevas publicadas: solo esas salen en IDEAS, y con sus archivos en public/.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { IDEAS } from '../app/lib/ideas.ts'
import { IDS_PUBLICADOS, IMAGENES_PUBLICADAS, VIDEOS_PUBLICADOS } from '../app/lib/ideas-publicadas.ts'
import { IDEAS_TENDENCIA, VIDEOS_POR_PROBAR } from '../app/lib/ideas-tendencias.ts'
import { IDEAS_ECOMMERCE, VIDEOS_ECOMMERCE_POR_PROBAR } from '../app/lib/ideas-ecommerce.ts'
import { IDEAS_ANIME_TEMPORADAS, VIDEOS_ANIME_TEMPORADAS_POR_PROBAR } from '../app/lib/ideas-anime-temporadas.ts'
import { IDEAS_GATITOS, VIDEOS_GATITOS_POR_PROBAR } from '../app/lib/ideas-gatitos.ts'

const imagenes = [...IDEAS_TENDENCIA, ...IDEAS_ECOMMERCE, ...IDEAS_ANIME_TEMPORADAS, ...IDEAS_GATITOS]
const videos = [...VIDEOS_POR_PROBAR, ...VIDEOS_ECOMMERCE_POR_PROBAR, ...VIDEOS_ANIME_TEMPORADAS_POR_PROBAR, ...VIDEOS_GATITOS_POR_PROBAR]
const enPublic = (ruta: string) => existsSync(new URL(`../public${ruta}`, import.meta.url))
const publicada = (id: string) => IDEAS.find((i) => i.id === id)

test('son 28 sin repetir: 19 imágenes y 9 videos, cada una de su tanda', () => {
  assert.equal(IMAGENES_PUBLICADAS.length, 19)
  assert.equal(VIDEOS_PUBLICADOS.length, 9)
  assert.equal(new Set(IDS_PUBLICADOS).size, 28)
  for (const id of IMAGENES_PUBLICADAS) assert.ok(imagenes.some((i) => i.id === id), id)
  for (const id of VIDEOS_PUBLICADOS) assert.ok(videos.some((v) => v.id === id), id)
})

test('IDEAS no repite ids y trae las 28', () => {
  const ids = IDEAS.map((i) => i.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of IDS_PUBLICADOS) assert.ok(publicada(id), id)
})

test('las ideas no listadas no están en IDEAS', () => {
  const publicos = new Set(IDEAS.map((i) => i.id))
  const noListadas = [...imagenes, ...videos].filter((i) => !IDS_PUBLICADOS.includes(i.id))
  assert.ok(noListadas.length > 0)
  assert.deepEqual(noListadas.filter((i) => publicos.has(i.id)).map((i) => i.id), [])
})

test('las reservas y las imágenes rechazadas siguen fuera', () => {
  for (const id of [
    'granja-figurita', 'granja-antes-despues', 'granja-ia-vs-real', 'granja-escritorio-noche', 'influencer-polaroid',
    'anuario-2085', 'afiche-combi', 'ceviche-afiche', 'ecom-fondo-blanco', 'ecom-cocina-real', 'anime-pelea-lima',
    'anime-retrato-personaje', 'gatito-chef',
  ]) assert.equal(publicada(id), undefined, id)
})

test('cada imagen publicada tiene su archivo en public/', () => {
  for (const id of IMAGENES_PUBLICADAS) {
    const i = publicada(id)!
    assert.equal(i.kind, 'image', id)
    assert.ok(i.image && enPublic(i.image), `${id}: ${i.image}`)
  }
})

test('cada video publicado tiene su imagen y su mp4 en public/', () => {
  for (const id of VIDEOS_PUBLICADOS) {
    const i = publicada(id)!
    assert.equal(i.kind, 'video', id)
    assert.equal(i.image, `/showcase/idea-${id}.jpg`)
    assert.equal(i.video, `/showcase/idea-${id}.mp4`)
    assert.ok(enPublic(i.image!), i.image)
    assert.ok(enPublic(i.video!), i.video)
  }
})

test('publicar no cambia el prompt ni los textos de la tanda', () => {
  for (const id of IDS_PUBLICADOS) {
    const o = [...imagenes, ...videos].find((i) => i.id === id)!
    const i = publicada(id)!
    assert.deepEqual([i.prompt, i.title, i.hook, i.variaciones], [o.prompt, o.title, o.hook, o.variaciones], id)
  }
})

test('el código de cliente no importa las ideas: las tandas sin publicar no llegan al navegador', () => {
  for (const ruta of ['app/estudio/Studio.tsx', 'app/ideas/IdeasGallery.tsx', 'app/admin/IdeasAdmin.tsx', 'app/lib/ideas-datos.ts']) {
    const fuente = readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8')
    assert.doesNotMatch(fuente, /^import \{[^}]*\} from "(@\/app\/lib\/ideas|\.\/ideas\.ts)";/m, ruta)
    assert.doesNotMatch(fuente, /^import .*from "(@\/app\/lib\/|\.\/)ideas-(tendencias|ecommerce|anime-temporadas|gatitos)/m, ruta)
  }
})

test('supabase/15 trae las 28', () => {
  const sql = readFileSync(new URL('../supabase/15_ideas.sql', import.meta.url), 'utf8')
  for (const id of IDS_PUBLICADOS) assert.ok(sql.includes(`  ('${id}', `), id)
})
