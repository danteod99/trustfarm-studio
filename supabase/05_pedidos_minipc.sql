-- Pedidos de la mini PC (TRUST Assistant): un registro por pago de Stripe Checkout.
-- Correr DESPUÉS de schema.sql (usa auth.users). Idempotente y no destructivo: pegar en el SQL Editor.
-- Todo va en UNA transacción: si la guarda de abajo se detiene, no se crea ni se cambia nada.

begin;

-- Guarda para el proyecto compartido (trustmind.online usa el mismo Supabase): si ya hay una tabla
-- pedidos_minipc que NO creó este script (no lleva la marca 'empleado-ia/minipc'), se detiene sin tocar nada.
-- La primera vez no existe (to_regclass da NULL) y sigue; las siguientes existen con la marca que este
-- mismo script les pone, y también sigue.
do $$
begin
  if to_regclass('public.pedidos_minipc') is not null
     and obj_description(to_regclass('public.pedidos_minipc'), 'pg_class') is distinct from 'empleado-ia/minipc' then
    raise exception 'La tabla pedidos_minipc ya existe y no es de Empleado IA: revisa antes de continuar.';
  end if;
end
$$;

create table if not exists pedidos_minipc (
  id                    uuid primary key default gen_random_uuid(),
  -- Los pedidos son registro de dinero: si se borra la cuenta, el pedido permanece con user_id en null.
  user_id               uuid references auth.users(id) on delete set null,
  -- NULL cuando el plan de la sesión es desconocido (el pedido queda en 'revisar').
  plan_id               text check (plan_id is null or plan_id in ('basico', 'pro', 'negocio')),
  -- Único: si Stripe reintenta el webhook, el insert falla con 23505 y se trata como duplicado.
  stripe_session_id     text not null unique,
  stripe_payment_intent text,
  stripe_customer       text,
  monto_centavos        integer not null check (monto_centavos >= 0),
  moneda                text not null,
  estado                text not null default 'pagado' check (estado in ('pagado', 'revisar', 'enviado', 'entregado', 'reembolsado', 'cancelado')),
  envio                 jsonb,
  telefono              text,
  email                 text,
  nota_revision         text,
  seguimiento           text check (char_length(seguimiento) <= 120),
  creado                timestamptz not null default now(),
  enviado_en            timestamptz,
  entregado_en          timestamptz
);
comment on table pedidos_minipc is 'empleado-ia/minipc';
create index if not exists pedidos_minipc_creado_idx on pedidos_minipc (creado desc);
create index if not exists pedidos_minipc_estado_idx on pedidos_minipc (estado);

alter table pedidos_minipc enable row level security;

-- El dueño solo LEE sus pedidos; ninguna política de escritura (se escribe con service_role).
drop policy if exists "pedidos_minipc_select_owner" on pedidos_minipc;
create policy "pedidos_minipc_select_owner" on pedidos_minipc for select using (auth.uid() = user_id);

commit;
