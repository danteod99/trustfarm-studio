-- Soporte a distancia: tickets de cada caja, el permiso que da el dueño y los accesos de soporte.
-- Idempotente y en una sola transacción. Solo añade tablas nuevas, sin tocar lo existente.
-- ORDEN: después de 04–12 y ANTES de desplegar el código que la usa. Lo aplica una sesión con acceso al proyecto, con el autorizo de Dante.
--   soporte_tickets:  qué pidió el cliente o soporte. Es lo único que escribe texto libre.
--   soporte_permisos: nivel y minutos que dio el dueño, y cuándo lo aceptó soporte.
--   soporte_accesos:  cada vez que soporte entró. Lo ve el cliente en su ticket.
begin;

-- Guarda del proyecto compartido: no pisar nada que no sea de Empleado IA.
do $$
declare
  t text;
begin
  foreach t in array array['soporte_tickets', 'soporte_permisos', 'soporte_accesos'] loop
    if to_regclass('public.' || t) is not null
       and obj_description(to_regclass('public.' || t), 'pg_class') is distinct from 'empleado-ia/cajas' then
      raise exception 'La tabla % ya existe y no es de Empleado IA: revisa antes de continuar.', t;
    end if;
  end loop;
end
$$;

create table if not exists soporte_tickets (
  id          uuid primary key default gen_random_uuid(),
  caja_id     uuid not null references cajas(id) on delete cascade,
  owner_id    uuid not null,
  abierto_por text not null check (abierto_por in ('cliente', 'soporte')),
  asunto      text not null check (char_length(asunto) between 1 and 2000),
  estado      text not null default 'abierto' check (estado in ('abierto', 'en_atencion', 'cerrado')),
  nota_cierre text check (nota_cierre is null or char_length(nota_cierre) <= 2000),
  creado_en   timestamptz not null default now(),
  cerrado_en  timestamptz
);
create index if not exists soporte_tickets_caja on soporte_tickets (caja_id, owner_id, creado_en desc);
create index if not exists soporte_tickets_estado on soporte_tickets (estado, creado_en desc);
comment on table soporte_tickets is 'empleado-ia/cajas';
alter table soporte_tickets enable row level security; -- sin políticas: solo service_role
revoke all on table soporte_tickets from anon, authenticated;

create table if not exists soporte_permisos (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references soporte_tickets(id) on delete cascade,
  caja_id       uuid not null references cajas(id) on delete cascade,
  nivel         text not null check (nivel in ('app', 'sistema')),
  minutos       integer not null check (minutos between 15 and 10080),
  concedido_en  timestamptz not null default now(),
  aceptado_en   timestamptz,
  aceptado_por  text,
  vence_en      timestamptz,
  cerrado_en    timestamptz,
  motivo_cierre text check (motivo_cierre is null or motivo_cierre in ('vencio', 'cliente', 'soporte', 'ticket'))
);
-- Un solo permiso sin cerrar por caja
create unique index if not exists soporte_permisos_uno_abierto on soporte_permisos (caja_id) where cerrado_en is null;
create index if not exists soporte_permisos_ticket on soporte_permisos (ticket_id);
comment on table soporte_permisos is 'empleado-ia/cajas';
alter table soporte_permisos enable row level security; -- sin políticas: solo service_role
revoke all on table soporte_permisos from anon, authenticated;

create table if not exists soporte_accesos (
  id         uuid primary key default gen_random_uuid(),
  permiso_id uuid not null references soporte_permisos(id) on delete cascade,
  nivel      text not null check (nivel in ('app', 'sistema')),
  quien      text not null,
  entro_en   timestamptz not null default now(),
  termino_en timestamptz
);
create index if not exists soporte_accesos_permiso on soporte_accesos (permiso_id);
comment on table soporte_accesos is 'empleado-ia/cajas';
alter table soporte_accesos enable row level security; -- sin políticas: solo service_role
revoke all on table soporte_accesos from anon, authenticated;

commit;
