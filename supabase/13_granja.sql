-- Modo Granja (fase B): cuentas de la granja de cada usuario (TikTok, Instagram, Facebook, YouTube).
-- Idempotente: se puede correr varias veces. Pegar en el SQL Editor de Supabase (proyecto jlxaubqvgjahcsnotvih).
-- La app escribe con service role; RLS deja a cada usuario ver y editar solo lo suyo.
-- Límite por usuario (1.000 cuentas) lo controla la app (app/lib/granja.ts → MAX_FARM_ACCOUNTS).
begin;

create table if not exists farm_accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  handle     text not null check (char_length(handle) between 1 and 60),
  network    text not null check (network in ('tiktok', 'instagram', 'facebook', 'youtube')),
  preset_id  uuid references ai_presets(id) on delete set null,
  notes      text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists farm_accounts_user_idx on farm_accounts (user_id, created_at);
-- Una misma cuenta no se guarda dos veces (la app guarda el handle en minúsculas y sin @).
create unique index if not exists farm_accounts_user_handle_uidx on farm_accounts (user_id, network, handle);

alter table farm_accounts enable row level security;

drop policy if exists farm_accounts_select_own on farm_accounts;
create policy farm_accounts_select_own on farm_accounts for select using (auth.uid() = user_id);
drop policy if exists farm_accounts_insert_own on farm_accounts;
create policy farm_accounts_insert_own on farm_accounts for insert with check (auth.uid() = user_id);
drop policy if exists farm_accounts_update_own on farm_accounts;
create policy farm_accounts_update_own on farm_accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists farm_accounts_delete_own on farm_accounts;
create policy farm_accounts_delete_own on farm_accounts for delete using (auth.uid() = user_id);

revoke all on farm_accounts from anon;
grant select, insert, update, delete on farm_accounts to authenticated;
grant all on farm_accounts to service_role;

commit;
