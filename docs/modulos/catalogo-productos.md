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

### Resaltado y orden de productos "Desde Costeo" (2026-08-04)

Un producto se marca "🏗️ Desde Costeo" (borde azul en la fila + badge) si tiene un registro en `COSTEO_PRODUCTOS` (es decir, su precio de lista se calcula desde un Costeo de Producto en Centro de Costos, no se edita a mano). Estos productos se ordenan al inicio del listado, en el mismo orden en que se fueron creando los costeos (`COSTEO_PRODUCTOS` ya llega ordenado por `creado` ascendente desde Supabase — ver `cargarDatos()`/`recargarCosteoProductosRT()` en `datos-realtime.js`). El resto de productos mantiene el orden alfabético de siempre.

### Precio bloqueado para productos con Costeo (2026-08-04)

`_productoTieneCosteo(codigo)` (helper compartido) bloquea la edición manual de Precio Lista/Mínimo para estos productos, tanto en los inputs inline de la tabla (`disabled`) como en el modal "Editar producto" (`abrirModalProducto`/`guardarProducto`, con aviso `#mp-aviso-costeo`) — a pedido del usuario, para que no se desincronicen del costo real. `guardarProducto()` además fuerza el valor existente aunque el campo se reactive por algún medio. El único camino para cambiar el precio de estos productos sigue siendo Centro de Costos › Costeo de Producto (con su propio modal de aprobación, ver `costeo.md`).
