# Módulo: Catálogo de Productos

## Archivos

- `js/catalogo.js` (566 líneas)

## Datos

- Tabla Supabase: `productos` (con auto-siembra la primera vez que se carga la app, ver `cargarCatalogo()` en `datos-realtime.js`)
- Fuente original: `Catalogo_Productos_Proconcreto.xlsx` / `.pdf`, y `Plantilla_Importar_Productos.xlsx` para cargas masivas

## Pantallas

`productos` (admin del catálogo)

## Qué hace

Administra el catálogo de mezclas/productos que se ofrecen (usado por el cotizador), con soporte de importación/exportación vía Excel (SheetJS).

### Nombres duplicados (2026-08-04)

Checkbox "Solo duplicados" + tarjeta-resumen clicable en `renderProductosAdmin()` (`js/catalogo.js`). Un producto se marca duplicado si otro producto (activo u oculto) tiene el mismo nombre normalizado (may/min y espacios). Fila resaltada en amarillo + badge "⚠️ Duplicado". Como `productos` tiene RLS que bloquea lecturas con la anon key, la detección se hace en el navegador sobre `CATALOGO` ya cargado (sesión autenticada), no por consulta directa.

### Resolver duplicados (2026-08-04)

Botón "🔗 Resolver duplicados" (abre `modal-resolver-duplicados`) — limpieza masiva de los productos duplicados que llegaron migrados de un programa contable que genera un código nuevo (sufijo `-01`/`-02`/`-03`...) cada vez que cambia la receta, conservando el mismo nombre. `_gruposDuplicadosResolver()` agrupa por nombre normalizado; si hay exactamente un código SIN sufijo de versión en el grupo, se preselecciona como el vigente (a pedido del usuario, después de confirmar que Cotizaciones/Producción/Calidad guardan su propia copia de nombre/precio y no dependen de que el producto siga activo). Los grupos sin un candidato claro quedan resaltados en amarillo y requieren elegir manualmente cuál código se queda activo (radio buttons).

**Nunca se borra un producto** — solo se ocultan los códigos no elegidos (mismo mecanismo que "🚫 Ocultar", `activo=false`), así que Cotizaciones/Órdenes/Producción/Calidad ya guardadas quedan intactas. Lo único que sí se **borra de verdad** es el Costeo de Producto redundante en Centro de Costos (`_borrarCosteoProductoDB()` en `js/costeo-producto.js`, compartido con `eliminarCosteoProducto()`), con un checkbox por grupo (marcado por defecto cuando aplica) — es la única parte que el usuario pidió explícitamente que sí quedara limpia de duplicados. `aplicarResolverDuplicados()` muestra un resumen con `confirm()` antes de tocar nada.

### Exportar Excel (2026-08-04)

Botón "⬇️ Exportar Excel" (`exportarCatalogoExcel()` en `js/catalogo.js`, misma librería SheetJS que ya usaba "Descargar plantilla") — exporta exactamente lo que está en pantalla, no siempre el catálogo completo: respeta los filtros activos (grupo, búsqueda, ver/solo ocultos, solo duplicados) y el orden actual. `_productosAdmVisibleActual` guarda ese set en cada `renderProductosAdmin()`. Incluye columnas que no trae la plantilla de importación (Estado, Desde Costeo) porque este export es para revisar/archivar, no para reimportar. Archivo `Catalogo_Productos_Proconcreto_YYYY-MM-DD.xlsx`.

### Eliminar definitivamente (2026-08-04)

Botón "🗑️ Eliminar" (`eliminarProductoDefinitivo()` en `js/catalogo.js`) — único borrado REAL de productos en la app (`sb.from('productos').delete(...)`), a pedido explícito del usuario ("no me gusta cargar basura"). Solo aparece para productos que ya están **ocultos** y **sin Costeo de Producto asociado**; si tiene costeo, primero hay que borrarlo desde Centro de Costos. El `confirm()` antes de borrar advierte explícitamente que no hay forma de garantizar desde la app que el código no aparezca en alguna cotización/orden histórica — esos módulos guardan su propia copia de nombre/precio (no dependen del catálogo vivo), así que seguirían mostrándose bien, pero cualquier función que vuelva a buscar el código en `CATALOGO` ya no lo encontraría. Por eso queda restringido a productos ya ocultos (que ya pasaron ese filtro antes) en vez de ofrecerse sobre cualquier producto.

### Las 4 tarjetas del resumen filtran al hacer clic (2026-08-04)

"Productos activos", "Ocultos", "Nombres duplicados" y "Mostrados" tienen cursor de mano y, al hacer clic, dejan los checkboxes del toolbar en el estado exacto que representan (`_filtroProdAdmActivos/Ocultos/Duplicados/Todos()` en `js/catalogo.js`) — a pedido del usuario, para que las 4 se comporten igual que ya lo hacía "Nombres duplicados". "Ocultos" necesitó un checkbox nuevo, **"Solo ocultos"** (distinto de "Ver ocultos", que mezcla activos+ocultos): cuando está marcado manda sobre "Ver ocultos" y filtra para mostrar únicamente los inactivos. "Mostrados" limpia todos los filtros (buscador, grupo, ambos checkboxes de ocultos, duplicados) para ver el catálogo completo sin filtrar.

### Resaltado y orden de productos "Desde Costeo" (2026-08-04)

Un producto se marca "🏗️ Desde Costeo" (borde azul en la fila + badge) si tiene un registro en `COSTEO_PRODUCTOS` (es decir, su precio de lista se calcula desde un Costeo de Producto en Centro de Costos, no se edita a mano). Estos productos se ordenan al inicio del listado, en el mismo orden en que se fueron creando los costeos (`COSTEO_PRODUCTOS` ya llega ordenado por `creado` ascendente desde Supabase — ver `cargarDatos()`/`recargarCosteoProductosRT()` en `datos-realtime.js`). El resto de productos mantiene el orden alfabético de siempre.

### Precio bloqueado para productos con Costeo (2026-08-04)

`_productoTieneCosteo(codigo)` (helper compartido) bloquea la edición manual de Precio Lista/Mínimo para estos productos, tanto en los inputs inline de la tabla (`disabled`) como en el modal "Editar producto" (`abrirModalProducto`/`guardarProducto`, con aviso `#mp-aviso-costeo`) — a pedido del usuario, para que no se desincronicen del costo real. `guardarProducto()` además fuerza el valor existente aunque el campo se reactive por algún medio. El único camino para cambiar el precio de estos productos sigue siendo Centro de Costos › Costeo de Producto (con su propio modal de aprobación, ver `costeo.md`).
