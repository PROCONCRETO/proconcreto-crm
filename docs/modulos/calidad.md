# Módulo: Calidad

El más grande de la aplicación — control técnico de las mezclas de concreto.

## Archivos

- `js/calidad-mezclas.js` (732 líneas) — diseño de mezclas y control de ensayos
- `js/calidad-ajuste-mezcla.js` (674 líneas) — ajustes de mezcla
- `js/calidad-estadisticas.js` (462 líneas) — análisis estadístico
- `js/calidad-trazabilidad.js` (433 líneas) — materia prima, trazabilidad y no conformidades
- `js/compresor-pdf.js` — comprime PDFs pesados (informes de laboratorio) en el navegador antes de subirlos
- `js/lector-informes.js` — lee el informe de laboratorio (PDF) en el navegador para autocompletar el modal de Ensayo

## Datos

- Tablas Supabase: `disenos_mezcla`, `ensayos_calidad`, `materia_prima`, `no_conformidades`, `ajustes_mezcla`
- Bucket de Supabase Storage: `laboratorio-pdf` (privado) — informes de laboratorio en PDF adjuntos a un Ensayo (ver más abajo)

## Pantallas

`diseno-mezcla`, `ajuste-mezcla`, `control-ensayos`, `analisis-estadistico`, `materia-prima`, `trazabilidad`, `no-conformidades`, `certificados-calidad`

## Filtros del histórico (Ajuste Diario y Control de Ensayos)

Ambas pantallas comparten el mismo patrón de filtros para encontrar registros del histórico: búsqueda de texto libre + desplegables de Cliente / Proyecto / Resistencia (tipo de mezcla), poblados dinámicamente solo con los valores que de verdad aparecen en los datos (no una lista fija). En Ajuste Diario: `_clientesProyectosAjuste()`, `poblarFiltrosAjustesLista()`, `_ajustesFiltrados()` (`js/calidad-ajuste-mezcla.js`). En Control de Ensayos: `_clientesProyectosEnsayo()`, `poblarFiltrosEnsayosLista()`, `_ensayosFiltrados()` (`js/calidad-mezclas.js`) — este último agrega también un filtro de Estado (En curado/Cumple/No cumple) y el botón "Imprimir Reporte", que Ajuste Diario no tiene.

## Informe de laboratorio adjunto (Control de Ensayos)

Cada día se ajusta la mezcla por humedad (Ajuste Diario) y a ese ajuste se le asigna un lote de cilindros (N° de cilindro); ese lote es el que se ensaya y sobre el que el laboratorio (campo "Laboratorio" del ensayo: CONSUAS INGENIERÍA, ASPRECON INGENIERÍA, o interno) manda su informe en PDF. Por eso el PDF se adjunta en el modal de **Nuevo/Editar Ensayo**, ligado siempre a ese N° de cilindro — no en Materia Prima, que es sobre insumos (cemento, arena, etc.), un concepto distinto.

- **Compresión automática por tamaño**: si el PDF pesa más de 300 KB (`_PDF_COMPRESION_UMBRAL` en `js/compresor-pdf.js`), se re-renderiza en el navegador a ~200 dpi y se reconstruye como JPEG al 20% de calidad (`_comprimirPdf()`) — esos valores se probaron a mano contra PDFs reales de laboratorio antes de fijarlos: bajar la resolución de más difumina texto/tablas, pero la calidad JPEG sí se puede bajar bastante en un documento de fondo blanco con texto negro sin que se note. Si el PDF ya es liviano (por debajo del umbral — típicamente el de un laboratorio que entrega el informe nativo, no escaneado), se sube tal cual.
- **Dónde se guarda**: bucket privado `laboratorio-pdf` en Supabase Storage (no público — solo usuarios autenticados de la app pueden subir/ver/borrar, mismas policies que el resto de la app). El registro de `ensayos_calidad` solo guarda la referencia (`pdfPath`, `pdfNombre`), no el archivo. Para verlo se genera una URL firmada de una hora (`_abrirPdfStorage()`), no un link público directo.
- **Nombre de archivo saneado**: Supabase Storage rechaza rutas con espacios, tildes u otros caracteres fuera de ASCII básico ("Invalid key") — `_sanearNombreArchivo()` en `js/compresor-pdf.js` arma la ruta interna sin esos caracteres; el nombre que ve el usuario (`pdfNombre`) sigue siendo el original tal como se subió.
- **Sin duplicados cuando un informe cubre varios cilindros**: un mismo PDF de laboratorio a veces reporta varios cilindros a la vez. Al elegir el archivo, se calcula su huella SHA-256 (`_hashArchivo()`) y se compara contra `pdfHash` de los demás ensayos ya guardados — si coincide, ese ensayo reutiliza la misma copia en Storage (mismo `pdfPath`) en vez de subir un duplicado; la zona de subida lo marca como "🔗 mismo informe que el ensayo ENS-00XX, no se duplica". Como varios ensayos pueden compartir el mismo archivo, `eliminarEnsayo()` solo borra el PDF de Storage si ningún otro ensayo lo sigue referenciando.
- **Cuándo se sube de verdad**: el archivo se procesa (comprime o no) apenas se elige, pero la subida real a Storage ocurre recién al hacer clic en "Guardar" (`guardarEnsayo()`, ahora async) — así no quedan archivos huérfanos en Storage si se cancela el modal sin guardar. Al eliminar un ensayo también se borra su PDF de Storage.
- Un botón "📄 Ver PDF" aparece en la fila de la tabla de Control de Ensayos cuando el registro tiene uno adjunto.
- **Descarga masiva**: el botón "📦 Descargar informes" (junto a "🖨️ Imprimir Reporte") arma un .zip con los informes de TODOS los ensayos que cumplen los filtros activos (Cliente/Proyecto/Resistencia/Estado/búsqueda) — pensado para bajar de una vez, por ejemplo, todos los informes de un proyecto o de un diseño de mezcla puntual. Usa JSZip (CDN) para armar el .zip en el navegador; cada ensayo sin informe adjunto se omite en silencio (`descargarInformesZip()` en `js/calidad-mezclas.js`).
- **Lectura automática del informe** (`js/lector-informes.js`, mismo principio que el lector de RUT — todo en el navegador, nunca se sube el PDF crudo a ningún lado más que a Storage): requiere elegir el **N° de Cilindro primero** — a propósito, así el lector no tiene que adivinar a cuál de las muestras del PDF corresponde este ensayo (un informe puede cubrir varios cilindros a la vez). Al soltar el archivo, busca dentro del PDF la fila de ESE cilindro puntual y autocompleta: Laboratorio (por la marca del membrete/pie — hoy reconoce ASPRECON y CONSUAS), Fecha de ensayo y las resistencias por probeta (agrega un resultado nuevo a "Resultados por edad"), y Observaciones (códigos de probeta tipo "T2-21, T2-22..."). Si el informe cubre otro cilindro también, se repite el proceso en un ensayo nuevo con el mismo PDF — no se duplica en Storage (ver deduplicación arriba). Es un lector de mejor esfuerzo: si no reconoce el laboratorio o no encuentra resistencias para ese cilindro, lo dice explícitamente en la zona de subida en vez de fallar en silencio, y nunca guarda nada solo — siempre queda en el formulario para revisar antes de Guardar.

## Qué hace

Gestiona el diseño técnico de cada mezcla de concreto, sus ajustes, los ensayos de calidad (resistencia, etc.), la trazabilidad de materia prima usada, el registro de no conformidades y la emisión de certificados de calidad para el cliente.
