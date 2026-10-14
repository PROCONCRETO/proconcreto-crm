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
  | Filas de la lista | Celdas editables, botón ✕ eliminar fila, barra de Agregar/Pegar/Importar/Guardar | Celdas de **solo lectura**, sin acción por fila (la producción se registra en lote con "+ Programar"/"+ Cargar producción", ver sección propia más abajo) | Celdas de **solo lectura**, sin acción por fila (el despacho se registra multi-fila con el botón de arriba) |
  | Botones "+ Programar"/"+ Cargar producción"/"📊 Producción diaria" / "Registrar despacho" + historial | Ocultos | Los 3 de producción visibles | Solo "Registrar despacho" + historial visibles |
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
- `filas[]` — una fila por pieza/grupo de piezas idénticas: `ejesEntre` ("Ejes numéricos" en
  pantalla), `laterales` ("Ejes alfabéticos" en pantalla — mismo nombre interno de siempre, solo
  cambió la etiqueta visible), `cuadro`, campos específicos del sistema (`ancho`/`hilos` para
  Prelosa/Placa Alveolar — **`ancho` se captura en CENTÍMETROS** (2026-10-14, a pedido del
  usuario), se convierte a metros solo dentro de `_pesoFila()` para el cálculo —;
  `tipoVigueta`/`hilosAbajo`/`hilosArriba` para Vigueta), `dimension`,
  `cantidad`, `observaciones`, y `produccion: [{fecha, cantidad, tipo}]` (tipo `Vaciado` o
  `Cortado` — una pieza no estándar cortada de otra en vez de fundida a su propia medida,
  distinción real vista en el Excel de SYMA Andes). Cada fila tiene un `id` propio estable (no
  un `#` correlativo renumerable) para poder referenciarla desde un despacho sin romperse si se
  borra otra fila.
  - **Ejes numéricos/Ejes alfabéticos como "(cuadro) - (cuadro)"** (2026-10-13, a pedido del
    usuario): en modo lista, cada una de estas dos columnas se captura con dos cuadros de texto
    chicos separados por un guion visual, en vez de un solo campo libre — coincide con cómo se
    ve el dato en los Excel reales ("1-1´", "I-G": un eje de inicio y uno de fin). El dato
    SIGUE guardándose como un solo texto combinado (`ejesEntre`/`laterales`, sin cambiar el
    modelo de datos ni el mapeo de Importar/Pegar, que ya traían ese valor combinado en una
    sola celda) — los dos cuadros solo parten y recomponen ese string en memoria
    (`_actualizarParEje()`), partiendo en el primer guion que encuentren. En modo
    producción/despacho se ve de nuevo como un solo texto de solo lectura, sin los cuadros.
  - **Orden de columnas** (2026-10-13, a pedido del usuario): `Cuadro` va en la posición 2,
    justo después del consecutivo `#` — antes de Ejes numéricos/Ejes alfabéticos. El orden
    esperado al pegar desde Excel (`onPasteFilasProduccion()`) se actualizó igual (Cuadro, Ejes
    numéricos, Ejes alfabéticos, ...) — Importar Excel no se vio afectado, mapea por nombre de
    encabezado, no por posición.
  - **Celdas numéricas vacías en una fila nueva, no en "0"** (2026-10-14, a pedido del usuario:
    "deja todos los campos sin datos, pues algunos están incluyendo ceros de entrada que me
    dificultan la digitación") — `agregarFilaProduccion()` sigue inicializando el modelo en 0
    internamente (nada cambia en el dato guardado), pero el `<input>` ya no renderiza
    `value="0"` sino `value=""` cuando el campo está en 0 — así el usuario escribe directo en
    vez de tener que borrar el cero primero. `oninput` sigue guardando 0 si el campo queda
    vacío (`parseFloat(this.value)||0`), mismo comportamiento de siempre.
  - **Columnas más angostas** (2026-10-14, a pedido del usuario: "estamos muy holgados y para
    ver el listado completo me toca mover el scroll") — se redujo el ancho de los `<input>` de
    cada celda (Cuadro 50→40px, Ejes num./alfa. 30→24px cada cuadro, Ancho/Hilos/Vigueta/Hilos
    Abajo/Arriba ~55-60→38-48px, Dimensión 65→50px, Cantidad 55→42px, Observaciones
    110→90px) y el `min-width` de la tabla bajó de 1400px a 980px, para que cupiera completa
    sin scroll horizontal en pantallas normales.
  - **Pend. Producción/Pend. Despacho, una sola por pantalla** (2026-10-13, a pedido del
    usuario: "las listas de producción, pasémoslas tal cual a la ventana de producción como un
    no editable" — la tabla de Producción/Despachos es la MISMA de Listas de Producción, de
    solo lectura, más la única columna de pendiente que le compete a esa área): modo lista no
    muestra ninguna (Ingeniería solo define cantidades, nada se ha producido/despachado
    todavía); modo producción muestra solo "Pend. Producción" (no le compete Despacho); modo
    despacho muestra solo "Pend. Despacho" (no le compete Producción) — mismo criterio ya usado
    en Bovedilla (`bov-columna-produccion`/`bov-columna-despacho`), aplicado también a la tabla
    principal de filas.
  - **🖨️ Imprimir lista de producción** (2026-10-13, a pedido del usuario: "agregamos un botón
    de imprimir listas de producción, donde se pueda seleccionar las filas y de esto me salga
    un imprimible para pasar a planta y puedan ellos fabricar lo que se necesita") — vive en
    modo **producción**, no en modo lista (corregido 2026-10-14, a pedido del usuario: "el
    imprimible debe salir de la ventana de Producción, no de la de Listas de Producción... lo
    hago para que más adelante podamos asignar permisos más fácil a ciertas ventanas a los
    diferentes roles" — Ingeniería solo define la lista, Planta es quien imprime para
    fabricar, y cada pantalla debe poder aislarse por rol a futuro). Cada fila lleva un
    checkbox (`.chk-fila-print`) más uno "marcar todas" en el encabezado
    (`_toggleSeleccionTodasFilas()`); el botón "🖨️ Imprimir" (`losa-btn-imprimir-produccion`,
    junto a "← Volver", visible solo si `_MODO_FLUJO_LOSA === 'produccion'`, mismo lugar donde
    Despachos tiene su "📦 Registrar despacho") llama `imprimirListaProduccion()`: si no hay
    ninguna fila marcada, imprime TODAS (más amigable que bloquear pidiendo una selección);
    construye el documento (tabla de las filas elegidas, SIN columnas de pendiente, de peso, ni
    checkboxes ni botones de acción — es un imprimible estático) y lo muestra en el contenedor
    compartido `#vista-previa`/`#contenido-preview` (el mismo que usa toda la app para vistas
    previas de PDF).
    - **Sin columna de Peso** (2026-10-15, a pedido del usuario: "en este, no es necesario
      incluir la columna de peso") — este imprimible le dice a planta QUÉ fabricar (cuadro,
      ejes, dimensión, cantidad), no cuánto pesa; la columna de Peso sigue viéndose en la
      pantalla normal (`_filaProduccionHTML()`), solo se quitó del imprimible
      (`imprimirListaProduccion()`).
    - **Mismo lenguaje gráfico que los demás documentos oficiales** (2026-10-15, a pedido del
      usuario: "revisa el formato de imprimible de diseño de mezcla para que manejemos el mismo
      lenguaje gráfico") — se reescribió para seguir el mismo molde que
      `verFormatoProduccionAjuste()`/`descargarFormatoProduccionAjuste()`
      (`js/calidad-ajuste-mezcla.js`) y `descargarPDF()` (`js/pdf.js`, la cotización), en vez
      del header/footer con estilo inline propio que tenía antes: membrete real
      (`membrete-top.jpg`) arriba, clases compartidas `css/estilos.css`
      (`.preview-doc`/`.preview-content`/`.preview-tabla`/`.total-row`/`.preview-firma`) para
      el cuerpo, y pie compartido `.preview-membrete-footer` (arco + teléfono/dirección/web)
      abajo — el mismo "papel membretado" que ya usan la cotización y el Formato de Producción
      de Calidad. "⬇️ Descargar PDF" llama `descargarPDFListaProduccion()`, que copia el cuerpo
      completo de `descargarFormatoProduccionAjuste()`: `cargarImagen()`/`_alturaContenidoReal()`/
      `_filaBlancaCerca()` (helpers compartidos, `js/pdf.js`) para paginar a varias páginas A4
      con el membrete repetido en cada una y el corte entre filas (nunca partiendo una fila a la
      mitad) — reemplaza el slicing simple sin membrete que tenía antes (heredado de
      `descargarPDFOrden()`, Órdenes de Producción, que ya no es el patrón que sigue este
      imprimible). Archivo `Lista_Produccion_<nombre de la Losa>_<fecha>.pdf`.
    - **Alineación de la fila de TOTALES** (corregido 2026-10-15, a pedido del usuario: "revisa
      los totales pues no están quedando bien alineados") — el `colspan` de la celda "TOTALES"
      debe cubrir exactamente las columnas antes de "Cant." (# + Cuadro + Ejes num. + Ejes alfa.
      + las 2 o 3 columnas propias del sistema + Dim.) para que el total de piezas caiga debajo
      de "Cant." y el total de metros debajo de "Long. tot." — antes el colspan se quedaba una
      columna corto y los totales aparecían corridos una posición a la izquierda.
    - "← Volver" cierra la vista previa y reactiva `pantalla-losa-detalle` tal como estaba.
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

### Control de Producción — flujo de dos pasos (2026-10-15, a pedido del usuario, reemplaza el
### registro rápido por fila que había antes)

El registro original (botón 🏗️ por fila, `abrirModalProduccionFila()`) se reemplazó por completo
por un flujo de **Programar → Cargar**, igual al que usa la planta en la práctica: primero se
define qué se va a fabricar, después se confirma qué se fabricó de verdad.

- **`losa.produccionesProgramadas[]`** — mismo molde que `despachos[]`: un lote
  `{id, fecha, observaciones, lineas: [{filaId, cantidadProgramada, cantidadReal}]}`.
  `cantidadReal: null` significa que esa línea todavía no se cargó. Vive en memoria mientras se
  edita la Losa (`_programacionesLosaActual`, cargada/guardada junto con `filas`/`despachos`/
  `bovedilla` en `abrirLosaDetalle()`/`_guardarLosaActual()`) — mismo criterio que el resto de
  sub-entidades de una Losa.
- **"+ Programar producción"** (`abrirModalProgramarProduccion()`/`guardarProgramacionProduccion()`)
  — modal con solo las filas que tienen saldo pendiente de producción (mismo filtro y misma UI
  que "📦 Registrar despacho": cantidad por fila, 0 = no se incluye), más fecha y observaciones.
  Crea una entrada nueva en `produccionesProgramadas[]` con todas sus líneas en
  `cantidadReal: null`.
  - **Casilla por fila que autocompleta el pendiente** (`_marcarFilaProgramar()`, 2026-10-15, a
    pedido del usuario: "pueda seleccionar una fila, y automáticamente se programen las
    cantidades pendientes de esa fila, pues por lo general siempre se funden juntas") —
    marcarla pone en "A programar" el pendiente completo de esa fila; desmarcarla lo vuelve a
    dejar en 0. El campo sigue editable a mano aparte, para programar solo una parte. Un
    checkbox "marcar todas" en el encabezado (`_marcarTodasFilasProgramar()`) hace lo mismo con
    todas las filas visibles de una vez.
  - **Filtro "Desde cuadro / Hasta cuadro"** (`_aplicarFiltroCuadroProgramar()`, 2026-10-15, a
    pedido del usuario) — en Losas grandes (Boreal real tuvo 247 filas) acota la tabla a un
    rango contiguo de cuadros. Oculta filas con `display:none` en vez de volver a renderizar la
    tabla, para no perder cantidades ya digitadas en filas que quedan fuera del rango al
    filtrar. Un `cuadro` no numérico queda oculto mientras el filtro esté activo. "Marcar
    todas" respeta el filtro — solo toca las filas visibles.
  - **"🖨️ Imprimir" dentro del propio modal** (`imprimirProgramacionProduccion()`/
    `descargarPDFProgramacionProduccion()`, 2026-10-15, a pedido del usuario: "la idea es poder
    imprimir lo que se espera producir, osea la programación de producción que damos con el
    primer botón" — antes el único botón de imprimir sacaba la Lista de Producción completa,
    no lo que se iba a programar ese día) — a la misma altura de "Guardar programación". Lee lo
    que esté digitado en el modal EN ESE MOMENTO (no hace falta haber guardado antes). Mismo
    lenguaje gráfico que `imprimirListaProduccion()` (membrete + clases compartidas), pero
    titulado "PROGRAMACIÓN DE PRODUCCIÓN", con solo cuadro/ejes/dimensión/cantidad a programar
    — es un plan, no lleva pendientes ni unidades fabricadas. Antes de mostrar la vista previa
    cierra el modal (`cerrarModal('modal-programar-produccion')`) — si no, el fondo oscuro del
    modal (`z-index` más alto) tapa la vista previa por completo. El PDF usa el helper
    compartido `_descargarPDFConMembrete()` (factorizado de `descargarPDFListaProduccion()` en
    esta misma vuelta — ambos imprimibles comparten el 100% de la lógica de paginación con
    membrete, solo cambia qué contenido se captura y el nombre del archivo), con el nombre
    `Programacion_Produccion_<Losa>_<fecha programada>.pdf`.
- **"+ Cargar producción"** (`abrirModalCargarProduccion()`/`_renderLineasCargarProduccion()`/
  `guardarCargaProduccion()`) — selector de las programaciones que todavía tienen alguna línea
  sin cargar; al elegir una, cada línea muestra "lo teórico programado" justo al lado de un
  campo para digitar lo que realmente se produjo (precargado con el valor programado, editable
  por si difiere). **Esta es la única puerta de entrada real a `fila.produccion[]`** — al
  guardar, cada línea con un valor digitado fija su `cantidadReal` (ya no se puede volver a
  cargar ni duplicar) y empuja `{fecha: <fecha de la programación>, cantidad, tipo:'Vaciado',
  programacionId}` a la fila correspondiente. Se puede cargar parcial (dejar algunas líneas en
  blanco para otro día) — las que se dejan en blanco siguen ofreciéndose la próxima vez.
- **Columna "Unidades fabricadas"** (`_filaProduccionHTML()`, justo antes de "Pend.
  Producción", solo en modo producción) = `cantidad − pendienteProducción` — mismo origen que el
  pendiente, solo mostrado desde el otro lado.
- **Pie de "Avance de producción" ponderado por longitud** (`_pieAvanceProduccionHTML()`, fila
  nueva al final de la tabla, solo en modo producción): el avance NO es "filas completas / filas
  totales" ni "piezas hechas / piezas totales" — cada fila pesa según sus metros reales
  (`dimensión × cantidad`), igual que ya usa el imprimible para el total de metros lineales. Una
  fila con pocas piezas muy largas cuenta tanto como le corresponde en metros, no menos que una
  fila con muchas piezas cortas. `% avance = Σ(dimensión×fabricadas) / Σ(dimensión×cantidad)`,
  `% faltante = 100 − % avance`.
- **"📊 Producción diaria"** (`abrirMatrizProduccionDiaria()`) — matriz fila × fecha, mismo
  formato que los Excel reales del usuario (una columna por día de producción, con el total de
  esa fila y el total de ese día). Las fechas salen de `fila.produccion[].fecha` de toda la
  Losa, sin pasar por `produccionesProgramadas` (así también refleja cualquier producción
  antigua que ya existiera antes de este flujo).
- **Selección de filas por checkbox, eliminada** (2026-10-15, a pedido del usuario: "quitemos
  mejor el seleccionable de la primera columna") — existía solo para elegir qué imprimir;
  `imprimirListaProduccion()` ahora imprime siempre todas las filas de la Losa.

### Peso — regresión verificada contra los 2 Excel reales

- Prelosa/Placa Alveolar: `(ancho/100) × dimensión × (espesorCm/100) × densidadKgM3 × cantidad`
  — `ancho` se captura en cm en pantalla (2026-10-14), de ahí el `/100` extra frente a la
  versión original de esta fórmula. Con los valores reales de Boreal (ancho 50 cm, dimensión
  2,24 m, espesor 5 cm, densidad 2400 kg/m³) da **134,4 kg**, el mismo número exacto visto en
  la columna "KG" del Excel real.
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
`_bovedillaLosaActual`/`_programacionesLosaActual`) y recargarlos automáticamente en medio de
una edición en curso borraría
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
