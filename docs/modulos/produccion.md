# Módulo: Producción

## Archivos

- `js/ordenes-produccion.js` (288 líneas) — órdenes de servicio y pipeline de producción
- `js/produccion-diaria.js` (277 líneas) — registro de producción del día, más Inventario de Producto Terminado
- `js/produccion-materia-prima.js` — Materia Prima e Inventario de Cemento por Bodega (movida de Calidad, ver "Materia Prima" más abajo)

## Datos

- Tablas Supabase: `ordenes_servicio`, `producciones`, `materia_prima`

## Pantallas

`pipeline-produccion`, `ordenes-servicio`, `produccion-diaria`, `inventario`, `materia-prima`

## Qué hace

Convierte una cotización aprobada en una orden de servicio, hace seguimiento del pipeline de producción, registra la producción diaria de la planta y las recepciones de materia prima (con control de inventario de cemento por bodega).

## Encadenamiento con Logística

Una orden puede traer un desglose por producto (`items[]`, cuando viene de una cotización aceptada vía `crearOrdenDesdeCotizacion()`) o solo una cantidad genérica (órdenes creadas a mano con `cantidad`+`descripcion`) — `_itemsDeOrden()` (en `logistica.js`) unifica ambos casos.

Al editar una orden (`editarOrden()`), se muestra una tabla de **Pedido / Entregado / Saldo** por producto (`renderSaldoOrden()`), cruzando con las entregas de Logística vinculadas a esa orden y marcadas "Hecha" en Cumplidos (`_cantidadEntregadaPorProducto()`). Así se ve de un vistazo si una orden ya se entregó completa, parcial, o sigue pendiente.

**Pasar la orden a Logística (2026-08-29)**: la pantalla "📦 Órdenes de Despacho" de Logística (`js/logistica-ordenes-despacho.js`, ver `docs/modulos/logistica.md`) lista, sin salir de este módulo ni tener que buscarla a mano, las órdenes ya listas o con algo de inventario disponible, con un botón que abre directo el modal de "Nuevo Viaje" con la orden ya vinculada. Es una vista calculada, no toca `ORDENES` ni el estado de la orden — la transición a "Despachado" sigue siendo 100% manual desde este tablero.

## Materia Prima (movida de Calidad, 2026-08-19)

La pantalla Materia Prima (recepciones de cemento, arena, grava, agua, aditivos...) vivía en Calidad — el usuario pidió moverla a Producción. Cambio puramente de navegación: mismo archivo renombrado (`js/calidad-materia-prima.js` → `js/produccion-materia-prima.js`), mismo CRUD contra la tabla `materia_prima`, sin cambios de esquema por la mudanza en sí. El botón "🧱 Materia Prima" pasó del subnav de Calidad al de Producción (después de "📦 Inventario"); `ir('materia-prima')` no cambió, solo el subnav donde vive el botón.

Junto con la mudanza, el usuario pidió 3 ajustes al formulario de registro:

- **Lote ya no es obligatorio** — antes bloqueaba guardar junto con Proveedor; ahora solo Proveedor es obligatorio (`guardarMateriaPrima()`).
- **Columna Bodega en la tabla general** (2026-08-20, a pedido del usuario): la tabla de Materia Prima (`renderMateriaPrima()`) muestra la Bodega de cada registro de Cemento (`_BODEGAS_CEMENTO[m.bodegaCemento]`) — "—" para el resto de tipos, que no tienen bodega.
- **Proveedor de Cemento es un desplegable fijo** (`ALION`/`ARGOS`, `_PROVEEDORES_CEMENTO`) en vez de texto libre — solo cuando Tipo = Cemento (`_alCambiarTipoMateriaPrima()` alterna entre el `<select id="m-mp-proveedor-cemento">` y el `<input id="m-mp-proveedor">` de texto libre que se sigue usando para el resto de tipos, ya que no hay una lista fija confirmada para Arena/Grava/Aditivo). `guardarMateriaPrima()` lee del campo que esté visible según el tipo.
- **Bodega** (`bodegaCemento`, antes llamada "Fuente/Silo" en la primera versión de este control — renombrada a pedido del usuario): mismo campo condicional que ya existía, solo cambió el nombre visible y el de la variable.

## Inventario de Cemento por Bodega (2026-08-19)

