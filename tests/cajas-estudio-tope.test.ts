// Tope diario del Estudio por caja: lógica pura y prueba estática del SQL (supabase/05_caja_estudio.sql).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TOPE_DIARIO_POR_DEFECTO, evaluarTope, inicioDiaLima } from '../app/lib/cajas/estudio-tope.ts'

test('el tope por defecto es 100 créditos', () => {
  assert.equal(TOPE_DIARIO_POR_DEFECTO, 100)
})

test('inicioDiaLima: antes de las 05:00 UTC en Lima todavía es el día anterior', () => {
  assert.equal(inicioDiaLima(new Date('2026-10-30T03:00:00Z')).toISOString(), '2026-10-29T05:00:00.000Z')
})

test('inicioDiaLima: a las 05:00 UTC en punto es medianoche en Lima (empieza el día nuevo)', () => {
  assert.equal(inicioDiaLima(new Date('2026-10-30T05:00:00Z')).toISOString(), '2026-10-30T05:00:00.000Z')
  assert.equal(inicioDiaLima(new Date('2026-10-30T04:59:59Z')).toISOString(), '2026-10-29T05:00:00.000Z')
})

test('inicioDiaLima: cualquier hora de la tarde usa el mismo inicio de día; cambio de año y de mes', () => {
  assert.equal(inicioDiaLima(new Date('2026-10-30T23:59:00Z')).toISOString(), '2026-10-30T05:00:00.000Z')
  assert.equal(inicioDiaLima(new Date('2027-01-01T02:00:00Z')).toISOString(), '2026-12-31T05:00:00.000Z')
  assert.equal(inicioDiaLima(new Date('2026-03-01T01:00:00Z')).toISOString(), '2026-02-28T05:00:00.000Z')
})

test('evaluarTope: permite hasta el tope exacto', () => {
  assert.deepEqual(evaluarTope({ gastado: 90, costo: 10, tope: 100 }), { ok: true })
  assert.deepEqual(evaluarTope({ gastado: 0, costo: 100, tope: 100 }), { ok: true })
})

test('evaluarTope: pasarse del tope bloquea con el mensaje exacto y el tope de esa caja', () => {
  assert.deepEqual(evaluarTope({ gastado: 91, costo: 10, tope: 100 }), {
    ok: false,
    error: 'Llegaste al límite de hoy (100 créditos por caja). Se reinicia a medianoche.',
  })
  const r = evaluarTope({ gastado: 10, costo: 10, tope: 15 })
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.error, /\(15 créditos por caja\)/)
})

test('evaluarTope: tope 0 bloquea todo', () => {
  assert.equal(evaluarTope({ gastado: 0, costo: 1, tope: 0 }).ok, false)
})

// ───────── SQL (texto) ─────────
const crudo = readFileSync(new URL('../supabase/05_caja_estudio.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sql = crudo.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')

test('SQL: transacción única e idempotente', () => {
  assert.match(sql, /\bbegin;/)
  assert.match(sql, /\bcommit;/)
  assert.match(sql, /add column if not exists caja_id uuid references cajas\(id\) on delete set null/)
  assert.match(sql, /add column if not exists tope_diario integer not null default 100 check \(tope_diario >= 0\)/)
  assert.match(sql, /create index if not exists \w+ on ai_generations \(caja_id, created_at desc\)/)
})

test('SQL: caja_gasto_hoy suma solo lo cobrado y no fallido desde la fecha dada', () => {
  const f = sql.match(/create or replace function caja_gasto_hoy\(p_caja uuid, p_desde timestamptz\)[\s\S]*?\$\$;/)
  assert.ok(f, 'falta la función caja_gasto_hoy')
  const cuerpo = f[0]
  assert.match(cuerpo, /returns integer/)
  assert.match(cuerpo, /coalesce\(sum\(cost_credits\), ?0\)/)
  assert.match(cuerpo, /caja_id = p_caja/)
  assert.match(cuerpo, /charged = true/)
  assert.match(cuerpo, /status <> 'failed'/)
  assert.match(cuerpo, /created_at >= p_desde/)
})

test('SQL: la función solo la ejecuta service_role', () => {
  assert.match(sql, /revoke all on function caja_gasto_hoy\(uuid, timestamptz\) from public, anon, authenticated;/)
  assert.match(sql, /grant execute on function caja_gasto_hoy\(uuid, timestamptz\) to service_role;/)
})
