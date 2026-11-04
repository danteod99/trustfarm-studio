-- Pasarela de IA: las mini PC usan la cuenta de Anthropic del negocio y el consumo se descuenta de los créditos de la cuenta dueña.
-- Idempotente y en una sola transacción. Solo añade columnas con valor por defecto, una tabla y dos funciones marcadas 'empleado-ia/cajas'.
-- ORDEN: después de 04–10 y ANTES de desplegar el código que la usa. Lo aplica una sesión con acceso al Supabase de producción.
--   caja_ia_consumo:     consumo por caja, día y modelo. Solo números: NUNCA el contenido de las conversaciones.
--   ia_fraccion_micro:   lo acumulado o debido en millonésimas de crédito. El saldo es entero y un mensaje cuesta una fracción.
begin;

-- Guarda del proyecto compartido: no pisar nada que no sea de Empleado IA.
do $$
declare
  f text;
begin
  foreach f in array array[
    'caja_ia_registrar(uuid,uuid,date,text,bigint,bigint,bigint,bigint,bigint,bigint,text,boolean)',
    'caja_ia_gasto_hoy(uuid,date,text)'
  ] loop
    if to_regprocedure('public.' || f) is not null
       and obj_description(to_regprocedure('public.' || f), 'pg_proc') is distinct from 'empleado-ia/cajas' then
      raise exception 'La función % ya existe y no es de Empleado IA: revisa antes de continuar.', f;
    end if;
  end loop;
  if to_regclass('public.caja_ia_consumo') is not null
     and obj_description(to_regclass('public.caja_ia_consumo'), 'pg_class') is distinct from 'empleado-ia/cajas' then
    raise exception 'La tabla caja_ia_consumo ya existe y no es de Empleado IA: revisa antes de continuar.';
  end if;
end
$$;

alter table cajas add column if not exists ia_fraccion_micro bigint not null default 0;
alter table cajas add column if not exists tope_diario_ia integer not null default 100 check (tope_diario_ia between 0 and 10000);
alter table cajas add column if not exists ia_bloqueada boolean not null default false;

create table if not exists caja_ia_consumo (
  caja_id         uuid not null references cajas(id) on delete cascade,
  dia             date not null,
  modelo          text not null,
  solicitudes     bigint not null default 0,
  entrada         bigint not null default 0,
  salida          bigint not null default 0,
  cache_lectura   bigint not null default 0,
  cache_escritura bigint not null default 0,
  costo_microusd  bigint not null default 0,
  creditos_micro  bigint not null default 0,
  ip_hash         text,
  cambios_ip      integer not null default 0,
  primary key (caja_id, dia, modelo)
);
comment on table caja_ia_consumo is 'empleado-ia/cajas';
alter table caja_ia_consumo enable row level security; -- sin políticas: solo service_role
revoke all on caja_ia_consumo from anon, authenticated;

-- Registra una solicitud y cobra los créditos enteros que ya se completaron. Si no alcanza el saldo, lo que falta queda en la fracción
-- y se cobra al recargar. Devuelve el saldo y cuántos créditos se cobraron ahora. p_cobrar = false: cuenta administradora.
create or replace function caja_ia_registrar(
  p_caja uuid, p_user uuid, p_dia date, p_modelo text,
  p_entrada bigint, p_salida bigint, p_cache_lectura bigint, p_cache_escritura bigint,
  p_costo_microusd bigint, p_microcreditos bigint, p_ip_hash text, p_cobrar boolean
) returns table (saldo integer, cobrados integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fraccion bigint;
  v_credits integer;
  v_cobrar integer := 0;
begin
  -- Siempre en este orden (caja, luego saldo): dos solicitudes a la vez se esperan y no se cruzan
  select ia_fraccion_micro into v_fraccion from cajas where id = p_caja for update;
  if v_fraccion is null then
    raise exception 'caja_inexistente';
  end if;
  select credits into v_credits from ai_wallets where user_id = p_user for update;
  v_credits := coalesce(v_credits, 0);

  insert into caja_ia_consumo as c (caja_id, dia, modelo, solicitudes, entrada, salida, cache_lectura, cache_escritura, costo_microusd, creditos_micro, ip_hash)
  values (p_caja, p_dia, p_modelo, 1, p_entrada, p_salida, p_cache_lectura, p_cache_escritura, p_costo_microusd, p_microcreditos, p_ip_hash)
  on conflict (caja_id, dia, modelo) do update set
    solicitudes = c.solicitudes + 1,
    entrada = c.entrada + excluded.entrada,
    salida = c.salida + excluded.salida,
    cache_lectura = c.cache_lectura + excluded.cache_lectura,
    cache_escritura = c.cache_escritura + excluded.cache_escritura,
    costo_microusd = c.costo_microusd + excluded.costo_microusd,
    creditos_micro = c.creditos_micro + excluded.creditos_micro,
    cambios_ip = c.cambios_ip + (case when c.ip_hash is distinct from excluded.ip_hash then 1 else 0 end),
    ip_hash = excluded.ip_hash;

  if p_cobrar then
    v_fraccion := v_fraccion + p_microcreditos;
    v_cobrar := least((v_fraccion / 1000000)::integer, v_credits);
    if v_cobrar > 0 then
      v_credits := v_credits - v_cobrar;
      update ai_wallets set credits = v_credits, updated_at = now() where user_id = p_user;
      insert into ai_ledger (user_id, delta, balance_after, reason, ref)
      values (p_user, -v_cobrar, v_credits, 'ia', 'ia:' || p_caja || ':' || gen_random_uuid());
      v_fraccion := v_fraccion - v_cobrar * 1000000::bigint;
    end if;
    update cajas set ia_fraccion_micro = v_fraccion where id = p_caja;
  end if;

  return query select v_credits, v_cobrar;
end;
$$;

-- Micro-créditos gastados por una caja un día con un modelo (para los topes diarios).
create or replace function caja_ia_gasto_hoy(p_caja uuid, p_dia date, p_modelo text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select creditos_micro from caja_ia_consumo where caja_id = p_caja and dia = p_dia and modelo = p_modelo), 0);
$$;

comment on function caja_ia_registrar(uuid, uuid, date, text, bigint, bigint, bigint, bigint, bigint, bigint, text, boolean) is 'empleado-ia/cajas';
comment on function caja_ia_gasto_hoy(uuid, date, text) is 'empleado-ia/cajas';
revoke all on function caja_ia_registrar(uuid, uuid, date, text, bigint, bigint, bigint, bigint, bigint, bigint, text, boolean) from public, anon, authenticated;
grant execute on function caja_ia_registrar(uuid, uuid, date, text, bigint, bigint, bigint, bigint, bigint, bigint, text, boolean) to service_role;
revoke all on function caja_ia_gasto_hoy(uuid, date, text) from public, anon, authenticated;
grant execute on function caja_ia_gasto_hoy(uuid, date, text) to service_role;

commit;
