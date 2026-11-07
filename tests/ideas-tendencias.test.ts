import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IDEAS } from '../app/lib/ideas.ts'
import { IDEAS_TENDENCIA, VIDEOS_POR_PROBAR } from '../app/lib/ideas-tendencias.ts'
import { IDS_PUBLICADOS, VIDEOS_PUBLICADOS } from '../app/lib/ideas-publicadas.ts'
import { validarIdea } from '../app/lib/ideas-datos.ts'

const nuevas = [...IDEAS_TENDENCIA, ...VIDEOS_POR_PROBAR]

test('son al menos 40 ideas, y al menos 10 refuerzan Tecnología y granjas', () => {
  assert.ok(nuevas.length >= 40, `solo ${nuevas.length}`)
  assert.ok(nuevas.filter((i) => i.category === 'Tecnología y granjas').length >= 10)
})

test('todas pasan la misma validación que admin', () => {
  const malas = nuevas.map((i) => [i.id, validarIdea(i)] as const).filter(([, r]) => 'error' in r)
  assert.deepEqual(malas, [])
})

test('ningún id se repite, tampoco contra las ideas anteriores', () => {
  const ids = nuevas.map((i) => i.id)
  assert.equal(new Set(ids).size, ids.length)
  const previas = new Set(IDEAS.filter((i) => !IDS_PUBLICADOS.includes(i.id)).map((i) => i.id))
  assert.deepEqual(ids.filter((id) => previas.has(id)), [])
})

test('cada idea trae de 3 a 5 variaciones, fuente interna y etiqueta de tendencia', () => {
  for (const i of nuevas) {
    assert.ok((i.variaciones?.length ?? 0) >= 3, i.id)
    assert.ok(i.fuente, i.id)
    assert.equal(i.tendencia, true, i.id)
  }
})

test('los prompts no nombran marcas de estudios ni canciones de la tendencia', () => {
  const textos = nuevas.flatMap((i) => [i.prompt, i.title, i.hook, ...(i.variaciones ?? []).map((v) => v.prompt)])
  for (const t of textos) assert.doesNotMatch(t, /ghibli|miyazaki|thriller|disney|pixar|dame hombro|ba ba ba/i, t.slice(0, 60))
})

test('los videos no listados como publicados no están en el archivo público', () => {
  const publicos = new Set(IDEAS.map((i) => i.id))
  assert.deepEqual(VIDEOS_POR_PROBAR.filter((v) => publicos.has(v.id) && !VIDEOS_PUBLICADOS.includes(v.id)).map((v) => v.id), [])
})
