-- Buscador de cuentas registradas para el panel de administración (crear una caja para una cuenta).
-- Idempotente y en una sola transacción. Solo añade UNA función de lectura marcada 'empleado-ia/cajas'; no toca nada existente.
-- ORDEN: antes de desplegar el código que la usa. Lo aplica una sesión con acceso al Supabase de producción.
begin;

-- Guarda del proyecto compartido: no pisar una función ajena con el mismo nombre.
do $$
begin
  if to_regprocedure('public.caja_buscar_cuentas(text)') is not null
     and obj_description(to_regprocedure('public.caja_buscar_cuentas(text)'), 'pg_proc') is distinct from 'empleado-ia/cajas' then
    raise exception 'La función caja_buscar_cuentas ya existe y no es de Empleado IA: revisa antes de continuar.';
  end if;
end
$$;

-- Hasta 8 cuentas cuyo correo contiene el texto, primero las que empiezan por él. % y _ se buscan como texto normal.
-- con_google: para vincular una caja hay que entrar con Google; el panel avisa si la cuenta todavía no lo ha hecho.
create or replace function caja_buscar_cuentas(p_texto text)
returns table (id uuid, email text, con_google boolean)
language sql
stable
security definer
set search_path = public, auth
as $$
  with t as (
    select replace(replace(replace(lower(btrim(p_texto)), '\', '\\'), '%', '\%'), '_', '\_') as q
  )
  select u.id, u.email::text,
         exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google')
    from auth.users u, t
   where char_length(btrim(p_texto)) >= 2
     and u.email is not null
     and u.deleted_at is null
     and lower(u.email) like '%' || t.q || '%'
   order by lower(u.email) like t.q || '%' desc, lower(u.email)
   limit 8;
$$;

comment on function caja_buscar_cuentas(text) is 'empleado-ia/cajas';
revoke all on function caja_buscar_cuentas(text) from public, anon, authenticated;
grant execute on function caja_buscar_cuentas(text) to service_role;

commit;
