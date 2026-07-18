# Módulo: Calidad

El más grande de la aplicación — control técnico de las mezclas de concreto.

## Archivos

- `js/calidad-mezclas.js` (732 líneas) — diseño de mezclas y control de ensayos
- `js/calidad-ajuste-mezcla.js` (674 líneas) — ajustes de mezcla
- `js/calidad-estadisticas.js` (462 líneas) — análisis estadístico
- `js/calidad-trazabilidad.js` (433 líneas) — materia prima, trazabilidad y no conformidades

## Datos

- Tablas Supabase: `disenos_mezcla`, `ensayos_calidad`, `materia_prima`, `no_conformidades`, `ajustes_mezcla`

## Pantallas

`diseno-mezcla`, `ajuste-mezcla`, `control-ensayos`, `analisis-estadistico`, `materia-prima`, `trazabilidad`, `no-conformidades`, `certificados-calidad`

## Filtros del histórico (Ajuste Diario y Control de Ensayos)

Ambas pantallas comparten el mismo patrón de filtros para encontrar registros del histórico: búsqueda de texto libre + desplegables de Cliente / Proyecto / Resistencia (tipo de mezcla), poblados dinámicamente solo con los valores que de verdad aparecen en los datos (no una lista fija). En Ajuste Diario: `_clientesProyectosAjuste()`, `poblarFiltrosAjustesLista()`, `_ajustesFiltrados()` (`js/calidad-ajuste-mezcla.js`). En Control de Ensayos: `_clientesProyectosEnsayo()`, `poblarFiltrosEnsayosLista()`, `_ensayosFiltrados()` (`js/calidad-mezclas.js`) — este último agrega también un filtro de Estado (En curado/Cumple/No cumple) y el botón "Imprimir Reporte", que Ajuste Diario no tiene.

## Qué hace

Gestiona el diseño técnico de cada mezcla de concreto, sus ajustes, los ensayos de calidad (resistencia, etc.), la trazabilidad de materia prima usada, el registro de no conformidades y la emisión de certificados de calidad para el cliente.
