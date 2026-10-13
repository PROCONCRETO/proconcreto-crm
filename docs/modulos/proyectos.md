# Módulo: Proyectos (2026-10-11)

## Archivos

- `js/proyectos.js`
- `sql/2026-10-11_proyectos.sql` (correr una sola vez en el SQL Editor de Supabase)
- `js/losas-proyecto.js` — extensión de Lista de Producción/Control de Producción/Despacho (ver sección propia más abajo)
- `sql/2026-10-11_losas_proyecto.sql` (correr una sola vez; incluye además las instrucciones para crear a mano el bucket de Storage `proyectos-pdf`)

## Datos

- Tabla Supabase: `proyectos` (`id text primary key`, `datos jsonb` — mismo patrón que el resto de la app)
- Tabla Supabase: `losas_proyecto` (mismo molde — ver sección propia)
- RLS: abierto a cualquier usuario autenticado, sin restricción por correo (mismo criterio que `clientes`/`cotizaciones` — todo el equipo necesita leer y escribir)

## Pantallas

- `pantalla-proyectos` — listado + modal de crear/editar, sin subnav propio.
- `pantalla-proyecto-carpetas` — carpetas-ícono de un proyecto (ver sección propia).
- `pantalla-proyecto-documentos` — Memorias de Cálculo / Planos de Producción reunidos (ver sección propia).
- `pantalla-proyecto-losas` — Losas de un proyecto, en modo "lista" o "producción" (ver sección propia).
- `pantalla-losa-detalle` — lista de producción de una Losa, o su seguimiento de producción/despacho según el modo (ver sección propia).

## Qué hace

A pedido del usuario: "vamos a crear una nueva ventana de PROYECTOS... incluyela en la pantalla de inicio y en la fila superior con las demás ventanas". Al preguntar qué debía mostrar/gestionar, eligió explícitamente **"gestión de proyectos como entidad nueva"**: un registro propio (nombre, cliente, ciudad, estado, fechas, responsable, descripción), **independiente** de lo que ya existe en Clientes (`cliente.proyectos[]`) y Cotizaciones (`cot.cliente.proyecto`) — no reutiliza ni modifica esas estructuras, son conceptos separados que coexisten.

- **Campos de un Proyecto**: `nombre` (único obligatorio), `cliente` (texto libre, con buscador contra `CLIENTES` para autocompletar — no obliga a que el cliente ya exista en el catálogo), `ciudad`, `estado` (`Planeación` / `En ejecución` / `Finalizado` / `Cancelado`), `fechaInicio`, `fechaFinEstimada`, `responsable` (texto libre), `descripcion`.
- **Listado** (`renderProyectos()`): desde el 2026-10-13, a pedido del usuario ("en vez de un listado de proyectos, iconos de acceso para los proyectos... tamaño similar a los iconos de la pantalla de inicio"), ya no es una tabla — es una grilla de tarjetas-ícono, una por proyecto, reusando tal cual las clases `.inicio-grid`/`.inicio-modulo` (`css/estilos.css`) que ya arma el grid de módulos de Inicio, para que el tamaño quede idéntico sin duplicar CSS. Buscador (nombre/cliente/ciudad) y filtro por estado, más reciente primero. Cada tarjeta: ícono 🏗️, nombre, cliente como subtítulo, badge de color según el estado, y dos botones chiquitos "✏️"/"🗑️" con `stopPropagation` (para no disparar también el clic de la tarjeta). **El clic en la tarjeta misma entra a las Carpetas de ese proyecto** (`abrirCarpetasProyecto()`, ver sección propia más abajo) — es la puerta de entrada a todo lo demás del proyecto.
- **Ubicación en la navegación**: botón nuevo en la barra superior y en la pantalla de Inicio, **entre Calidad y Centro de Costos** (a pedido explícito del usuario: "pongamos la de proyectos al lado de la de calidad... movamos la ventana de costos para el extremo derecho" — Centro de Costos ya estaba al final, insertar Proyectos justo antes deja ambos pedidos resueltos a la vez).
- **Sin subnav propio todavía** — `activarModulo('proyectos')` va directo a la única pantalla, a diferencia de los demás módulos (que siempre muestran su barra de sub-pestañas). Se puede agregar más adelante si el módulo crece (ej. una vista de estadísticas).
- Verificado con un arnés real — 32 aserciones: el orden de los botones en la barra superior y en Inicio; la navegación activa/desactiva las pantallas correctas; el estado vacío; crear un proyecto completo de punta a punta (validación de Nombre obligatorio, el upsert real hacia Supabase, el modal cerrando y la tabla mostrando el registro); editar sin duplicar y sin perder `creadoEn`; el buscador de cliente; los filtros de estado y de búsqueda; eliminar con su `delete` real; y que los demás módulos (Calidad, Cotizaciones, Inicio) siguen funcionando igual que antes — sin errores de consola.

