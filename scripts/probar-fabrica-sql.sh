#!/usr/bin/env bash
# Prueba REAL de supabase/08_caja_fabrica.sql en un Postgres de verdad (Docker, imagen postgres:16-alpine).
# No toca Supabase: levanta un contenedor desechable, simula auth.users y los roles de Supabase, aplica los SQL del repo y comprueba el
# comportamiento (llave de un solo uso, 20 clientes reclamando el mismo código a la vez, tope de 100, permisos, idempotencia).
# Uso (desde la raíz del repo):  bash scripts/probar-fabrica-sql.sh
set -uo pipefail
NOMBRE=pg-fabrica
SQLDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../supabase" && pwd)"
P="docker exec -i $NOMBRE psql -U postgres -v ON_ERROR_STOP=1 -q -t -A"
ok=0; mal=0
chk() { if [ "$2" = "$3" ]; then echo "  OK    $1"; ok=$((ok+1)); else echo "  FALLA $1 -> esperado [$3], salió [$2]"; mal=$((mal+1)); fi; }
limpiar() { docker rm -f "$NOMBRE" >/dev/null 2>&1; }
trap limpiar EXIT

limpiar
docker run -d --name "$NOMBRE" -e POSTGRES_PASSWORD=prueba postgres:16-alpine >/dev/null || { echo "No pude levantar Docker/Postgres"; exit 2; }
for i in $(seq 1 40); do docker exec "$NOMBRE" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done

echo "== preparación: roles y auth.users simulados, y los SQL del repo"
$P <<'SQL' >/dev/null 2>&1
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_app_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create extension if not exists pgcrypto;
SQL
for f in schema.sql 02_servidor_local.sql 03_personajes.sql 04_cajas.sql 05_caja_estudio.sql 08_caja_fabrica.sql; do
  $P < "$SQLDIR/$f" >/dev/null 2>&1; chk "se aplica $f" "$?" "0"
done
$P < "$SQLDIR/08_caja_fabrica.sql" >/dev/null 2>&1; chk "08 dos veces seguidas (idempotente)" "$?" "0"

H() { printf '%s' "$1" | sha256sum | cut -d' ' -f1; }   # SHA-256 hex de un texto
ADMIN=$($P -c "insert into auth.users (email) values ('admin@x.com') returning id")
LLAVE_A=$(H llave-a); SEC_A=$(H secreto-a)

echo "== caja_preparar"
CAJA=$($P -c "select caja_preparar('abcd0001','tunel-1','Cliente Bodega López','$ADMIN','$LLAVE_A', now() + interval '30 days')")
chk "crea la caja" "$([ -n "$CAJA" ] && echo si)" "si"
chk "sin dueño" "$($P -c "select owner_id is null from cajas where id='$CAJA'")" "t"
chk "etiqueta y creada_por" "$($P -c "select etiqueta || '|' || (creada_por = '$ADMIN') from cajas where id='$CAJA'")" "Cliente Bodega López|true"
chk "la llave se guarda solo como hash" "$($P -c "select count(*) from caja_activaciones where caja_id='$CAJA' and llave_hash='$LLAVE_A'")" "1"
chk "slug repetido -> slug_repetido" "$($P -c "select caja_preparar('abcd0001','tunel-x','x','$ADMIN','$(H otra)', now() + interval '1 day')" 2>&1 | grep -c slug_repetido)" "1"
chk "no queda una caja a medias tras el slug repetido" "$($P -c "select count(*) from cajas where slug='abcd0001'")" "1"

echo "== caja_activar: una sola vez"
R=$($P -c "select registro_id || '|' || caja_id from caja_activar('$LLAVE_A','$SEC_A','AAAABBBB', now() + interval '15 minutes','1.0','1.2.3.4')")
chk "activa con la llave buena y devuelve registro y caja" "${R#*|}" "$CAJA"
REG=${R%%|*}
chk "el registro queda enlazado a la caja y 'vinculada'" "$($P -c "select estado || '|' || (caja_id = '$CAJA') from caja_registros where id='$REG'")" "vinculada|true"
chk "la MISMA llave otra vez -> llave_invalida" "$($P -c "select * from caja_activar('$LLAVE_A','$(H s2)','CCCCDDDD', now() + interval '15 minutes','1.0','1.2.3.4')" 2>&1 | grep -c llave_invalida)" "1"
chk "una llave que no existe -> llave_invalida" "$($P -c "select * from caja_activar('$(H nada)','$(H s3)','EEEEFFFF', now() + interval '15 minutes','1.0','x')" 2>&1 | grep -c llave_invalida)" "1"
LLAVE_V=$(H vencida)
$P -c "insert into caja_activaciones (caja_id, llave_hash, vence_en) values ('$CAJA','$LLAVE_V', now() - interval '1 minute')" >/dev/null
chk "una llave vencida -> llave_invalida" "$($P -c "select * from caja_activar('$LLAVE_V','$(H s4)','GGGGHHHH', now() + interval '15 minutes','1.0','x')" 2>&1 | grep -c llave_invalida)" "1"