El usuario pidió llevar control del cemento como insumo, con dos objetivos: (1) saber cuándo pedir más, y (2) comparar el consumo real contra el teórico por producto. Las 3 bodegas reales de la planta (`_BODEGAS_CEMENTO`, `js/produccion-materia-prima.js`): **Silo 1 — Pretensados** (`silo1`), **Silo 2 — Vibrocompactados** (`silo2`), **Cemento en bolsa** (`bolsa`).

- **Entradas**: cuando el Tipo de un registro de Materia Prima es "Cemento", el modal muestra el campo **Bodega** (obligatorio, una de las 3 opciones) y **fija la Unidad a `kg`** (deshabilitada, no oculta — necesario para poder sumar entradas y salidas en una sola unidad sin adivinar cuántos kg trae un "bulto" ni convertir toneladas a mano).
- **Salidas**: cada registro de Producción Diaria puede llevar, además de la cantidad producida, el **Consumo total de cemento (kg)** de esa colada y su **Bodega** (`consumoCemento`/`bodegaCemento`, ambos opcionales — no bloquean guardar si se dejan vacíos, igual que Orden/Observaciones) — mismas 3 opciones que Materia Prima, para que el inventario sume entradas y salidas del mismo lado.
- **Stock e indicador de reorden**: `calcularInventarioCemento()` (`js/produccion-materia-prima.js`) suma entradas de `MATERIA_PRIMA` (tipo Cemento, no rechazadas) menos salidas de `PRODUCCIONES`, por cada una de las 3 bodegas. El stock actual se muestra junto al **consumo promedio de los últimos 30 días** y los **días de cobertura estimados** (stock ÷ consumo promedio), este último solo informativo.
- **Color de cada tarjeta por stock actual, no por días de cobertura** (2026-08-19, a pedido del usuario, corrigiendo el criterio inicial): `_colorStockCemento(stock)` pinta el fondo completo de la tarjeta según el kg disponible — 🔴 rojo hasta 15.000 kg (`_KG_STOCK_ROJO`), 🟡 ámbar de 15.000 a 30.000 kg (`_KG_STOCK_AMBAR`), 🟢 verde por encima de 30.000 kg. Los días de cobertura se dejaron solo como dato informativo (texto), ya no deciden el color — con poco consumo reciente una bodega puede salir con muchos "días de cobertura" aunque el stock en kg ya sea crítico (caso real: Silo 2 con 3.401 kg y "sin consumo reciente" no se pintaba en rojo con el criterio anterior).
- **`renderInventarioCemento()`** se llama al final de `renderMateriaPrima()`, así que se mantiene al día solo: tanto `materia_prima` como `producciones` ya disparan `rerenderPantallaActiva()` (ver `js/datos-realtime.js`), que vuelve a llamar `renderMateriaPrima()` sin importar cuál de las dos tablas cambió — no hizo falta ninguna suscripción realtime nueva.
- **No se corrige historial**: los registros de Materia Prima/Producción Diaria de antes de este cambio no tienen `bodegaCemento`/`consumoCemento` — quedan fuera de la suma (el inventario arranca a contar desde que se empiece a usar el campo nuevo, no se le pide al usuario que complete a mano lo viejo).

## Consumo de cemento por registro — real vs. teórico (2026-08-19)

- **Real vs. teórico**: la tabla de Producción Diaria muestra, en la columna "Cemento", el consumo real registrado y — si ese producto tiene un Costeo de Producto guardado — el % de variación contra el teórico (`_celdaCementoProduccion()`, usa `_cementoTeoricoPorUnidad(producto)` de `js/costeo-producto.js`, que recalcula el Costeo guardado de ese producto y lee la cantidad de la fila de Materia Prima marcada `esCemento: true`, kg por unidad × cantidad producida = teórico total). Verde si la variación es ≤10%, ámbar ≤25%, rojo por encima — para detectar sobreconsumo de un vistazo. Sin Costeo de Producto guardado para ese producto, se muestra solo el real, sin badge de comparación (no bloquea nada — hoy solo una parte del catálogo tiene Costeo guardado).
- `_cementoTeoricoPorUnidad()` funciona para los 3 tipos de estructura de Costeo (Vibrocompactado/Reforzado/Pretensado) porque el flag `esCemento` se agregó en los 3 `_MATERIALES_COSTEO_PESO.forEach()` que arman `materiaPrimaDetalle` — cambio puramente aditivo, no afecta ningún cálculo existente.