## Carpetas de un proyecto y separación Ingeniería/Producción/Despachos (2026-10-13)

A pedido del usuario, en 3 pasos el mismo día: primero "incluyamos subcarpetas por ahora, de,
memorias de cálculo, planos de producción, listas de producción, producción y despachos, todas
a modo de ícono"; después la razón de fondo, "vamos a independizar las listas de producción,
que salen del departamento de ingeniería como un insumo para el área de producción, la cual al
hacer la producción, genera un insumo para el área de despachos"; y por último "partamos
producción de despachos en dos carpetas diferentes" — no es solo una reorganización visual, es
un flujo real entre **3 áreas** con una sola dirección: Ingeniería → Producción → Despachos,
cada una con su propia carpeta.

- **`pantalla-proyecto-carpetas`** (`abrirCarpetasProyecto()`): 5 tarjetas-ícono, mismo tamaño
  `.inicio-modulo` que el resto de la app, con un conteo en cada una:
  - 📐 **Memorias de Cálculo** y 📋 **Planos de Producción** → `abrirDocumentosProyecto('memoria'|'plano')`
    → `pantalla-proyecto-documentos`: junta en una sola tabla los PDF que **ya se adjuntan por
    Losa** (`planoPath`/`memoriaCalculoPath`, ver sección de Losas) de TODAS las losas del
    proyecto — no duplica el archivo ni reinventa la subida, solo reúne lo que Ingeniería ya
    adjuntó al crear/editar cada Losa, para no tener que entrar losa por losa a buscarlo.
  - 📄 **Listas de Producción**, 🏗️ **Producción** y 📦 **Despachos** → las 3 llaman
    `abrirLosasDeProyecto(modo)` con `modo` = `'lista'` / `'produccion'` / `'despacho'` — la
    MISMA pantalla de Losas y el MISMO registro de Losa por debajo, pero con permisos y
    contenido distintos (ver abajo).

- **`_MODO_FLUJO_LOSA`** (`'lista'` | `'produccion'` | `'despacho'`, variable de módulo en
  `js/losas-proyecto.js`): decide qué puede hacer y qué ve cada pantalla reusada:
  | | `lista` (Ingeniería) | `produccion` (Planta) | `despacho` (Logística) |
  |---|---|---|---|
  | `pantalla-proyecto-losas` | "+ Nueva Losa", ✏️ Editar, 🗑️ Eliminar visibles | Solo "🏗️ Ver producción" | Solo "📦 Ver despachos" |
  | Filas de la lista | Celdas editables, botón ✕ eliminar fila, barra de Agregar/Pegar/Importar/Guardar | Celdas de **solo lectura**, botón 🏗️ para registrar producción | Celdas de **solo lectura**, sin acción por fila (el despacho se registra multi-fila con el botón de arriba) |
  | Botón "Registrar despacho" / historial de despachos | Ocultos | Ocultos | Visibles |
  | Bovedilla | `tipo`/`cantidadRequerida` editables, sin seguimiento | Solo lectura + SOLO columna "Entradas (producción)" | Solo lectura + SOLO columna "Salidas (despacho)" |

  Lo que Ingeniería define (cuadro, dimensión, cantidad, tipo/cantidad de bovedilla) nunca se
  puede tocar desde Producción ni desde Despachos — ahí solo se **consume** como insumo de solo
  lectura. Y ahora tampoco se mezclan entre sí: Producción no ve ni registra despachos, y
  Despachos no ve ni registra producción — cada una ve solo lo suyo (`bov-columna-produccion`/
  `bov-columna-despacho` se muestran una a la vez, nunca juntas fuera del modo lista). El
  resumen de Bovedilla también quedó partido: en modo producción solo menciona "Producido/
  Pendiente producción", en modo despacho solo "Despachado/Pendiente despacho" — antes mostraba
  ambos pares juntos. Pendiente de producción/despacho se sigue calculando igual en los 3 modos
  (`Math.max(0, total − Σeventos)`).

