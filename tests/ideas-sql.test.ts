// Prueba estática de supabase/15_ideas.sql: se lee el texto.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const crudo = readFileSync(new URL('../supabase/15_ideas.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sql = crudo.split('\n').map((l) => (l.startsWith('--') ? '' : l)).join('\n')
const filas = sql.split('\n').filter((l) => l.startsWith("  ('"))

test('una sola transacción y sin borrar nada', () => {
  assert.match(sql, /^\s*begin;/m)
  assert.match(sql, /\bcommit;\s*$/)
  assert.doesNotMatch(sql, /\bdrop\s+(table|column)\b/i)
  assert.doesNotMatch(sql, /\btruncate\b/i)
})

test('idempotente y no pisa lo editado desde admin', () => {
  assert.match(sql, /create table if not exists ideas/)
  assert.match(sql, /on conflict \(id\) do nothing;/)
  assert.doesNotMatch(sql, /do update/i)
})

test('solo service role: RLS activa y sin permisos para anon ni usuarios', () => {
  assert.match(sql, /alter table ideas enable row level security;/)
  assert.match(sql, /revoke all on ideas from anon, authenticated;/)
  assert.match(sql, /grant all on ideas to service_role;/)
  assert.doesNotMatch(sql, /create policy/i)
})

test('migra las ideas del archivo, sin repetir y con sus comillas cerradas', () => {
  const ids = filas.map((f) => f.match(/^ {2}\('([a-z0-9-]+)', /)?.[1])
  assert.ok(ids.length >= 84, `solo ${ids.length} ideas`)
  assert.ok(ids.every(Boolean))
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.includes('maquina-cascos'))
  for (const f of filas) assert.equal((f.match(/'/g) ?? []).length % 2, 0, f.slice(0, 60))
})