## Filtros de Producción Diaria (2026-08-21)

A pedido del usuario, la pantalla ganó filtros para revisar el histórico sin tener que scrollear todo `PRODUCCIONES`:

- **Rango de fechas** (`filtro-fecha-desde-prod`/`filtro-fecha-hasta-prod`, ambos opcionales) — reemplaza al filtro de un solo día que había antes (`filtro-fecha-prod`). Sugerido como mejora natural sobre lo pedido: un registro de producción se suele revisar por semana/mes, no día por día.
- **Tipo de producto** (`filtro-grupo-prod`, dropdown) — filtra por `p.grupo` (el mismo campo `grupo` del catálogo que ya trae cada registro, ver `guardarProduccion()`). Poblado dinámicamente (`poblarFiltroGrupoProd()`) solo con los grupos que de verdad aparecen en `PRODUCCIONES` — mismo patrón que `poblarFiltroGrupoInv()` (Inventario de Producto Terminado, mismo archivo).
- **Producto/Responsable** (`buscar-produccion`, texto libre) — ya existía, sin cambios de comportamiento (busca coincidencia parcial en `producto` o `responsable`); solo se ajustó el placeholder para que diga explícitamente que también busca por responsable.
- Los 4 filtros son acumulables (se aplican todos los que tengan valor a la vez) y siguen alimentando el mismo resumen "Filtrado" / "Total registros" de arriba de la tabla.

## Mismos filtros en Órdenes, Inventario y Materia Prima (2026-08-21)

El usuario pidió el mismo criterio de filtros (fecha, tipo de producto, búsqueda) en el resto de pantallas del módulo — adaptado a lo que cada una realmente representa, no una copia mecánica:

- **Órdenes de Producción** (`js/ordenes-produccion.js`): `renderOrdenes()` dejó de aceptar un `lista` filtrada desde afuera (se eliminó `filtrarOrdenes(q)`, que era el único punto que lo hacía) y ahora lee sus propios filtros, igual que las demás pantallas del módulo. Rango de fechas sobre `fechaEntrega`. El "Tipo de producto" no vive directo en la orden (una orden trae `items[]` si viene de una cotización, o solo `descripcion`+`cantidad` si se creó a mano) — `poblarFiltroGrupoOrdenes()` y el filtro mismo pasan cada renglón por `_itemsDeOrden(o)` (helper ya existente en `logistica.js`, unifica los dos casos) y cruzan el nombre contra `PRODUCTOS` para sacar su `grupo`; una orden entra al filtro si CUALQUIERA de sus renglones pertenece al grupo elegido. El buscador de texto (ahora con `id="buscar-ordenes"`, antes no tenía id) no cambió: número/cliente/descripción.
- **Inventario de Producto Terminado** (`renderInventario()`, `js/produccion-diaria.js`): ya tenía Tipo de producto (`filtro-grupo-inv`) y búsqueda por producto. Se sumó rango de fechas — pero como cada fila es un TOTAL acumulado (producido − despachado a la fecha), no un movimiento puntual, filtra por **última producción** (`r.ultima`) en vez de una fecha propia de la fila; el stock mostrado sigue siendo el real acumulado, el filtro solo decide qué referencias listar.

### Solo las entregas "Hecha" descuentan inventario (2026-08-30)

El usuario preguntó directamente "¿los Hechos de entregas están descontando inventario?" — la respuesta real era **no**: `calcularInventario()` solo restaba órdenes marcadas manualmente "Despachado" en el tablero de Producción, sin ninguna relación con si sus entregas de Logística ya se habían marcado "Hecha" en Cumplidos o no. El usuario aclaró el criterio correcto: "cuando se hace una entrega, el producto ya salió de planta por tanto no se tiene en inventario. distinto a cuando se programa y no se ha hecho, que el producto no ha salido de planta por tanto sigue en inventario" — es decir, "Hecha" (no "programada") es la señal real de que algo salió de planta.

