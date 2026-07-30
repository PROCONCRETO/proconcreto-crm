-- Módulo de Costeo — Amortización de Maquinaria y Equipos
-- Correr una sola vez en el SQL Editor de Supabase (Dashboard > SQL Editor > New query).
-- Al aparecer el aviso de RLS, elegir "Run without RLS" (igual que el resto de tablas de la app).

create table if not exists maquinaria_equipos (
  nombre text primary key,
  datos jsonb not null,
  creado timestamptz default now(),
  modificado timestamptz default now()
);
