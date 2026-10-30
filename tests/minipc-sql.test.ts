import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../supabase/05_pedidos_minipc.sql', import.meta.url), 'utf8')
// Sin comentarios de línea, para no confundir texto explicativo con SQL.
const codigo = sql
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n')
const plano = codigo.replace(/\s+/g, ' ').toLowerCase()

test('empieza con begin; y termina con commit;', () => {
  assert.ok(plano.trim().startsWith('begin;'))
  assert.ok(plano.trim().endsWith('commit;'))
})

test('la guarda do $$ va antes del primer create table', () => {
  const guarda = plano.indexOf('do $$')
  const crear = plano.indexOf('create table')
  assert.ok(guarda >= 0 && crear >= 0)
  assert.ok(guarda < crear)
})

test('la guarda aborta si la tabla existe con otra marca', () => {
  assert.match(plano, /to_regclass\('public\.pedidos_minipc'\) is not null/)
  assert.match(plano, /obj_description\(to_regclass\('public\.pedidos_minipc'\), 'pg_class'\) is distinct from 'empleado-ia\/minipc'/)
  assert.match(plano, /raise exception/)
})

test('marca la tabla con empleado-ia/minipc', () => {
  assert.match(plano, /comment on table pedidos_minipc is 'empleado-ia\/minipc'/)
})

test('no es destructivo', () => {
  assert.doesNotMatch(plano, /drop table/)
  assert.doesNotMatch(plano, /truncate/)
  assert.doesNotMatch(plano, /delete from/)
})

test('stripe_session_id es not null unique', () => {
  assert.match(plano, /stripe_session_id text not null unique/)
})

test('CHECK de estado lista exactamente los seis estados', () => {
  const m = plano.match(/estado text not null default 'pagado' check \(estado in \(([^)]*)\)\)/)
  assert.ok(m, 'no encontré el CHECK de estado')
  const lista = m[1].split(',').map((s) => s.trim().replace(/'/g, ''))
  assert.deepEqual(lista, ['pagado', 'revisar', 'enviado', 'entregado', 'reembolsado', 'cancelado'])
})

test('CHECK de plan_id admite basico, pro, negocio y NULL', () => {
  const m = plano.match(/plan_id text check \(plan_id is null or plan_id in \(([^)]*)\)\)/)
  assert.ok(m, 'no encontré el CHECK de plan_id')
  const lista = m[1].split(',').map((s) => s.trim().replace(/'/g, ''))
  assert.deepEqual(lista, ['basico', 'pro', 'negocio'])
})

test('monto_centavos integer not null con CHECK >= 0 y moneda not null', () => {
  assert.match(plano, /monto_centavos integer not null check \(monto_centavos >= 0\)/)
  assert.match(plano, /moneda text not null/)
})

test('seguimiento admite hasta 120 caracteres y es nullable', () => {
  assert.match(plano, /seguimiento text check \(char_length\(seguimiento\) <= 120\)/)
})

test('foco 5: user_id nullable, on delete set null', () => {
  assert.match(plano, /user_id uuid references auth\.users\(id\) on delete set null/)
  assert.doesNotMatch(plano, /user_id uuid not null/)
})

test('RLS activado con solo una política de lectura auth.uid() = user_id', () => {
  assert.match(plano, /alter table pedidos_minipc enable row level security/)
  const politicas = plano.match(/create policy/g) ?? []
  assert.equal(politicas.length, 1)
  assert.match(plano, /create policy "[^"]+" on pedidos_minipc for select using \(auth\.uid\(\) = user_id\)/)
  assert.doesNotMatch(plano, /for (insert|update|delete|all)/)
})

test('índices por creado desc y por estado', () => {
  assert.match(plano, /create index if not exists \w+ on pedidos_minipc \(creado desc\)/)
  assert.match(plano, /create index if not exists \w+ on pedidos_minipc \(estado\)/)
})
