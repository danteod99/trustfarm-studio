-- Caja que sale de fábrica con su dirección: una caja puede existir SIN dueño (con su túnel y su dirección ya creados),
-- se activa con una llave de un solo uso y se reclama después con el código de 8 caracteres.
-- Idempotente (se puede correr varias veces) y en una sola transacción. Lo aplica una sesión con acceso al Supabase de producción.
-- ORDEN: 04_cajas.sql, 05_caja_estudio.sql y este archivo, y DESPUÉS desplegar el código.
-- No toca caja_vincular ni caja_desvincular: el flujo antiguo (registrar → código → vincular) sigue funcionando.
begin;

-- Guarda de proyecto compartido (mismo criterio que 04_cajas.sql): no pisar nada que no sea de Empleado IA.
do $$
declare
  f text;
begin
  foreach f in array array[
    'caja_preparar(text,text,text,uuid,text,timestamptz)',
    'caja_nueva_llave(uuid,text,timestamptz)',
    'caja_activar(text,text,text,timestamptz,text,text)',
    'caja_nuevo_codigo(uuid,text,timestamptz)',
    'caja_reclamar(text,uuid,text)',
    'caja_liberar(uuid)'
  ] loop
    if to_regprocedure('public.' || f) is not null
       and obj_description(to_regprocedure('public.' || f), 'pg_proc') is distinct from 'empleado-ia/cajas' then
      raise exception 'La función % ya existe y no es de Empleado IA: revisa antes de continuar.', f;
    end if;
  end loop;
  if to_regclass('public.caja_activaciones') is not null
     and obj_description(to_regclass('public.caja_activaciones'), 'pg_class') is distinct from 'empleado-ia/cajas' then
    raise exception 'La tabla caja_activaciones ya existe y no es de Empleado IA: revisa antes de continuar.';
  end if;
end
$$;

-- Una caja preparada no tiene dueño todavía.
alter table cajas alter column owner_id drop not null;
alter table cajas add column if not exists etiqueta text check (etiqueta is null or char_length(etiqueta) <= 80);
-- Qué administrador la creó (sin clave foránea: el rastro sobrevive aunque se borre el usuario).
alter table cajas add column if not exists creada_por uuid;

-- Llaves de activación: de un solo uso, vencen, y NUNCA se guarda la llave en claro (solo su SHA-256).
create table if not exists caja_activaciones (
  id         uuid primary key default gen_random_uuid(),
  caja_id    uuid not null references cajas(id) on delete cascade,
  llave_hash text not null unique check (llave_hash ~ '^[0-9a-f]{64}$'),
  vence_en   timestamptz not null,
  usada_en   timestamptz,
  created_at timestamptz not null default now()
);
comment on table caja_activaciones is 'empleado-ia/cajas';
create index if not exists caja_activaciones_caja_idx on caja_activaciones (caja_id);
alter table caja_activaciones enable row level security; -- sin políticas: solo service_role

