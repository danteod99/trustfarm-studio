-- Cajas (Empleado IA): vinculación de cajas con cuentas, registros con código y límite de intentos.
-- Correr DESPUÉS de schema.sql (usa auth.users). Idempotente y no destructivo: pegar en el SQL Editor.

create table if not exists cajas (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  nombre     text not null default 'Mi caja',
  slug       text not null unique check (slug ~ '^[a-z0-9]{8}$'),
  tunnel_id  text not null,
  last_seen  timestamptz,
  version    text,
  created_at timestamptz default now(),
  linked_at  timestamptz default now()
);
create index if not exists cajas_owner_idx on cajas (owner_id);

create table if not exists caja_registros (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,          -- 8 caracteres normalizados, sin guion
  secreto_hash text not null,                -- SHA-256 hex del secreto de la caja
  expira_en   timestamptz not null,
  caja_id     uuid references cajas(id) on delete set null,
  estado      text not null default 'pendiente' check (estado in ('pendiente','vinculada','desvinculada')),
  version     text,
  ip          text,
  created_at  timestamptz default now()
);
create index if not exists caja_registros_expira_idx on caja_registros (expira_en);
create index if not exists caja_registros_caja_idx on caja_registros (caja_id);

create table if not exists caja_intentos (
  id     bigserial primary key,
  clave  text not null,
  creado timestamptz not null default now()
);
create index if not exists caja_intentos_clave_idx on caja_intentos (clave, creado desc);

alter table cajas          enable row level security;
alter table caja_registros enable row level security; -- sin políticas: solo service_role
alter table caja_intentos  enable row level security; -- sin políticas: solo service_role

-- El dueño solo LEE sus cajas; ninguna política de escritura (se escribe con service_role).
drop policy if exists "cajas_select_owner" on cajas;
create policy "cajas_select_owner" on cajas for select using (auth.uid() = owner_id);

-- Vincular un código a una cuenta, de forma ATÓMICA.
-- Por qué es atómica: la función corre en una sola transacción y el "reclamo" del código es
-- UN solo UPDATE condicional (estado='pendiente', caja_id is null, no vencido). Si dos clientes
-- envían el mismo código a la vez, ambos UPDATE apuntan a la misma fila: Postgres bloquea la fila
-- para el primero; el segundo espera, y al desbloquearse re-evalúa el WHERE contra la fila ya
-- modificada (estado='vinculada'), ya no coincide y afecta 0 filas. Gana uno solo; el otro recibe
-- 'codigo_invalido' (mismo error para inexistente, vencido o ya usado). Si algo falla después
-- (p. ej. slug repetido), toda la transacción se revierte y el código sigue disponible.
create or replace function caja_vincular(
  p_codigo text, p_owner uuid, p_nombre text, p_slug text, p_tunnel_id text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registro uuid;
  v_caja uuid;
begin
  update caja_registros
     set estado = 'vinculada'
   where codigo = p_codigo
     and estado = 'pendiente'
     and caja_id is null
     and expira_en > now()
  returning id into v_registro;

  if v_registro is null then
    raise exception 'codigo_invalido';
  end if;

  -- Si el slug choca, la violación de unicidad se propaga (y revierte el UPDATE): el llamador reintenta.
  insert into cajas (owner_id, nombre, slug, tunnel_id)
  values (p_owner, coalesce(nullif(p_nombre, ''), 'Mi caja'), p_slug, p_tunnel_id)
  returning id into v_caja;

  update caja_registros set caja_id = v_caja where id = v_registro;

  return v_caja;
end;
$$;
revoke all on function caja_vincular(text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function caja_vincular(text, uuid, text, text, text) to service_role;

-- Desvincular, atómico: marca los registros de la caja y borra la caja en la misma transacción.
-- El caja_id de los registros queda en null por "on delete set null".
create or replace function caja_desvincular(p_caja uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update caja_registros set estado = 'desvinculada' where caja_id = p_caja;
  delete from cajas where id = p_caja;
end;
$$;
revoke all on function caja_desvincular(uuid) from public, anon, authenticated;
grant execute on function caja_desvincular(uuid) to service_role;