- Pantallas reusadas, no duplicadas: en vez de crear 3 pantallas HTML separadas (una por cada
  modo), se mantuvo una sola `pantalla-losa-detalle` y `pantalla-proyecto-losas`, con varios
  bloques (`#losa-barra-lista`, `#losa-btn-registrar-despacho`, `#losa-card-despachos`,
  `#bov-campos-editables`, `#bov-columna-produccion`/`#bov-columna-despacho`, botones Editar/
  Eliminar/Nueva Losa) que se muestran/ocultan según `_MODO_FLUJO_LOSA` — mismo registro de
  Losa, misma lógica de cálculo, una sola fuente de verdad.

- Verificado con dos arneses reales — 43 aserciones para la primera versión (Carpetas + modos
  lista/producción) y 29 más para la partición en Producción/Despachos: el clic en una tarjeta
  de proyecto entra a Carpetas; las 5 carpetas (ya no 4) con sus conteos correctos; Documentos
  reúne los PDF de las losas que sí tienen adjunto; en modo lista las celdas son editables y el
  guardado persiste; en modo producción las celdas aparecen de solo lectura con el botón de
  registrar producción funcionando (sin ningún rastro de despacho — botón e historial ocultos);
  en modo despacho aparece el botón de registrar despacho multi-fila funcionando y el historial
  visible (sin ningún rastro de producción — sin botón por fila); Bovedilla muestra solo la
  columna y el resumen que corresponden a cada modo, nunca ambos a la vez fuera de modo lista —
  sin errores de consola.

## Losas / Lista de Producción / Control de Producción y Despacho (2026-10-11)

A pedido del usuario, tras revisar en detalle 3 proyectos reales ya ejecutados (Edificio Boreal
Sohnos — Prelosa; SYMA Tarso y SYMA Andes — Vigueta y Bovedilla): "donde tendríamos más
utilidad sería en atender lo relacionado a las listas de producción y al desarrollo y control
en producción y despachos" — se descartó explícitamente construir el motor de cálculo
estructural (memorias de cálculo, ingeniería real de pretensado) por su alcance y riesgo, y se
priorizó digitalizar el flujo real: plano → distribución por cuadros → **lista de
producción** → **control de producción** → **control de despacho**.

### Por qué una entidad "Losa" y no una lista plana por proyecto

Revisando el Excel real de SYMA Andes (28 "Órdenes de Fabricación" distintas, una por cada
combinación de piso/torre) quedó claro que un proyecto grande no tiene una sola lista — tiene
una **Losa** por cada nivel/torre, cada una con su propia lista de producción. Boreal (un
edificio más chico) solo necesitó 2. El modelo soporta ambos casos sin cambios.

### Modelo de datos — tabla `losas_proyecto`

Un registro `datos jsonb` por Losa (mismo molde `id/datos/creado/modificado` del resto de la
app), con **todo anidado adentro** (filas, despachos, bovedilla) — mismo criterio que ya usa
Despiece de Acero en Costeo de Producto: nadie necesita sincronizar en tiempo real una sola
fila suelta, la Losa completa es la unidad natural de guardado/sincronización.

- `proyectoId`, `nombre`, `ubicacion` (torre, opcional), `sistema` (`prelosa` /
  `vigueta_bovedilla` / `placa_alveolar`), `estado`.