-- Crea la caja SIN dueño y su llave. Tope de 100 cajas sin dueño a la vez (bajo candado: dos admins no lo saltan juntos).
create or replace function caja_preparar(
  p_slug text, p_tunnel_id text, p_etiqueta text, p_admin uuid, p_llave_hash text, p_vence timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caja uuid;
begin
  perform pg_advisory_xact_lock(hashtext('caja_preparar'));
  if (select count(*) from cajas where owner_id is null) >= 100 then
    raise exception 'limite_preparadas';
  end if;
  begin
    insert into cajas (owner_id, nombre, slug, tunnel_id, etiqueta, creada_por)
    values (null, 'Mi caja', p_slug, p_tunnel_id, nullif(left(btrim(p_etiqueta), 80), ''), p_admin)
    returning id into v_caja;
  exception when unique_violation then
    raise exception 'slug_repetido';
  end;
  insert into caja_activaciones (caja_id, llave_hash, vence_en) values (v_caja, p_llave_hash, p_vence);
  return v_caja;
end;
$$;

-- Llave nueva para una caja: invalida las que no se hayan usado.
create or replace function caja_nueva_llave(p_caja uuid, p_llave_hash text, p_vence timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from cajas where id = p_caja) then
    raise exception 'caja_inexistente';
  end if;
  delete from caja_activaciones where caja_id = p_caja and usada_en is null;
  insert into caja_activaciones (caja_id, llave_hash, vence_en) values (p_caja, p_llave_hash, p_vence);
end;
$$;

-- Activa la caja con su llave: consume la llave (una sola UPDATE condicional: solo una petición la consigue) y deja a la
-- caja con su secreto permanente. Si la caja ya tenía registro (reinstalación), se reemplaza su secreto y se CONSERVA el dueño.
create or replace function caja_activar(
  p_llave_hash text, p_secreto_hash text, p_codigo text, p_expira timestamptz, p_version text, p_ip text
) returns table (registro_id uuid, caja_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caja uuid;
  v_registro uuid;
begin
  update caja_activaciones a
     set usada_en = now()
   where a.llave_hash = p_llave_hash
     and a.usada_en is null
     and a.vence_en > now()
  returning a.caja_id into v_caja;
  if v_caja is null then
    raise exception 'llave_invalida';
  end if;

  select r.id into v_registro
    from caja_registros r
   where r.caja_id = v_caja
   order by r.created_at desc
   limit 1
   for update;
  if v_registro is null then
    insert into caja_registros (codigo, secreto_hash, expira_en, caja_id, estado, version, ip)
    values (p_codigo, p_secreto_hash, p_expira, v_caja, 'vinculada', p_version, p_ip)
    returning id into v_registro;
  else
    update caja_registros
       set secreto_hash = p_secreto_hash, codigo = p_codigo, expira_en = p_expira,
           estado = 'vinculada', version = p_version, ip = p_ip
     where id = v_registro;
  end if;
  return query select v_registro, v_caja;
end;
$$;

-- Renueva el código de asociación de una caja que todavía no tiene dueño (false si no aplica).
create or replace function caja_nuevo_codigo(p_registro uuid, p_codigo text, p_expira timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update caja_registros r
     set codigo = p_codigo, expira_en = p_expira
   where r.id = p_registro
     and r.caja_id is not null
     and exists (select 1 from cajas c where c.id = r.caja_id and c.owner_id is null);
  return found;
end;
$$;

-- El cliente escribe el código: la caja pasa a su cuenta. Atómica: con dos clientes a la vez, solo uno la consigue
-- (el segundo espera el candado de la fila y al volver a evaluar ya no encuentra una caja sin dueño).
create or replace function caja_reclamar(p_codigo text, p_owner uuid, p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registro uuid;
  v_caja uuid;
begin
  select r.id, r.caja_id into v_registro, v_caja
    from caja_registros r
    join cajas c on c.id = r.caja_id
   where r.codigo = p_codigo
     and r.expira_en > now()
     and c.owner_id is null
   for update of r, c;
  if v_caja is null then
    raise exception 'codigo_invalido';
  end if;
  update cajas
     set owner_id = p_owner,
         nombre = coalesce(nullif(left(btrim(p_nombre), 60), ''), 'Mi caja'),
         linked_at = now()
   where id = v_caja;
  update caja_registros set expira_en = now() where id = v_registro; -- el código ya se gastó
  return v_caja;
end;
$$;

-- El cliente «quita» la caja de su cuenta: queda sin dueño pero CONSERVA su dirección y su túnel; su código vence ya
-- (la caja pedirá uno nuevo). Borrarla del todo es solo de un administrador (caja_desvincular).
create or replace function caja_liberar(p_caja uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update cajas set owner_id = null where id = p_caja;
  update caja_registros set expira_en = now() where caja_id = p_caja;
end;
$$;

comment on function caja_preparar(text, text, text, uuid, text, timestamptz) is 'empleado-ia/cajas';
comment on function caja_nueva_llave(uuid, text, timestamptz) is 'empleado-ia/cajas';
comment on function caja_activar(text, text, text, timestamptz, text, text) is 'empleado-ia/cajas';
comment on function caja_nuevo_codigo(uuid, text, timestamptz) is 'empleado-ia/cajas';
comment on function caja_reclamar(text, uuid, text) is 'empleado-ia/cajas';
comment on function caja_liberar(uuid) is 'empleado-ia/cajas';

revoke all on function caja_preparar(text, text, text, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function caja_preparar(text, text, text, uuid, text, timestamptz) to service_role;
revoke all on function caja_nueva_llave(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function caja_nueva_llave(uuid, text, timestamptz) to service_role;
revoke all on function caja_activar(text, text, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function caja_activar(text, text, text, timestamptz, text, text) to service_role;
revoke all on function caja_nuevo_codigo(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function caja_nuevo_codigo(uuid, text, timestamptz) to service_role;
revoke all on function caja_reclamar(text, uuid, text) from public, anon, authenticated;
grant execute on function caja_reclamar(text, uuid, text) to service_role;
revoke all on function caja_liberar(uuid) from public, anon, authenticated;
grant execute on function caja_liberar(uuid) to service_role;

commit;
