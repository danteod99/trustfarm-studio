// Prueba estática de supabase/14_soporte.sql: se lee el texto, no se corre contra una base.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const crudo = readFileSync(new URL('../supabase/14_soporte.sql', import.meta.url), 'utf8')
const sql = crudo.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')

test('una sola transacción y solo añade', () => {
  assert.match(sql, /^\s*begin;/m)
  assert.match(sql, /\bcommit;\s*$/)
  assert.doesNotMatch(sql, /\b(drop|truncate|alter\s+table\s+cajas)\b/i)
  assert.doesNotMatch(sql, /\bdelete\s+from\b/i)
})

test('guarda del proyecto compartido en las tres tablas', () => {
  assert.match(sql, /array\['soporte_tickets', 'soporte_permisos', 'soporte_accesos'\]/)
  assert.match(sql, /raise exception/)
  for (const t of ['soporte_tickets', 'soporte_permisos', 'soporte_accesos']) {
    assert.match(sql, new RegExp(`comment on table ${t} is 'empleado-ia/cajas'`))
  }
})

test('los límites del diseño están en la base: nivel, minutos y estado', () => {
  assert.match(sql, /nivel\s+text not null check \(nivel in \('app', 'sistema'\)\)/)
  assert.match(sql, /minutos\s+integer not null check \(minutos between 15 and 10080\)/)
  assert.match(sql, /estado\s+text not null default 'abierto' check \(estado in \('abierto', 'en_atencion', 'cerrado'\)\)/)
})

test('un solo permiso sin cerrar por caja', () => {
  assert.match(sql, /create unique index if not exists soporte_permisos_uno_abierto on soporte_permisos \(caja_id\) where cerrado_en is null/)
})

test('RLS activado y sin políticas públicas', () => {
  for (const t of ['soporte_tickets', 'soporte_permisos', 'soporte_accesos']) {
    assert.match(sql, new RegExp(`alter table ${t} enable row level security`))
  }
  assert.doesNotMatch(sql, /create policy/i)
  for (const t of ['soporte_tickets', 'soporte_permisos', 'soporte_accesos']) {
    assert.match(sql, new RegExp(`revoke all on table ${t} from anon, authenticated`), `${t}: sin permisos para anon ni authenticated`)
  }
})
