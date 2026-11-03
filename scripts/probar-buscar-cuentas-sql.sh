#!/usr/bin/env bash
# Prueba REAL de supabase/11_buscar_cuentas.sql en un Postgres de verdad (Docker, imagen postgres:16-alpine). No toca Supabase.
# Uso (desde la raíz del repo):  bash scripts/probar-buscar-cuentas-sql.sh
set -uo pipefail
NOMBRE=pg-buscar
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

$P <<'SQL' >/dev/null 2>&1
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email varchar(255), deleted_at timestamptz);
create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), provider text);
insert into auth.users (email) values ('ana.perez@gmail.com'), ('anabel@empresa.pe'), ('juan_ana@gmail.com'), ('juanXana@gmail.com'), ('100%real@gmail.com');
insert into auth.users (email, deleted_at) values ('ana.borrada@gmail.com', now());
insert into auth.users (email) values (null);
insert into auth.identities (user_id, provider) select id, 'google' from auth.users where email = 'ana.perez@gmail.com';
insert into auth.identities (user_id, provider) select id, 'email' from auth.users where email = 'anabel@empresa.pe';
SQL
for i in 1 2; do $P < "$SQLDIR/11_buscar_cuentas.sql" >/dev/null 2>&1; chk "se aplica (vez $i, idempotente)" "$?" "0"; done

B() { $P -c "select string_agg(email || ':' || con_google, ',') from caja_buscar_cuentas(\$\$$1\$\$)"; }
chk "busca por parte del correo y dice quién tiene Google" "$(B 'perez')" "ana.perez@gmail.com:true"
chk "sin importar mayúsculas ni espacios" "$(B '  PEREZ ')" "ana.perez@gmail.com:true"
chk "primero las que empiezan por el texto" "$(B 'ana')" "ana.perez@gmail.com:true,anabel@empresa.pe:false,juan_ana@gmail.com:false,juanXana@gmail.com:false"
chk "_ se busca como texto, no como comodín" "$(B 'n_a')" "juan_ana@gmail.com:false"
chk "% se busca como texto, no como comodín" "$(B '%real')" "100%real@gmail.com:false"
chk "un solo carácter no devuelve nada" "$(B 'a')" ""
chk "% solo no lista todas las cuentas" "$(B '%')" ""
chk "no incluye cuentas borradas" "$(B 'borrada')" ""
$P -c "insert into auth.users (email) select 'lote' || g || '@x.com' from generate_series(1, 20) g" >/dev/null
chk "máximo 8 resultados" "$($P -c "select count(*) from caja_buscar_cuentas('lote')")" "8"
for rol in anon authenticated; do
  chk "$rol no puede ejecutarla" "$($P -c "set role $rol; select * from caja_buscar_cuentas('ana')" 2>&1 </dev/null | grep -c 'permission denied')" "1"
done
chk "service_role sí" "$($P -c "set role service_role; select count(*) from caja_buscar_cuentas('perez')" 2>&1 </dev/null)" "1"

echo
echo "Resultado: $ok OK, $mal fallas"
[ "$mal" = 0 ]
