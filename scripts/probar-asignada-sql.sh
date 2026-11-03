#!/usr/bin/env bash
# Prueba REAL de supabase/10_caja_asignada.sql en un Postgres de verdad (Docker, imagen postgres:16-alpine).
# No toca Supabase: levanta un contenedor desechable, simula auth.users y los roles de Supabase, aplica los SQL del repo y comprueba el
# comportamiento (correo validado, cuenta equivocada, caja libre más antigua, 20 mini PC compitiendo por 5 cajas, permisos, idempotencia).
# Uso (desde la raíz del repo):  bash scripts/probar-asignada-sql.sh
set -uo pipefail
NOMBRE=pg-asignada
SQLDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../supabase" && pwd)"
P="docker exec -i $NOMBRE psql -U postgres -v ON_ERROR_STOP=1 -q -t -A"
ok=0; mal=0
chk() { if [ "$2" = "$3" ]; then echo "  OK    $1"; ok=$((ok+1)); else echo "  FALLA $1 -> esperado [$3], salió [$2]"; mal=$((mal+1)); fi; }
limpiar() { docker rm -f "$NOMBRE" >/dev/null 2>&1; }
trap limpiar EXIT

limpiar
docker run -d --name "$NOMBRE" -e POSTGRES_PASSWORD=prueba postgres:16-alpine >/dev/null || { echo "No pude levantar Docker/Postgres"; exit 2; }
for i in $(seq 1 40); do docker exec "$NOMBRE" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2

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
for f in schema.sql 02_servidor_local.sql 03_personajes.sql 04_cajas.sql 05_caja_estudio.sql 08_caja_fabrica.sql 09_cajas_releases.sql 10_caja_asignada.sql; do
  $P < "$SQLDIR/$f" >/dev/null 2>&1; chk "se aplica $f" "$?" "0"
done
$P < "$SQLDIR/10_caja_asignada.sql" >/dev/null 2>&1; chk "10 dos veces seguidas (idempotente)" "$?" "0"

H() { printf '%s' "$1" | sha256sum | cut -d' ' -f1; }
ADMIN=$($P -c "insert into auth.users (email) values ('admin@x.com') returning id")
CLIENTE=$($P -c "insert into auth.users (email) values ('cliente@gmail.com') returning id")
CORREO=cliente@gmail.com

# caja asignada: como lo hace prepararCaja (caja_preparar + correo)
caja() { # slug correo
  local id
  id=$($P -c "select caja_preparar('$1','tunel-$1','$1','$ADMIN','$(H "llave-$1")', now() + interval '30 days')")
  $P -c "update cajas set email_asignado='$2' where id='$id'" >/dev/null
  echo "$id"
}
# registro de una mini PC del ISO: como lo hace crearRegistro
registro() { # codigo [email_validado] [minutos de vida]
  local correo="null"; [ -n "${2:-}" ] && correo="'$2'"
  $P -c "insert into caja_registros (codigo, secreto_hash, expira_en, version, ip, email_validado) values ('$1','$(H "sec-$1")', now() + interval '${3:-15} minutes','1.0','1.1.1.1',$correo) returning id"
}
vincular() { # codigo owner email
  $P -c "select caja_vincular_asignada('$1','$2','$3','Mi caja')" 2>&1
}

echo "== el registro debe tener ESE correo validado"
VIEJA=$(caja aaaa0001 $CORREO)
sleep 0.05
NUEVA=$(caja aaaa0002 $CORREO)
chk "un correo con mayúsculas no entra (check)" "$($P -c "update cajas set email_asignado='MAL@x.com'" 2>&1 | grep -c 'violates check')" "1"
registro AAAABBBB >/dev/null
chk "sin correo validado -> codigo_invalido" "$(vincular AAAABBBB "$CLIENTE" $CORREO | grep -c codigo_invalido)" "1"
registro AAAACCCC intruso@gmail.com >/dev/null
chk "validado con otro correo -> codigo_invalido" "$(vincular AAAACCCC "$CLIENTE" $CORREO | grep -c codigo_invalido)" "1"
registro AAAADDDD $CORREO -1 >/dev/null
chk "código vencido -> codigo_invalido" "$(vincular AAAADDDD "$CLIENTE" $CORREO | grep -c codigo_invalido)" "1"
chk "tras los rechazos, las cajas siguen sin dueño" "$($P -c "select count(*) from cajas where owner_id is not null")" "0"

