#!/usr/bin/env bash
# Prueba REAL de supabase/12_ia_pasarela.sql en un Postgres de verdad (Docker, imagen postgres:16-alpine). No toca Supabase.
# Comprueba el cobro por fracciones: acumular, cobrar enteros, deuda sin saldo, cuentas gratis, cambios de red y 20 solicitudes a la vez.
# Uso (desde la raíz del repo):  bash scripts/probar-ia-sql.sh
set -uo pipefail
NOMBRE=pg-ia
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
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_app_meta_data jsonb default '{}'::jsonb, deleted_at timestamptz);
create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid, provider text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create extension if not exists pgcrypto;
SQL
for f in schema.sql 02_servidor_local.sql 03_personajes.sql 04_cajas.sql 05_caja_estudio.sql 08_caja_fabrica.sql 09_cajas_releases.sql 10_caja_asignada.sql 12_ia_pasarela.sql; do
  $P < "$SQLDIR/$f" >/dev/null 2>&1; chk "se aplica $f" "$?" "0"
done
$P < "$SQLDIR/12_ia_pasarela.sql" >/dev/null 2>&1; chk "12 dos veces seguidas (idempotente)" "$?" "0"

DIA=2026-11-03
HAIKU=claude-haiku-5-5
cuenta() { # saldo
  local u; u=$($P -c "insert into auth.users (email) values (gen_random_uuid() || '@x.com') returning id")
  $P -c "insert into ai_wallets (user_id, credits) values ('$u', $1)" >/dev/null
  echo "$u"
}
caja() { # dueño slug
  $P -c "insert into cajas (owner_id, nombre, slug, tunnel_id) values ('$1', 'Mi caja', '$2', 'tun-$2') returning id"
}
reg() { # caja dueño micro [ip] [cobrar]
  $P -c "select saldo || '|' || cobrados from caja_ia_registrar('$1','$2','$DIA','$HAIKU',100,50,10,5,7,$3,'${4:-ip-a}',${5:-true})" 2>&1
}
saldo() { $P -c "select credits from ai_wallets where user_id='$1'"; }
frac() { $P -c "select ia_fraccion_micro from cajas where id='$1'"; }

echo "== acumula fracciones y cobra al completar un crédito"
U=$(cuenta 10); C=$(caja "$U" aaaa0001)
chk "0.6 créditos: no cobra" "$(reg "$C" "$U" 600000)" "10|0"
chk "1.2 créditos: cobra 1" "$(reg "$C" "$U" 600000)" "9|1"
chk "queda la fracción" "$(frac "$C")" "200000"
chk "una fila en el historial, motivo ia" "$($P -c "select count(*) || '|' || min(delta) || '|' || min(reason) from ai_ledger where user_id='$U'")" "1|-1|ia"
chk "consumo sumado" "$($P -c "select solicitudes || '|' || entrada || '|' || salida || '|' || cache_lectura || '|' || cache_escritura || '|' || costo_microusd || '|' || creditos_micro from caja_ia_consumo where caja_id='$C'")" "2|200|100|20|10|14|1200000"
chk "gasto de hoy en micro-créditos" "$($P -c "select caja_ia_gasto_hoy('$C','$DIA','$HAIKU')")" "1200000"
chk "otro modelo: gasto 0" "$($P -c "select caja_ia_gasto_hoy('$C','$DIA','claude-sonnet-5-5')")" "0"

echo "== sin saldo: la deuda queda en la fracción y el saldo nunca es negativo"
U0=$(cuenta 0); C0=$(caja "$U0" aaaa0002)
chk "1.5 créditos sin saldo: no cobra" "$(reg "$C0" "$U0" 1500000)" "0|0"
chk "guarda la deuda" "$(frac "$C0")" "1500000"
$P -c "update ai_wallets set credits = 5 where user_id='$U0'" >/dev/null
chk "al recargar se cobra la deuda con la siguiente solicitud" "$(reg "$C0" "$U0" 600000)" "3|2"
chk "fracción restante" "$(frac "$C0")" "100000"
USW=$($P -c "insert into auth.users (email) values ('sinwallet@x.com') returning id"); CSW=$(caja "$USW" aaaa0003)
chk "cuenta sin fila de saldo: no falla" "$(reg "$CSW" "$USW" 1000000)" "0|0"

echo "== cuenta administradora: registra consumo, sin cobrar"
UA=$(cuenta 3); CA=$(caja "$UA" aaaa0004)
chk "no cobra" "$(reg "$CA" "$UA" 5000000 ip-a false)" "3|0"
chk "no suma fracción" "$(frac "$CA")" "0"
chk "sí registra consumo" "$($P -c "select creditos_micro from caja_ia_consumo where caja_id='$CA'")" "5000000"

echo "== cambios de red"
UI=$(cuenta 3); CI=$(caja "$UI" aaaa0005)
reg "$CI" "$UI" 1 ip-a >/dev/null; reg "$CI" "$UI" 1 ip-a >/dev/null
chk "misma red: 0 cambios" "$($P -c "select cambios_ip from caja_ia_consumo where caja_id='$CI'")" "0"
reg "$CI" "$UI" 1 ip-b >/dev/null; reg "$CI" "$UI" 1 ip-a >/dev/null
chk "cambia dos veces: 2" "$($P -c "select cambios_ip from caja_ia_consumo where caja_id='$CI'")" "2"

echo "== 20 solicitudes a la vez, de 0.5 créditos: exactamente 10 cobrados"
UC=$(cuenta 100); CC=$(caja "$UC" aaaa0006)
rm -f /tmp/ia.*; for i in $(seq 1 20); do ( reg "$CC" "$UC" 500000 > "/tmp/ia.$i" ) & done; wait
chk "saldo" "$(saldo "$UC")" "90"
chk "fracción" "$(frac "$CC")" "0"
chk "historial: 10 créditos en total, refs únicos" "$($P -c "select -sum(delta) || '|' || count(distinct ref) || '|' || count(*) from ai_ledger where user_id='$UC'")" "10|$($P -c "select count(*) from ai_ledger where user_id='$UC'")|$($P -c "select count(*) from ai_ledger where user_id='$UC'")"
chk "20 solicitudes contadas" "$($P -c "select solicitudes from caja_ia_consumo where caja_id='$CC'")" "20"
rm -f /tmp/ia.*

echo "== permisos: solo service_role"
for rol in anon authenticated; do
  chk "$rol no ejecuta registrar" "$($P -c "set role $rol; select * from caja_ia_registrar('$C','$U','$DIA','$HAIKU',1,1,1,1,1,1,'x',true)" 2>&1 </dev/null | grep -c 'permission denied')" "1"
  chk "$rol no lee el consumo" "$($P -c "set role $rol; select count(*) from caja_ia_consumo" 2>&1 </dev/null | grep -c 'permission denied')" "1"
done
chk "service_role ejecuta registrar" "$($P -c "set role service_role; select cobrados from caja_ia_registrar('$C','$U','$DIA','$HAIKU',1,1,1,1,1,1,'x',true)" 2>&1 </dev/null | grep -Ec '^[0-9]+$')" "1"

echo
echo "Resultado: $ok OK, $mal fallas"
[ "$mal" = 0 ]
