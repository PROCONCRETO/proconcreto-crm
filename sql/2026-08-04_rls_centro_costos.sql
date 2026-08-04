-- Restringir la edición de Centro de Costos a un grupo cerrado de usuarios.
-- Correr una sola vez en el SQL Editor de Supabase (Dashboard > SQL Editor > New query).
--
-- Motivo (2026-08-04, a pedido del usuario): hasta ahora estas 6 tablas NO tenían RLS
-- (se crearon con "Run without RLS" para simplificar mientras se construía el módulo). Eso
-- significa que cualquiera con la anon key pública (visible en el código fuente de la página,
-- ver js/config.js) puede leer Y ESCRIBIR ahí directamente vía la API REST de Supabase, sin
-- iniciar sesión en la app. Este script cierra esa puerta:
--   - LECTURA: sigue abierta a cualquier usuario AUTENTICADO (no anónimo) — la necesitan otras
--     pantallas que no son de Centro de Costos, ej. Diseño de Mezcla (Calidad) lee
--     insumos_costos para poblar el selector de Cemento/Triturado/etc.
--   - ESCRITURA (insert/update/delete): solo para los 3 correos definidos en
--     es_usuario_centro_costos() más abajo. El resto de usuarios autenticados (Comercial,
--     Logística, Calidad...) puede seguir usando el resto de la app sin que esto los afecte.
--
-- Para agregar o quitar a alguien de Centro de Costos más adelante, basta con editar la lista
-- de correos en es_usuario_centro_costos() y volver a correr solo ese CREATE OR REPLACE
-- FUNCTION (no hace falta tocar las políticas).

create or replace function public.es_usuario_centro_costos()
returns boolean
language sql
stable
as $$
  select (auth.jwt() ->> 'email') in (
    'jose.escobar@proconcreto.com.co',       -- Jose Pablo Escobar Mejia, Gerente Técnico
    'departamentotecnico@proconcreto.com.co', -- Ana María Mazuera, Coordinadora Técnica
    'produccion@proconcreto.com.co'           -- Jaime Eduardo Franco, Jefe de Producción
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array['maquinaria_equipos','cuadrillas_productivas','clases_salariales','insumos_costos','parametros_mo','costeo_productos']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "lectura autenticados" on public.%I', t);
    execute format(
      'create policy "lectura autenticados" on public.%I for select to authenticated using (true)', t
    );

    execute format('drop policy if exists "insertar solo centro de costos" on public.%I', t);
    execute format(
      'create policy "insertar solo centro de costos" on public.%I for insert to authenticated with check (public.es_usuario_centro_costos())', t
    );

    execute format('drop policy if exists "actualizar solo centro de costos" on public.%I', t);
    execute format(
      'create policy "actualizar solo centro de costos" on public.%I for update to authenticated using (public.es_usuario_centro_costos()) with check (public.es_usuario_centro_costos())', t
    );

    execute format('drop policy if exists "eliminar solo centro de costos" on public.%I', t);
    execute format(
      'create policy "eliminar solo centro de costos" on public.%I for delete to authenticated using (public.es_usuario_centro_costos())', t
    );
  end loop;
end $$;
