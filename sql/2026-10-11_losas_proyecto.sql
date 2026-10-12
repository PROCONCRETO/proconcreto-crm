-- Módulo "Proyectos" — Losas/Órdenes de Fabricación (2026-10-11, a pedido del usuario:
-- "donde tendríamos más utilidad sería en atender lo relacionado a las listas de producción
-- y al desarrollo y control en producción y despachos") — entidad nueva, una por cada
-- nivel/torre de un proyecto de entrepiso prefabricado (Prelosa, Vigueta y Bovedilla, Placa
-- Alveolar). Cada Losa guarda su propia lista de producción (filas), su control de
-- producción y de despacho, todo anidado en un solo JSONB — mismo criterio que ya usa
-- Despiece de Acero dentro de Costeo de Producto: nadie necesita sincronizar en tiempo real
-- una sola fila suelta, la unidad natural de sincronización es la Losa completa.
--
-- Correr una sola vez en el SQL Editor de Supabase (Dashboard > SQL Editor > New query).

create table if not exists public.losas_proyecto (
  id text primary key,
  datos jsonb not null,
  creado timestamptz not null default now(),
  modificado timestamptz not null default now()
);

alter table public.losas_proyecto enable row level security;

-- Mismo criterio que `proyectos`: todo el equipo con sesión iniciada puede leer y escribir,
-- sin restricción por correo.
drop policy if exists "acceso autenticados" on public.losas_proyecto;
create policy "acceso autenticados" on public.losas_proyecto
  for all to authenticated using (true) with check (true);

-- REPLICA IDENTITY FULL — sin esto Realtime puede filtrar los eventos de esta tabla aunque la
-- política sea permisiva (ver sql/2026-08-21_reparar_realtime_con_rls.sql, mismo motivo exacto
-- ya documentado para `proyectos`).
alter table public.losas_proyecto replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'losas_proyecto'
  ) then
    alter publication supabase_realtime add table public.losas_proyecto;
  end if;
end $$;

-- ── Bucket de Storage para planos/memorias de cálculo (PDF) ──
-- El bucket en sí NO se crea por SQL (tampoco se hizo así para `laboratorio-pdf`, el único
-- otro bucket de la app) — hay que crearlo a mano en el Dashboard de Supabase:
--   Storage → New bucket → nombre exacto "proyectos-pdf" → Private bucket (dejar DESTILDADO
--   "Public bucket") → mismas políticas de acceso que ya tiene configurado `laboratorio-pdf`
--   (cópialas de ahí si el dashboard te da esa opción, o usa los mismos criterios: solo
--   usuarios autenticados pueden subir/ver/borrar).
-- Una vez creado el bucket a mano, corre esto para los límites reales del lado del servidor
-- (mismo criterio ya aplicado a `laboratorio-pdf` en sql/2026-08-04_limites_bucket_laboratorio_pdf.sql):
update storage.buckets
set file_size_limit = 26214400, -- 25 MB
    allowed_mime_types = array['application/pdf']
where id = 'proyectos-pdf';
