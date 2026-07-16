# Módulo: Producción

## Archivos

- `js/ordenes-produccion.js` (288 líneas) — órdenes de servicio y pipeline de producción
- `js/produccion-diaria.js` (277 líneas) — registro de producción del día

## Datos

- Tablas Supabase: `ordenes_servicio`, `producciones`

## Pantallas

`pipeline-produccion`, `ordenes-servicio`, `produccion-diaria`

## Qué hace

Convierte una cotización aprobada en una orden de servicio, hace seguimiento del pipeline de producción y registra la producción diaria de la planta.

## Encadenamiento con Logística

Una orden puede traer un desglose por producto (`items[]`, cuando viene de una cotización aceptada vía `crearOrdenDesdeCotizacion()`) o solo una cantidad genérica (órdenes creadas a mano con `cantidad`+`descripcion`) — `_itemsDeOrden()` (en `logistica.js`) unifica ambos casos.

Al editar una orden (`editarOrden()`), se muestra una tabla de **Pedido / Entregado / Saldo** por producto (`renderSaldoOrden()`), cruzando con las entregas de Logística vinculadas a esa orden y marcadas "Hecha" en Cumplidos (`_cantidadEntregadaPorProducto()`). Así se ve de un vistazo si una orden ya se entregó completa, parcial, o sigue pendiente.