- `espesorCm`/`densidadKgM3` (Prelosa/Placa Alveolar) o `pesoFactorKgM` (Vigueta) — factor
  simple para calcular el peso de cada fila, editable por Losa (no es todavía una tabla de
  referencia tipo `VARILLAS_ACERO` — no hay suficiente variedad confirmada como para
  justificarla; se puede migrar más adelante si el usuario nota que repite los mismos valores
  entre proyectos).
- `planoPath`/`planoNombre`, `memoriaCalculoPath`/`memoriaCalculoNombre` — PDF opcionales,
  bucket `proyectos-pdf`, mismo mecanismo exacto que ya usa Calidad para informes de
  laboratorio (`js/compresor-pdf.js`: comprimir si pesa, sanear el nombre, subir recién al
  Guardar) — reutilizado tal cual, sin duplicar lógica.
- `filas[]` — una fila por pieza/grupo de piezas idénticas: `ejesEntre`, `laterales`,
  `cuadro`, campos específicos del sistema (`ancho`/`hilos` para Prelosa/Placa Alveolar;
  `tipoVigueta`/`hilosAbajo`/`hilosArriba` para Vigueta), `dimension`, `cantidad`,
  `observaciones`, y `produccion: [{fecha, cantidad, tipo}]` (tipo `Vaciado` o `Cortado` — una
  pieza no estándar cortada de otra en vez de fundida a su propia medida, distinción real vista
  en el Excel de SYMA Andes). Cada fila tiene un `id` propio estable (no un `#` correlativo
  renumerable) para poder referenciarla desde un despacho sin romperse si se borra otra fila.
- `despachos[]` — **a nivel de Losa, no por fila**: `{remision, fecha, observaciones,
  lineas: [{filaId, cantidad}]}` — una remisión real cubre varias filas a la vez, mismo
  espíritu que ya usa Logística con `viaje.entregas[].productos[]`.