echo "== caja_activar: 20 conexiones a la vez con la misma llave -> gana una"
CAJA2=$($P -c "select caja_preparar('abcd0002','tunel-2','carrera','$ADMIN','$(H llave-c)', now() + interval '1 day')")
rm -f /tmp/act.*; for i in $(seq 1 20); do ( $P -c "select registro_id from caja_activar('$(H llave-c)','$(H sec-$i)','ZZ$(printf '%06d' $i | tr 01 AB)', now() + interval '15 minutes','1.0','x')" > /tmp/act.$i 2>&1 ) & done; wait
chk "exactamente 1 de 20 activa" "$(cat /tmp/act.* 2>/dev/null | grep -cE '^[0-9a-f-]{36}$')" "1"
chk "19 reciben llave_invalida" "$(cat /tmp/act.* 2>/dev/null | grep -c llave_invalida)" "19"
rm -f /tmp/act.*

echo "== caja_nuevo_codigo y caja_reclamar"
chk "renueva el código de una caja sin dueño" "$($P -c "select caja_nuevo_codigo('$REG','JJJJKKKK', now() + interval '15 minutes')")" "t"
chk "no renueva el de un registro inexistente" "$($P -c "select caja_nuevo_codigo(gen_random_uuid(),'MMMMNNNN', now() + interval '15 minutes')")" "f"
OWNERS=(); for i in $(seq 1 20); do OWNERS+=("$($P -c "insert into auth.users (email) values ('cliente$i@x.com') returning id")"); done
rm -f /tmp/rec.*; for i in $(seq 1 20); do ( $P -c "select caja_reclamar('JJJJKKKK','${OWNERS[$((i-1))]}','Mi caja $i')" > /tmp/rec.$i 2>&1 ) & done; wait
chk "20 clientes con el mismo código a la vez: exactamente 1 la reclama" "$(cat /tmp/rec.* | grep -cE '^[0-9a-f-]{36}$')" "1"
chk "los otros 19 reciben codigo_invalido" "$(cat /tmp/rec.* | grep -c codigo_invalido)" "19"
rm -f /tmp/rec.*
chk "la caja tiene dueño" "$($P -c "select owner_id is not null from cajas where id='$CAJA'")" "t"
chk "el código ya se gastó (no se puede reclamar otra vez)" "$($P -c "select caja_reclamar('JJJJKKKK','${OWNERS[0]}','x')" 2>&1 | grep -c codigo_invalido)" "1"
chk "con dueño, ya no se renueva el código" "$($P -c "select caja_nuevo_codigo('$REG','PPPPQQQQ', now() + interval '15 minutes')")" "f"
$P -c "update caja_registros set expira_en = now() - interval '1 minute' where id='$REG'" >/dev/null
chk "un código vencido no sirve" "$($P -c "select caja_reclamar('JJJJKKKK','${OWNERS[1]}','x')" 2>&1 | grep -c codigo_invalido)" "1"

echo "== reactivar (reinstalación) conserva al dueño"
DUENO=$($P -c "select owner_id from cajas where id='$CAJA'")
$P -c "select caja_nueva_llave('$CAJA','$(H llave-d)', now() + interval '1 day')" >/dev/null
$P -c "select * from caja_activar('$(H llave-d)','$(H secreto-nuevo)','RRRRSSSS', now() + interval '15 minutes','1.1','y')" >/dev/null
chk "el secreto cambió" "$($P -c "select secreto_hash from caja_registros where id='$REG'")" "$(H secreto-nuevo)"
chk "el dueño sigue siendo el mismo" "$($P -c "select owner_id from cajas where id='$CAJA'")" "$DUENO"
chk "sigue habiendo un solo registro para la caja" "$($P -c "select count(*) from caja_registros where caja_id='$CAJA'")" "1"

