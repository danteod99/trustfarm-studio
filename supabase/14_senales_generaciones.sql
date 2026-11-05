-- Señales de calidad de cada generación (para armar datasets de entrenamiento con lo que SÍ sirvió).
-- Una fila por (generación, evento): solo importa si pasó, no cuántas veces.
--   download   = el cliente la descargó            (+1)
--   animate    = usó la imagen como 1.er cuadro    (+2)
--   character  = la guardó como personaje          (+2)
--   regenerate = repitió el mismo prompt al rato   (-2, no le gustó)
-- Solo escribe el servidor (service role); el cliente no lee ni escribe esta tabla.
create table if not exists ai_generation_events (
  generation_id uuid not null references ai_generations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  event         text not null check (event in ('download', 'animate', 'character', 'regenerate')),
  created_at    timestamptz not null default now(),
  primary key (generation_id, event)
);
create index if not exists ai_generation_events_event_idx on ai_generation_events (event, created_at desc);
alter table ai_generation_events enable row level security;
