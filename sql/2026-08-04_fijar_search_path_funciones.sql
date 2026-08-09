-- Cierra el warning "Function Search Path Mutable" del Security Advisor de Supabase, para
-- las 4 funciones creadas hoy (es_usuario_centro_costos, _forzar_autoria_real,
-- _forzar_autor_ultimo_elemento, _forzar_confirmado_por_cumplido).
-- Correr una sola vez en el SQL Editor de Supabase (Dashboard > SQL Editor > New query).
--
-- Motivo: una función sin `search_path` fijo puede, en teoría, resolver un nombre de función
-- distinto al esperado si alguien con permiso de crear objetos define una función con el
-- mismo nombre en un esquema que quede antes en la búsqueda — "search path hijacking". Fijar
-- search_path = '' obliga a que todo dentro de la función esté completamente calificado
-- (auth.jwt(), no jwt() a secas); pg_catalog (jsonb_set, coalesce, to_jsonb, etc.) siempre se
-- busca igual sin importar esto, así que no rompe nada de lo que ya está escrito.

alter function public.es_usuario_centro_costos() set search_path = '';
alter function public._forzar_autoria_real() set search_path = '';
alter function public._forzar_autor_ultimo_elemento() set search_path = '';
alter function public._forzar_confirmado_por_cumplido() set search_path = '';
