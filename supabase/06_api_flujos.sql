-- API pública, flujos (recetas de varios pasos) y loops (generaciones que se repiten solas).
-- Idempotente. Correr DESPUÉS de schema.sql y 03_personajes.sql. Solo lo usa el servidor (service role):
-- las tablas tienen RLS de solo lectura para el dueño y ninguna escritura desde el navegador.
begin;

-- Claves de API: solo se guarda el hash SHA-256; la clave completa se muestra una sola vez al crearla.
create table if not exists ai_api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  prefix       text not null,              -- primeros caracteres, para reconocerla en la lista
  key_hash     text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists ai_api_keys_user_idx on ai_api_keys (user_id, created_at desc);

-- Flujos: lista ordenada de pasos (cada paso puede usar el resultado del anterior).
create table if not exists ai_flows (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  steps        jsonb not null,             -- [{ title, model, aspect, duration?, resolution?, motion?, prompt, input: "none"|"previous" }]
  character_id uuid,                       -- personaje guardado (ai_presets) que se antepone a cada paso
  style_id     uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ai_flows_user_idx on ai_flows (user_id, created_at desc);

-- Corridas de un flujo: avanzan paso a paso a medida que terminan las generaciones.
create table if not exists ai_flow_runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  flow_id      uuid references ai_flows(id) on delete set null,
  loop_id      uuid,
  name         text not null,
  steps        jsonb not null,             -- copia de los pasos al momento de correr (el flujo puede editarse después)
  character_id uuid,
  style_id     uuid,
  status       text not null default 'running' check (status in ('running', 'done', 'failed')),
  step         integer not null default 0, -- paso actual (0 = primero)
  generations  uuid[] not null default '{}',
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ai_flow_runs_user_idx on ai_flow_runs (user_id, created_at desc);
create index if not exists ai_flow_runs_active_idx on ai_flow_runs (status) where status = 'running';

-- Loops: repiten un flujo o una sola generación en días y hora fijos (hora de Lima).
create table if not exists ai_loops (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  flow_id      uuid references ai_flows(id) on delete cascade, -- o null + step: una sola generación
  step         jsonb,
  per_run      integer not null default 1 check (per_run between 1 and 10),
  hour         integer not null default 9 check (hour between 0 and 23),
  days         integer[] not null default '{0,1,2,3,4,5,6}',  -- 0 = domingo
  active       boolean not null default true,
  next_run_at  timestamptz not null,
  last_run_at  timestamptz,
  last_error   text,
  created_at   timestamptz not null default now(),
  check (flow_id is not null or step is not null)
);
create index if not exists ai_loops_due_idx on ai_loops (next_run_at) where active;
create index if not exists ai_loops_user_idx on ai_loops (user_id, created_at desc);

alter table ai_api_keys  enable row level security;
alter table ai_flows     enable row level security;
alter table ai_flow_runs enable row level security;
alter table ai_loops     enable row level security;
drop policy if exists ai_api_keys_own on ai_api_keys;
create policy ai_api_keys_own on ai_api_keys for select using (auth.uid() = user_id);
drop policy if exists ai_flows_own on ai_flows;
create policy ai_flows_own on ai_flows for select using (auth.uid() = user_id);
drop policy if exists ai_flow_runs_own on ai_flow_runs;
create policy ai_flow_runs_own on ai_flow_runs for select using (auth.uid() = user_id);
drop policy if exists ai_loops_own on ai_loops;
create policy ai_loops_own on ai_loops for select using (auth.uid() = user_id);

commit;
