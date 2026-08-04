-- Rastro de auditoría real — quién creó/modificó/confirmó cada registro, verificado por el
-- servidor en vez de confiar en lo que manda el navegador.
-- Correr una sola vez en el SQL Editor de Supabase (Dashboard > SQL Editor > New query).
--
-- Motivo (2026-08-04, auditoría de seguridad — hallazgo medio "rastro de auditoría
-- falsificable"): campos como creadoPor/modificadoPor/confirmadoPor/autor se arman en el
-- navegador con USUARIO_ACTUAL?.email y se guardan tal cual — cualquier cuenta autenticada
-- podía, en teoría, editar esa petición y atribuirle una acción a otra persona. Además se
-- encontró de paso un bug real no relacionado con seguridad: varias pantallas (Ensayos de
-- Calidad, Materia Prima) sobreescribían creadoPor con quien fuera que EDITARA el registro,
-- no con quien lo creó originalmente — este script también corrige eso, porque la regla nueva
-- es la misma en los dos casos: creadoPor nunca cambia después de creado el registro.
--
-- Cómo funciona: dos funciones trigger genéricas + una específica, reutilizadas en las tablas
-- que las necesitan. Todas usan auth.jwt()->>'email' (el correo verificado de la sesión, no
-- falsificable desde el navegador) y solo actúan si hay una sesión real.
--
--   1) _forzar_autoria_real(campoCreado, campoModificado): para el patrón simple, un campo al
--      nivel superior de `datos`. Al INSERTAR, fija campoCreado al usuario real. Al
--      ACTUALIZAR, campoCreado queda inmutable (se restaura al valor original pase lo que
--      pase) y campoModificado se refresca siempre al usuario real. Pasar '' para el campo
--      que no aplique en esa tabla.
--
--   2) _forzar_autor_ultimo_elemento(campoLista, campoAutor): para el patrón de listas que
--      solo crecen agregando al final (notas de seguimiento, revisiones de diseño,
--      reprogramaciones de entrega). Solo actúa cuando de verdad se agregó un elemento nuevo
--      (compara el tamaño de la lista antes/después) — no toca elementos ya existentes.
--
--   3) _forzar_confirmado_por_cumplido(): específica para el campo `cumplido` (objeto, no
--      lista) de entregas_programadas — solo actúa cuando fechaConfirmacion cambió de verdad
--      (o sea, se está confirmando/reprogramando/cancelando en este momento), para no pisar
--      la autoría de una confirmación ya hecha con quien edite después cualquier otro campo
--      de esa misma entrega.

create or replace function public._forzar_autoria_real()
returns trigger
language plpgsql
as $$
declare
  campo_creado text := nullif(TG_ARGV[0], '');
  campo_modificado text := nullif(TG_ARGV[1], '');
  correo text := auth.jwt() ->> 'email';
begin
  if correo is null then
    return NEW; -- sin sesión real verificable (no debería pasar, RLS ya lo exige) — no tocar nada
  end if;

  if TG_OP = 'INSERT' then
    if campo_creado is not null then
      NEW.datos := jsonb_set(NEW.datos, array[campo_creado], to_jsonb(correo), true);
    end if;
  elsif TG_OP = 'UPDATE' then
    if campo_creado is not null then
      -- coalesce importante: si la fila vieja nunca tuvo este campo (dato legado, de antes de
      -- este trigger), OLD.datos -> campo_creado da NULL en SQL — y jsonb_set con un valor NULL
      -- devuelve NULL como resultado COMPLETO, lo que borraría toda la columna datos. Si no
      -- había valor previo que preservar, se usa el usuario real actual como mejor alternativa.
      NEW.datos := jsonb_set(NEW.datos, array[campo_creado], coalesce(OLD.datos -> campo_creado, to_jsonb(correo)), true);
    end if;
    if campo_modificado is not null then
      NEW.datos := jsonb_set(NEW.datos, array[campo_modificado], to_jsonb(correo), true);
    end if;
  end if;

  return NEW;
end;
$$;

create or replace function public._forzar_autor_ultimo_elemento()
returns trigger
language plpgsql
as $$
declare
  campo_lista text := TG_ARGV[0];
  campo_autor text := TG_ARGV[1];
  correo text := auth.jwt() ->> 'email';
  len_nuevo int;
  len_viejo int;
