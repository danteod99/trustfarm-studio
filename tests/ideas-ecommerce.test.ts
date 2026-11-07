import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IDEAS } from '../app/lib/ideas.ts'
import { IDEAS_ECOMMERCE, VIDEOS_ECOMMERCE_POR_PROBAR } from '../app/lib/ideas-ecommerce.ts'
import { IDEAS_TENDENCIA, VIDEOS_POR_PROBAR } from '../app/lib/ideas-tendencias.ts'
import { IDS_PUBLICADOS, VIDEOS_PUBLICADOS } from '../app/lib/ideas-publicadas.ts'
import { validarIdea } from '../app/lib/ideas-datos.ts'

const nuevas = [...IDEAS_ECOMMERCE, ...VIDEOS_ECOMMERCE_POR_PROBAR]
const base = IDEAS.filter((i) => !IDS_PUBLICADOS.includes(i.id))

test('todas pasan la misma validación que admin', () => {
  const malas = nuevas.map((i) => [i.id, validarIdea(i)] as const).filter(([, r]) => 'error' in r)
  assert.deepEqual(malas, [])
})

test('ningún id se repite con las ideas anteriores ni con la tanda de tendencias', () => {
  const ids = nuevas.map((i) => i.id)
  assert.equal(new Set(ids).size, ids.length)
  const previas = new Set([...base, ...IDEAS_TENDENCIA, ...VIDEOS_POR_PROBAR].map((i) => i.id))
  assert.deepEqual(ids.filter((id) => previas.has(id)), [])
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
  assert.deepEqual(VIDEOS_ECOMMERCE_POR_PROBAR.filter((v) => publicos.has(v.id) && !VIDEOS_PUBLICADOS.includes(v.id)).map((v) => v.id), [])
})

test('los prompts piden sin logos o texto controlado, para no mostrar marcas de terceros', () => {
  for (const i of nuevas) {
    if (i.model === 'qwen-image') continue
    assert.match(i.prompt, /sin .*(logos|texto)/i, i.id)
  }
})
