-- TrustFarm Studio — esquema en el MISMO proyecto Supabase de trustmind.online (jlxaubqvgjahcsnotvih).
-- Login compartido (auth.users), pero los créditos IA viven aparte de smm_balances:
-- lo que se paga con Stripe solo puede gastarse en generar imágenes y video.
-- Correr una vez en el SQL Editor. Es idempotente.

-- ───────── Saldo de créditos IA ─────────
create table if not exists ai_wallets (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  credits    integer not null default 0 check (credits >= 0),
  updated_at timestamptz not null default now()
);

-- Cada movimiento de créditos. `ref` único = idempotencia (sesión de Stripe, reembolso de un trabajo…).
create table if not exists ai_ledger (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  delta         integer not null,
  balance_after integer,
  reason        text not null,
  ref           text unique,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists ai_ledger_user_idx on ai_ledger (user_id, created_at desc);

-- ───────── Trabajos de generación ─────────
create table if not exists ai_generations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('image', 'video')),
  model        text not null,
  prompt       text not null,
  params       jsonb not null default '{}'::jsonb,
  status       text not null default 'queued'
               check (status in ('queued', 'running', 'finalizing', 'done', 'failed')),
  cost_credits integer not null default 0,
  charged      boolean not null default false,
  provider_ref jsonb,           -- operación de Veo / URLs de cola de fal
  output_path  text,            -- ruta en el bucket ai-media
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ai_generations_user_idx on ai_generations (user_id, created_at desc);
create index if not exists ai_generations_active_idx on ai_generations (status) where status in ('queued', 'running', 'finalizing');

-- ───────── RLS: el usuario solo LEE lo suyo; todo lo que escribe pasa por el servidor ─────────
alter table ai_wallets     enable row level security;
alter table ai_ledger      enable row level security;
alter table ai_generations enable row level security;

drop policy if exists ai_wallets_own on ai_wallets;
create policy ai_wallets_own on ai_wallets for select using (auth.uid() = user_id);
drop policy if exists ai_ledger_own on ai_ledger;
create policy ai_ledger_own on ai_ledger for select using (auth.uid() = user_id);
drop policy if exists ai_generations_own on ai_generations;
create policy ai_generations_own on ai_generations for select using (auth.uid() = user_id);

-- ───────── Cobro atómico ─────────
create or replace function ai_charge(p_user uuid, p_amount integer, p_reason text, p_ref text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  update ai_wallets
     set credits = credits - p_amount, updated_at = now()
   where user_id = p_user and credits >= p_amount
  returning credits into v_balance;

  if v_balance is null then
    raise exception 'insufficient_credits';
  end if;

  insert into ai_ledger (user_id, delta, balance_after, reason, ref)
  values (p_user, -p_amount, v_balance, p_reason, p_ref);

  return v_balance;
end;
$$;

-- ───────── Abono idempotente (Stripe, reembolsos, regalos del admin) ─────────
create or replace function ai_credit(p_user uuid, p_amount integer, p_reason text, p_ref text default null,
                                     p_meta jsonb default '{}'::jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger  bigint;
  v_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  insert into ai_ledger (user_id, delta, reason, ref, meta)
  values (p_user, p_amount, p_reason, p_ref, coalesce(p_meta, '{}'::jsonb))
  on conflict (ref) do nothing
  returning id into v_ledger;

  if v_ledger is null then
    -- Ya acreditado antes (webhook repetido / reembolso doble): no hacer nada.
    select credits into v_balance from ai_wallets where user_id = p_user;
    return coalesce(v_balance, 0);
  end if;

  insert into ai_wallets (user_id, credits) values (p_user, p_amount)
  on conflict (user_id) do update set credits = ai_wallets.credits + excluded.credits, updated_at = now()
  returning credits into v_balance;

  update ai_ledger set balance_after = v_balance where id = v_ledger;
  return v_balance;
end;
$$;

revoke all on function ai_charge(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function ai_credit(uuid, integer, text, text, jsonb) from public, anon, authenticated;
grant execute on function ai_charge(uuid, integer, text, text) to service_role;
grant execute on function ai_credit(uuid, integer, text, text, jsonb) to service_role;

-- ───────── Bucket privado para los resultados ─────────
insert into storage.buckets (id, name, public)
values ('ai-media', 'ai-media', false)
on conflict (id) do nothing;

-- ───────── Buscar usuario por email (para que el admin regale créditos) ─────────
create or replace function ai_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke all on function ai_user_id_by_email(text) from public, anon, authenticated;
grant execute on function ai_user_id_by_email(text) to service_role;

-- ───────── Servidor local (GPU en casa) ─────────
-- El servidor de casa NO recibe conexiones: él pregunta a Supabase si hay trabajos
-- pendientes de sus modelos, toma uno (sin que dos servidores tomen el mismo) y lo procesa.
alter table ai_generations add column if not exists worker text;

create or replace function ai_claim_job(p_worker text, p_models text[])
returns setof ai_generations
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update ai_generations g
     set status = 'running', worker = p_worker, updated_at = now()
   where g.id = (
     select id from ai_generations
      where status = 'queued' and model = any(p_models) and provider_ref->>'local' = 'true'
      order by created_at
      for update skip locked
      limit 1
   )
  returning g.*;
end;
$$;
revoke all on function ai_claim_job(text, text[]) from public, anon, authenticated;
grant execute on function ai_claim_job(text, text[]) to service_role;

-- Señal de vida de cada servidor local (ver supabase/02_servidor_local.sql).
create table if not exists ai_workers (
  id        text primary key,
  models    text[] not null default '{}',
  last_seen timestamptz not null default now(),
  info      jsonb not null default '{}'::jsonb
);
alter table ai_workers enable row level security;
