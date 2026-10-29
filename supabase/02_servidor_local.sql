-- Servidor local: señal de vida + cola que solo entrega trabajos marcados para la GPU de casa.
-- Correr DESPUÉS de schema.sql. Idempotente.

create table if not exists ai_workers (
  id        text primary key,
  models    text[] not null default '{}',
  last_seen timestamptz not null default now(),
  info      jsonb not null default '{}'::jsonb
);
alter table ai_workers enable row level security; -- sin políticas: solo service_role

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
