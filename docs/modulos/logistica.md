# Módulo: Logística

## Archivos

- `js/logistica.js` — calendario de viajes, modal de viaje/entregas, backlog de Cumplidos.
- `js/estadisticas-logistica.js` — dashboard de Estadísticas (Chart.js).

## Subnav

- `🚛 Programación de Viajes` — calendario mensual.
- `📊 Estadísticas` — dashboard de desempeño.

(Misma estructura de subnav que Cotizaciones/Producción/Calidad — ver `subnav-logistica` en `cotizaciones.html`.)

## Conceptos del dominio

- **Viaje**: una salida de camión de planta. Tiene fecha, **Ciudad de Destino** (desplegable curado con municipios de Caldas/Risaralda/Quindío + "Otros" para texto libre — ver `toggleCiudadDestinoOtro()`/`_valorCiudadDestino()`/`_fijarCiudadDestino()`), vehículo y estado. Es la entidad principal del módulo (variable `VIAJES`, tabla Supabase `entregas_programadas`).
- **Entrega**: dentro de un viaje, puede haber una o varias entregas — una entrega es el viaje completo para un cliente, o una porción de él si el camión se completa con otra(s) entrega(s) para otro(s) cliente(s). Cada entrega tiene su propio cliente, **destino específico/proyecto** (el sitio puntual dentro de la ciudad — no confundir con la Ciudad de Destino del viaje), contacto en obra y lista de productos.
- El peso total del viaje es la suma de todas las líneas de producto de todas sus entregas, comparado contra la capacidad del vehículo seleccionado (`CAPACIDAD_VEHICULO`).
- **Cumplido**: cada entrega tiene `entrega.cumplido = { estado, fechaConfirmacion, confirmadoPor }`. `estado` es uno de `pendiente` (default), `hecha` o `cancelada` — estos dos últimos sí son resultados finales. El cumplimiento de un viaje es proporcional: entregas `hecha` / total de entregas programadas (`pctCumplidoViaje()`). "Reprogramada" **no** es un estado final ni bloquea nada (ver más abajo) — por compatibilidad, entregas de antes de este cambio (2026-07-17) pueden traer `estado: 'reprogramada'` guardado como marca fija; el código sigue sabiendo mostrarlas, pero ya no se vuelve a generar.
- **Orden de Producción asociada**: cada entrega puede vincularse a una orden (`entrega.ordenId`/`ordenNumero`, o "N/A" si no aplica — órdenes viejas no cargadas en el aplicativo, o entregas sin orden). Al elegir una orden se autocompletan cliente/destino/contacto y las líneas de producto con el **saldo pendiente** de cada una (pedido − ya entregado a la fecha en otras entregas "hecha" de esa orden), no la cantidad pedida completa — pensado para entregas parciales. Ver `aplicarOrdenAEntrega()`, `_itemsDeOrden()`, `_cantidadEntregadaPorProducto()`.
- **Prioridad dentro del día**: los viajes de un mismo día se ordenan por `viaje.orden` (si no está definido, se usa el id/timestamp de creación como respaldo — orden cronológico). Se puede reordenar de dos formas equivalentes: las flechas ▲▼ en cada chip (`moverViajeOrden()`, intercambia `orden` con el vecino inmediato) o arrastrando un chip y soltándolo **sobre otro chip del mismo día** (`soltarViajeSobreViaje()`, inserta el arrastrado justo antes del objetivo y renumera `orden` para todo el día). Este orden es el que se usa también en el imprimible del día (ver más abajo) — no solo en el calendario.
- **Mover un viaje a otro día**: arrastrando el chip y soltándolo sobre una celda vacía **o sobre otro viaje** de un día distinto (drag & drop nativo, sin librerías — `iniciarArrastreViaje()`/`soltarViajeEnDia()`/`soltarViajeSobreViaje()`/`_moverViajeADia()`), incluso a días futuros. Solo se puede arrastrar un viaje en fecha no bloqueada, y no se puede soltar sobre una fecha bloqueada (mismo criterio que `esFechaBloqueada`) — un viaje que ya pasó se reprograma desde "✅ Cumplidos", no arrastrándolo. `_moverViajeADia()` es una mutación simple (nunca duplica el viaje): mover un viaje que sigue siendo "plan" (hoy o futuro) es una acción reversible, no un hecho histórico que haya que dejar marcado para siempre.
- **`entrega.fechaOriginal`**: se fija la primera vez que la entrega se guarda y nunca vuelve a cambiar — es el compromiso original. Las Estadísticas comparan `fechaOriginal` contra la fecha ACTUAL de la entrega para saber si se reprogramó (`_fueReprogramada()` en estadisticas-logistica.js), independientemente de si el resultado final terminó siendo Hecha o Cancelada.
- **`entrega.vecesReprogramada`**: contador que sube cada vez que "Reprogramar" (en Cumplidos) mueve esta entrega — es la señal principal para `_fueReprogramada()`. Arrastrar en el calendario no lo toca (no pasa por Cumplidos), pero sigue contando igual porque `fechaOriginal` ya no coincide con la fecha actual.

## Bloqueo de fechas pasadas

`esFechaBloqueada(fecha)` — cualquier fecha anterior a hoy. Un viaje en fecha bloqueada se abre en modo solo-lectura (banner + campos deshabilitados + sin botón Guardar/Eliminar). No se puede crear un viaje nuevo en una fecha pasada. Marcar cumplidos SÍ sigue permitido sobre fechas pasadas — es la vía para registrar qué pasó realmente.

