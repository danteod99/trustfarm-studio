// Genera los SQL de ideas:
//   supabase/15_ideas.sql: la tabla y las ideas de app/lib/ideas.ts.
//   supabase/16_ideas_videos_tendencia.sql: los videos no publicados, ocultos hasta publicarlos desde admin.
// Uso: node --experimental-strip-types scripts/generar-sql-ideas.ts
import { writeFileSync } from 'node:fs'
import { IDEAS, type Idea } from '../app/lib/ideas.ts'
import { ideaAFila } from '../app/lib/ideas-datos.ts'
import { VIDEOS_PUBLICADOS } from '../app/lib/ideas-publicadas.ts'
import { VIDEOS_POR_PROBAR } from '../app/lib/ideas-tendencias.ts'
import { VIDEOS_ECOMMERCE_POR_PROBAR } from '../app/lib/ideas-ecommerce.ts'
import { VIDEOS_ANIME_TEMPORADAS_POR_PROBAR } from '../app/lib/ideas-anime-temporadas.ts'
import { VIDEOS_GATITOS_POR_PROBAR } from '../app/lib/ideas-gatitos.ts'

const lit = (v: unknown): string => {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'object') return `${lit(JSON.stringify(v))}::jsonb`
  return `'${String(v).replace(/'/g, "''")}'`
}

const COLUMNAS = ['id', 'category', 'title', 'hook', 'image', 'video', 'kind', 'model', 'aspect', 'duration', 'resolution', 'motion', 'prompt', 'variaciones', 'fuente', 'tendencia', 'oculta', 'orden'] as const

const VIDEOS = [...VIDEOS_POR_PROBAR, ...VIDEOS_ECOMMERCE_POR_PROBAR, ...VIDEOS_ANIME_TEMPORADAS_POR_PROBAR, ...VIDEOS_GATITOS_POR_PROBAR]
  .filter((v) => !VIDEOS_PUBLICADOS.includes(v.id))

function insertar(ideas: Idea[], oculta: boolean) {
  const filas = ideas.map((i, k) => {
    const f = ideaAFila(i, k + 1, oculta)
    return `  (${COLUMNAS.map((c) => lit(f[c])).join(', ')})`
  })
  return `insert into ideas (${COLUMNAS.join(', ')}) values
${filas.join(',\n')}
on conflict (id) do nothing;`
}

const tabla = `-- Ideas de /ideas en base de datos, editables desde admin sin deploy.
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

${insertar(IDEAS, false)}

commit;
`

const videos = `-- Videos de tendencias, ecommerce, anime, temporadas y gatitos del 06-11-2026. Entran OCULTOS: aún no se han probado.
-- Requiere supabase/15_ideas.sql. Se publican uno por uno desde Admin → Ideas → Mostrar, después de probarlos.
-- Idempotente y no pisa lo editado. Generado por scripts/generar-sql-ideas.ts.
begin;

${insertar(VIDEOS, true)}

commit;
`

writeFileSync(new URL('../supabase/15_ideas.sql', import.meta.url), tabla)
writeFileSync(new URL('../supabase/16_ideas_videos_tendencia.sql', import.meta.url), videos)
console.log(`15_ideas.sql: ${IDEAS.length} ideas · 16_ideas_videos_tendencia.sql: ${VIDEOS.length} videos ocultos`)
