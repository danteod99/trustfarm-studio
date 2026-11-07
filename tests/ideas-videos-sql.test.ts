// Prueba estática de supabase/16_ideas_videos_tendencia.sql: los videos no publicados no pueden publicarse solos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VIDEOS_PUBLICADOS } from '../app/lib/ideas-publicadas.ts'
import { VIDEOS_POR_PROBAR } from '../app/lib/ideas-tendencias.ts'
import { VIDEOS_ECOMMERCE_POR_PROBAR } from '../app/lib/ideas-ecommerce.ts'
import { VIDEOS_ANIME_TEMPORADAS_POR_PROBAR } from '../app/lib/ideas-anime-temporadas.ts'
import { VIDEOS_GATITOS_POR_PROBAR } from '../app/lib/ideas-gatitos.ts'

const crudo = readFileSync(new URL('../supabase/16_ideas_videos_tendencia.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sql = crudo.split('\n').map((l) => (l.startsWith('--') ? '' : l)).join('\n')
const filas = sql.split('\n').filter((l) => l.startsWith("  ('"))

test('una sola transacción, solo inserta y no pisa lo editado', () => {
  assert.match(sql, /^\s*begin;/m)
  assert.match(sql, /\bcommit;\s*$/)
  assert.match(sql, /on conflict \(id\) do nothing;/)
  assert.doesNotMatch(sql, /\b(drop|truncate|update|delete from|create table)\b/i)
})

test('trae solo los videos no publicados, y cada fila entra oculta', () => {
  const todos = [...VIDEOS_POR_PROBAR, ...VIDEOS_ECOMMERCE_POR_PROBAR, ...VIDEOS_ANIME_TEMPORADAS_POR_PROBAR, ...VIDEOS_GATITOS_POR_PROBAR]
  const videos = todos.filter((v) => !VIDEOS_PUBLICADOS.includes(v.id))
  assert.equal(videos.length, todos.length - VIDEOS_PUBLICADOS.length)
  assert.equal(filas.length, videos.length)
  for (const id of VIDEOS_PUBLICADOS) assert.ok(!filas.some((f) => f.startsWith(`  ('${id}', `)), id)
  for (const v of videos) assert.ok(filas.some((f) => f.startsWith(`  ('${v.id}', `)), v.id)
  // Columnas finales: tendencia, oculta, orden.
  for (const f of filas) assert.match(f, /, true, true, \d+\),?$/, f.slice(0, 60))
})

test('las variaciones van como jsonb y las comillas quedan cerradas', () => {
  for (const f of filas) {
    assert.match(f, /'\[\{.*\}\]'::jsonb/, f.slice(0, 60))
    assert.equal((f.match(/'/g) ?? []).length % 2, 0, f.slice(0, 60))
  }
})
