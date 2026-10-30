-- Estudio desde la caja: marca cada generación con su caja y fija un tope diario de gasto por caja.
-- Idempotente (se puede correr varias veces) y en una sola transacción. Lo aplica el dueño en el SQL Editor de Supabase.
-- Requiere haber corrido antes 04_cajas.sql (tabla `cajas`).
begin;

-- Desde qué caja se pidió la generación (null = desde la web). El cobro en `ai_ledger` queda enlazado
-- por su `ref = 'gen:<id>'`, así que no hace falta tocar el ledger.
alter table ai_generations add column if not exists caja_id uuid references cajas(id) on delete set null;
create index if not exists ai_generations_caja_idx on ai_generations (caja_id, created_at desc);

-- Tope diario de créditos por caja (100 por defecto). Lo edita un admin desde /admin.
alter table cajas add column if not exists tope_diario integer not null default 100 check (tope_diario >= 0);

-- Créditos gastados por una caja desde `p_desde` (el inicio del día en Lima lo calcula la app).
-- No cuenta las generaciones fallidas: se reembolsan.
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
     and charged = true
     and status <> 'failed'
     and created_at >= p_desde;
$$;

revoke all on function caja_gasto_hoy(uuid, timestamptz) from public, anon, authenticated;
grant execute on function caja_gasto_hoy(uuid, timestamptz) to service_role;

commit;