begin
  if correo is null then
    return NEW;
  end if;

  len_nuevo := coalesce(jsonb_array_length(NEW.datos -> campo_lista), 0);
  len_viejo := case when TG_OP = 'UPDATE' then coalesce(jsonb_array_length(OLD.datos -> campo_lista), 0) else 0 end;

  if len_nuevo > len_viejo then
    NEW.datos := jsonb_set(
      NEW.datos,
      array[campo_lista, (len_nuevo - 1)::text, campo_autor],
      to_jsonb(correo),
      true
    );
  end if;

  return NEW;
end;
$$;

create or replace function public._forzar_confirmado_por_cumplido()
returns trigger
language plpgsql
as $$
declare
  correo text := auth.jwt() ->> 'email';
  fecha_nueva text := NEW.datos -> 'cumplido' ->> 'fechaConfirmacion';
  fecha_vieja text;
begin
  if correo is null or fecha_nueva is null then
    return NEW;
  end if;
  fecha_vieja := case when TG_OP = 'UPDATE' then OLD.datos -> 'cumplido' ->> 'fechaConfirmacion' else null end;
  if fecha_nueva is distinct from fecha_vieja then
    NEW.datos := jsonb_set(NEW.datos, array['cumplido','confirmadoPor'], to_jsonb(correo), true);
  end if;
  return NEW;
end;
$$;

-- ── Campos simples (creadoPor / modificadoPor de nivel superior) ──

drop trigger if exists _trg_autoria on public.cotizaciones;
create trigger _trg_autoria before insert or update on public.cotizaciones
  for each row execute function public._forzar_autoria_real('creadoPor', '');

drop trigger if exists _trg_autoria on public.disenos_mezcla;
create trigger _trg_autoria before insert or update on public.disenos_mezcla
  for each row execute function public._forzar_autoria_real('creadoPor', 'modificadoPor');

drop trigger if exists _trg_autoria on public.ensayos_calidad;
create trigger _trg_autoria before insert or update on public.ensayos_calidad
  for each row execute function public._forzar_autoria_real('creadoPor', '');

drop trigger if exists _trg_autoria on public.materia_prima;
create trigger _trg_autoria before insert or update on public.materia_prima
  for each row execute function public._forzar_autoria_real('creadoPor', '');

drop trigger if exists _trg_autoria on public.no_conformidades;
create trigger _trg_autoria before insert or update on public.no_conformidades
  for each row execute function public._forzar_autoria_real('creadoPor', '');

drop trigger if exists _trg_autoria on public.ordenes_servicio;
create trigger _trg_autoria before insert or update on public.ordenes_servicio
  for each row execute function public._forzar_autoria_real('creadoPor', '');

drop trigger if exists _trg_autoria on public.producciones;
create trigger _trg_autoria before insert or update on public.producciones
  for each row execute function public._forzar_autoria_real('creadoPor', '');

drop trigger if exists _trg_autoria on public.entregas_programadas;
create trigger _trg_autoria before insert or update on public.entregas_programadas
  for each row execute function public._forzar_autoria_real('creadoPor', '');

-- ── Listas que crecen agregando al final ──

drop trigger if exists _trg_autor_notas on public.cotizaciones;
create trigger _trg_autor_notas before insert or update on public.cotizaciones
  for each row execute function public._forzar_autor_ultimo_elemento('notasSeguimiento', 'autor');

drop trigger if exists _trg_autor_revisiones on public.disenos_mezcla;
create trigger _trg_autor_revisiones before insert or update on public.disenos_mezcla
  for each row execute function public._forzar_autor_ultimo_elemento('revisiones', 'modificadoPor');

drop trigger if exists _trg_autor_reprogramaciones on public.entregas_programadas;
create trigger _trg_autor_reprogramaciones before insert or update on public.entregas_programadas
  for each row execute function public._forzar_autor_ultimo_elemento('reprogramaciones', 'confirmadoPor');

-- ── Campo `cumplido` (objeto, no lista) de entregas_programadas ──

drop trigger if exists _trg_confirmado_cumplido on public.entregas_programadas;
create trigger _trg_confirmado_cumplido before insert or update on public.entregas_programadas
  for each row execute function public._forzar_confirmado_por_cumplido();
