// Prueba estática de supabase/10_caja_asignada.sql: se lee el texto, no se corre contra ninguna base.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const crudo = readFileSync(new URL('../supabase/10_caja_asignada.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sql = crudo.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')

test('una sola transacción y solo toca lo propio', () => {
  assert.match(sql, /^\s*begin;/m)
  assert.match(sql, /\bcommit;\s*$/)
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|function)\b/i)
  assert.doesNotMatch(sql, /\bdelete\s+from\b/i)
})

test('columnas nuevas nullable y con el correo siempre en minúsculas y sin espacios', () => {
  assert.match(sql, /alter table cajas add column if not exists email_asignado text\s+check \(email_asignado is null or \(char_length\(email_asignado\) <= 254 and email_asignado = lower\(btrim\(email_asignado\)\)\)\);/)
  assert.match(sql, /alter table caja_registros add column if not exists email_validado text\s+check \(email_validado is null or \(char_length\(email_validado\) <= 254 and email_validado = lower\(btrim\(email_validado\)\)\)\);/)
  assert.doesNotMatch(sql, /email_(asignado|validado) text not null/)
})

test('caja_vincular_asignada: security definer, correo validado, caja libre más antigua con skip locked', () => {
  const m = sql.match(/create or replace function caja_vincular_asignada\([\s\S]*?\$\$;/)
  assert.ok(m, 'falta la función')
  const f = m[0]
  assert.match(f, /security definer/)
  assert.match(f, /set search_path = public/)
  assert.match(f, /r\.email_validado = p_email/)
  assert.match(f, /r\.estado = 'pendiente'/)
  assert.match(f, /r\.caja_id is null/)
  assert.match(f, /r\.expira_en > now\(\)/)
  assert.match(f, /c\.email_asignado = p_email/)
  assert.match(f, /c\.owner_id is null/)
  assert.match(f, /not exists \(select 1 from caja_registros x where x\.caja_id = c\.id\)/)
  assert.match(f, /order by c\.created_at/)
  assert.match(f, /for update skip locked/)
  assert.match(f, /raise exception 'codigo_invalido'/)
  assert.match(f, /raise exception 'sin_caja_asignada'/)
  assert.match(f, /update caja_registros set estado = 'vinculada', caja_id = v_caja where id = v_registro;/)
})

test('permisos: solo service_role; marca del proyecto y guarda contra funciones ajenas', () => {
  assert.match(sql, /comment on function caja_vincular_asignada\(text, uuid, text, text\) is 'empleado-ia\/cajas';/)
  assert.match(sql, /revoke all on function caja_vincular_asignada\(text, uuid, text, text\) from public, anon, authenticated;/)
  assert.match(sql, /grant execute on function caja_vincular_asignada\(text, uuid, text, text\) to service_role;/)
  assert.match(sql, /obj_description\(to_regprocedure\('public\.caja_vincular_asignada\(text,uuid,text,text\)'\), 'pg_proc'\) is distinct from 'empleado-ia\/cajas'/)
})

test('idempotente: columnas e índice con if not exists', () => {
  assert.match(sql, /create index if not exists cajas_email_asignado_libres/)
  assert.equal((sql.match(/add column(?! if not exists)/g) ?? []).length, 0)
})
