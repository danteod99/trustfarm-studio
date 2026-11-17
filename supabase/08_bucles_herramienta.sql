-- Bucles de herramienta: una herramienta (Multiclipping, Perfil de TikTok) que se repite sola según horario
-- y deja cada resultado como «entrega» para que TrustFarm Desktop la recoja a la carpeta de su bucle de publicación.
-- Idempotente. NO aplicar sin revisar: va al Supabase compartido (jlxaubqvgjahcsnotvih = Studio + TrustMind + desktop).
-- Las tablas viven en `public` (junto a ai_* y clip_jobs, que escribe el servidor con service role) y el desktop
-- NUNCA las toca directo: usa las RPC de `trustfarm` (JWT del usuario) + un endpoint web que firma las descargas.
begin;

-- ───────── Bucles ─────────
create table if not exists tool_loops (
  id                   uuid primary key default gen_random_uuid(),
  owner                uuid not null references auth.users(id) on delete cascade,
  site                 text not null default 'studio',          -- quién lo creó: studio | trustmind
  tool                 text not null check (tool in ('multiclip', 'perfil')),
  name                 text not null default 'Mi bucle',
  params               jsonb not null default '{}'::jsonb,       -- multiclip: {url, kind, channel_id?, clips, preset, subs, titulo, framing}; perfil: {handle, max_videos}
  variacion            text check (variacion is null or variacion in ('pantalla_real')),
  pantalla             text check (pantalla is null or pantalla in ('laptop', 'tv')),
  days                 integer[] not null default '{0,1,2,3,4,5,6}', -- 0 = domingo
  hora                 integer not null default 9 check (hora between 0 and 23),
  minuto               integer not null default 0 check (minuto between 0 and 59),
  tz                   text not null default 'America/Lima' check (tz = 'America/Lima'),
  daily_cap            integer not null default 2 check (daily_cap between 1 and 10),   -- trabajos (cobrados) por día
  max_per_run          integer not null default 1 check (max_per_run between 1 and 5),  -- trabajos por vuelta
  status               text not null default 'active' check (status in ('active', 'paused', 'error', 'no_credits')),
  last_error           text,
  consecutive_failures integer not null default 0,
  next_run_at          timestamptz not null,
  last_run_at          timestamptz,
  cursor               jsonb not null default '{}'::jsonb,       -- {seen: [ids de fuente ya procesados], baseline: bool}
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists tool_loops_due_idx on tool_loops (next_run_at) where status = 'active';
create index if not exists tool_loops_owner_idx on tool_loops (owner, created_at desc);

-- ───────── Vueltas (una por trabajo encolado; el índice único hace idempotente cada vuelta) ─────────
create table if not exists tool_runs (
  id          uuid primary key default gen_random_uuid(),
  loop_id     uuid not null references tool_loops(id) on delete cascade,
  owner       uuid not null references auth.users(id) on delete cascade,
  run_key     text not null,                  -- multiclip: id del video de YouTube; perfil: fecha de Lima (YYYY-MM-DD) + n
  source_ref  text not null,                  -- video de YouTube o @perfil
  lima_day    date not null,                  -- día de Lima de la vuelta (para el tope diario)
  job_id      uuid,                           -- clip_jobs.id
  status      text not null default 'creating' check (status in ('creating', 'running', 'done', 'empty', 'failed')),
  credits     integer not null default 0,
  cobro_ref   text,
  error       text,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create unique index if not exists tool_runs_key_idx on tool_runs (loop_id, run_key);
create index if not exists tool_runs_open_idx on tool_runs (status) where status in ('creating', 'running');
create index if not exists tool_runs_day_idx on tool_runs (loop_id, lima_day);

-- ───────── Entregas (un archivo listo para publicar) ─────────
create table if not exists tool_deliveries (
  id            uuid primary key default gen_random_uuid(),
  loop_id       uuid not null references tool_loops(id) on delete cascade,
  owner         uuid not null references auth.users(id) on delete cascade,
  run_id        uuid references tool_runs(id) on delete set null,
  source_ref    text not null,                -- multiclip: <videoId>#<n>; perfil: id del video de TikTok
  titulo        text not null default '',
  caption       text not null default '',
  storage_path  text not null,                -- bucket `clips`: deliveries/<owner>/<loop>/<archivo>.mp4
  caption_path  text,                         -- gemelo .txt con el caption
  bytes         bigint,
  status        text not null default 'pending_pickup' check (status in ('pending_pickup', 'picked', 'delivered', 'expired', 'failed')),
  attempts      integer not null default 0,
  picked_by     text,                         -- id del desktop que la tomó
  picked_at     timestamptz,
  lease_until   timestamptz,                  -- mientras dure, nadie más la toma; si vence sin ack vuelve a estar disponible
  delivered_at  timestamptz,
  last_error    text,
  purged_at     timestamptz,                  -- archivo ya borrado de la nube (3 días después de entregada)
  expires_at    timestamptz not null default (now() + interval '7 days'),
  created_at    timestamptz not null default now()
);
create unique index if not exists tool_deliveries_src_idx on tool_deliveries (loop_id, source_ref);
create index if not exists tool_deliveries_owner_idx on tool_deliveries (owner, status, created_at);
create index if not exists tool_deliveries_exp_idx on tool_deliveries (expires_at) where status in ('pending_pickup', 'picked');

-- ───────── RLS: el dueño solo LEE; escribe únicamente el servidor (service role) ─────────
alter table tool_loops      enable row level security;
alter table tool_runs       enable row level security;
alter table tool_deliveries enable row level security;
drop policy if exists tool_loops_own on tool_loops;
create policy tool_loops_own on tool_loops for select using (auth.uid() = owner);
drop policy if exists tool_runs_own on tool_runs;
create policy tool_runs_own on tool_runs for select using (auth.uid() = owner);
drop policy if exists tool_deliveries_own on tool_deliveries;
create policy tool_deliveries_own on tool_deliveries for select using (auth.uid() = owner);

-- ───────── Reclamo de bucles vencidos (solo servidor) ─────────
-- FOR UPDATE SKIP LOCKED: dos ticks (Mac mini + cron de Vercel) nunca toman el mismo bucle. El reclamo deja un
-- arrendamiento de 10 min en next_run_at; al terminar la vuelta el servidor lo pasa a la próxima fecha real.
create or replace function public.tool_claim_due_loops(p_limit integer default 10)
returns setof tool_loops
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with due as (
    select id from tool_loops
     where status = 'active' and next_run_at <= now()
     order by next_run_at
     limit greatest(1, least(p_limit, 50))
     for update skip locked
  )
  update tool_loops l
     set next_run_at = now() + interval '10 minutes', updated_at = now()
    from due
   where l.id = due.id
  returning l.*;
end;
$$;
revoke all on function public.tool_claim_due_loops(integer) from public, anon, authenticated;
grant execute on function public.tool_claim_due_loops(integer) to service_role;

-- ───────── RPC del desktop (schema trustfarm, JWT del usuario; nunca service role) ─────────
create schema if not exists trustfarm;

-- Toma hasta p_limit entregas del usuario y las marca `picked` con arrendamiento de 30 min.
create or replace function trustfarm.claim_deliveries(p_desktop_id text, p_limit integer default 5)
returns table (
  id uuid, loop_id uuid, tool text, loop_name text, variacion text, source_ref text, titulo text, caption text,
  storage_path text, caption_path text, bytes bigint, attempts integer, expires_at timestamptz, created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- Las que agotaron intentos (5 recogidas sin ack) pasan a failed en vez de rondar para siempre.
  update tool_deliveries d set status = 'failed', last_error = coalesce(d.last_error, 'sin confirmar tras 5 intentos')
   where d.owner = v_uid and d.status = 'picked' and d.lease_until < now() and d.attempts >= 5;
  update tool_deliveries d set status = 'expired'
   where d.owner = v_uid and d.status in ('pending_pickup', 'picked') and d.expires_at <= now();

  return query
  with pick as (
    select d.id from tool_deliveries d
     where d.owner = v_uid and d.expires_at > now() and d.attempts < 5
       and (d.status = 'pending_pickup' or (d.status = 'picked' and d.lease_until < now()))
     order by d.created_at
     limit greatest(1, least(coalesce(p_limit, 5), 20))
     for update skip locked
  ), upd as (
    update tool_deliveries d
       set status = 'picked', picked_at = now(), picked_by = left(coalesce(p_desktop_id, ''), 80),
           lease_until = now() + interval '30 minutes', attempts = d.attempts + 1
      from pick where d.id = pick.id
    returning d.*
  )
  select u.id, u.loop_id, l.tool, l.name, l.variacion, u.source_ref, u.titulo, u.caption,
         u.storage_path, u.caption_path, u.bytes, u.attempts, u.expires_at, u.created_at
    from upd u join tool_loops l on l.id = u.loop_id
   order by u.created_at;
end;
$$;

-- Confirma que el archivo ya está en la carpeta del bucle del desktop. Idempotente (devuelve true si ya estaba entregada).
create or replace function trustfarm.ack_delivery(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  update tool_deliveries set status = 'delivered', delivered_at = now(), lease_until = null
   where id = p_id and owner = v_uid and status = 'picked';
  get diagnostics v_n = row_count;
  if v_n > 0 then return true; end if;
  return exists (select 1 from tool_deliveries where id = p_id and owner = v_uid and status = 'delivered');
end;
$$;

-- El desktop no pudo copiar/descargar: vuelve a la cola (o `failed` si ya se intentó 5 veces).
create or replace function trustfarm.release_delivery(p_id uuid, p_error text default null)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  update tool_deliveries
     set status = case when attempts >= 5 then 'failed' else 'pending_pickup' end,
         lease_until = null, last_error = left(p_error, 300)
   where id = p_id and owner = v_uid and status = 'picked';
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

revoke all on function trustfarm.claim_deliveries(text, integer) from public, anon;
revoke all on function trustfarm.ack_delivery(uuid) from public, anon;
revoke all on function trustfarm.release_delivery(uuid, text) from public, anon;
grant execute on function trustfarm.claim_deliveries(text, integer) to authenticated;
grant execute on function trustfarm.ack_delivery(uuid) to authenticated;
grant execute on function trustfarm.release_delivery(uuid, text) to authenticated;

commit;
