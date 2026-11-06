// Genera supabase/15_ideas.sql: la tabla y las ideas actuales de app/lib/ideas.ts.
// Uso: node --experimental-strip-types scripts/generar-sql-ideas.ts
import { writeFileSync } from 'node:fs'
import { IDEAS } from '../app/lib/ideas.ts'
import { ideaAFila } from '../app/lib/ideas-datos.ts'

const lit = (v: string | number | boolean | null) => {
  if (v === null) return 'null'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return `'${v.replace(/'/g, "''")}'`
}

const COLUMNAS = ['id', 'category', 'title', 'hook', 'image', 'video', 'kind', 'model', 'aspect', 'duration', 'resolution', 'motion', 'prompt', 'orden'] as const
const filas = IDEAS.map((i, k) => {
  const f = ideaAFila(i, k + 1)
  return `  (${COLUMNAS.map((c) => lit(f[c] as string | number | null)).join(', ')})`
})

const sql = `-- Ideas de /ideas en base de datos, editables desde admin sin deploy.
-- Idempotente: se puede correr varias veces y no pisa lo editado. Pegar en el SQL Editor de Supabase.
-- Generado por scripts/generar-sql-ideas.ts. Se lee solo desde el servidor con service role.
begin;

create table if not exists ideas (
  id          text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 60),
  category    text not null,
  title       text not null check (char_length(title) between 3 and 80),
  hook        text not null check (char_length(hook) between 3 and 200),
  image       text,
  video       text,
  kind        text not null check (kind in ('image', 'video')),
  model       text not null,
  aspect      text not null,
  duration    integer,
  resolution  text,
  motion      text,
  prompt      text not null check (char_length(prompt) between 10 and 2000),
  variaciones jsonb not null default '[]'::jsonb check (jsonb_typeof(variaciones) = 'array'),
  fuente      text,
  tendencia   boolean not null default false,
  oculta      boolean not null default false,
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table ideas enable row level security;
revoke all on ideas from anon, authenticated;
grant all on ideas to service_role;

insert into ideas (${COLUMNAS.join(', ')}) values
${filas.join(',\n')}
on conflict (id) do nothing;

commit;
`
writeFileSync(new URL('../supabase/15_ideas.sql', import.meta.url), sql)
console.log(`supabase/15_ideas.sql: ${filas.length} ideas`)
