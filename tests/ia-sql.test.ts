// Prueba estática de supabase/12_ia_pasarela.sql: se lee el texto. El comportamiento real lo prueba scripts/probar-ia-sql.sh.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const crudo = readFileSync(new URL('../supabase/12_ia_pasarela.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sql = crudo.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')
const REGISTRAR = 'uuid, uuid, date, text, bigint, bigint, bigint, bigint, bigint, bigint, text, boolean'

test('una sola transacción y sin borrar nada', () => {
  assert.match(sql, /^\s*begin;/m)
  assert.match(sql, /\bcommit;\s*$/)
  assert.doesNotMatch(sql, /\bdrop\s+(table|column)\b/i)
  assert.doesNotMatch(sql, /\bdelete\s+from\b/i)
})

test('columnas nuevas de cajas, con valor por defecto para las filas existentes', () => {
  assert.match(sql, /alter table cajas add column if not exists ia_fraccion_micro bigint not null default 0;/)
  assert.match(sql, /alter table cajas add column if not exists tope_diario_ia integer not null default 100/)
  assert.match(sql, /alter table cajas add column if not exists ia_bloqueada boolean not null default false;/)
})

test('caja_ia_consumo: una fila por caja, día y modelo; sin contenido de conversaciones; solo service_role', () => {
  const m = sql.match(/create table if not exists caja_ia_consumo \(([\s\S]*?)\n\);/)
  assert.ok(m, 'falta la tabla')
  assert.match(m[1], /primary key \(caja_id, dia, modelo\)/)
  assert.match(m[1], /caja_id\s+uuid not null references cajas\(id\) on delete cascade/)
  for (const c of ['solicitudes', 'entrada', 'salida', 'cache_lectura', 'cache_escritura', 'costo_microusd', 'creditos_micro']) {
    assert.match(m[1], new RegExp(`${c}\\s+bigint not null default 0`), c)
  }
  assert.doesNotMatch(m[1], /message|system|contenido|prompt/i)
  assert.match(sql, /comment on table caja_ia_consumo is 'empleado-ia\/cajas';/)
  assert.match(sql, /alter table caja_ia_consumo enable row level security;/)
  assert.match(sql, /revoke all on caja_ia_consumo from anon, authenticated;/)
})

test('funciones: security definer, marca del proyecto y execute solo para service_role', () => {
  for (const [f, firma] of [['caja_ia_registrar', REGISTRAR], ['caja_ia_gasto_hoy', 'uuid, date, text']]) {
    const m = sql.match(new RegExp(`create or replace function ${f}\\([\\s\\S]*?\\$\\$;`))
    assert.ok(m, `falta ${f}`)
    assert.match(m[0], /security definer/)
    assert.match(m[0], /set search_path = public/)
    assert.ok(sql.includes(`comment on function ${f}(${firma}) is 'empleado-ia/cajas';`), `comentario ${f}`)
    assert.ok(sql.includes(`revoke all on function ${f}(${firma}) from public, anon, authenticated;`), `revoke ${f}`)
    assert.ok(sql.includes(`grant execute on function ${f}(${firma}) to service_role;`), `grant ${f}`)
  }
})

test('guarda: no pisa tablas ni funciones ajenas', () => {
  assert.match(sql, /is distinct from 'empleado-ia\/cajas'/)
  assert.match(sql, /to_regclass\('public\.caja_ia_consumo'\)/)
})

test('cobro: bloquea la caja y el saldo, y usa ref único en el historial', () => {
  const f = sql.match(/create or replace function caja_ia_registrar\([\s\S]*?\$\$;/)![0]
  assert.match(f, /from cajas[\s\S]*?for update/)
  assert.match(f, /from ai_wallets[\s\S]*?for update/)
  assert.match(f, /'ia:' \|\| p_caja \|\| ':' \|\| gen_random_uuid\(\)/)
  assert.doesNotMatch(f, /ai_charge/, 'ai_charge falla si no alcanza el saldo; aquí la deuda queda en la fracción')
})
