-- Personajes y estilos guardados ("biblia del canal"): se anteponen al prompt para que
-- el mismo personaje salga igual en todas las escenas. Correr DESPUÉS de schema.sql. Idempotente.

create table if not exists ai_presets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('character', 'style')),
  name        text not null,
  description text not null,
  image_path  text,            -- foto de referencia en el bucket ai-media (solo personajes)
  created_at  timestamptz not null default now()
);
create index if not exists ai_presets_user_idx on ai_presets (user_id, created_at desc);

alter table ai_presets enable row level security;
drop policy if exists ai_presets_own on ai_presets;
create policy ai_presets_own on ai_presets for select using (auth.uid() = user_id);
