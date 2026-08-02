-- Módulo de Costeo — Costeo de Producto
-- Correr una sola vez en el SQL Editor de Supabase (Dashboard > SQL Editor > New query).
-- Al aparecer el aviso de RLS, elegir "Run without RLS" (igual que el resto de tablas del módulo).
--
-- Llave natural = código de producto (catálogo), como nombre/id en las demás tablas de
-- Costeo — un costeo por producto, se sobreescribe con upsert al editar.

create table if not exists costeo_productos (
  producto_codigo text primary key,
  datos jsonb not null,
  creado timestamptz default now(),
  modificado timestamptz default now()
);