## Cumplidos (backlog)

Botón "✅ Cumplidos" en la barra de Programación de Viajes, con contador de entregas pendientes. `entregasPendientesAcumuladas()` junta TODAS las entregas de hoy o de cualquier día anterior que sigan en estado `pendiente` (no solo las de ayer — se van acumulando si no se marcan). Cada fila se marca como Hecha, Reprogramada (pide nueva fecha) o Cancelada vía `marcarCumplidoEntrega()`.

**Reprogramar** mueve la entrega a la fecha nueva — no es un resultado final ni la bloquea: sigue `pendiente` y vuelve a aparecer en Cumplidos en su nueva fecha, totalmente accionable (se puede volver a marcar Hecha, reprogramar otra vez o Cancelar). Esto evita que una entrega que se reprogramó y al final SÍ se cumplió se quedara sin forma de marcarse como hecha. Lo único que queda como rastro es `entrega.vecesReprogramada` (sube en 1 cada vez), que es lo que cuenta para la tarjeta "Entregas reprogramadas" de Estadísticas — independiente de si termina Hecha o Cancelada (`_moverEntregaADia()` en `logistica.js`, mismo mecanismo que arrastrar un viaje en el calendario: mutación simple del viaje si es su única entrega, o se separa en un viaje nuevo si el viaje tenía otras entregas que se quedan donde estaban). Si la fecha elegida es la misma del viaje actual (ej. "se atrasó, se entrega más tarde hoy"), no se mueve nada — no es una reprogramación real.

## Datos

- Tabla Supabase: `entregas_programadas` (el nombre de la tabla no se cambió al renombrar Despacho→Viaje, para no requerir migración de base de datos).
- Cada fila guarda un viaje completo en `datos` (JSONB), con el arreglo de entregas en el campo `entregas`. Los viajes guardados antes del rename de 2026-07-16 tienen ese arreglo en el campo viejo `clientes` — el código lee `entregas || clientes` para que sigan funcionando, y los migra al campo nuevo la próxima vez que se editan y guardan.

## Estadísticas (dashboard)

`renderEstadisticasLogistica()`, filtrable por periodo (botones segmentados 7/30/90 días o todo — `setPeriodoLogistica()`, mismo patrón que `setPeriodo()` en Cotizaciones→Estadísticas). El filtro de fecha usa **`fechaOriginal`** de cada entrega, no la fecha actual de su viaje — así una entrega que se movió hacia adelante se sigue evaluando dentro de la ventana de su compromiso original, en vez de desaparecer. "Viajes en el periodo" y "Entregas programadas" cuentan todo lo comprometido en la ventana; **"Peso transportado", "% Capacidad promedio" y "Desempeño por vehículo" solo cuentan entregas marcadas "Hecha"** (agrupadas por viaje real — un viaje con 2 entregas hechas es 1 viaje, no 2), para no mezclar lo programado con lo realmente cumplido. **"Entregas reprogramadas"** cuenta el hecho histórico `_fueReprogramada()` (no un estado actual): una entrega puede sumar aquí Y contar como "Hecha" a la vez, porque reprogramar ya no es un resultado final que compita con los demás — ver "Cumplidos" arriba.

Tarjetas KPI con el componente `.stat-card` (mismo que Cotizaciones→Estadísticas), con acento de color dinámico tipo semáforo en las que tienen una meta clara: % Cumplimiento (verde ≥80%, ámbar ≥50%, rojo por debajo — `_colorSemaforo()`) y % Capacidad promedio (verde 70-100%, ámbar por debajo, rojo por encima de 100% = sobrecarga — `_colorCapacidad()`); Entregas reprogramadas se resalta en ámbar si hay alguna. Cada gráfica vive en un contenedor de alto fijo con `maintainAspectRatio:false` (mismo patrón que Calidad→Análisis Estadístico), para que el tamaño no dependa de la cantidad de datos. Gráficas:
- Dona de **cumplimiento de entregas** (verde=hecha, ámbar=reprogramada, rojo=cancelada, gris=pendiente).
- Dona de **cumplimiento de viajes** (`_categoriaCumplidoViaje()`: completo=100% de sus entregas hechas, parcial=algunas, sin_cumplir=ninguna, pendiente=todavía hay entregas sin marcar).
- Barras de peso transportado por vehículo, **etiquetadas por placa** (propios) **o tipo de camión** (tercerizados — "CAMION SENCILLO" vs "TRACTO CAMION", nunca el nombre del conductor ni un genérico "TERCERIZADO" que los mezclaría), con tabla de apoyo de N° de viajes y % capacidad debajo (evita mezclar métricas de distinta escala en un mismo eje).
- Tendencia de viajes por día.
- Ranking de destinos más frecuentes — cuenta la **Ciudad de Destino del viaje**, no el destino específico/proyecto de la entrega.

## Qué hace

Calendario mensual de viajes programados (`renderCalendarioLogistica()`), con modal para crear/editar un viaje y sus entregas (`abrirModalViaje()` / `editarViaje()`), backlog de Cumplidos, dashboard de Estadísticas, e impresión/PDF de la programación de un día (`imprimirProgramacionDia()`) para el área de logística en planta — los viajes salen numerados (1, 2, 3…) en el mismo orden de prioridad del calendario (`viaje.orden`), no alfabético por vehículo, porque el impreso es lo único que ve esa área sin acceso al aplicativo.
