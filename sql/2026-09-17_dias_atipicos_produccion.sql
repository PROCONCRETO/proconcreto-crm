-- Días atípicos en Producción Diaria — exclusión curada del estándar de ciclos/día (2026-09-17,
-- a pedido del usuario): permite marcar un día de producción como "atípico" y sacarlo del cálculo
-- del estándar de ciclos/día (media/desviación, usado más adelante para costear mano de obra al
-- fijar precios), SIN borrar el registro y SIN que la exclusión sea automática. Reglas de negocio
-- no negociables (confirmadas con el usuario):
--   1) Nunca se borra un registro de producción — la exclusión es un estado adicional.
--   2) Toda exclusión exige una causa de una lista cerrada.
--   3) Ningún registro se auto-excluye por estar fuera de rango estadístico — el sistema solo
--      puede sugerir "revisar"; la exclusión real la hace una persona con causa registrada.
--   4) Quien marca un día como atípico sin ser aprobador deja el registro en
--      "pendiente_revision"; solo un aprobador puede pasarlo a "excluido" (o saltarse el paso
--      intermedio si quien marca ya es aprobador).
-- Permiso de "aprobador de Producción": se reutiliza EXACTAMENTE la misma lista de correos de
-- Centro de Costos (public.es_usuario_centro_costos(), ver sql/2026-08-04_rls_centro_costos.sql)
-- — confirmado con el usuario, sin lista nueva que mantener sincronizada a mano.
--
-- Correr una sola vez en el SQL Editor de Supabase (Dashboard > SQL Editor > New query).

-- ── Permiso: aprobador de Producción (alias de dominio de la misma lista de Centro de Costos) ──
create or replace function public.es_usuario_aprobador_produccion()
returns boolean
language sql
stable
as $$
  select public.es_usuario_centro_costos();
$$;

-- ── Tabla nueva: eventos_especiales ──
-- Bitácora de eventos de máquina/línea, generada AUTOMÁTICAMENTE cuando una exclusión de
-- Producción Diaria queda aprobada (nunca se crea a mano en esta primera vuelta) — permite sumar
-- ciclos perdidos por causa (avería, cambio de molde, etc.) sin rehacer el análisis a mano.
-- Mismo patrón del resto de la app: una columna datos JSONB con el objeto completo. id es text
-- (no bigint) porque se arma como `${Date.now()}-${produccionId}` para evitar colisiones.
create table if not exists public.eventos_especiales (
  id text primary key,
  datos jsonb not null,
  creado timestamptz default now(),
  modificado timestamptz default now()
);

alter table public.eventos_especiales enable row level security;

drop policy if exists "lectura autenticados" on public.eventos_especiales;
create policy "lectura autenticados" on public.eventos_especiales
  for select to authenticated using (true);

drop policy if exists "insertar solo aprobador produccion" on public.eventos_especiales;
create policy "insertar solo aprobador produccion" on public.eventos_especiales
  for insert to authenticated with check (public.es_usuario_aprobador_produccion());

drop policy if exists "actualizar solo aprobador produccion" on public.eventos_especiales;
create policy "actualizar solo aprobador produccion" on public.eventos_especiales
  for update to authenticated using (public.es_usuario_aprobador_produccion()) with check (public.es_usuario_aprobador_produccion());

drop policy if exists "eliminar solo aprobador produccion" on public.eventos_especiales;
create policy "eliminar solo aprobador produccion" on public.eventos_especiales
  for delete to authenticated using (public.es_usuario_aprobador_produccion());

-- REPLICA IDENTITY FULL — sin esto Realtime puede filtrar los eventos de esta tabla aunque la
-- política sea permisiva (ver sql/2026-08-21_reparar_realtime_con_rls.sql, mismo motivo exacto).
alter table public.eventos_especiales replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'eventos_especiales'
  ) then
    alter publication supabase_realtime add table public.eventos_especiales;
  end if;
end $$;

