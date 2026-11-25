-- Pulso del desktop: cada vuelta de recogida (cada ~7 min, con la app abierta y la sesión iniciada) avisa que está vivo.
-- La web lo lee con service role para mostrar «Desktop conectado» en Bucles. Idempotente.
-- Va al Supabase compartido (jlxaubqvgjahcsnotvih). Nada se rompe si no se aplica: el desktop ignora el error y la web
-- muestra «sin datos».
begin;

create table if not exists public.desktop_pulse (
  owner      uuid not null references auth.users(id) on delete cascade,
  desktop_id text not null,
  last_seen  timestamptz not null default now(),
  primary key (owner, desktop_id)
);
alter table public.desktop_pulse enable row level security; -- sin políticas: solo service role y la RPC

create schema if not exists trustfarm;

create or replace function trustfarm.desktop_heartbeat(p_desktop_id text)
returns void
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
  if p_desktop_id is null or length(p_desktop_id) not between 1 and 100 then
    raise exception 'invalid_desktop_id' using errcode = '22023';
  end if;
  insert into desktop_pulse (owner, desktop_id, last_seen) values (v_uid, p_desktop_id, now())
  on conflict (owner, desktop_id) do update set last_seen = now();
end;
$$;

revoke all on function trustfarm.desktop_heartbeat(text) from public, anon;
grant execute on function trustfarm.desktop_heartbeat(text) to authenticated;

commit;
