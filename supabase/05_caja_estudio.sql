-- Estudio desde la caja: marca cada generación con su caja y fija un tope diario de gasto por caja.
-- Idempotente (se puede correr varias veces) y en una sola transacción. Lo aplica el dueño en el SQL Editor de Supabase.
-- ORDEN: correr 04_cajas.sql, luego este archivo y DESPUÉS desplegar el código (la web ya lee `cajas.tope_diario`).
begin;

-- Desde qué caja se pidió la generación (null = desde la web). Sin clave foránea a propósito: si se desvincula una caja
-- (se borra su fila), sus generaciones conservan el rastro de qué gastó. El cobro en `ai_ledger` queda enlazado por su
-- `ref = 'gen:<id>'`, así que no hace falta tocar el ledger.
alter table ai_generations add column if not exists caja_id uuid;
create index if not exists ai_generations_caja_idx on ai_generations (caja_id, created_at desc);

-- Tope diario de créditos por caja (100 por defecto). Lo edita un admin desde /admin.
alter table cajas add column if not exists tope_diario integer not null default 100 check (tope_diario >= 0);

-- Candado por caja: una sola generación a la vez, para que dos peticiones simultáneas no se salten el tope.
-- Caduca solo (por si el servidor muere a mitad de una generación).
alter table cajas add column if not exists generando_hasta timestamptz;

-- Créditos gastados por una caja desde `p_desde` (el inicio del día en Lima lo calcula la app).
-- Cuenta toda fila no fallida con costo, aunque `charged` aún no se haya escrito: contar de más es el lado seguro.
-- No cuenta las generaciones fallidas (se reembolsan) ni las gratis (costo 0).
create or replace function caja_gasto_hoy(p_caja uuid, p_desde timestamptz)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cost_credits), 0)::integer
    from ai_generations
   where caja_id = p_caja
     and cost_credits > 0
     and status <> 'failed'
     and created_at >= p_desde;
$$;

-- Lo mismo para varias cajas a la vez (el panel de admin), con la misma regla y sin el corte de 1000 filas de PostgREST.
create or replace function caja_gasto_hoy_varias(p_cajas uuid[], p_desde timestamptz)
returns table (caja_id uuid, total integer)
language sql
stable
security definer
set search_path = public
as $$
  select g.caja_id, coalesce(sum(g.cost_credits), 0)::integer
    from ai_generations g
   where g.caja_id = any(p_cajas)
     and g.cost_credits > 0
     and g.status <> 'failed'
     and g.created_at >= p_desde
   group by g.caja_id;
$$;

-- Toma el candado de la caja por `p_segundos`. Una sola UPDATE condicional: es atómica, solo una petición lo consigue.
create or replace function caja_candado_tomar(p_caja uuid, p_segundos integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update cajas
     set generando_hasta = now() + make_interval(secs => p_segundos)
   where id = p_caja
     and (generando_hasta is null or generando_hasta < now())
  returning id into v_id;
  return v_id is not null;
end;
$$;

create or replace function caja_candado_soltar(p_caja uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update cajas set generando_hasta = null where id = p_caja;
$$;

revoke all on function caja_gasto_hoy(uuid, timestamptz) from public, anon, authenticated;
grant execute on function caja_gasto_hoy(uuid, timestamptz) to service_role;
revoke all on function caja_gasto_hoy_varias(uuid[], timestamptz) from public, anon, authenticated;
grant execute on function caja_gasto_hoy_varias(uuid[], timestamptz) to service_role;
revoke all on function caja_candado_tomar(uuid, integer) from public, anon, authenticated;
grant execute on function caja_candado_tomar(uuid, integer) to service_role;
revoke all on function caja_candado_soltar(uuid) from public, anon, authenticated;
grant execute on function caja_candado_soltar(uuid) to service_role;

commit;
