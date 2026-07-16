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
- **Cumplido**: cada entrega tiene `entrega.cumplido = { estado, nuevaFecha?, fechaConfirmacion, confirmadoPor }`. `estado` es uno de `pendiente` (default), `hecha`, `reprogramada` o `cancelada`. El cumplimiento de un viaje es proporcional: entregas `hecha` / total de entregas programadas (`pctCumplidoViaje()`).
- **Orden de Producción asociada**: cada entrega puede vincularse a una orden (`entrega.ordenId`/`ordenNumero`, o "N/A" si no aplica — órdenes viejas no cargadas en el aplicativo, o entregas sin orden). Al elegir una orden se autocompletan cliente/destino/contacto y las líneas de producto con el **saldo pendiente** de cada una (pedido − ya entregado a la fecha en otras entregas "hecha" de esa orden), no la cantidad pedida completa — pensado para entregas parciales. Ver `aplicarOrdenAEntrega()`, `_itemsDeOrden()`, `_cantidadEntregadaPorProducto()`.
- **Prioridad dentro del día**: los viajes de un mismo día se ordenan por `viaje.orden` (si no está definido, se usa el id/timestamp de creación como respaldo — orden cronológico). Se puede reordenar de dos formas equivalentes: las flechas ▲▼ en cada chip (`moverViajeOrden()`, intercambia `orden` con el vecino inmediato) o arrastrando un chip y soltándolo **sobre otro chip del mismo día** (`soltarViajeSobreViaje()`, inserta el arrastrado justo antes del objetivo y renumera `orden` para todo el día). Este orden es el que se usa también en el imprimible del día (ver más abajo) — no solo en el calendario.
- **Mover un viaje a otro día**: arrastrando el chip y soltándolo sobre una celda vacía **o sobre otro viaje** de un día distinto (drag & drop nativo, sin librerías — `iniciarArrastreViaje()`/`soltarViajeEnDia()`/`soltarViajeSobreViaje()`/`_moverViajeADia()`), incluso a días futuros. Solo se puede arrastrar un viaje en fecha no bloqueada, y no se puede soltar sobre una fecha bloqueada (mismo criterio que `esFechaBloqueada`) — un viaje que ya pasó se reprograma desde "✅ Cumplidos", no arrastrándolo. `_moverViajeADia()` es una mutación simple (nunca duplica el viaje): mover un viaje que sigue siendo "plan" (hoy o futuro) es una acción reversible, no un hecho histórico que haya que dejar marcado para siempre.
- **`entrega.fechaOriginal`**: se fija la primera vez que la entrega se guarda y nunca vuelve a cambiar — es el compromiso original. Las Estadísticas comparan `fechaOriginal` contra la fecha ACTUAL del viaje **en vivo** (`_cumplidoEfectivo()` en estadisticas-logistica.js): si una entrega sigue `pendiente` pero su viaje quedó en otra fecha, cuenta como "reprogramada" para las estadísticas de la fecha original — pero si se arrastra de vuelta a su fecha original, vuelve a contar como pendiente sola, sin marca que deshacer a mano. Por eso arrastrar y "Reprogramar" en Cumplidos se comportan distinto: arrastrar es reversible (mutación simple + comparación en vivo); "Reprogramar" en Cumplidos confirma un hecho ya pasado y sí deja una marca fija (`cumplido.estado = 'reprogramada'`) porque ese día ya no se puede volver a editar una vez bloqueado.

## Bloqueo de fechas pasadas

`esFechaBloqueada(fecha)` — cualquier fecha anterior a hoy. Un viaje en fecha bloqueada se abre en modo solo-lectura (banner + campos deshabilitados + sin botón Guardar/Eliminar). No se puede crear un viaje nuevo en una fecha pasada. Marcar cumplidos SÍ sigue permitido sobre fechas pasadas — es la vía para registrar qué pasó realmente.

## Cumplidos (backlog)

