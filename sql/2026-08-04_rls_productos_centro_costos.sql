-- Alinear la tabla `productos` con la restricción de Centro de Costos.
-- Correr una sola vez en el SQL Editor de Supabase (Dashboard > SQL Editor > New query).
--
-- Motivo (2026-08-04, auditoría de seguridad, a pedido del usuario: "cerremos todos los
-- huecos sin importar el riesgo"): `productos` ya tenía RLS (bloqueaba lecturas anónimas),
-- pero no hay forma de confirmar desde afuera si la política de escritura ya existente
-- limita a alguien en particular o deja escribir a cualquier usuario autenticado. La app ya
-- bloquea la pantalla de Productos (y el candado de precio "Desde Costeo") para cualquiera
-- que no sea uno de los 3 correos de Centro de Costos — este script alinea la base de datos
-- con esa misma regla, sin dejarlo solo como un candado de interfaz.
--
-- Lectura: se mantiene abierta a cualquier autenticado (el Cotizador de TODO el equipo
-- necesita leer precios del catálogo). Escritura: solo los 3 correos de
-- es_usuario_centro_costos() (ver sql/2026-08-04_rls_centro_costos.sql).
--
-- Este script BORRA cualquier política de escritura que ya exista en `productos` (sin
-- importar su nombre, las descubre dinámicamente vía pg_policies) y las reemplaza por un set
-- limpio y conocido — así no queda una política vieja más permisiva compitiendo con esta
-- (las políticas RLS se combinan con OR: si quedara una vieja política abierta, esta nueva
-- restricción no serviría de nada).

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'productos'
  loop
    execute format('drop policy %I on public.productos', pol.policyname);
  end loop;
end $$;

alter table public.productos enable row level security;

create policy "lectura autenticados" on public.productos
  for select to authenticated using (true);

create policy "insertar solo centro de costos" on public.productos
  for insert to authenticated with check (public.es_usuario_centro_costos());

create policy "actualizar solo centro de costos" on public.productos
  for update to authenticated using (public.es_usuario_centro_costos()) with check (public.es_usuario_centro_costos());

create policy "eliminar solo centro de costos" on public.productos
  for delete to authenticated using (public.es_usuario_centro_costos());
