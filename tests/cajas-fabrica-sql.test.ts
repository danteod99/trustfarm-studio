// Prueba estática de supabase/08_caja_fabrica.sql: no se corre contra ninguna base, se lee el texto.
// El comportamiento real (carrera de 20 clientes, llaves de un solo uso, permisos) lo prueba scripts/probar-fabrica-sql.sh en un Postgres de verdad.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const crudo = readFileSync(new URL('../supabase/08_caja_fabrica.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
// Sin comentarios de línea: un texto comentado no cuenta como SQL
const sql = crudo.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')

const FUNCIONES: Array<[string, string]> = [
  ['caja_preparar', 'text, text, text, uuid, text, timestamptz'],
  ['caja_nueva_llave', 'uuid, text, timestamptz'],
  ['caja_activar', 'text, text, text, timestamptz, text, text'],
  ['caja_nuevo_codigo', 'uuid, text, timestamptz'],
  ['caja_reclamar', 'text, uuid, text'],
  ['caja_liberar', 'uuid'],
]

/** Cuerpo de `create or replace function nombre(...) … $$;` */
function funcion(nombre: string): string {
  const m = sql.match(new RegExp(`create or replace function ${nombre}\\([\\s\\S]*?\\$\\$;`))
  assert.ok(m, `falta la función ${nombre}`)
  return m[0]
}

test('una sola transacción', () => {
  assert.match(sql, /^\s*begin;/m)
  assert.match(sql, /\bcommit;\s*$/)
})

test('cajas admite no tener dueño y gana etiqueta y creada_por (sin clave foránea en creada_por)', () => {
  assert.match(sql, /alter table cajas alter column owner_id drop not null;/)
  assert.match(sql, /alter table cajas add column if not exists etiqueta text check \(etiqueta is null or char_length\(etiqueta\) <= 80\);/)
  assert.match(sql, /alter table cajas add column if not exists creada_por uuid;/)
  assert.doesNotMatch(sql, /creada_por uuid references/)
})

test('caja_activaciones: llave solo como hash único de 64 hex, vence y se usa una vez', () => {
  const m = sql.match(/create table if not exists caja_activaciones \(([\s\S]*?)\n\);/)
  assert.ok(m, 'falta la tabla caja_activaciones')
  assert.match(m[1], /caja_id\s+uuid not null references cajas\(id\) on delete cascade/)
  assert.match(m[1], /llave_hash\s+text not null unique check \(llave_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/)
  assert.match(m[1], /vence_en\s+timestamptz not null/)
  assert.match(m[1], /usada_en\s+timestamptz/)
  assert.match(sql, /comment on table caja_activaciones is 'empleado-ia\/cajas';/)
  assert.match(sql, /alter table caja_activaciones enable row level security;/)
  assert.doesNotMatch(m[1], /\bllave\b\s+text/) // nunca la llave en claro
})

test('las seis funciones existen con su firma exacta, marca, y solo service_role las ejecuta', () => {
  for (const [nombre, firma] of FUNCIONES) {
    funcion(nombre)
    const f = firma.replace(/[()]/g, '\\$&')
    assert.match(sql, new RegExp(`comment on function ${nombre}\\(${f}\\) is 'empleado-ia/cajas';`), `marca de ${nombre}`)
    assert.match(sql, new RegExp(`revoke all on function ${nombre}\\(${f}\\) from public, anon, authenticated;`), `revoke de ${nombre}`)
    assert.match(sql, new RegExp(`grant execute on function ${nombre}\\(${f}\\) to service_role;`), `grant de ${nombre}`)
  }
})

test('todas las funciones son security definer con search_path fijo', () => {
  for (const [nombre] of FUNCIONES) {
    const f = funcion(nombre)
    assert.match(f, /security definer/, nombre)
    assert.match(f, /set search_path = public/, nombre)
  }
})

test('guarda de proyecto compartido: no pisa funciones o tablas ajenas', () => {
  const g = sql.match(/\bdo \$\$[\s\S]*?\$\$;/)
  assert.ok(g, 'falta el bloque do $$')
  for (const [nombre, firma] of FUNCIONES) assert.ok(g[0].includes(`${nombre}(${firma.replace(/, /g, ',')})`), `la guarda no nombra ${nombre}`)
  assert.match(g[0], /caja_activaciones/)
  assert.match(g[0], /raise exception/)
})

test('caja_preparar: tope de 100 cajas sin dueño bajo candado, slug repetido y sin dueño', () => {
  const f = funcion('caja_preparar')
  assert.match(f, /pg_advisory_xact_lock/)
  assert.match(f, /owner_id is null/)
  assert.match(f, />= 100/)
  assert.match(f, /owner_id is null and creada_por is not null/) // las cajas del flujo antiguo liberadas no cuentan para el tope
  assert.match(f, /raise exception 'limite_preparadas'/)
  assert.match(f, /raise exception 'slug_repetido'/)
  assert.match(f, /insert into caja_activaciones/)
})

test('caja_nueva_llave: borra solo las llaves sin usar y falla si la caja no existe', () => {
  const f = funcion('caja_nueva_llave')
  assert.match(f, /raise exception 'caja_inexistente'/)
  assert.match(f, /delete from caja_activaciones[\s\S]*usada_en is null/)
})

test('caja_activar: consume la llave con una sola UPDATE atómica y conserva al dueño al reactivar', () => {
  const f = funcion('caja_activar')
  assert.match(f, /update caja_activaciones[\s\S]*usada_en is null[\s\S]*vence_en > now\(\)/)
  assert.match(f, /raise exception 'llave_invalida'/)
  assert.match(f, /returns table \(registro_id uuid, caja_id uuid\)/)
  assert.match(f, /insert into caja_registros/)
  assert.match(f, /update caja_registros/)
  assert.doesNotMatch(f, /update cajas/) // reactivar no toca al dueño
})

test('caja_nuevo_codigo: solo para cajas sin dueño', () => {
  const f = funcion('caja_nuevo_codigo')
  assert.match(f, /returns boolean/)
  assert.match(f, /owner_id is null/)
})

test('caja_reclamar: atómica (for update), solo códigos vigentes de cajas sin dueño, y gasta el código', () => {
  const f = funcion('caja_reclamar')
  assert.match(f, /returns uuid/)
  assert.match(f, /owner_id is null/)
  assert.match(f, /expira_en > now\(\)/)
  assert.match(f, /for update/)
  assert.match(f, /raise exception 'codigo_invalido'/)
  assert.match(f, /update caja_registros set expira_en = now\(\)/)
})

test('caja_liberar: quita el dueño y vence el código; no borra la caja', () => {
  const f = funcion('caja_liberar')
  assert.match(f, /set owner_id = null/)
  assert.match(f, /expira_en = now\(\)/)
  assert.doesNotMatch(f, /delete from cajas/)
})

test('caja_vincular y caja_desvincular (flujo antiguo) no se redefinen aquí', () => {
  assert.doesNotMatch(sql, /function caja_vincular\(/)
  assert.doesNotMatch(sql, /function caja_desvincular\(/)
})
