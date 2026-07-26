-- Módulo de Costeo — Costo de Mano de Obra + Cuadrillas Productivas
-- Correr una sola vez en el SQL Editor de Supabase (Dashboard > SQL Editor > New query).
-- Mismo patrón que el resto de la app: una columna datos JSONB con el objeto completo.

create table if not exists parametros_mo (
  id bigint primary key,
  datos jsonb not null,
  modificado timestamptz default now()
);

create table if not exists clases_salariales (
  nombre text primary key,
  datos jsonb not null,
  creado timestamptz default now(),
  modificado timestamptz default now()
);

create table if not exists cuadrillas_productivas (
  nombre text primary key,
  datos jsonb not null,
  creado timestamptz default now(),
  modificado timestamptz default now()
);
