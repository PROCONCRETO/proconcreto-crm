# Módulo: Proyectos (2026-10-11)

## Archivos

- `js/proyectos.js`
- `sql/2026-10-11_proyectos.sql` (correr una sola vez en el SQL Editor de Supabase)

## Datos

- Tabla Supabase: `proyectos` (`id text primary key`, `datos jsonb` — mismo patrón que el resto de la app)
- RLS: abierto a cualquier usuario autenticado, sin restricción por correo (mismo criterio que `clientes`/`cotizaciones` — todo el equipo necesita leer y escribir)

## Pantallas

`proyectos` — una sola pantalla por ahora (listado + modal de crear/editar), sin subnav propio.

## Qué hace

A pedido del usuario: "vamos a crear una nueva ventana de PROYECTOS... incluyela en la pantalla de inicio y en la fila superior con las demás ventanas". Al preguntar qué debía mostrar/gestionar, eligió explícitamente **"gestión de proyectos como entidad nueva"**: un registro propio (nombre, cliente, ciudad, estado, fechas, responsable, descripción), **independiente** de lo que ya existe en Clientes (`cliente.proyectos[]`) y Cotizaciones (`cot.cliente.proyecto`) — no reutiliza ni modifica esas estructuras, son conceptos separados que coexisten.

- **Campos de un Proyecto**: `nombre` (único obligatorio), `cliente` (texto libre, con buscador contra `CLIENTES` para autocompletar — no obliga a que el cliente ya exista en el catálogo), `ciudad`, `estado` (`Planeación` / `En ejecución` / `Finalizado` / `Cancelado`), `fechaInicio`, `fechaFinEstimada`, `responsable` (texto libre), `descripcion`.
- **Listado** (`renderProyectos()`): tabla con buscador (nombre/cliente/ciudad) y filtro por estado, más reciente primero. Cada fila tiene un badge de color según el estado y botones "✏️ Editar"/"🗑️" (eliminar definitivo, con confirmación — a diferencia de Productos/Clientes, acá no hay ningún otro módulo que referencie un Proyecto todavía, así que no hace falta el patrón de "ocultar en vez de borrar").
- **Ubicación en la navegación**: botón nuevo en la barra superior y en la pantalla de Inicio, **entre Calidad y Centro de Costos** (a pedido explícito del usuario: "pongamos la de proyectos al lado de la de calidad... movamos la ventana de costos para el extremo derecho" — Centro de Costos ya estaba al final, insertar Proyectos justo antes deja ambos pedidos resueltos a la vez).
- **Sin subnav propio todavía** — `activarModulo('proyectos')` va directo a la única pantalla, a diferencia de los demás módulos (que siempre muestran su barra de sub-pestañas). Se puede agregar más adelante si el módulo crece (ej. una vista de estadísticas).
- Verificado con un arnés real — 32 aserciones: el orden de los botones en la barra superior y en Inicio; la navegación activa/desactiva las pantallas correctas; el estado vacío; crear un proyecto completo de punta a punta (validación de Nombre obligatorio, el upsert real hacia Supabase, el modal cerrando y la tabla mostrando el registro); editar sin duplicar y sin perder `creadoEn`; el buscador de cliente; los filtros de estado y de búsqueda; eliminar con su `delete` real; y que los demás módulos (Calidad, Cotizaciones, Inicio) siguen funcionando igual que antes — sin errores de consola.
