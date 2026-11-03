-- Caja asignada a una cuenta: el administrador crea la caja PARA un correo y solo esa cuenta puede vincularla.
-- Idempotente y en una sola transacción. Solo añade columnas (nullable) y UNA función nueva marcada 'empleado-ia/cajas'; no toca nada existente.
-- ORDEN: después de 04, 08 (y 09); y ANTES de desplegar el código que la usa. Lo aplica una sesión con acceso al Supabase de producción.
--   cajas.email_asignado:           correo (minúsculas) de la cuenta a la que va dirigida la caja; null = caja sin cuenta asignada.
--   caja_registros.email_validado:  correo que el cliente escribió en la mini PC y para el que SÍ hay una caja asignada libre.
--   caja_vincular_asignada():       une el registro de la mini PC con la caja asignada más antigua y libre de ese correo (atómico).
begin;

-- Guarda del proyecto compartido: no pisar una función ajena con el mismo nombre.
do $$
begin
  if to_regprocedure('public.caja_vincular_asignada(text,uuid,text,text)') is not null
     and obj_description(to_regprocedure('public.caja_vincular_asignada(text,uuid,text,text)'), 'pg_proc') is distinct from 'empleado-ia/cajas' then
    raise exception 'La función caja_vincular_asignada ya existe y no es de Empleado IA: revisa antes de continuar.';
  end if;
end
$$;

alter table cajas add column if not exists email_asignado text
  check (email_asignado is null or (char_length(email_asignado) <= 254 and email_asignado = lower(btrim(email_asignado))));
alter table caja_registros add column if not exists email_validado text
  check (email_validado is null or (char_length(email_validado) <= 254 and email_validado = lower(btrim(email_validado))));

-- Búsqueda de la caja libre de un correo (sin dueño y sin mini PC unida todavía).
create index if not exists cajas_email_asignado_libres on cajas (email_asignado, created_at) where owner_id is null and email_asignado is not null;

create or replace function caja_vincular_asignada(p_codigo text, p_owner uuid, p_email text, p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registro uuid;
  v_caja uuid;
begin
  -- El registro debe estar pendiente, vigente y con ESE correo ya validado en la mini PC.
  select r.id into v_registro
    from caja_registros r
   where r.codigo = p_codigo
     and r.estado = 'pendiente'
     and r.caja_id is null
     and r.expira_en > now()
     and r.email_validado = p_email
   for update;
  if v_registro is null then
    raise exception 'codigo_invalido';
  end if;

  -- La caja asignada más antigua de ese correo que sigue libre; skip locked: dos vínculos a la vez no toman la misma.
  select c.id into v_caja
    from cajas c
   where c.owner_id is null
     and c.email_asignado = p_email
     and not exists (select 1 from caja_registros x where x.caja_id = c.id)
   order by c.created_at
   limit 1
   for update skip locked;
  if v_caja is null then
    raise exception 'sin_caja_asignada';
  end if;

  update cajas
     set owner_id = p_owner,
         nombre = coalesce(nullif(left(btrim(p_nombre), 60), ''), 'Mi caja'),
         linked_at = now()
   where id = v_caja;
  update caja_registros set estado = 'vinculada', caja_id = v_caja where id = v_registro;
  return v_caja;
end;
$$;

comment on function caja_vincular_asignada(text, uuid, text, text) is 'empleado-ia/cajas';
revoke all on function caja_vincular_asignada(text, uuid, text, text) from public, anon, authenticated;
grant execute on function caja_vincular_asignada(text, uuid, text, text) to service_role;

commit;
