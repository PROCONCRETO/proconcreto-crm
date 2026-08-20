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