-- ── producciones: permitir escritura general (su estado de RLS actual no está confirmado en
-- este repo — este script no lo asume, lo deja en un estado conocido) y BLOQUEAR con una
-- política RESTRICTIVA que solo un aprobador pueda escribir un registro en estado 'excluido'.
-- RESTRICTIVE (no permisiva) a propósito: se combina con AND contra cualquier otra política
-- permisiva que ya exista en esta tabla (conocida o no por este repo) — no se puede burlar
-- agregando otra política permisiva más adelante.
alter table public.producciones enable row level security;
alter table public.producciones replica identity full; -- idempotente, ya aplicado en 2026-08-21, se reafirma

drop policy if exists "acceso autenticados" on public.producciones;
create policy "acceso autenticados" on public.producciones
  for all to authenticated using (true) with check (true);

drop policy if exists "bloquear exclusion sin aprobador insert" on public.producciones;
create policy "bloquear exclusion sin aprobador insert" on public.producciones
  as restrictive
  for insert to authenticated
  with check ((datos->>'estado') is distinct from 'excluido' or public.es_usuario_aprobador_produccion());

drop policy if exists "bloquear exclusion sin aprobador update" on public.producciones;
create policy "bloquear exclusion sin aprobador update" on public.producciones
  as restrictive
  for update to authenticated
  with check ((datos->>'estado') is distinct from 'excluido' or public.es_usuario_aprobador_produccion());

-- Efecto secundario aceptado: una vez que un registro queda 'excluido', CUALQUIER actualización
-- posterior a esa fila (incluso corregir un campo sin relación) exige una sesión de aprobador,
-- porque RESTRICTIVE con WITH CHECK no puede distinguir "sigue excluido, edito otra cosa" de "lo
-- estoy re-marcando excluido" sin ver la fila OLD (eso solo lo puede un trigger). Se mitiga en la
-- UI: editarProduccion() (js/produccion-diaria.js) rehúsa abrir el modal de edición para un
-- registro excluido si quien lo abre no es aprobador, en vez de dejarlo intentar guardar y
-- toparse con un error de RLS confuso.

-- ── Autoría real de marcadoPor/aprobadoPor/rechazadoPor — misma técnica exacta que
-- _forzar_confirmado_por_cumplido() (sql/2026-08-04_rastro_auditoria_real.sql): compara el campo
-- de fecha antes/después para saber si la transición ACABA de pasar, y solo entonces estampa el
-- correo real de la sesión (auth.jwt()->>'email', no falsificable desde el navegador). Convive
-- sin conflicto con el trigger _trg_autoria ya existente en producciones (mismo evento, otro
-- nombre, otras claves del JSONB).
create or replace function public._forzar_autoria_dia_atipico()
returns trigger
language plpgsql
as $$
declare
  correo text := auth.jwt() ->> 'email';
  marcado_nuevo text := NEW.datos ->> 'fechaMarcado';
  marcado_viejo text;
  aprob_nuevo text := NEW.datos ->> 'fechaAprobacion';
  aprob_viejo text;
  rechazo_nuevo text := NEW.datos ->> 'fechaRechazo';
  rechazo_viejo text;
begin
  if correo is null then
    return NEW;
  end if;

  marcado_viejo := case when TG_OP = 'UPDATE' then OLD.datos ->> 'fechaMarcado' else null end;
  if marcado_nuevo is not null and marcado_nuevo is distinct from marcado_viejo then
    NEW.datos := jsonb_set(NEW.datos, array['marcadoPor'], to_jsonb(correo), true);
  end if;

  aprob_viejo := case when TG_OP = 'UPDATE' then OLD.datos ->> 'fechaAprobacion' else null end;
  if aprob_nuevo is not null and aprob_nuevo is distinct from aprob_viejo then
    NEW.datos := jsonb_set(NEW.datos, array['aprobadoPor'], to_jsonb(correo), true);
  end if;

  rechazo_viejo := case when TG_OP = 'UPDATE' then OLD.datos ->> 'fechaRechazo' else null end;
  if rechazo_nuevo is not null and rechazo_nuevo is distinct from rechazo_viejo then
    NEW.datos := jsonb_set(NEW.datos, array['rechazadoPor'], to_jsonb(correo), true);
  end if;

  return NEW;
end;
$$;

drop trigger if exists _trg_autoria_dia_atipico on public.producciones;
create trigger _trg_autoria_dia_atipico before insert or update on public.producciones
  for each row execute function public._forzar_autoria_dia_atipico();