echo "== caja_nueva_llave"
chk "caja inexistente -> caja_inexistente" "$($P -c "select caja_nueva_llave(gen_random_uuid(),'$(H z)', now() + interval '1 day')" 2>&1 | grep -c caja_inexistente)" "1"
$P -c "select caja_nueva_llave('$CAJA2','$(H llave-e)', now() + interval '1 day')" >/dev/null 2>&1
chk "no se puede activar una caja2 con la llave anterior sin usar (queda invalidada)" "$($P -c "select count(*) from caja_activaciones where caja_id='$CAJA2' and usada_en is null")" "1"

echo "== caja_liberar: queda sin dueño, conserva dirección y túnel"
$P -c "select caja_liberar('$CAJA')" >/dev/null
chk "sin dueño otra vez" "$($P -c "select owner_id is null from cajas where id='$CAJA'")" "t"
chk "conserva slug y túnel" "$($P -c "select slug || '|' || tunnel_id from cajas where id='$CAJA'")" "abcd0001|tunel-1"
chk "su código vence ya" "$($P -c "select expira_en <= now() from caja_registros where id='$REG'")" "t"
chk "pide un código nuevo y se puede reclamar otra vez" "$($P -c "select caja_nuevo_codigo('$REG','TTTTUUUU', now() + interval '15 minutes')")" "t"
chk "reclamar de nuevo" "$($P -c "select (caja_reclamar('TTTTUUUU','${OWNERS[2]}','Otra') = '$CAJA')")" "t"

echo "== tope de 100 cajas sin dueño"
$P -c "insert into cajas (owner_id, slug, tunnel_id) select null, 'z' || lpad(g::text, 7, '0'), 't' || g from generate_series(1, 99) g" >/dev/null
chk "hay 99 + las que quedaron sin dueño" "$($P -c "select count(*) >= 99 from cajas where owner_id is null")" "t"
$P -c "update cajas set owner_id = null where id in (select id from cajas order by slug limit 0)" >/dev/null
SIN=$($P -c "select count(*) from cajas where owner_id is null")
FALTAN=$((100 - SIN))
if [ "$FALTAN" -gt 0 ]; then $P -c "insert into cajas (owner_id, slug, tunnel_id) select null, 'y' || lpad(g::text, 7, '0'), 'u' || g from generate_series(1, $FALTAN) g" >/dev/null; fi
chk "con 100 sin dueño, caja_preparar -> limite_preparadas" "$($P -c "select caja_preparar('abcd9999','t-9','x','$ADMIN','$(H ultima)', now() + interval '1 day')" 2>&1 | grep -c limite_preparadas)" "1"

echo "== permisos: solo service_role"
FIRMAS=("caja_preparar('abcd7777','t','x','$ADMIN','$(H q)', now())" "caja_nueva_llave('$CAJA','$(H q)', now())" "caja_activar('$(H q)','$(H q)','AAAAAAAA', now(),'1','x')" "caja_nuevo_codigo('$REG','AAAAAAAA', now())" "caja_reclamar('AAAAAAAA','$ADMIN','x')" "caja_liberar('$CAJA')")
for rol in anon authenticated; do
  n=0; for f in "${FIRMAS[@]}"; do
    out=$($P -c "set role $rol; select * from $f" 2>&1 </dev/null)
    if echo "$out" | grep -q "permission denied"; then n=$((n+1)); else echo "     (sin 'permission denied' en $rol / ${f%%(*}: ${out:0:140})"; fi
  done
  chk "$rol no puede ejecutar ninguna de las 6 funciones" "$n" "6"
done
chk "caja_activaciones no es legible por anon (RLS sin políticas)" "$($P -c "set role anon; select count(*) from caja_activaciones" 2>&1 | grep -cE 'permission denied|^0$')" "1"

echo "== el flujo antiguo sigue funcionando (caja_vincular con un registro pendiente)"
$P -c "insert into caja_registros (codigo, secreto_hash, expira_en) values ('VVVVWWWW','$(H viejo)', now() + interval '15 minutes')" >/dev/null
VIEJA=$($P -c "select caja_vincular('VVVVWWWW','${OWNERS[3]}','Mi caja','abcd5555','tunel-viejo')")
chk "caja_vincular crea una caja con dueño" "$($P -c "select owner_id = '${OWNERS[3]}' from cajas where id='$VIEJA'")" "t"
$P -c "select caja_desvincular('$VIEJA')" >/dev/null
chk "caja_desvincular la borra" "$($P -c "select count(*) from cajas where id='$VIEJA'")" "0"

echo
echo "RESULTADO: $ok bien, $mal mal"
[ "$mal" = 0 ]
