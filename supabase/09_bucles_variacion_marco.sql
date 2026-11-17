-- Bucles de herramienta: variación «Marco o fondo» (solo ffmpeg) además de «Pantalla real».
-- Idempotente. NO aplicar sin revisar: va al Supabase compartido. Requiere 08_bucles_herramienta.sql.
-- Hasta que se aplique, el código sigue funcionando: crear un bucle con marco responde "todavía no disponible"
-- y los bucles de pantalla_real / sin variación ni siquiera envían la columna `estilo`.
begin;

alter table tool_loops add column if not exists estilo text;

-- El CHECK de 08 era inline (nombre automático tool_loops_variacion_check). Se reemplaza por uno con 'marco'.
alter table tool_loops drop constraint if exists tool_loops_variacion_check;
alter table tool_loops add constraint tool_loops_variacion_check
  check (variacion is null or variacion in ('pantalla_real', 'marco'));

alter table tool_loops drop constraint if exists tool_loops_estilo_check;
alter table tool_loops add constraint tool_loops_estilo_check
  check (estilo is null or estilo in ('blur', 'color', 'marco', 'mixto'));

commit;
