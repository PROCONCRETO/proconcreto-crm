# Módulo: Cotizador / CRM comercial

## Archivos

- `js/cotizador.js` (948 líneas) — núcleo: arma la cotización, calcula precios y transporte, genera el consecutivo (`siguienteNum()` en `config.js`)
- `js/historico-clientes-stats.js` (946 líneas) — pipeline de cotizaciones, histórico por cliente, estadísticas, modal de Cliente (`abrirModalCliente()`/`editarCliente()`/`guardarCliente()`)
- `js/pdf.js` — exporta la cotización a PDF (jsPDF + html2canvas)
- `js/rut-parser.js` — lee el RUT (PDF) de un cliente en el navegador para autocompletar el modal de Cliente

## Datos

- Tablas Supabase: `cotizaciones`, `clientes`
- Tarifas de transporte por municipio están fijas en `TARIFAS_TRANSPORTE` / `TARIFAS_KG_TRANSPORTE` (`js/config.js`), no en base de datos
- `cliente`: `nombre`, `contacto` (persona que gestiona/recibe — **no necesariamente el representante legal**), `cel`, `email` (del contacto), `ciudad`, `nit` (formato `NIT-DV`), `direccion`, `representanteLegal`, `emailFacturacion` (el correo del RUT — **distinto** del email del contacto). Estos últimos 4 campos se pueden autocompletar leyendo el RUT (ver más abajo) o escribirse a mano.

## Pantallas (`ir()` en `navegacion.js`)

`pipeline`, `historico`, `clientes`, `estadisticas`

## Lectura de RUT (autocompletar cliente desde el PDF)

En el modal de Nuevo/Editar Cliente, el botón "📄 Muéstrame el RUT del cliente" (zona de arrastrar-y-soltar o buscar archivo) lee el PDF del RUT **completo en el navegador** con [pdf.js](https://mozilla.github.io/pdf.js/) (CDN) — el archivo nunca se sube a Supabase ni se guarda en ningún lado, solo se procesa en memoria y se descarta.

- `_leerLineasPDF()`: pdf.js no entrega el texto en orden de lectura visual por defecto (el RUT de la DIAN suele separar "plantilla" de "valores llenados" en bloques distintos del PDF) — se reconstruyen renglones agrupando el texto por posición Y (con tolerancia) y ordenando por X, para recuperar el orden visual real.
- `_extraerDatosRut()`: busca sobre esas líneas los patrones de las casillas del formulario 001 (Razón social, NIT+DV, Dirección principal, correo electrónico, representante legal en la hoja de Representación) y devuelve lo que logra reconocer.
- Es un parser de **mejor esfuerzo, no infalible** (la posición exacta del texto puede variar entre PDFs) — por eso siempre rellena el formulario para que se revise antes de guardar, nunca guarda directo. Si no reconoce nada, lo dice explícitamente en vez de fallar en silencio.
- Solo llena: Razón social, NIT, Dirección, Representante legal, Correo de facturación. **Nunca** toca Contacto/Celular/Email — esos son datos de la persona operativa de contacto, que el RUT no tiene y siguen siendo manuales.

## Qué hace

Arma cotizaciones para clientes (producto, cantidad, transporte según municipio), las guarda en Supabase, lleva el pipeline comercial y genera estadísticas/histórico por cliente. Exporta a PDF con membrete de la empresa.
