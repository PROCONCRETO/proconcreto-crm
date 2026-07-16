# Módulo: Cotizador / CRM comercial

## Archivos

- `js/cotizador.js` (948 líneas) — núcleo: arma la cotización, calcula precios y transporte, genera el consecutivo (`siguienteNum()` en `config.js`)
- `js/historico-clientes-stats.js` (946 líneas) — pipeline de cotizaciones, histórico por cliente, estadísticas, modal de Cliente (`abrirModalCliente()`/`editarCliente()`/`guardarCliente()`)
- `js/pdf.js` — exporta la cotización a PDF (jsPDF + html2canvas)
- `js/rut-parser.js` — lee el RUT (PDF) de un cliente en el navegador para autocompletar el modal de Cliente

## Datos

- Tablas Supabase: `cotizaciones`, `clientes`
- Tarifas de transporte por municipio están fijas en `TARIFAS_TRANSPORTE` / `TARIFAS_KG_TRANSPORTE` (`js/config.js`), no en base de datos
- `cliente`: `nombre`, `contacto` (persona que gestiona/recibe), `cel`, `email` (del contacto), `ciudad`, `nit` (formato `NIT-DV`), `direccion`, `emailFacturacion` (el correo del RUT — **distinto** del email del contacto), `regimen` (uno de los 3 códigos de responsabilidad del RUT: `05. Impuesto Sobre la Renta y Complementarios Régimen Ordinario` / `13. Gran contribuyente` / `47. Régimen Simple de Tributación (SIMPLE)`). Todos estos (salvo Contacto/Celular/Email) se pueden autocompletar leyendo el RUT (ver más abajo) o escribirse/elegirse a mano.

## Pantallas (`ir()` en `navegacion.js`)

`pipeline`, `historico`, `clientes`, `estadisticas`

## Lectura de RUT (autocompletar cliente desde el PDF)

En el modal de Nuevo/Editar Cliente, el botón "📄 Muéstrame el RUT del cliente" (zona de arrastrar-y-soltar o buscar archivo) lee el PDF del RUT **completo en el navegador** con [pdf.js](https://mozilla.github.io/pdf.js/) (CDN) — el archivo nunca se sube a Supabase ni se guarda en ningún lado, solo se procesa en memoria y se descarta.

- `_leerLineasPDF()`: pdf.js no entrega el texto en orden de lectura visual por defecto (el RUT de la DIAN suele separar "plantilla" de "valores llenados" en bloques distintos del PDF) — se reconstruyen renglones agrupando el texto por posición Y (con tolerancia) y ordenando por X, para recuperar el orden visual real.
- `_extraerDatosRut()`: busca sobre esas líneas los patrones de las casillas del formulario 001 (Razón social, NIT+DV, Dirección principal, correo electrónico, régimen tributario) y devuelve lo que logra reconocer.
  - `_extraerNitDv()`: el NIT+DV es una fila de casillas de un solo dígito que a veces queda pegada a otros valores de la misma franja del formulario (ej. "Dirección seccional") — no basta con tomar "la línea siguiente" a la etiqueta tal cual; se busca, en las líneas después de la etiqueta, la primera racha de solo dígitos/espacios/guiones de al menos 9 caracteres.
  - `_extraerCorreo()`: busca el correo cerca de la etiqueta "Correo electrónico" primero, y solo si no lo encuentra ahí cae a buscar en todo el documento — un PDF de RUT puede traer otros correos que no se ven a simple vista (metadatos, pie de página).
  - `_extraerRegimen()`: busca en el recuadro "Responsabilidades, Calidades y Atributos" (casilla 53) por el propio código ("NN-", ej. "05-", "13-", "47-") en la leyenda de esa sección — más confiable que buscar la frase descriptiva completa, porque esas cajas de texto son angostas y a veces cortan la palabra antes de terminar (ej. "régimen ordinario" queda como "régimen ordinar"). La frase (con la raíz de la palabra, no completa) queda como respaldo. Un RUT puede traer varios códigos a la vez; prioridad si hay más de uno: 47 Régimen Simple (reemplaza al ordinario) > 13 Gran Contribuyente > 05 régimen ordinario.
  - `_extraerCiudadDepartamento()`: País, Departamento y Ciudad/Municipio (casillas 38/39/40) quedan en una sola fila visual — se extraen solo las rachas de letras de esa línea (ignorando los códigos numéricos pegados a cada una): el primer bloque es el país, el segundo el departamento, el tercero la ciudad. Se guarda como "Ciudad, Departamento" en el campo Ciudad del cliente.
- Es un parser de **mejor esfuerzo, no infalible** (la posición exacta del texto puede variar entre PDFs) — por eso siempre rellena el formulario para que se revise antes de guardar, nunca guarda directo. Si no reconoce nada, lo dice explícitamente en vez de fallar en silencio.
- Solo llena: Razón social, NIT, Dirección, Correo de facturación, Régimen tributario, Ciudad. **Nunca** toca Contacto/Celular/Email — esos son datos de la persona operativa de contacto, que el RUT no tiene y siguen siendo manuales. (El representante legal del RUT se evaluó pero no se incluyó — no hace falta para este flujo.)

## Qué hace

Arma cotizaciones para clientes (producto, cantidad, transporte según municipio), las guarda en Supabase, lleva el pipeline comercial y genera estadísticas/histórico por cliente. Exporta a PDF con membrete de la empresa.
