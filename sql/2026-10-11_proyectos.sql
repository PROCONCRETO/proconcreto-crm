-- Módulo nuevo "Proyectos" (2026-10-11, a pedido del usuario): gestión de proyectos como
-- entidad propia (nombre, cliente, ciudad, estado, fechas, responsable, descripción) —
-- independiente de lo que ya existe en Clientes/Cotizaciones, no reutiliza esas tablas.
-- Mismo patrón del resto de la app: una columna `datos` JSONB con el objeto completo.
--
-- Correr una sola vez en el SQL Editor de Supabase (Dashboard > SQL Editor > New query).

create table if not exists public.proyectos (
  id text primary key,
  datos jsonb not null,
  creado timestamptz not null default now(),
  modificado timestamptz not null default now()
);

alter table public.proyectos enable row level security;

-- Todo el equipo puede leer y escribir — no hay restricción por correo acá (a diferencia de
-- Centro de Costos), mismo criterio que Clientes/Cotizaciones: cualquiera con sesión iniciada.
drop policy if exists "acceso autenticados" on public.proyectos;
create policy "acceso autenticados" on public.proyectos
  for all to authenticated using (true) with check (true);

-- REPLICA IDENTITY FULL — sin esto Realtime puede filtrar los eventos de esta tabla aunque la
-- política sea permisiva (ver sql/2026-08-21_reparar_realtime_con_rls.sql, mismo motivo exacto).
alter table public.proyectos replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'proyectos'
  ) then
    alter publication supabase_realtime add table public.proyectos;
  end if;
end $$;
