import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PLANES } from '../app/lib/minipc.ts'

const crudo = readFileSync(new URL('../supabase/05_pedidos_minipc.sql', import.meta.url), 'utf8')

// Mismo análisis para LF y CRLF (el repo tiene core.autocrlf=true).
function analizar(sql: string) {
  // Sin comentarios de línea, para no confundir texto explicativo con SQL.
  const codigo = sql
    .split(/\r?\n/)
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n')
  const plano = codigo.replace(/\s+/g, ' ').toLowerCase()
  // Definición de una columna (una por línea en el create table), normalizada.
  const columna = (c: string) =>
    codigo.split('\n').map((l) => l.trim().replace(/\s+/g, ' ').toLowerCase()).find((l) => l.startsWith(c + ' ')) ?? ''
  return { plano, columna }
}

const variantes: Array<[string, string]> = [
  ['LF', crudo.replace(/\r\n/g, '\n')],
  ['CRLF', crudo.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')],
]

for (const [nombre, sql] of variantes) {
  const { plano, columna } = analizar(sql)
  const t = (titulo: string, fn: () => void) => test(`[${nombre}] ${titulo}`, fn)

  t('empieza con begin; y termina con commit; (uno solo de cada uno)', () => {
    assert.ok(plano.trim().startsWith('begin;'))
    assert.ok(plano.trim().endsWith('commit;'))
    assert.equal((plano.match(/\bbegin;/g) ?? []).length, 1)
    assert.equal((plano.match(/\bcommit;/g) ?? []).length, 1)
  })

  t('la guarda do $$ va antes del primer create table', () => {
    const guarda = plano.indexOf('do $$')
    const crear = plano.indexOf('create table')
    assert.ok(guarda >= 0 && crear >= 0)
    assert.ok(guarda < crear)
  })

  t('la guarda aborta si la tabla existe con otra marca', () => {
    assert.match(plano, /to_regclass\('public\.pedidos_minipc'\) is not null and obj_description/)
    assert.match(plano, /obj_description\(to_regclass\('public\.pedidos_minipc'\), 'pg_class'\) is distinct from 'empleado-ia\/minipc'/)
    assert.match(plano, /raise exception/)
  })

  t('marca la tabla con empleado-ia/minipc', () => {
    assert.match(plano, /comment on table pedidos_minipc is 'empleado-ia\/minipc'/)
  })

  t('no es destructivo', () => {
    assert.doesNotMatch(plano, /drop table/)
    assert.doesNotMatch(plano, /truncate/)
    assert.doesNotMatch(plano, /delete from/)
    assert.doesNotMatch(plano, /disable row level security|drop column/)
  })

  t('stripe_session_id es not null unique', () => {
    assert.match(plano, /stripe_session_id text not null unique/)
  })

  t('CHECK de estado lista exactamente los seis estados', () => {
    const m = plano.match(/estado text not null default 'pagado' check \(estado in \(([^)]*)\)\)/)
    assert.ok(m, 'no encontré el CHECK de estado')
    const lista = m[1].split(',').map((s) => s.trim().replace(/'/g, ''))
    assert.deepEqual(lista, ['pagado', 'revisar', 'enviado', 'entregado', 'reembolsado', 'cancelado'])
  })

  t('CHECK de plan_id admite NULL y coincide con PLANES de minipc.ts', () => {
    const m = plano.match(/plan_id text check \(plan_id is null or plan_id in \(([^)]*)\)\)/)
    assert.ok(m, 'no encontré el CHECK de plan_id')
    const lista = m[1].split(',').map((s) => s.trim().replace(/'/g, '')).sort()
    assert.deepEqual(lista, PLANES.map((p) => p.id).sort())
    assert.deepEqual(lista, ['basico', 'negocio', 'pro'])
  })

  t('monto_centavos integer not null con CHECK >= 0 y moneda not null', () => {
    assert.match(plano, /monto_centavos integer not null check \(monto_centavos >= 0\)/)
    assert.match(plano, /moneda text not null/)
  })

  t('seguimiento admite hasta 120 caracteres', () => {
    assert.match(plano, /seguimiento text check \(char_length\(seguimiento\) <= 120\)/)
  })

  t('foco 5: user_id on delete set null', () => {
    assert.match(plano, /user_id uuid references auth\.users\(id\) on delete set null/)
  })

  t('nulabilidad: user_id, plan_id y seguimiento sin not null', () => {
    for (const c of ['user_id', 'plan_id', 'seguimiento']) {
      assert.ok(columna(c), `no encontré la columna ${c}`)
      assert.doesNotMatch(columna(c), /not null/, c)
    }
    assert.doesNotMatch(plano, /set not null/)
  })

  t('idempotencia: create table/policy y guarda con AND', () => {
    assert.match(plano, /create table if not exists pedidos_minipc \(/)
    assert.match(plano, /drop policy if exists "pedidos_minipc_select_owner" on pedidos_minipc; create policy "pedidos_minipc_select_owner"/)
  })

  t('RLS activado con solo una política de lectura auth.uid() = user_id', () => {
    assert.match(plano, /alter table pedidos_minipc enable row level security/)
    assert.equal((plano.match(/create policy/g) ?? []).length, 1)
    assert.match(plano, /create policy "[^"]+" on pedidos_minipc for select using \(auth\.uid\(\) = user_id\)/)
    assert.doesNotMatch(plano, /for (insert|update|delete|all)/)
  })

  t('índices por creado desc, estado y user_id', () => {
    assert.match(plano, /create index if not exists \w+ on pedidos_minipc \(creado desc\)/)
    assert.match(plano, /create index if not exists \w+ on pedidos_minipc \(estado\)/)
    assert.match(plano, /create index if not exists pedidos_minipc_user_idx on pedidos_minipc \(user_id\);/)
  })
}

test('el SQL en disco menciona minipc.ts junto al CHECK de plan_id', () => {
  assert.match(crudo, /minipc\.ts/)
})
