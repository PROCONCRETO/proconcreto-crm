-- Módulo de Costeo — Lista de Referencia de Costos (Materias Primas / Insumos y Otros CIF)
-- Correr una sola vez en el SQL Editor de Supabase (Dashboard > SQL Editor > New query).
-- Al aparecer el aviso de RLS, elegir "Run without RLS" (igual que el resto de tablas de la app).
--
-- Esta tabla solo guarda Materias Primas e Insumos/CIF — las filas de Mano de Obra y
-- Maquinaria que aparecen en la misma pantalla NO se guardan aquí, se leen en vivo de
-- clases_salariales / cuadrillas_productivas / maquinaria_equipos (ya existentes).

create table if not exists insumos_costos (
  nombre text primary key,
  datos jsonb not null,
  creado timestamptz default now(),
  modificado timestamptz default now()
);