Botón "✅ Cumplidos" en la barra de Programación de Viajes, con contador de entregas pendientes. `entregasPendientesAcumuladas()` junta TODAS las entregas de hoy o de cualquier día anterior que sigan en estado `pendiente` (no solo las de ayer — se van acumulando si no se marcan). Cada fila se marca como Hecha, Reprogramada (pide nueva fecha) o Cancelada vía `marcarCumplidoEntrega()`.

**Reprogramar** mueve la entrega: crea un viaje nuevo en la fecha nueva con una copia de esa entrega (fresca, en `pendiente`, heredando `fechaOriginal`), y dentro del viaje original la entrega original queda marcada `reprogramada` con la fecha a la que se movió (no desaparece — así las estadísticas conservan el rastro de que hubo una reprogramación ese día). Si la fecha elegida es la misma del viaje actual (ej. "se atrasó, se entrega más tarde hoy"), no se crea nada nuevo — la entrega se deja `pendiente` tal cual, porque no es una reprogramación real.

## Datos

- Tabla Supabase: `entregas_programadas` (el nombre de la tabla no se cambió al renombrar Despacho→Viaje, para no requerir migración de base de datos).
- Cada fila guarda un viaje completo en `datos` (JSONB), con el arreglo de entregas en el campo `entregas`. Los viajes guardados antes del rename de 2026-07-16 tienen ese arreglo en el campo viejo `clientes` — el código lee `entregas || clientes` para que sigan funcionando, y los migra al campo nuevo la próxima vez que se editan y guardan.

## Estadísticas (dashboard)

`renderEstadisticasLogistica()`, filtrable por periodo (7/30/90 días o todo). El filtro de fecha usa **`fechaOriginal`** de cada entrega, no la fecha actual de su viaje — así una entrega que se arrastró hacia adelante se sigue evaluando dentro de la ventana de su compromiso original, en vez de desaparecer. "Viajes en el periodo" y "Entregas programadas" cuentan todo lo comprometido en la ventana; **"Peso transportado", "% Capacidad promedio" y "Desempeño por vehículo" solo cuentan entregas marcadas "Hecha"** (agrupadas por viaje real — un viaje con 2 entregas hechas es 1 viaje, no 2), para no mezclar lo programado con lo realmente cumplido. **"Entregas reprogramadas"** cuenta el estado "efectivo" `reprogramada` (`_cumplidoEfectivo()`) — mismo bucket que la dona, calculado en vivo: incluye tanto lo marcado a mano en Cumplidos como lo arrastrado a otro día en el calendario, y dejar de contar automáticamente si se arrastra de vuelta a su fecha original. Gráficas:
- Dona de **cumplimiento de entregas** (verde=hecha, ámbar=reprogramada, rojo=cancelada, gris=pendiente).
- Dona de **cumplimiento de viajes** (`_categoriaCumplidoViaje()`: completo=100% de sus entregas hechas, parcial=algunas, sin_cumplir=ninguna, pendiente=todavía hay entregas sin marcar).
- Barras de peso transportado por vehículo, **etiquetadas por placa** (propios) **o tipo de camión** (tercerizados — "CAMION SENCILLO" vs "TRACTO CAMION", nunca el nombre del conductor ni un genérico "TERCERIZADO" que los mezclaría), con tabla de apoyo de N° de viajes y % capacidad debajo (evita mezclar métricas de distinta escala en un mismo eje).
- Tendencia de viajes por día.
- Ranking de destinos más frecuentes — cuenta la **Ciudad de Destino del viaje**, no el destino específico/proyecto de la entrega.

## Qué hace

Calendario mensual de viajes programados (`renderCalendarioLogistica()`), con modal para crear/editar un viaje y sus entregas (`abrirModalViaje()` / `editarViaje()`), backlog de Cumplidos, dashboard de Estadísticas, e impresión/PDF de la programación de un día (`imprimirProgramacionDia()`) para el área de logística en planta — los viajes salen numerados (1, 2, 3…) en el mismo orden de prioridad del calendario (`viaje.orden`), no alfabético por vehículo, porque el impreso es lo único que ve esa área sin acceso al aplicativo.
