-- Corrige la sincronización "en vivo" (Realtime) — el usuario reportó (2026-08-21) que hay
-- que hacer Ctrl+F5 para ver los cambios de otros usuarios, en vez de que aparezcan solos
-- mientras la pantalla está abierta.
-- Correr una sola vez en el SQL Editor de Supabase (Dashboard > SQL Editor > New query).
--
-- CAUSA REAL (probable, confirmable solo con acceso al dashboard): Supabase Realtime exige
-- `REPLICA IDENTITY FULL` en cualquier tabla con RLS habilitado para poder evaluar sus
-- políticas sobre los eventos de INSERT/UPDATE/DELETE que llegan por replicación lógica de
-- Postgres — sin esto, Realtime puede filtrar (no entregar) esos eventos aunque la política
-- sea totalmente permisiva (`using (true)`), porque la fila que le llega no trae los datos
-- suficientes para evaluarla.
--
-- Se sabe con certeza (por los scripts ya en este repo) que `clientes`, `cotizaciones`,
-- `productos`, `maquinaria_equipos`, `cuadrillas_productivas`, `clases_salariales`,
-- `insumos_costos`, `parametros_mo` y `costeo_productos` tienen RLS — activado el 2026-08-04,
-- sin este paso (ver sql/2026-08-04_rls_*.sql), justo antes de que empezara a fallar lo "en
-- vivo". Las demás tablas que la app escucha podrían tener RLS agregado directo desde el
-- dashboard de Supabase (sin quedar registrado en este repo) — por eso este script aplica
-- REPLICA IDENTITY FULL a TODAS las tablas que `suscribirRealtime()` escucha
-- (js/datos-realtime.js), no solo a las 9 confirmadas — es inofensivo en las que no tengan RLS
-- (Postgres simplemente incluye la fila completa en el WAL, sin ningún efecto visible para la
-- app) y no toca ninguna política ni ningún dato.

do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes','cotizaciones','ordenes_servicio','producciones','productos',
    'disenos_mezcla','ensayos_calidad','materia_prima','ajustes_mezcla',
    'entregas_programadas','parametros_mo','clases_salariales',
    'cuadrillas_productivas','maquinaria_equipos','insumos_costos','costeo_productos'
  ]
  loop
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

-- Además, confirma (y agrega si hiciera falta) que esas mismas tablas estén en la publicación
-- de Realtime — sin esto tampoco llegan los eventos, sin importar RLS/REPLICA IDENTITY. Se
-- valida contra pg_publication_tables antes de agregar cada una, así este script se puede
-- correr más de una vez sin error si alguna ya estaba.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes','cotizaciones','ordenes_servicio','producciones','productos',
    'disenos_mezcla','ensayos_calidad','materia_prima','ajustes_mezcla',
    'entregas_programadas','parametros_mo','clases_salariales',
    'cuadrillas_productivas','maquinaria_equipos','insumos_costos','costeo_productos'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
