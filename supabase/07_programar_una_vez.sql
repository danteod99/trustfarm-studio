-- Programaciones: además de repetir cada semana, un loop puede correr UNA sola vez en fecha y hora exactas,
-- y los que se repiten pueden elegir minutos (7:30, no solo 7:00). Idempotente; correr después de 06_api_flujos.sql.
alter table ai_loops add column if not exists once   boolean not null default false;
alter table ai_loops add column if not exists minute integer not null default 0 check (minute between 0 and 59);