**Diseño (confirmado con el usuario, pregunta directa sobre el caso borde)**: por cada orden, `calcularInventario()` resta lo **MAYOR** entre (a) lo que sus entregas ya marcadas "Hecha" en Logística suman por producto (`_cantidadEntregadaPorProducto()`, `js/logistica.js`) y (b) si la orden sigue marcada manualmente "Despachado" en Producción, el pedido completo. (a) y (b) nunca se suman para el mismo producto — competirían por lo mismo y duplicarían el descuento; se usa `Math.max()`. El respaldo (b) existe a propósito para no perder de vista despachos que nunca se programaron como entrega en Logística (ej. un cliente que retira en planta) — quitar el estado "Despachado" del todo habría dejado ese caso sin ninguna forma de descontarse. Las entregas "Hecha" que no están vinculadas a ninguna orden (`_cantidadEntregadaSinOrdenPorNombre()`) también restan, resueltas por nombre plano de producto (`_nombrePlanoDeProducto()`, convierte la clave "código — nombre" que usan las líneas de entrega al nombre plano que usa `calcularInventario()`/`PRODUCCIONES`).

Una entrega **programada y todavía pendiente** (o reprogramada) sigue sin tocar el inventario — el material sigue físicamente en planta hasta que se confirma. Esto es intencional y ya estaba así desde que se construyó Órdenes de Despacho (ver `docs/modulos/logistica.md`) — lo único que cambió acá es qué pasa cuando SÍ se marca "Hecha".

**Historial de entradas/salidas por referencia**: en Inventario de Producto Terminado, el nombre del producto en cada fila es clickeable (`verHistorialInventario()`) y abre un modal con dos tablas — Entradas (registros de Producción Diaria de ese producto) y Salidas (el mismo desglose que usa `calcularInventario()` para su columna Despachado: entregas "Hecha" con fecha/cliente/orden, y filas aparte para el respaldo manual "Orden marcada Despachado" cuando cubre algo que sus entregas no cubrieron). La suma de "Salidas" del historial siempre coincide exacto con la columna Despachado de la tabla — se calculan con la misma lógica (`_historialInventarioProducto()`), no una aproximación aparte. La fecha de una fila manual usa la fecha de entrega estimada de la orden (`fechaEntrega`) porque no hay ningún registro exacto de cuándo se cambió el estado a mano.

Verificado ejecutando `calcularInventario()`/`_historialInventarioProducto()`/`verHistorialInventario()` reales (no solo revisión de código) contra: una orden con entrega Hecha parcial sin marcar Despachado, una marcada Despachado sin ninguna entrega (respaldo manual puro), una con ambas señales a la vez para el mismo producto (confirma que no duplica — `MAX`, no suma), una entrega Hecha 100% sin que la orden se marcara nunca Despachado (el fix pedido), una entrega vinculada pero pendiente (sigue sin restar), una entrega cancelada (no cuenta), un producto con código real del catálogo (prueba la resolución de clave "código — nombre" → nombre plano) y una entrega "Hecha" sin ninguna orden vinculada — 15 aserciones sobre el modal real, todas correctas, incluida la comprobación de que la suma de "Salidas" del historial coincide exacto con "Despachado" de la tabla.
- **Materia Prima** (`renderMateriaPrima()`, `js/produccion-materia-prima.js`): ya tenía Tipo (`filtro-tipo-mp`, tipo de material — Cemento/Arena/Grava/...) y búsqueda por proveedor/lote. Se sumó rango de fechas sobre `fechaRecepcion`.
- Mismo patrón en las 4 pantallas: los filtros son acumulables, se recalculan en cada `renderX()` (nunca se guarda estado de filtro aparte), y el mensaje de "sin resultados" distingue cuando es por un filtro activo.

### Presentación unificada — título/acción y filtros en renglones separados (2026-08-21)

Con varios filtros nuevos, el `.acciones-row` (título + controles a la derecha, `justify-content: space-between; flex-wrap: wrap`) empezó a envolver a 2 renglones en las pantallas con más filtros pero se quedaba en 1 en las que tenían menos — inconsistente según el ancho disponible, a pedido del usuario se unificó con un solo criterio: **el título y el botón de acción principal ("+ Registrar...", "+ Nueva Orden") siempre van en su propio `.acciones-row`; los filtros van en un `.flex-gap` aparte, en su propio renglón, siempre debajo** — mismas 4 pantallas (Producción Diaria, Órdenes, Inventario, Materia Prima). Inventario no tiene botón de acción, así que su `.acciones-row` queda solo con el título — el layout de `.acciones-row` (`space-between`) lo deja igual de bien alineado a la izquierda sin necesitar un caso especial.
