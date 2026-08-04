-- Cerrar el hueco más grave encontrado en la auditoría de seguridad (2026-08-04): las tablas
-- `clientes` y `cotizaciones` NO tenían NINGÚN RLS — son las tablas originales de la app,
-- de antes de que este proyecto empezara a usar RLS en nada. Confirmado en vivo con la anon
-- key pública, SIN iniciar sesión:
--   - Lectura: 103 clientes reales (nombre, celular, email personal, NIT/cédula, dirección) y
--     101 cotizaciones completas (cliente, ítems, precios) quedaban expuestas a cualquiera.
--   - Escritura: se pudo INSERTAR y BORRAR un cliente de prueba sin ninguna credencial — lo
--     mismo aplica casi seguro a `cotizaciones` (mismo patrón, sin política ninguna).
-- Esto no es solo robo de información: un cliente insertado así puede traer un nombre con
-- HTML/JS malicioso (ver auditoría — 62 puntos en 13 archivos interpolan nombre/contacto/etc.
-- directo en innerHTML sin escapar), que se ejecutaría en el navegador de cualquier empleado
-- que abra Histórico de Clientes/Cotizaciones. Cerrar este hueco corta esa vía de entrada.
--
-- A diferencia de Centro de Costos, TODO el equipo necesita leer y escribir estas dos tablas
-- (es el flujo de ventas normal) — no hay restricción por correo aquí, solo exigir sesión
-- iniciada (autenticado) para cualquier operación.
--
-- Correr una sola vez en el SQL Editor de Supabase (Dashboard > SQL Editor > New query).

do $$
declare
  t text;
begin
  foreach t in array array['clientes','cotizaciones']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "acceso autenticados" on public.%I', t);
    execute format(
      'create policy "acceso autenticados" on public.%I for all to authenticated using (true) with check (true)', t
    );
  end loop;
end $$;
