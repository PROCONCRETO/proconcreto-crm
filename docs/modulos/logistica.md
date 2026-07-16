# Módulo: Logística

## Archivos

- `js/logistica.js`

## Subnav

`🚛 Programación de Viajes` (única pantalla por ahora, misma estructura de subnav que Cotizaciones/Producción/Calidad — ver `subnav-logistica` en `cotizaciones.html`).

## Conceptos del dominio

- **Viaje**: una salida de camión de planta. Tiene fecha, destino general (ej. Manizales), vehículo y estado. Es la entidad principal del módulo (variable `VIAJES`, tabla Supabase `entregas_programadas`).
- **Entrega**: dentro de un viaje, puede haber una o varias entregas — una entrega es el viaje completo para un cliente, o una porción de él si el camión se completa con otra(s) entrega(s) para otro(s) cliente(s). Cada entrega tiene su propio cliente, destino específico/proyecto, contacto en obra y lista de productos.
- El peso total del viaje es la suma de todas las líneas de producto de todas sus entregas, comparado contra la capacidad del vehículo seleccionado (`CAPACIDAD_VEHICULO`).

## Datos

- Tabla Supabase: `entregas_programadas` (el nombre de la tabla no se cambió al renombrar Despacho→Viaje, para no requerir migración de base de datos).
- Cada fila guarda un viaje completo en `datos` (JSONB), con el arreglo de entregas en el campo `entregas`. Los viajes guardados antes del rename de 2026-07-16 tienen ese arreglo en el campo viejo `clientes` — el código lee `entregas || clientes` para que sigan funcionando, y los migra al campo nuevo la próxima vez que se editan y guardan.

## Qué hace

Calendario mensual de viajes programados (`renderCalendarioLogistica()`), con modal para crear/editar un viaje y sus entregas (`abrirModalViaje()` / `editarViaje()`), e impresión/PDF de la programación de un día (`imprimirProgramacionDia()`) para el área de logística en planta.
