-- Límites reales (del lado del servidor) para el bucket `laboratorio-pdf`.
-- Correr una sola vez en el SQL Editor de Supabase (Dashboard > SQL Editor > New query).
--
-- Motivo (2026-08-04, auditoría de seguridad — hallazgo medio "validación de archivo subido
-- solo del lado del cliente"): el código ya valida en el navegador que sea un PDF real (firma
-- %PDF-, no solo la extensión) y que pese menos de 25 MB, pero esa validación la puede saltar
-- cualquiera que llame directo a la API con una sesión válida — el navegador es un control de
-- UX, no de seguridad. Esto agrega el control real: Supabase Storage rechaza de plano
-- cualquier archivo que exceda el tamaño o cuyo Content-Type declarado no esté en la lista,
-- sin importar cómo se haga la petición.
--
-- Nota honesta: esto valida el tamaño real del archivo y el Content-Type DECLARADO en la
-- subida — no abre el archivo para verificar que sus bytes son realmente un PDF (eso
-- requeriría una Edge Function que inspeccione el contenido). Sigue siendo una mejora real:
-- cierra el abuso de espacio/costo (tamaño) y obliga a declarar el tipo correcto.

update storage.buckets
set file_size_limit = 26214400, -- 25 MB, igual al límite ya validado en el navegador
    allowed_mime_types = array['application/pdf']
where id = 'laboratorio-pdf';