- `bovedilla` (solo si `sistema === 'vigueta_bovedilla'`, si no `null`) — **sin desglose por
  fila**, a pedido explícito del usuario ("no es tan riguroso su control más allá de cantidad
  de entradas de producción y salidas... como fabricar un bloque de cemento"): `tipo`,
  `cantidadRequerida`, `produccion: [{fecha,cantidad}]`, `despacho: [{remision,fecha,cantidad}]`.
- **No se modela una dualidad "cantidad original/cantidad nueva"** — se vio en el Excel de SYMA
  Andes (correcciones de campo), pero el usuario confirmó que no es un patrón recurrente. Cada
  fila lleva un único valor vigente + `observaciones` libres.

### Pendientes — mismo patrón ya usado en Logística/Órdenes de Producción

`Math.max(0, total − Σ(eventos))`, **siempre recalculado en vivo**, nunca cacheado:
- Pendiente de producción de una fila = `cantidad − Σ(fila.produccion[].cantidad)`.
- Pendiente de despacho de una fila = `cantidad − Σ(sobre TODOS los despachos de la Losa, las
  líneas cuyo `filaId` sea esta fila)`.
- Mismo cálculo para Bovedilla, con `cantidadRequerida` en vez de `cantidad` por fila.

### Peso — regresión verificada contra los 2 Excel reales

- Prelosa/Placa Alveolar: `ancho × dimensión × (espesorCm/100) × densidadKgM3 × cantidad` — con
  los valores reales de Boreal (ancho 0,5 m, dimensión 2,24 m, espesor 5 cm, densidad
  2400 kg/m³) da **134,4 kg**, el mismo número exacto visto en la columna "KG" del Excel real.
- Vigueta: `dimensión × pesoFactorKgM × cantidad` — con los valores reales de SYMA Andes
  (dimensión 2,84 m, factor 21,5 kg/ml de la vigueta H11) da **61,06 kg**, también el número
  exacto visto en el Excel real.

### Carga de las 100-250+ filas por Losa — las 3 formas (a pedido del usuario)

Capturarlas una por una sería impracticable (Boreal tuvo 247 filas en una sola losa):
1. **Fila por fila** (`agregarFilaProduccion()`) — igual al patrón ya usado en Despiece de
   Acero de Costeo de Producto.
2. **Pegar desde Excel** (`onPasteFilasProduccion()`, listener `onpaste` sobre la tabla) —
   parsea el texto del portapapeles (filas por salto de línea, columnas por tab) en el mismo
   orden de columnas que la tabla visible.
3. **Importar archivo Excel/CSV** (`onSeleccionImportarFilas()`) — reusa SheetJS (ya cargado en
   la app) y `_normHdr()` (`js/catalogo.js`, el mismo helper que ya usa el import de Catálogo)
   para mapear columnas por nombre de encabezado, tolerante a mayúsculas/tildes — funciona
   directo con los Excel reales de la empresa (mismos encabezados vistos en Boreal/SYMA:
   CUADRO, DIMENSIONES, CANTIDAD...). Busca la fila de encabezados aunque no sea la primera
   (los Excel reales traen un título arriba).

`guardarListaProduccion()` solo descarta filas 100% vacías (mismo criterio que
`guardarDespieceAcero()`), nunca las parcialmente llenas.

### Navegación — pantalla nueva, no un patrón ya existente

No existe en la app ningún patrón de "pantalla completa con alcance a un registro padre"
(confirmado explorando el código antes de construir esto) — se armó uno a mano: variables de
estado (`_PROYECTO_ACTIVO_ID`/`_LOSA_ACTIVA_ID`/`_MODO_FLUJO_LOSA`) + activar/desactivar
`.pantalla` directamente, sin pasar por `ir()`/subnav (esas funciones no soportan pantallas
parametrizadas por id). Se entra desde la tarjeta de un proyecto en `pantalla-proyectos` → las
Carpetas del proyecto → según la carpeta elegida, Losas en modo lista o en modo producción (ver
sección "Carpetas de un proyecto..." más arriba).

**Realtime**: `pantalla-proyecto-losas` sí se refresca automáticamente
(`rerenderPantallaActiva()`); `pantalla-losa-detalle` **a propósito no** — esa pantalla trabaja
sobre arreglos de edición en memoria (`_filasLosaActual`/`_despachosLosaActual`/
`_bovedillaLosaActual`) y recargarlos automáticamente en medio de una edición en curso borraría
cambios sin guardar — mismo criterio ya aceptado en Ajustes de Mezcla (valores "congelados"
mientras se edita).

### Fuera de alcance en esta vuelta (conocido, no es un olvido)

- Motor de cálculo estructural (memorias de cálculo) — descartado explícitamente por el
  usuario, alcance de ingeniería real, no un CRUD.
- Tabla de referencia reutilizable para el factor de peso de vigueta (tipo `VARILLAS_ACERO`) —
  por ahora es un campo simple por Losa.
- Eliminar un Proyecto no borra en cascada sus Losas — una Losa huérfana (con `proyectoId`
  apuntando a un proyecto ya borrado) queda en la tabla pero no es alcanzable desde la
  navegación; no se automatizó la limpieza, es un caso borde poco frecuente.

Verificado con un arnés real — 68 aserciones (incluye las de la sección original de arriba):
crear una Losa de cada sistema (Prelosa y Vigueta y Bovedilla) y confirmar que el modal muestra
solo los campos relevantes a cada una; navegación Proyectos → Losas → Detalle y de vuelta;
columnas de la tabla de filas correctas según el sistema; las 3 formas de cargar filas,
incluyendo un `.xlsx` real armado en memoria con los mismos encabezados que trae el Excel real
de la empresa; el peso calculado exacto contra los 2 casos reales (Boreal y SYMA Andes);
control de producción por fila con su pendiente recalculado; control de despacho multi-fila
por remisión, confirmando que una fila NO incluida en una remisión conserva su pendiente
intacto; Bovedilla (entradas/salidas, rechazo de un despacho sin remisión); adjuntar un PDF
real (firma `%PDF-` válida) y el rechazo de uno sin esa firma; eliminar una Losa con Deshacer —
sin errores de consola.