echo "== la cuenta correcta se queda con la caja más antigua y luego con la otra (dos mini PC, misma cuenta)"
REG=$(registro AAAAEEEE $CORREO)
chk "vincula la más antigua" "$(vincular AAAAEEEE "$CLIENTE" $CORREO)" "$VIEJA"
chk "la caja queda con su dueño y conserva su dirección" "$($P -c "select (owner_id='$CLIENTE') || '|' || slug || '|' || (linked_at is not null) from cajas where id='$VIEJA'")" "true|aaaa0001|true"
chk "el registro queda vinculado a esa caja" "$($P -c "select estado || '|' || (caja_id='$VIEJA') from caja_registros where id='$REG'")" "vinculada|true"
chk "el mismo código no sirve dos veces" "$(vincular AAAAEEEE "$CLIENTE" $CORREO | grep -c codigo_invalido)" "1"
registro AAAAFFFF $CORREO >/dev/null
chk "la segunda mini PC toma la otra caja" "$(vincular AAAAFFFF "$CLIENTE" $CORREO)" "$NUEVA"
registro AAAAGGGG $CORREO >/dev/null
chk "sin cajas libres -> sin_caja_asignada" "$(vincular AAAAGGGG "$CLIENTE" $CORREO | grep -c sin_caja_asignada)" "1"
chk "ese intento no gastó el registro" "$($P -c "select estado from caja_registros where codigo='AAAAGGGG'")" "pendiente"

echo "== una caja activada con su llave (ya tiene mini PC) no entra en el reparto"
OTRA=otra@gmail.com
ACT=$($P -c "select caja_preparar('bbbb0001','tunel-b','b','$ADMIN','$(H llave-b)', now() + interval '1 day')")
$P -c "update cajas set email_asignado='$OTRA' where id='$ACT'" >/dev/null
$P -c "select * from caja_activar('$(H llave-b)','$(H sec-b)','BBBBCCCC', now() + interval '15 minutes','1.0','x')" >/dev/null
registro BBBBDDDD $OTRA >/dev/null
OTRO=$($P -c "insert into auth.users (email) values ('$OTRA') returning id")
chk "-> sin_caja_asignada" "$(vincular BBBBDDDD "$OTRO" $OTRA | grep -c sin_caja_asignada)" "1"

echo "== 20 mini PC a la vez compiten por 5 cajas del mismo correo: 5 ganan y ninguna caja se reparte dos veces"
MUCHAS=muchas@gmail.com
DUENO=$($P -c "insert into auth.users (email) values ('$MUCHAS') returning id")
for i in 1 2 3 4 5; do caja "cccc000$i" $MUCHAS >/dev/null; done
COD() { printf 'CC%06d' "$1" | tr '0123456789' 'ABCDEFGHJK'; }
for i in $(seq 1 20); do registro "$(COD "$i")" $MUCHAS >/dev/null; done
rm -f /tmp/asig.*
for i in $(seq 1 20); do ( vincular "$(COD "$i")" "$DUENO" $MUCHAS > "/tmp/asig.$i" ) & done; wait
GANAN=$(cat /tmp/asig.* | grep -cE '^[0-9a-f-]{36}$')
chk "ganan exactamente 5" "$GANAN" "5"
chk "las 5 cajas tienen dueño" "$($P -c "select count(*) from cajas where email_asignado='$MUCHAS' and owner_id='$DUENO'")" "5"
chk "cada caja tiene una sola mini PC" "$($P -c "select count(*) from (select caja_id from caja_registros where caja_id is not null group by caja_id having count(*) > 1) x")" "0"
chk "los otros 15 siguen pendientes" "$($P -c "select count(*) from caja_registros where email_validado='$MUCHAS' and estado='pendiente'")" "15"
rm -f /tmp/asig.*

echo "== permisos: solo service_role"
for rol in anon authenticated; do
  chk "$rol no puede ejecutarla" "$($P -c "set role $rol; select caja_vincular_asignada('X','$CLIENTE','x','y')" 2>&1 </dev/null | grep -c 'permission denied')" "1"
done
chk "service_role sí llega a la función" "$($P -c "set role service_role; select caja_vincular_asignada('NOEXISTE','$CLIENTE','x','y')" 2>&1 </dev/null | grep -c codigo_invalido)" "1"

echo
echo "Resultado: $ok OK, $mal fallas"
[ "$mal" = 0 ]
