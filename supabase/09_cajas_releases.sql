-- Actualizaciones automáticas firmadas de las mini PC (Empleado IA).
-- Idempotente. Solo añade dos tablas (nuevas) con la marca 'empleado-ia/cajas'; no toca nada existente. Aplicar DESPUÉS de 04–08.
--   cajas_releases:         versiones publicadas (url del paquete, huella, firma Ed25519 y % de la tanda). La firma la pone el dueño en su PC.
--   cajas_actualizaciones:  cómo le fue a cada caja (solo versión, ok y un detalle corto; sin datos del negocio).
begin;

-- Guarda del proyecto compartido: si ya existe una tabla con ese nombre y no es nuestra, no se continúa.
do $$
declare t text;
begin
  foreach t in array array['cajas_releases', 'cajas_actualizaciones'] loop
    if to_regclass('public.' || t) is not null
       and obj_description(to_regclass('public.' || t), 'pg_class') is distinct from 'empleado-ia/cajas' then
      raise exception 'La tabla % ya existe y no es de Empleado IA: revisa antes de continuar.', t;
    end if;
  end loop;
end
$$;

create table if not exists cajas_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique check (version ~ '^\d{1,4}\.\d{1,4}\.\d{1,4}$'),
  url text not null check (url ~ '^https://'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  tamano integer not null check (tamano > 0 and tamano <= 52428800),
  firma text not null check (char_length(firma) between 80 and 100),
  porcentaje integer not null default 5 check (porcentaje between 0 and 100),
  notas text check (notas is null or char_length(notas) <= 500),
  creada_en timestamptz not null default now()
);

create table if not exists cajas_actualizaciones (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null,
  version text not null check (version ~ '^\d{1,4}\.\d{1,4}\.\d{1,4}$'),
  ok boolean not null,
  detalle text check (detalle is null or char_length(detalle) <= 120),
  creada_en timestamptz not null default now()
);
create index if not exists cajas_actualizaciones_registro on cajas_actualizaciones (registro_id, creada_en desc);

comment on table cajas_releases is 'empleado-ia/cajas';
comment on table cajas_actualizaciones is 'empleado-ia/cajas';

-- Solo el servidor (service_role) las lee y escribe: sin políticas = nadie más.
alter table cajas_releases enable row level security;
alter table cajas_actualizaciones enable row level security;
revoke all on cajas_releases from anon, authenticated;
revoke all on cajas_actualizaciones from anon, authenticated;

commit;
