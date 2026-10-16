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
- **Listado** (`renderProyectos()`): desde el 2026-10-13, a pedido del usuario ("en vez de un listado de proyectos, iconos de acceso para los proyectos... tamaño similar a los iconos de la pantalla de inicio"), ya no es una tabla — es una grilla de tarjetas-ícono, una por proyecto, reusando tal cual las clases `.inicio-grid`/`.inicio-modulo` (`css/estilos.css`) que ya arma el grid de módulos de Inicio, para que el tamaño quede idéntico sin duplicar CSS. Buscador (nombre/cliente/ciudad) y filtro por estado, más reciente primero. Cada tarjeta: ícono 🏗️, nombre, cliente como subtítulo, badge de color según el estado, y dos botones chiquitos "✏️"/"🗑️" con `stopPropagation` (para no disparar también el clic de la tarjeta). **El clic en la tarjeta misma entra a las Carpetas de ese proyecto** (`abrirCarpetasProyecto()`, ver sección propia más abajo) — es la puerta de entrada a todo lo demás del proyecto. (2026-10-16: se probó primero poner acá mismo, por tarjeta, botones de atajo a las subventanas — el usuario aclaró que no era eso: lo que quería era una sub-navegación tipo Cotizaciones y Ventas, debajo de la barra superior; ver "Sub-navegación dinámica de Proyectos" más abajo. Ese primer intento se revirtió del todo.)
- **Ubicación en la navegación**: botón nuevo en la barra superior y en la pantalla de Inicio, **entre Calidad y Centro de Costos** (a pedido explícito del usuario: "pongamos la de proyectos al lado de la de calidad... movamos la ventana de costos para el extremo derecho" — Centro de Costos ya estaba al final, insertar Proyectos justo antes deja ambos pedidos resueltos a la vez).
- **Sub-nav propia, dinámica** (2026-10-16, ver sección "Sub-navegación dinámica de Proyectos" más abajo) — `activarModulo('proyectos')` sigue yendo directo a la grilla de todos los proyectos (sin subnav visible ahí, nada que mostrar todavía), pero una vez dentro de un proyecto aparece una fila de sub-navegación igual en estilo a la de los demás módulos.
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
  | Filas de la lista | Celdas editables, botón ✕ eliminar fila, barra de Agregar/Pegar/Importar/Guardar | Celdas de **solo lectura**, sin acción por fila (la producción se registra en lote con "+ Programar"/"+ Cargar producción", ver sección propia más abajo) | Celdas de **solo lectura**, sin acción por fila (el despacho se registra en lote con "+ Programar"/"+ Cargar despacho", mismo patrón que Producción, ver sección propia más abajo) |
  | Botones "+ Programar"/"+ Cargar producción"/"📊 Producción diaria" / "+ Programar"/"+ Cargar despacho" | Ocultos | Los 3 de producción visibles | Los 2 de despacho visibles |
  | Tarjeta "🏗️ Producciones registradas" / "📦 Despachos registrados" (siempre visible, no un botón) | Ocultas | Solo "Producciones registradas" | Solo "Despachos registrados" |
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
  - **Ancho estandarizado — SOLO prelosa, no placa alveolar** (2026-10-16, a pedido del usuario:
    "para las prelosas, el ancho del elemento no se debe salir de 20 30 40 o 50cm por
    estandarización. no puede ser menos, no puede ser mas ni puede ser intermedio") —
    `ANCHOS_ESTANDAR_PRELOSA = [20, 30, 40, 50]`, validado en dos capas: (1) al terminar de
    escribir el ancho en modo lista (`onchange`, no `oninput` — para no interrumpir a mitad de
    tecleo), `_validarAnchoPrelosa(i)` avisa y resetea a 0 si el valor no es uno de los 4
    válidos; (2) al Guardar (`guardarListaProduccion()`), un bloqueo real que SÍ impide guardar
    si queda algún ancho fuera del estándar — cubre Pegar/Importar además de la digitación
    manual, que son las otras 2 vías por las que un ancho inválido podría colarse sin pasar por
    el input. Placa Alveolar usa el mismo campo `ancho` pero NO tiene esta restricción — el
    usuario fue explícito en que es "para las prelosas".
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
  - **🖨️ Imprimir lista de producción — QUITADO (2026-10-16)**. Existió entre el 2026-10-13 y
    el 2026-10-16 un botón en la barra superior del modo producción que imprimía la Lista de
    Producción completa (todas las filas, con membrete real, mismo lenguaje gráfico que
    `verFormatoProduccionAjuste()` en Calidad). Se quitó por quedar redundante: una vez que
    existió el imprimible de "+ Programar producción" (ver más abajo), que sí refleja el plan
    real del día, nadie usaba ya el de la lista completa — confirmado con el usuario
    ("¿qué función quedó cumpliendo el botón de imprimir... no sería reemplazado por el que
    tenemos ya en las programaciones de producción?"). `imprimirListaProduccion()`/
    `descargarPDFListaProduccion()` y el botón `losa-btn-imprimir-produccion` se eliminaron del
    todo; el helper compartido `_descargarPDFConMembrete()` se conservó porque lo sigue usando
    `descargarPDFProgramacionProduccion()`.
- `despachos[]` — **a nivel de Losa, no por fila**: `{remision, fecha, observaciones,
  lineas: [{filaId, cantidad}]}` — una remisión real cubre varias filas a la vez, mismo
  espíritu que ya usa Logística con `viaje.entregas[].productos[]`. Sigue siendo el libro real
  de remisiones (sin cambios en su forma), ahora alimentado por "+ Cargar despacho" en vez de
  directo por el usuario — ver "Control de Despacho" más abajo.
- `despachosProgramados[]` — mismo molde EXACTO que `produccionesProgramadas[]` (ver "Control de
  Producción" más abajo): `{id, fecha, observaciones, lineas: [{filaId, cantidadProgramada,
  cantidadReal}]}`, más `remision` una vez que se carga por primera vez. Es el PLAN; `despachos[]`
  sigue siendo el libro REAL — misma separación plan/real que ya existe entre
  `produccionesProgramadas[]` y `fila.produccion[]`.
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
  - **Filtros por tipo, combinables** (`TIPOS_FILTRO_PROGRAMAR`, `_agregarFiltroProgramar()`,
    `_aplicarFiltrosProgramar()`, 2026-10-15, a pedido del usuario: "hagamos que pueda uno
    seleccionar el tipo de filtro a aplicar... permite agregar filtros adicionales, de forma
    tal que pueda yo por ejemplo acotar entre ejes A y C y ejes 3 y 4... o entre los cuadros 10
    al 30, de 50cm de ancho" — sustituye el filtro fijo original de "Desde/Hasta cuadro") — en
    Losas grandes (Boreal real tuvo 247 filas) acota la tabla por el criterio que haga falta en
    vez de buscar a mano. Botón "+ Agregar filtro" agrega una fila con: selector de tipo
    (Entre cuadros / Entre ejes numéricos / Entre ejes alfabéticos / Ancho de prelosa / Número
    de hilos — estas dos últimas solo aparecen si el sistema no es vigueta, no existen ahí) +
    un área de valor que cambia según el tipo elegido + botón ✕ para quitarla. Se pueden agregar
    varios filtros de tipos distintos a la vez, combinados con Y (una fila solo se ve si pasa
    TODOS los filtros activos). Oculta filas con `display:none` en vez de volver a renderizar la
    tabla, para no perder cantidades ya digitadas en filas que quedan fuera del filtro. "Marcar
    todas" respeta el filtro — solo toca las filas visibles. Misma lógica exacta en Programar
    despacho (prefijo `mpd` en vez de `mpp`, funciones compartidas).
    - **Ejes numéricos/alfabéticos: Desde/Hasta, por CONTENCIÓN** — el valor de la fila ya es en
      sí un rango ("1-2", "A-B"); "pasa el filtro" si ese rango queda COMPLETO dentro del rango
      pedido (`_parRangoFiltro()` + comparación en `_filaPasaFiltroProgramar()`); un rango de
      fila al revés ("C-A") se normaliza antes de comparar. **Corregido 2026-10-19** — la
      primera versión (2026-10-15) usaba CRUCE en vez de contención ("un cuadro que va de eje 2
      a eje 5 sí aparece al filtrar 'entre eje 3 y 4', porque pasa por esa zona del plano"); el
      usuario reportó el bug real: "cuando aplico los filtros de los ejes numéricos y
      alfabéticos, me está mostrando cuadros que no pertenecen a dichos ejes" — un cuadro que
      solo TOCA el borde del rango pedido (ej. "2-3" al filtrar "3 a 4") no "pertenece" a ese
      rango para el usuario, aunque técnicamente se cruce con él. Ahora usa el mismo criterio que
      ya tenían cuadro/ancho/hilos (contención simple), más consistente y menos sorprendente.
    - **Ancho de prelosa / Número de hilos: UN SOLO desplegable de valor exacto** (`soloValorUnico`
      en `TIPOS_FILTRO_PROGRAMAR`, `_valoresDisponiblesFiltro()`, 2026-10-19, a pedido del
      usuario: "se nos debe habilitar solamente una casilla para las opciones de número de
      hilos y ancho, que sea un desplegable con los anchos y número de hilos que hay disponibles
      en la lista") — a diferencia de Desde/Hasta, estos dos campos no son un rango libre sino
      valores estandarizados y pocos (20/30/40/50cm de ancho, unos pocos conteos de hilos), así
      que el filtro muestra UN desplegable con "Todos" + los valores que de verdad existen entre
      las filas de esa Losa en ese momento (no una lista fija) — elegir compara por IGUALDAD
      exacta, no por rango. Cambiar el tipo de filtro reconstruye el área de valor
      (`_cambiarTipoFiltroProgramar()`/`_filtroValorAreaHTML()`) — Desde/Hasta para
      cuadro/ejes, el desplegable de valor único para ancho/hilos, en cualquier dirección.
  - **Columnas "Ejes num."/"Ejes alfa." en la tabla del propio modal** (2026-10-19, a pedido del
    usuario: "agreguemos nuevamente los ejes numéricos y alfabéticos en el cuadro que se abre de
    programación de despachos y de producción") — de solo lectura, junto a "Cuadro", mismo valor
    crudo que ya alimenta el filtro por ejes — deja verificar a simple vista qué cuadro cae en
    qué eje, sin tener que adivinar o cruzar con la pantalla principal. Mismas columnas en los
    dos modales (`mpp`/`mpd`).
  - **Bancos de producción de prelosa** (`BANCO_PRELOSA_METROS_UTILES = 96`,
    `BANCO_PRELOSA_NUM_CINTAS = 2`, `BANCO_PRELOSA_MAX_ANCHOS = 2`, `_topeMetrosBanco()`,
    `_actualizarResumenBancosPrelosa()`, 2026-10-19, a pedido del usuario: "los bancos de
    producción de prelosa son dos cintas de 96 metros útiles por cinta. Lo más común es
    programar un banco (las dos cintas) de 50cm de ancho... en otras ocasiones se programa una
    cinta de 50cm y otra de 20, 30 o 40cm... condicionemos para que sean máximo 96 metros por
    cinta, en función del ancho. Programemos también para que se puedan programar solo dos
    anchos") — cada cinta fabrica un único ancho a la vez, y como mucho 2 anchos distintos en
    toda la programación del día (una cinta por ancho). **Solo aplica a PRELOSA** — Placa
    Alveolar y Vigueta y Bovedilla no se fabrican en estas cintas, el usuario habló
    específicamente de "bancos de producción de prelosa" (si en el futuro se confirma que Placa
    Alveolar comparte el mismo banco físico, extender la condición de `l.sistema === 'prelosa'`).
    - **El tope por ancho es dinámico, no siempre 96 m (corregido 2026-10-20, a pedido del
      usuario: "estamos limitando a 96 metros que es lo de una cinta, pero en realidad debe ser
      eso por 2, en el caso que se programe todo de 50cm de ancho, o todo de 40 o 30 o 20")** —
      el límite de 96 m es por CINTA, no por ancho: una cinta no se puede repartir entre dos
      anchos distintos a la vez (es una tira continua, configurada para un solo ancho por
      corrida), así que el tope real de un ancho depende de CUÁNTAS cintas le tocan ese día.
      `_topeMetrosBanco(cantidadAnchos)`: si la programación usa **un solo ancho**, ese ancho
      tiene las 2 cintas completas para él (`96 × 2 = 192` m); si usa **2 anchos distintos**,
      cada uno queda con una sola cinta (`96` m cada uno — no se puede "prestar" cinta de un
      ancho a otro aunque la suma total no llegue a 192). El resumen en vivo
      (`#mpp-resumen-bancos`) recalcula este tope con cada tecla, según cuántos anchos distintos
      haya en ese momento ("50 cm (2 cintas): 180.00 / 192 m" con un solo ancho; "50 cm (1
      cinta): 80.00 / 96 m" con dos). **Tope duro al guardar**
      (`guardarProgramacionProduccion()`) — mismo cálculo recalculado contra `lineas` (lo que de
      verdad se va a guardar), con un mensaje que explica el porqué del tope en ese caso
      concreto ("usa las 2 cintas completas" / "solo tiene disponible 1 cinta... hay otro ancho
      programado ese día").
  - **"🖨️ Imprimir" dentro del propio modal** (`imprimirProgramacionProduccion()`/
    `descargarPDFProgramacionProduccion()`, 2026-10-15, a pedido del usuario: "la idea es poder
    imprimir lo que se espera producir, osea la programación de producción que damos con el
    primer botón" — antes el único botón de imprimir sacaba la Lista de Producción completa,
    no lo que se iba a programar ese día) — a la misma altura de "Guardar programación". Lee lo
    que esté digitado en el modal EN ESE MOMENTO (no hace falta haber guardado antes). Mismo
    lenguaje gráfico que `imprimirListaProduccion()` (membrete + clases compartidas), pero
    titulado "PROGRAMACIÓN DE PRODUCCIÓN", con solo cuadro/ancho(o vigueta)/largo/cantidad a
    programar — es un plan, no lleva pendientes ni unidades fabricadas. Antes de mostrar la vista previa
    cierra el modal (`cerrarModal('modal-programar-produccion')`) — si no, el fondo oscuro del
    modal (`z-index` más alto) tapa la vista previa por completo. El PDF usa el helper
    compartido `_descargarPDFConMembrete()` (factorizado de `descargarPDFListaProduccion()` en
    esta misma vuelta — ambos imprimibles comparten el 100% de la lógica de paginación con
    membrete, solo cambia qué contenido se captura y el nombre del archivo), con el nombre
    `Programacion_Produccion_<Losa>_<fecha programada>.pdf`.
    - **"← Volver" reabre el modal, no solo la pantalla de atrás** (2026-10-19, bug real
      reportado por el usuario: "cuando le doy imprimir y luego le doy volver, se me cierra la
      ventana de programar producción y/o programar despachos. Garanticemos que cuando le demos
      volver, volvamos a la ventana como la teníamos digitada") — `cerrarModal()` solo quita la
      clase `.abierto` (no borra nada del DOM ni de los valores de los `<input>`/`<select>`), así
      que todo lo digitado (cantidades, filtros, fecha, observaciones, vehículo) seguía intacto
      todo el tiempo, solo escondido detrás de la vista previa. El botón "← Volver" ahora
      re-agrega `.abierto` al modal correspondiente además de reactivar `pantalla-losa-detalle`,
      mostrándolo exactamente como se dejó — sin guardar/restaurar nada aparte. Mismo arreglo en
      Programar despacho.
  - **"RESUMEN POR MEDIDAS" al pie del imprimible** (`_resumenPorMedidasHTML()`, 2026-10-17, a
    pedido del usuario: "incluyamos un resumen, que muestre la cantidad por medidas, esto
    porque en ocasiones la medida es la misma para varios cuadros en el plano... y termina
    siendo más fácil revisar unos totales que cuadro por cuadro") — agrupa las líneas impresas
    por la medida REAL de la pieza, no por fila: en prelosa/placa alveolar, Ancho + Dimensión
    (dos piezas del mismo ancho y largo son intercambiables, sin importar en qué cuadro vayan);
    en vigueta, Vigueta (tipo) + Dimensión — el tipo de vigueta es parte de la medida, no un
    dato aparte, así que dos viguetas del mismo largo pero de tipo distinto NO se agrupan.
    Tabla aparte debajo de la tabla de filas (antes de la firma), con su propia fila de
    totales — incluye **columna de Peso (kg)** (2026-10-17, a pedido del usuario: "incluyamos
    también en ambos imprimibles en el cuadro inferior, la columna de peso" — a diferencia de
    la tabla principal, donde Peso es solo del lado de despacho, en este resumen va en LOS DOS
    imprimibles; peso por grupo = Σ `_pesoFila()` de cada línea que cae en ese grupo, válido
    porque todas comparten el mismo ancho/vigueta y dimensión — lo que determina el peso por
    pieza — así que sumar línea por línea da lo mismo que peso-por-unidad × cantidad total del
    grupo). Función compartida entre `imprimirProgramacionProduccion()` e
    `imprimirProgramacionDespacho()` — ambos imprimibles la llevan igual.
    - **Columna "Hilos"** (2026-10-19, a pedido del usuario: "incluir una columna con el número
      de hilos") — entra también en la CLAVE de agrupación, no solo como columna: dos líneas del
      mismo ancho/vigueta y dimensión pero con distinto número de hilos NO son la misma pieza
      (distinto refuerzo), agruparlas bajo un solo valor de hilos sería engañoso. Vigueta no
      tiene un único campo "hilos" (son dos: Abajo/Arriba) — se muestra combinado "2+1".
  - **Columnas de la tabla principal** (2026-10-17, dos ajustes a pedido del usuario): "Dim."
    pasó a decir **"Largo"** en las dos tablas de cada imprimible (la principal y el resumen por
    medidas) — más claro para planta/logística que la abreviatura. La columna
    Ancho(cm)/Vigueta, que antes solo aparecía en el resumen por medidas, ahora también
    aparece en la tabla principal, **justo antes de "Largo"** ("incluyamos en el primer cuadro,
    el ancho antes del largo"). **Las columnas "Ejes num."/"Ejes alfa." se quitaron del todo**
    de ambos imprimibles ("no son necesarios en estos imprimibles y podrían llegar a confundir
    a los operarios") — siguen viéndose en la pantalla normal (`_filaProduccionHTML()`), solo
    se quitaron de lo que se imprime; el `colspan` de la fila TOTALES bajó de 6 a 4 para
    acompañar. Orden final de columnas: `#, Cuadro, Ancho(cm)/Vigueta, Largo (m), Cant. a
    programar, Long. tot. (m)` (más Peso y Observaciones solo en despacho, ver los dos bullets
    siguientes).
  - **Datos centrados bajo su etiqueta** (2026-10-17, a pedido del usuario: "centremos los
    datos, debajo del título, pues como las columnas son tan anchas, no se identifica bien a
    qué corresponde cada dato") — el bloque Sistema/Piezas a programar, que antes era
    "ETIQUETA: valor" en una sola línea dentro de una grilla de 2 columnas muy anchas, pasó a
    ser una etiqueta chica en mayúsculas arriba y el valor centrado debajo, mismo estilo en los
    dos imprimibles.
  - **Columna de Peso en la tabla PRINCIPAL — SOLO en el imprimible de despacho, no en el de
    producción** (2026-10-17, a pedido del usuario: "en el imprimible de despachos, a
    diferencia del de producción, es muy importante incluir el peso como otra columna
    adicional" — logística necesita saber cuánto va a pesar cada viaje; producción no lo
    necesita en SU imprimible, por eso se había quitado antes del que sacaba la lista
    completa). Va después de "Long. tot. (m)". Reusa `_pesoFila()` (mismo cálculo de la
    pantalla normal), pero evaluado sobre la **cantidad que se está imprimiendo** (`{...f,
    cantidad}`), no sobre `f.cantidad` — si solo se programa una parte de una fila, el peso
    impreso corresponde a esa parte, no a la fila completa. La columna de Peso del RESUMEN POR
    MEDIDAS (ver bullet más arriba) es aparte — esa sí la llevan los DOS imprimibles.
  - **Columna de Observaciones (cant. real) — en los dos imprimibles, última columna**
    (2026-10-17, a pedido del usuario: "incluyamos una columna a mano derecha de
    observaciones, donde el personal pueda registrar a mano cuántas unidades se produjeron o se
    despacharon, y con este insumo podamos cargar las producciones y los despachos reales al
    sistema") — celda vacía por diseño (`<td style="min-width:65px"></td>`, sin contenido), para
    que planta/logística anoten a mano sobre el papel impreso cuánto se produjo/despachó
    realmente; ese papel es después el insumo con el que se digita en "+ Cargar producción"/"+
    Cargar despacho". No guarda nada en el sistema — es una columna de papel, no de datos.
- **"+ Cargar producción"** (`abrirModalCargarProduccion()`/`_renderLineasCargarProduccion()`/
  `guardarCargaProduccion()`) — selector de TODAS las programaciones (ya no solo las que tienen
  líneas pendientes, ver más abajo); al elegir una, cada línea muestra "lo teórico programado"
  justo al lado de un campo para digitar lo que realmente se produjo (precargado con el valor ya
  cargado, o con lo programado si todavía no se cargó). **Esta es la única puerta de entrada
  real a `fila.produccion[]`** — al guardar, cada línea con un valor digitado fija su
  `cantidadReal` y empuja/actualiza `{fecha: <fecha de la programación>, cantidad,
  tipo:'Vaciado', programacionId}` en la fila correspondiente. Se puede cargar parcial (dejar
  algunas líneas en blanco para otro día) — las que se dejan en blanco siguen ofreciéndose la
  próxima vez, sin cambios.
  - **Una línea ya cargada se puede volver a editar** (2026-10-16, a pedido del usuario:
    "permitamos que se puedan también editar producciones ya cargadas, pues es posible que se
    cometan errores en el camino que se deban solucionar") — ya NO es de solo lectura; el
    selector ahora lista TODAS las programaciones (antes solo las que tenían algo pendiente), y
    una completa se marca "(completa, editable)". Al corregir el valor de una línea ya cargada,
    `guardarCargaProduccion()` busca la entrada EXISTENTE que esa línea ya había empujado a
    `fila.produccion[]` (identificada por `programacionId`) y la ACTUALIZA en el lugar — nunca
    empuja una segunda entrada, así nunca se duplica el conteo. Si el valor no cambió frente al
    ya guardado, esa línea se ignora (no hay nada que corregir).
- **"📋 Producciones programadas"** (`renderProduccionProgramada()`, tarjeta nueva entre la
  tabla de filas y "🏗️ Producciones registradas", solo en modo producción — 2026-10-21, a
  pedido del usuario: "metamos otro cuadro intermedio, entre el cuadro general y el cuadro de
  producciones registradas, donde incluyamos las producciones programadas. de esta manera
  podemos hacer varias programaciones, editarlas e imprimirlas luego de su programación
  inicial. cuando se carga la producción asociada a una programación, esta programación baja al
  cuadro de producciones registradas") — lista las `produccionesProgramadas[]` que TODAVÍA no
  tienen NINGUNA línea cargada (`every(l => l.cantidadReal == null)`), el complemento exacto del
  filtro de "Producciones registradas" (`some(...)`, ver bullet siguiente): en cuanto se carga
  la primera línea de una programación, desaparece de acá y aparece allá, automáticamente, sin
  ningún dato duplicado ni ninguna lógica extra — las dos tarjetas leen del mismo
  `_programacionesLosaActual[]`, solo cambia el filtro. Antes de esto, una programación sin
  nada cargado todavía era invisible en la pantalla principal (solo se veía dentro del
  desplegable de "+ Cargar producción"), así que no había forma de ver de un vistazo, editar ni
  reimprimir varias programaciones hechas de antemano.
  - **Mismas tres acciones** (Formato/Editar/Borrar, mismo patrón visual que el resto de
    tarjetas de esta pantalla):
    - **"✏️ Editar"** (`editarProgramacionProduccion()`) → reabre "+ Programar producción"
      (`abrirModalProgramarProduccion(programacionId)`, ahora acepta un id opcional) en modo
      edición: título cambia a "✏️ Editar programación de producción", `#mpp-id` guarda qué
      programación se está editando, y la fecha/observaciones/cantidades ya digitadas se
      precargan (`editando.lineas.find(l => l.filaId === f.id)?.cantidadProgramada`, por fila).
      Una programación sin cargar no resta nada del pendiente de producción (eso solo lo hace
      `fila.produccion[]`, vía "+ Cargar producción") — así que la lista de filas ofrecidas es
      la misma de siempre, sin ninguna lógica de "liberar cupo" al editar.
      `guardarProgramacionProduccion()` ahora revisa `#mpp-id`: si trae un id, ACTUALIZA esa
      entrada en `_programacionesLosaActual` en vez de empujar una nueva.
    - **"🖨️ Formato"** (`imprimirProgramacionProduccionGuardada(id)`) → imprime la programación
      guardada directo, sin pasar por el modal. El imprimible mismo se factorizó en
      `_htmlProgramacionProduccion(l, p, sis, esVigueta, fecha, observaciones, lineas, origen)`
      — tanto esta función como la ya existente `imprimirProgramacionProduccion()` (la que lee
      en vivo del modal abierto) arman `lineas` a su manera y le pasan el resto a este HTML
      compartido; `origen` ('modal' | 'tarjeta') solo decide a dónde vuelve el botón "← Volver"
      (reabre el modal si se venía de ahí, o solo regresa a la pantalla de la Losa si se
      imprimió directo desde la tarjeta, donde nunca hubo ningún modal abierto que reabrir). El
      ancho/dimensión/peso de cada línea se siguen leyendo EN VIVO de `_filasLosaActual` en los
      dos casos — nunca se congela nada en la programación misma.
    - **"🗑️ Borrar"** (`eliminarProgramacionProduccion()`) → a diferencia de
      `eliminarProduccionRegistrada()` (más abajo), acá NUNCA hay nada que deshacer en
      `fila.produccion[]`: una programación solo vive en esta tarjeta mientras nada se ha
      cargado, así que borrarla no mueve ningún pendiente.
- **"🏗️ Producciones registradas"** (`renderProduccionRegistrada()`/
  `verDetalleProduccionRegistrada()`, tarjeta nueva debajo de la tabla de filas, solo en modo
  producción — 2026-10-15, a pedido del usuario: "algo similar a lo que tenemos en Despachos de
  Despachos Registrados... fila a fila lo producido y seleccionándola podamos ver el resumen...
  lo realmente fabricado") — lista las `produccionesProgramadas[]` que ya tienen AL MENOS una
  línea cargada (`cantidadReal != null`) — una programación 100% sin cargar todavía no es
  "producción", es solo un plan, no aparece acá (sigue ofreciéndose completa en "+ Cargar
  producción"). La columna "Contenido" cuenta solo lo REALMENTE fabricado (`Σ cantidadReal`), no
  lo programado, y avisa si a esa programación todavía le faltan líneas por cargar. (Esta
  tarjeta fue el molde que se replicó para Despachos el 2026-10-16, ver sección propia más
  abajo.)
  - **Columna "Acciones"** (2026-10-18, a pedido del usuario: "manejemos la misma lógica de la
    ventana que tenemos por ejemplo en ajuste diario de mezclas, con las acciones en el lado
    derecho teniendo las mismas tres, del formato, editar y borrar") — reemplaza el clic sobre
    la fila por tres botones, mismo patrón visual EXACTO que `renderAjustesMezcla()`
    (`js/calidad-ajuste-mezcla.js`):
    - **"🖨️ Formato"** = lo que antes abría el clic en la fila: `#modal-detalle-produccion`
      (Cuadro / Programado / Producido, de solo lectura) — se mantiene tal cual, solo cambia
      cómo se dispara.
    - **"✏️ Editar"** (`editarProduccionRegistrada()`) = abre "+ Cargar producción" con esta
      programación ya elegida en el combo (`_renderLineasCargarProduccion()`), en vez de que el
      usuario tenga que volver a buscarla — la edición in-situ en sí ya existía desde el
      2026-10-16 (corrige la entrada existente de `fila.produccion[]`, no la duplica).
    - **"🗑️ Borrar"** (`eliminarProduccionRegistrada()`) = con `confirm()` de por medio, elimina
      la PROGRAMACIÓN COMPLETA (plan + lo cargado), mismo criterio que `eliminarAjusteMezcla()`
      (el botón borra el registro entero, no solo "lo cargado"). También recorre las líneas de
      esa programación y quita de `fila.produccion[]` la entrada que le correspondía a cada una
      (`entrada.programacionId === p.id`) — si no se hiciera, la fila quedaría con piezas
      "fabricadas" fantasma sin ninguna programación detrás, y su pendiente de producción no
      subiría de vuelta.
- **Columna "Unidades fabricadas"** (`_filaProduccionHTML()`, justo antes de "Pend.
  Producción", solo en modo producción) = `cantidad − pendienteProducción` — mismo origen que el
  pendiente, solo mostrado desde el otro lado.
- **Columna "m²"** (`_filaProduccionHTML()`, justo después de "Long. total (m)", 2026-10-17, a
  pedido del usuario: "incluyamos una nueva fila de m2, que es el resultado de multiplicar el
  largo por el ancho") — en las TRES vistas (lista/producción/despacho), solo en
  prelosa/placa alveolar. `m2 = (ancho/100) × dimensión × cantidad` — mismo patrón que "Long.
  total (m)" (multiplica por `cantidad`, no es un valor por unidad), para que sumarla en la fila
  de TOTALES dé directamente los m² reales de la Losa sin necesitar ponderar nada aparte.
  Vigueta no la lleva — no tiene un "ancho" real, se mide en metros lineales, no en área.
- **Fila de "TOTALES"** (`_pieTotalesHTML()`, 2026-10-17, a pedido del usuario: "incluyamos al
  final del cuadro... una fila de totales, donde totalicemos unidades, los metros lineales como
  los metros cuadrados") — en las TRES vistas, a diferencia del avance ponderado de abajo, que
  sigue siendo solo de producción; en producción quedan las DOS filas de pie, una debajo de la
  otra. `Σ cantidad`, `Σ (dimensión×cantidad)`, si no es vigueta `Σ m2`, y (2026-10-18, a pedido
  del usuario: "en el total de la última fila de los cuadros, incluyamos también el total del
  peso") `Σ _pesoFila(f,l)`. **Alineada debajo de su propia columna** (2026-10-17, a pedido del
  usuario: "cuadra los totales para que queden debajo de cada columna" — la primera versión era
  un solo banner de texto de ancho completo, más fácil de armar pero más difícil de leer de un
  vistazo): la celda "📐 TOTALES" lleva un `colspan` calculado que cubre exactamente las
  columnas antes de "Cantidad" (# + Cuadro + Ejes num. + Ejes alfa. + las columnas propias del
  sistema + Dimensión), luego los totales van en celdas reales justo debajo de "Cantidad"/"Long.
  total (m)"/"m²"/"Peso (kg)", y un último `colspan` cubre el resto (Pend./Fabricadas,
  Observaciones, acciones) — mismo criterio que ya usa el `colspan` de la fila TOTALES de los
  imprimibles. `_actualizarFilaProduccion(i)` (la actualización quirúrgica al escribir en modo
  lista) también refresca esta fila completa en cada tecla — depende de TODAS las filas, no solo
  de la que se está editando, así que no se puede actualizar celda por celda como las demás; como
  no tiene ningún `<input>` adentro, reemplazar su `innerHTML` no le quita el foco a nada. El pie
  de "Avance de producción" de abajo sigue siendo un banner de ancho completo (no se pidió
  alinearlo por columna).
- **Encabezado fijo al bajar, en las TRES vistas** (clase `.tabla-items.fija-al-bajar`,
  `css/estilos.css`, 2026-10-17, a pedido del usuario: "bloquea las primeras filas... pues al
  bajar se pierden los títulos y no sabe uno qué está viendo") — `renderFilasProduccion()`
  pone siempre `tabla-filas-produccion` como `tabla-items fija-al-bajar`, que agrega
  `position:sticky` manteniendo el mismo fondo azul de siempre — se usa una clase ADITIVA nueva
  en vez de cambiar directamente a `.tabla-cots`, porque esa trae su propio estilo de
  encabezado (fondo blanco, texto gris) que no se pidió cambiar. Mismo `top:94px` que
  `.tabla-cots` (una sola `.nav` de 44px bajo el `.nav-top` de 50px, sea la fija del módulo o la
  dinámica de Proyectos). **Al principio (2026-10-17) se dejó afuera de Lista a propósito**, por
  el mismo motivo documentado junto a `.tabla-items` en `css/estilos.css` (el bug real de una
  fila nueva tapada detrás del encabezado pegado, visto una vez en el formulario de Costeo de
  Producto); se volvió a pedir expresamente el 2026-10-18 ("no está bloqueando la fila de
  títulos en la ventana de listas de producción, bloquéala también") y, probado con una tabla
  corta (2 filas) + el bloque de Bovedilla justo debajo (el caso real más parecido al que causó
  el bug original: otra sección después de una tabla corta), no se reprodujo — se verificó con
  `getBoundingClientRect()` en varias posiciones de scroll que el `<thead>` nunca se solapa con
  el bloque de Bovedilla. Acá la tabla SÍ es el contenido que se scrollea (igual que
  `.tabla-cots`, con muchas filas en los casos reales: Boreal tuvo 247), así que el encabezado
  se suelta en cuanto se pasa de largo la tabla completa.
  - **Bug real encontrado al probarlo (2026-10-18, reportado por el usuario: "no se están
    bloqueando las filas de los títulos... incluso en el de producción, está quedando montado")**
    — la clase estaba bien puesta, pero la `<div class="card">` que envuelve la tabla
    (`cotizaciones.html`) traía `style="padding:0;overflow-x:auto"` para permitir scroll
    horizontal (la tabla es ancha: `min-width:980px`). Cualquier ancestro con `overflow`
    distinto de `visible` se vuelve el límite real del `position:sticky` — y por una regla real
    de CSS, `overflow-x:auto` con `overflow-y` sin especificar NO deja a `overflow-y` en
    `visible`: el navegador la sube a `auto` también (no se puede evitar declarando
    `overflow-y:visible` a mano, la regla igual aplica). Como esa tarjeta nunca scrollea por sí
    sola (solo scrollea la página), el encabezado terminaba sin pegarse a ningún lado — mismo
    diagnóstico que ya está documentado junto a `.tabla-cots` en `css/estilos.css` para el resto
    de listados de la app ("Las tablas que viven en una tarjeta... dejaron de tener ese
    overflow:hidden... porque rompe position:sticky"), pero esta tarjeta en particular se había
    quedado afuera de ese ajuste porque es nueva (Losas de Proyecto) y necesitaba scroll
    horizontal, algo que ninguna otra `.tabla-cots`/`.tabla-items` de la app necesitó antes.
    **Arreglo**: se quitó el `overflow-x:auto` de la tarjeta (ahora es `style="padding:0"`, igual
    que el resto); si la tabla no cabe en pantallas angostas, ahora desborda hacia la página
    completa (mismo comportamiento que ya toleran los demás listados anchos de la app) en vez de
    atraparse en un scroll propio que rompía el sticky.
- **"⬇️ Exportar Excel"** (`exportarFilasLosaExcel()`, botón siempre visible junto a los demás
  botones de arriba de la tabla, en las TRES vistas — 2026-10-18, a pedido del usuario: surgió de
  una diferencia real que reportó entre su suma manual y el total de metros lineales de ProSuite
  para la Losa "PISO 6" de Torres de la Francia (1376.05 vs 1425.16) — "la tabla tiene muchas
  filas y no caben en la foto", así que en vez de mandar una captura se exporta la tabla completa
  para auditarla fila por fila) — mismo patrón ya establecido en
  `exportarEstadisticasProduccionExcel()` (`js/estadisticas-produccion.js`): `aoa_to_sheet` →
  `book_new` → `book_append_sheet` → `writeFile` (SheetJS, ya cargado en la app). Exporta
  EXACTAMENTE las mismas columnas que se ven en pantalla en el modo activo en ese momento (mismos
  cálculos por fila que `_filaProduccionHTML()`, sin redondear antes de sumar), más una fila de
  TOTALES al final con la misma fórmula de `_pieTotalesHTML()` — para que una diferencia entre lo
  que alguien suma a mano y lo que muestra la pantalla quede auditable en el mismo archivo.
  Archivo `Losa_<nombre>_<vista>_<fecha>.xlsx`.
- **Pie de "Avance de producción" ponderado por longitud** (`_pieAvanceProduccionHTML()`, fila
  nueva al final de la tabla, solo en modo producción): el avance NO es "filas completas / filas
  totales" ni "piezas hechas / piezas totales" — cada fila pesa según sus metros reales
  (`dimensión × cantidad`), igual que ya usa el imprimible para el total de metros lineales. Una
  fila con pocas piezas muy largas cuenta tanto como le corresponde en metros, no menos que una
  fila con muchas piezas cortas. `% avance = Σ(dimensión×fabricadas) / Σ(dimensión×cantidad)`,
  `% faltante = 100 − % avance`.
- **"📊 Producción diaria"** (`abrirMatrizProduccionDiaria()`) — matriz fila × fecha, mismo
  formato que los Excel reales del usuario (una columna por día de producción). Las fechas
  salen de `fila.produccion[].fecha` de toda la Losa, sin pasar por `produccionesProgramadas`
  (así también refleja cualquier producción antigua que ya existiera antes de este flujo).
  - **Siempre lista TODAS las filas de la Losa** (2026-10-15, a pedido del usuario: "la idea es
    que aparezcan todas las filas de la losa") — antes, si no había ninguna producción cargada
    todavía (`fechas.length === 0`), se mostraba un mensaje y NINGUNA fila; ahora las filas
    siempre aparecen (con "Total fabricado" en 0 y sin columnas de fecha si aún no hay nada
    registrado). Solo se muestra un mensaje si la Losa en sí no tiene filas todavía.
  - **Columnas fijas (`position:sticky;left:...`) a la izquierda — Cuadro, Ancho, Largo, Cant.
    a fabricar y Total fabricado** (2026-10-15, a pedido del usuario: "si la losa es muy
    grande, [las columnas de fecha] van a ser muchas... permitamos que se vean todas los
    registros de fabricación, bloqueando [esas columnas]... y permitiendo desplazar con la
    barra hacia la derecha") — mismo mecanismo que ya fija `.tabla-cots th` arriba al bajar
    (`top:0`, ya heredado de la clase), aplicado ahora también al eje horizontal con un `left`
    numérico por columna (no sirve con anchos automáticos — thead/tbody/tfoot usan exactamente
    el mismo ancho por columna para que las celdas congeladas queden alineadas). Ancho (cm)
    solo aparece en prelosa/placa alveolar (vigueta no tiene un "ancho" propio — tiene
    `tipoVigueta`/hilos en su lugar), así que el `left` de las columnas siguientes se recalcula
    según si esa columna existe o no. El pie "Total día" muestra el total general de Cant. a
    fabricar y de Total fabricado en sus columnas fijas, más el total de cada fecha a la
    derecha. **Caveat ya documentado para `position:sticky` en este repo**
    (`docs/01-arquitectura-tecnica.md`): su recálculo visual no es verificable de forma
    confiable con el arnés de Chrome headless (`--dump-dom`) — se probaron los valores de
    `left`/`position` en el DOM, no el resultado visual en pantalla.
- **Selección de filas por checkbox, eliminada** (2026-10-15, a pedido del usuario: "quitemos
  mejor el seleccionable de la primera columna") — existía solo para elegir qué imprimir con el
  ahora ya eliminado `imprimirListaProduccion()` (ver bullet "🖨️ Imprimir lista de producción —
  QUITADO" más arriba).

### Control de Despacho — mismo flujo que Producción (2026-10-16, a pedido del usuario:
### "incluyamos la misma lógica que tenemos en producción, con los tres botones superiores de
### programar despacho, cargar despacho e historial de despachos")

Réplica casi exacta del flujo Programar → Cargar de Producción, con dos diferencias reales:
Despacho necesita el número de **remisión** del camión (Producción no tiene un equivalente), y
el libro real sigue siendo `despachos[]` **a nivel de Losa** (una remisión cubre varias filas a
la vez) en vez de `fila.produccion[]` **por fila** — esa asimetría ya existía desde antes y se
conservó a propósito (mismo espíritu que `viaje.entregas[].productos[]` en Logística).

- **"+ Programar despacho"** (`abrirModalProgramarDespacho()`/`guardarProgramacionDespacho()`)
  — idéntico a "+ Programar producción" en estructura: casilla por fila que autocompleta
  (`_marcarFilaProgramarDespacho()`/`_marcarTodasFilasProgramarDespacho()`), filtros por tipo
  combinables (`_agregarFiltroProgramar('mpd')`/`_aplicarFiltrosProgramar('mpd')` — mismas
  funciones compartidas que usa Programar producción, ver bullet correspondiente más arriba).
  Crea una entrada en `despachosProgramados[]` con todas sus líneas en `cantidadReal: null`.
  - **Filtrado por DISPONIBLE, no por pendiente** (2026-10-19, a pedido del usuario: "incluir
    una columna... de disponible para despacho, que será arrastrada de la ventana de
    producción. Condicionar la programación de despachos solo para elementos que estén
    disponibles para despacho") — antes ofrecía programar hasta el pendiente TOTAL de despacho
    (`cantidad − despachado`), sin importar si ya se había fabricado o no. Ahora
    (`_disponibleDespachoFila()` = `_fabricadoFila()` [Σ `fila.produccion[]`] − despachado) solo
    se ofrecen, y solo se puede programar hasta, las piezas que YA existen físicamente en
    planta — una fila con pendiente de despacho pero nada fabricado todavía ni siquiera
    aparece en el modal. Columna nueva **"Disponible despacho"** en la tabla de filas de la
    pantalla (modo despacho, junto a "Pend. Despacho", que sigue existiendo — una es "cuánto
    debo despachar en total" y la otra "cuánto puedo despachar hoy"). Tope duro al guardar:
    `guardarProgramacionDespacho()` recalcula `_disponibleDespachoFila()` por línea contra el
    estado real (no contra el `max` del `<input>`, que solo es una sugerencia visual) y rechaza
    si alguna línea lo supera.
  - **Vehículo y peso máximo** (2026-10-19, a pedido del usuario: "condicionemos también el
    peso del despacho a la capacidad que tenemos de los vehículos sencillos como lo tenemos
    codificado actualmente en la ventana de logística. podríamos poner un desplegable para
    escoger el tipo de vehículo y en función de este, programar el peso máximo") — desplegable
    `#mpd-vehiculo` (`_poblarSelectVehiculoDespacho()`) poblado directamente desde
    `CAPACIDAD_VEHICULO` (`js/logistica.js`, toneladas) — sin duplicar el catálogo de
    vehículos: si la flota cambia en Logística, acá se actualiza solo. Funciona porque
    `logistica.js` carga antes que `losas-proyecto.js` (incluso siendo ambas una `const` de
    nivel superior — mismo mecanismo que ya usa `sb` de `config.js` en toda la app). Resumen de
    peso en vivo (`_actualizarResumenPesoDespacho()`, Σ `_pesoFila()` de lo programado) junto al
    desplegable, con ⚠️ si supera la capacidad. **Elegir vehículo es obligatorio** para guardar
    — sin eso no hay peso máximo contra qué validar; `guardarProgramacionDespacho()` recalcula
    el peso total contra `lineas` (lo que de verdad se va a guardar) y rechaza si supera la
    capacidad × 1000 (kg). El vehículo elegido queda guardado en la programación
    (`despachosProgramados[].vehiculo`) y se muestra también en el imprimible
    (`imprimirProgramacionDespacho()`, tercera columna del recuadro de info junto a
    Sistema/Piezas a programar, con el peso total en toneladas en la etiqueta).
  - **"🖨️ Imprimir" dentro del propio modal** (`imprimirProgramacionDespacho()`/
    `descargarPDFProgramacionDespacho()`, 2026-10-17, a pedido del usuario: "incluyamos el
    botón de imprimir, para poder pasar el impreso de lo que se debe organizar y cargar en el
    viaje") — mismo patrón EXACTO que `imprimirProgramacionProduccion()` (membrete, resumen por
    medidas al pie), con dos diferencias: título/firmas propios de despacho ("Programado por" /
    "Cargado por", en vez de "Recibido en planta") y **sin remisión** — esa se captura recién
    en "+ Cargar despacho"; acá todavía es solo un plan, el camión ni ha llegado. Archivo
    `Programacion_Despacho_<Losa>_<fecha programada>.pdf`.
- **"+ Cargar despacho"** (`abrirModalCargarDespacho()`/`_renderLineasCargarDespacho()`/
  `guardarCargaDespacho()`) — el selector lista TODAS las programaciones (editable incluso si ya
  están completas, igual que Producción), más dos campos que Producción no tiene: **N° Remisión**
  (obligatorio) y **Fecha** (de cuándo salió realmente el camión, puede diferir de la fecha
  programada). Al guardar: fija `cantidadReal` en cada línea tocada (o la corrige si ya estaba
  cargada, sin duplicar — mismo mecanismo que Producción), guarda la remisión en
  `p.remision`, y **reconstruye por completo** la entrada de esa programación en el libro real
  `despachos[]` (`_despachosLosaActual.find(d => d.despachoProgramadoId === p.id)`, find-or-create)
  a partir de TODAS las líneas ya cargadas de ese plan en ese momento — nunca parcial ni
  duplicado. `_pendienteDespachoFila()` sigue funcionando exactamente igual que siempre, sin
  tocar su fórmula ni su firma.
- **"📋 Despachos programados"** (`renderDespachoProgramado()`, 2026-10-21) — misma lógica
  EXACTA que "📋 Producciones programadas" (ver bullet propio más arriba), del lado de
  Despacho: tarjeta entre la tabla de filas y "📦 Despachos registrados", lista las
  `despachosProgramados[]` sin ninguna línea cargada todavía, con las mismas tres acciones
  (`editarProgramacionDespacho()` → `abrirModalProgramarDespacho(despachoProgramadoId)`, ahora
  también acepta id opcional en modo edición — incluye restaurar el **vehículo** elegido
  (`editando.vehiculo`) además de fecha/observaciones/cantidades;
  `imprimirProgramacionDespachoGuardada()` → `_htmlProgramacionDespacho(...)`, mismo HTML
  factorizado que usa `imprimirProgramacionDespacho()` desde el modal;
  `eliminarProgramacionDespacho()`, sin nada que deshacer). Columna propia **"Vehículo"** (acá
  sí vale la pena verlo de un vistazo en la tarjeta, a diferencia de Producción, que no tiene un
  dato equivalente).
- **"📦 Despachos registrados"** (`renderDespachosRegistrados()`/`verDetalleDespachoRegistrado()`)
  — tarjeta SIEMPRE VISIBLE debajo de la tabla de filas, misma lógica EXACTA que "🏗️
  Producciones registradas". Pasó por dos vueltas: primero se preguntó explícitamente si debía
  ser una lista clicable (como Producciones registradas) o una matriz día × fila (como
  Producción diaria) — el usuario eligió "lista clicable como Producciones registradas" — pero
  se implementó por error como un botón+modal ("📜 Historial de despachos"); el usuario corrigió
  (2026-10-17): "eliminaste el segundo cuadro que mostraba el resumen de despachos... inclúyelo
  nuevamente, con la misma lógica que tiene en la ventana de producción, el segundo cuadro de
  Producciones registradas" — es decir, quería la tarjeta SIEMPRE VISIBLE, no un botón que la
  esconde. Se quitó el botón "📜 Historial de despachos" y su modal por completo; la tarjeta
  quedó en el mismo lugar que ocupaba la antigua "📦 Despachos registrados" (debajo de la tabla
  de filas, junto a "🏗️ Producciones registradas"). Lista las `despachosProgramados[]` con AL
  MENOS una línea cargada; "Contenido" cuenta solo lo REALMENTE despachado.
  - **Columna "Acciones"** (2026-10-18) — misma lógica EXACTA que la de "🏗️ Producciones
    registradas" (ver bullet correspondiente más arriba): **"🖨️ Formato"** abre
    `#modal-detalle-despacho` (Remisión / Fecha / Observaciones + Cuadro / Programado /
    Despachado por línea, solo lectura — no cambió, solo cómo se llega a él); **"✏️ Editar"**
    (`editarDespachoRegistrado()`) abre "+ Cargar despacho" con esta programación ya elegida;
    **"🗑️ Borrar"** (`eliminarDespachoRegistrado()`) elimina la programación completa Y,
    a diferencia de Producción, también quita la entrada correspondiente del libro real
    `despachos[]` (`despachoProgramadoId === p.id`) — acá sí hay un segundo lugar donde queda la
    carga (`guardarCargaDespacho()` lo crea aparte, por remisión), y si no se borrara también de
    ahí, el peso y los totales de despacho seguirían contando piezas sin ninguna programación
    detrás.
- **El antiguo "📦 Registrar despacho" de un solo paso se eliminó del todo**
  (`abrirModalDespachoLosa()`/`guardarDespachoLosa()`/`renderDespachosLosa()`/
  `#modal-despacho-losa`) — reemplazado enteramente por Programar/Cargar, igual que ya se había
  hecho antes con el registro rápido de Producción. No quedaron dos caminos paralelos para
  registrar un despacho.

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

- **Decimales con coma al pegar/importar** (`_parseFloatEs()`, 2026-10-20, reportado por el
  usuario: "cuando intento pegar un cuadro de excel... los decimales vienen con comas y al
  pegarlo solo queda el entero sin los decimales") — Excel en configuración regional en español
  copia los decimales con coma ("3,5"), y `parseFloat()` de JS se detiene ahí (`parseFloat("3,5")`
  da `3`, no `3.5`) — perdía el decimal en silencio, sin ningún error. `_parseFloatEs(valor)`
  reemplaza la coma por un punto antes de parsear (ningún campo de esta pantalla — dimensión,
  ancho, cantidad, hilos — necesita nunca un separador de miles, así que no hay ambigüedad).
  Reemplaza todos los `parseFloat()` numéricos tanto en **Pegar** (`onPasteFilasProduccion()`)
  como en **Importar Excel/CSV** (`onSeleccionImportarFilas()`) — el import es menos propenso
  (SheetJS suele entregar los números ya parseados desde celdas numéricas reales), pero una
  celda de texto o un CSV exportado en español puede traer la misma coma. Sigue aceptando el
  punto decimal normal sin cambios.

- **Números cortados en los campos angostos** (2026-10-19, reportado por el usuario con una
  captura real de "PISO 6": "no se ve con claridad los números digitados... aparecen cortados
  en algunos casos" — el campo de Ancho mostraba "50" como "5C") — causa real: las flechitas
  nativas de subir/bajar de `<input type="number">` ocupan ~20px fijos, que en un campo de
  40-50px (la fila tiene muchas columnas, no sobra espacio) son casi la mitad del ancho
  disponible, recortando visualmente el número. **Arreglo** en dos partes: (1)
  `css/estilos.css`, se ocultan esas flechitas para todo `.tabla-items input[type="number"]`
  (`-webkit-appearance:none` en los pseudo-elementos de Chrome/Safari +
  `-moz-appearance:textfield` para Firefox) — nadie las usaba para escribir un ancho o un
  número de hilos, siempre se teclea directo; (2) se amplió el `width` en píxeles de los campos
  más angostos en `_filaProduccionHTML()` (Cuadro 40→48, Ancho/Vigueta 44→54, Hilos
  Abajo/Arriba/Hilos 38→44, Dimensión 50→58, Cantidad 42→50, los dos cuadritos de Ejes
  numéricos/alfabéticos 24→28 cada uno). Verificado con una captura de pantalla real del
  arnés de pruebas (no solo revisión de código) — el `document.styleSheets`/`cssRules` del
  arnés no deja inspeccionar la hoja de estilos cargada por `file://` (CORS), así que la
  verificación de esta regla específica fue visual, no por aserción de DOM.

- **Candado de medidas ya fabricadas** (2026-10-20, a pedido del usuario: "me preocupa que se
  modifique la lista y se cambie algo que ya está fabricado o despachado... el ancho, largo,
  cantidad y número de hilos... deberíamos congelar también la fila en la lista de producción,
  para indicarle a quien vaya a modificar que dicho material ya se fabricó") — antes de esto, el
  Peso/m²/Long. total de una fila se recalculaban siempre en vivo desde `ancho`/`dimension`/
  `cantidad` de la fila (`_pesoFila()`, etc.), así que corregir la medida de una fila que YA
  tenía piezas fabricadas o despachadas corría ese número "por arte de magia" sin que las piezas
  físicas cambiaran — ni se notaba en pantalla que había pasado.
  - **Qué se bloquea** (`_filaProduccionHTML()`, modo Lista): en cuanto una fila tiene AL MENOS
    una unidad fabricada (`_fabricadoFila(f) > 0` — la misma función que ya usa "Disponible
    despacho"), su **ancho, dimensión (largo) e hilos** (o **tipo de vigueta, Hilos Abajo,
    Hilos Arriba, dimensión** en sistema vigueta) pasan a verse como `<input disabled>` con un
    `title` explicativo ("🔒 Ya tiene unidades fabricadas... agrega una fila nueva") — ya no hay
    forma de "corregirlos" editando, porque lo físico ya existe con esa medida. El botón ✕ de
    borrar fila también se reemplaza por un ícono 🔒 (no se puede borrar una fila con historial).
    **La Cantidad es la única "importante" que sigue editable** (decisión explícita del usuario,
    tras preguntarle: "la cantidad... la editemos hasta el piso de lo ya fabricado" — es normal
    que cambie el total planeado sin que eso tenga que ver con lo ya hecho), con un piso = lo ya
    fabricado (`_validarCantidadMinima(i)`, valida en caliente al salir del campo —
    `onchange`, mismo patrón que `_validarAnchoPrelosa()`). Cuadro/Ejes/Observaciones NO se
    bloquean (no afectan ningún cálculo, son administrativos).
  - **Por qué no hace falta "congelar" nada en los registros de producción/despacho aparte**:
    una vez el ancho/dimensión/hilos no pueden cambiar más (candado activo), el valor que lee
    `_pesoFila()` en vivo desde la fila YA ES, de hecho, el valor congelado — no puede haber
    drift porque la edición está bloqueada desde el primer momento en que existe producción. Más
    simple y con menos superficie de cambio que agregar una copia aparte por cada línea de
    `fila.produccion[]`/`despachos[].lineas[]` (alternativa que se consideró y se descartó por
    innecesaria, justo por este motivo).
  - **Tope real al guardar, no solo visual** (`guardarListaProduccion()`) — cubre Pegar/Importar
    y cualquier mutación directa de `_filasLosaActual` que no pase por los `<input>` bloqueados
    de la UI (igual que ya hacía la estandarización de ancho de prelosa, mismo patrón). Compara
    cada fila contra la ÚLTIMA versión persistida de la Losa (`l.filas`, no lo que haya en
    memoria en ese momento) para detectar si un campo bloqueado de verdad cambió en la sesión de
    edición; si una fila con historial desaparece de la lista (por ejemplo, al pegar un bloque
    que reemplaza filas existentes), también se rechaza el guardado completo — perdería el
    historial de producción/despacho que vive adentro de ella.

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

### Sub-navegación dinámica de Proyectos (2026-10-16, a pedido del usuario)

El usuario pidió primero "en la segunda fila los botones para entrar a las subventanas de
proyectos" — se interpretó mal al principio (se probó poner esos botones EN CADA TARJETA de la
grilla de proyectos, ver nota en "Listado" más arriba, y se revirtió del todo). Lo que en
realidad pedía era una fila de sub-navegación igual a la que ya tienen los demás módulos
(Cotizaciones y Ventas: "+ Nueva Cotización" / "Pipeline" / "Histórico" / "Clientes" /
"Estadísticas", debajo de la barra superior) — pero como Proyectos tiene un nivel adicional
(primero se elige UN proyecto, después sus secciones), el primer botón de esa fila no abre una
pantalla fija: muestra el **nombre del proyecto activo** y sirve para **salir** de él ("al
costado izquierdo de la fila podemos nombrar el proyecto... si quiero salir del proyecto, pincho
el botón del nombre del proyecto y de ahí me manda a la ventana donde me muestra los iconos de
todos los proyectos"). La pantalla de Carpetas (el "inicio" de cada proyecto, con sus 5
tarjetas-ícono) **no se eliminó** — el usuario fue explícito: "sin eliminar la ventana de inicio
de cada proyecto". La sub-nav es un atajo ADICIONAL para moverse entre secciones sin tener que
volver a Carpetas primero, no un reemplazo.

- **`#subnav-proyecto-activo`** (`cotizaciones.html`, junto a las otras 5 filas `<nav class="nav"
  id="subnav-*">` que arma `js/navegacion.js`) — mismas clases `.nav`/`.nav-btn` que las demás
  (mismo `box-shadow`/sticky/`top:50px`/altura 44px, `css/estilos.css`), para que se vea
  idéntica. A diferencia de esas 5, que son listas de botones 100% fijas en el HTML (confirmado
  explorando el código: no existe en toda la app ningún otro precedente de una fila de
  sub-navegación cuyo contenido dependa del estado — esto es la primera), el HTML de esta trae
  los 5 botones de sección fijos (sus etiquetas no cambian), más el primer botón
  (`#subnav-proyecto-nombre-btn`) vacío, que `_sincronizarSubnavProyecto()` llena con el nombre
  del proyecto activo.
- **`_sincronizarSubnavProyecto(seccion)`** (`js/losas-proyecto.js`) — la única función que
  decide todo sobre esta fila: si `_PROYECTO_ACTIVO_ID` no apunta a un proyecto real, la
  esconde; si sí, la muestra, pone `🏛️ <nombre>` en el primer botón, y resalta (`.activo`) el
  botón cuya `data-seccion-proyecto` sea igual al parámetro `seccion` (`null` = ninguno
  resaltado, para cuando se está viendo la propia pantalla de Carpetas). Se llama al final de
  **todas** las funciones de navegación dentro de Proyectos: `abrirCarpetasProyecto()` (`null`),
  `abrirDocumentosProyecto(tipo)` (`tipo`), `abrirLosasDeProyecto(modo)`/`abrirLosaDetalle(id)`/
  `volverALosasProyecto()` (`modo`/`_MODO_FLUJO_LOSA`), `volverACarpetasProyecto()` (`null`),
  `volverAProyectos()` (`null`, la esconde porque ya no hay `_PROYECTO_ACTIVO_ID`).
- **Botón del nombre del proyecto = "salir"**: `onclick="volverAProyectos()"` directo — mismo
  destino que ya usaba el único botón "← Volver a Proyectos" que existía en Carpetas, ahora
  también alcanzable desde cualquier sección sin tener que pasar primero por Carpetas.
- **Se esconde al cambiar de módulo** — `activarModulo()` (`js/navegacion.js`) esconde
  `#subnav-proyecto-activo` en cualquier rama que no sea `modulo === 'proyectos'` (una línea
  nueva, junto a las 5 que ya prendían/apagaban las otras filas). La rama `proyectos` en sí
  siempre resetea `_PROYECTO_ACTIVO_ID = null` y llama `_sincronizarSubnavProyecto(null)` — así
  entrar por la barra superior aterriza siempre en la grilla con la fila escondida, **incluso
  si se vuelve a hacer clic en "Proyectos" estando ya dentro de uno** (caso borde real:
  sin ese `_sincronizarSubnavProyecto(null)` ahí, la fila se quedaba pegada mostrando el
  proyecto anterior, porque esa rama no pasa por el `if (modulo !== 'proyectos')` que esconde
  las demás).

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
