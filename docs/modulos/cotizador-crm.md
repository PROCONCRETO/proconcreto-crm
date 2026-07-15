# Módulo: Cotizador / CRM comercial

## Archivos

- `js/cotizador.js` (948 líneas) — núcleo: arma la cotización, calcula precios y transporte, genera el consecutivo (`siguienteNum()` en `config.js`)
- `js/historico-clientes-stats.js` (946 líneas) — pipeline de cotizaciones, histórico por cliente, estadísticas
- `js/pdf.js` — exporta la cotización a PDF (jsPDF + html2canvas)

## Datos

- Tablas Supabase: `cotizaciones`, `clientes`
- Tarifas de transporte por municipio están fijas en `TARIFAS_TRANSPORTE` / `TARIFAS_KG_TRANSPORTE` (`js/config.js`), no en base de datos

## Pantallas (`ir()` en `navegacion.js`)

`pipeline`, `historico`, `clientes`, `estadisticas`

## Qué hace

Arma cotizaciones para clientes (producto, cantidad, transporte según municipio), las guarda en Supabase, lleva el pipeline comercial y genera estadísticas/histórico por cliente. Exporta a PDF con membrete de la empresa.
