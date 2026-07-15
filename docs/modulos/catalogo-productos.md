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
