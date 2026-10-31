// Prueba estática de supabase/04_cajas.sql: no se corre contra ninguna base, se lee el texto.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generarCodigo, normalizarCodigo } from '../app/lib/cajas/codigo.ts'
import { generarSecreto, hashSecreto } from '../app/lib/cajas/secreto.ts'

const crudo = readFileSync(new URL('../supabase/04_cajas.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
// Sin comentarios de línea: un texto comentado no cuenta como SQL
const sql = crudo.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')
const MARCA = "'empleado-ia/cajas'"

/** Cuerpo de `create table if not exists <nombre> ( … );` */
function tabla(nombre: string): string {
  const m = sql.match(new RegExp(`create table if not exists ${nombre} \\(([\\s\\S]*?)\\n\\);`))
  assert.ok(m, `no encontré la tabla ${nombre}`)
  return m[1]
}

/** Bloque `do $$ … $$;` de la guarda (el primero del archivo). */
function guarda(): { texto: string; inicio: number } {
  const inicio = sql.search(/\bdo \$\$/)
  assert.ok(inicio >= 0, 'falta el bloque do $$ de la guarda')
  const fin = sql.indexOf('$$;', inicio + 5)
  assert.ok(fin > inicio, 'el bloque do $$ no se cierra')
  return { texto: sql.slice(inicio, fin), inicio }
}

test('la guarda de colisión va al inicio, antes del primer create table', () => {
  const g = guarda()
  const primerCreate = sql.search(/create table/i)
  assert.ok(primerCreate > 0)
  assert.ok(g.inicio < primerCreate, 'la guarda debe ir ANTES del primer create table')
  for (const t of ["'cajas'", "'caja_registros'", "'caja_intentos'"]) assert.ok(g.texto.includes(t), `la guarda no revisa ${t}`)
  for (const f of ["'caja_vincular(text,uuid,text,text,text)'", "'caja_desvincular(uuid)'", "'caja_registros_al_borrar_caja()'"]) {
    assert.ok(g.texto.includes(f), `la guarda no revisa ${f}`)
  }
  assert.match(g.texto, /to_regclass\(/)
  assert.match(g.texto, /obj_description\(to_regclass\([^)]*\), 'pg_class'\)/)
  assert.match(g.texto, /to_regprocedure\(/)
  assert.match(g.texto, /obj_description\(to_regprocedure\([^)]*\), 'pg_proc'\)/)
  // "is distinct from": sin comentario (NULL) también aborta; con <> un NULL pasaría de largo
  assert.equal(g.texto.match(new RegExp(`is distinct from ${MARCA}`, 'g'))?.length, 2)
  assert.doesNotMatch(g.texto, /<>/)
  assert.match(g.texto, /raise exception 'La tabla % ya existe y no es de Empleado IA: revisa antes de continuar\.'/)
  assert.match(g.texto, /raise exception 'La función % ya existe y no es de Empleado IA: revisa antes de continuar\.'/)
})

test('todo corre en una transacción: si la guarda aborta, no queda nada a medias', () => {
  const g = guarda()
  const begin = sql.search(/^begin;$/m)
  assert.ok(begin >= 0 && begin < g.inicio, 'falta begin; antes de la guarda')
  assert.match(sql.trimEnd(), /\ncommit;$/)
})

test('cada tabla y función lleva la marca de Empleado IA', () => {
  for (const t of ['cajas', 'caja_registros', 'caja_intentos']) {
    assert.match(sql, new RegExp(`comment on table ${t} is ${MARCA};`), `falta comment on table ${t}`)
  }
  for (const f of ['caja_vincular\\(text, uuid, text, text, text\\)', 'caja_desvincular\\(uuid\\)', 'caja_registros_al_borrar_caja\\(\\)']) {
    assert.match(sql, new RegExp(`comment on function ${f} is ${MARCA};`), `falta comment on function ${f}`)
  }
  // la marca de cada tabla va justo después de crearla (si algo falla en medio, la guarda no la confunde con ajena)
  for (const t of ['cajas', 'caja_registros', 'caja_intentos']) {
    const despues = sql.slice(sql.indexOf(`create table if not exists ${t} (`))
    const cierre = despues.indexOf('\n);')
    assert.match(despues.slice(cierre + 3).trimStart(), new RegExp(`^comment on table ${t} is ${MARCA};`))
  }
})

test('CHECKs de formato y not null', () => {
  const reg = tabla('caja_registros')
  assert.match(reg, /codigo\s+text not null unique check \(codigo ~ '\^\[A-HJKMNP-Z2-9\]\{8\}\$'\)/)
  assert.match(reg, /secreto_hash\s+text not null check \(secreto_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/)
  assert.match(reg, /created_at\s+timestamptz not null default now\(\)/)
  const cajas = tabla('cajas')
  assert.match(cajas, /nombre\s+text not null default 'Mi caja' check \(char_length\(nombre\) between 1 and 60\)/)
  assert.match(cajas, /created_at\s+timestamptz not null default now\(\)/)
  assert.match(cajas, /linked_at\s+timestamptz not null default now\(\)/)
})

test('caja_vincular recorta y limpia el nombre antes de guardarlo', () => {
  assert.match(sql, /coalesce\(nullif\(left\(btrim\(p_nombre\), 60\), ''\), 'Mi caja'\)/)
  assert.doesNotMatch(sql, /coalesce\(nullif\(p_nombre, ''\)/)
})

test('idempotente y no destructivo: se puede correr dos veces seguidas', () => {
  assert.doesNotMatch(sql, /drop\s+table/i)
  assert.doesNotMatch(sql, /\btruncate\b/i)
  for (const m of sql.matchAll(/create\s+(?:unique\s+)?(table|index)\s+(\S+)/gi)) {
    assert.equal(m[2].toLowerCase(), 'if', `create ${m[1]} sin if not exists`)
  }
  for (const m of sql.matchAll(/create\s+(or\s+replace\s+)?function/gi)) assert.ok(m[1], 'create function sin or replace')
  for (const m of sql.matchAll(/create policy "([^"]+)" on (\w+)/g)) {
    assert.ok(sql.includes(`drop policy if exists "${m[1]}" on ${m[2]};`), `falta drop policy if exists de ${m[1]}`)
  }
  for (const m of sql.matchAll(/create trigger (\w+)\s+\w+ \w+ on (\w+)/g)) {
    assert.ok(sql.includes(`drop trigger if exists ${m[1]} on ${m[2]};`), `falta drop trigger if exists de ${m[1]}`)
  }
})

function regexDelCheck(columna: string): RegExp {
  const m = sql.match(new RegExp(`check \\(${columna} ~ '([^']+)'\\)`))
  assert.ok(m, `no encontré el CHECK de ${columna}`)
  return new RegExp(m[1])
}

test('el CHECK de codigo acepta los códigos que genera la central (normalizados)', () => {
  const re = regexDelCheck('codigo')
  for (let i = 0; i < 1000; i++) {
    const n = normalizarCodigo(generarCodigo())
    assert.ok(n && re.test(n), `rechazó ${n}`)
  }
})

test('el CHECK de codigo rechaza 0, O, 1, I, L, guion y longitudes 7 y 9', () => {
  const re = regexDelCheck('codigo')
  const base = 'ABCD2345'
  for (const malo of ['0', 'O', '1', 'I', 'L']) assert.equal(re.test(malo + base.slice(1)), false, malo)
  for (const malo of ['ABC2345', 'ABCD23456', 'ABCD-2345', 'abcd2345', '', 'ABCD234Ñ']) assert.equal(re.test(malo), false, malo)
})

test('el CHECK de secreto_hash acepta hashSecreto y rechaza lo demás', () => {
  const re = regexDelCheck('secreto_hash')
  for (let i = 0; i < 50; i++) assert.ok(re.test(hashSecreto(generarSecreto())))
  for (const malo of ['', 'A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), generarSecreto()]) assert.equal(re.test(malo), false, malo)
})
