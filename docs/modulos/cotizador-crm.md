# Módulo: Cotizador / CRM comercial

## Archivos

- `js/cotizador.js` (948 líneas) — núcleo: arma la cotización, calcula precios y transporte, genera el consecutivo (`siguienteNum()` en `config.js`)
- `js/historico-clientes-stats.js` (946 líneas) — pipeline de cotizaciones, histórico por cliente, estadísticas, modal de Cliente (`abrirModalCliente()`/`editarCliente()`/`guardarCliente()`)
- `js/pdf.js` — exporta la cotización a PDF (jsPDF + html2canvas)
- `js/rut-parser.js` — lee el RUT (PDF) de un cliente en el navegador para autocompletar el modal de Cliente
- `js/migracion-consecutivos.js` — **temporal**, borrar tras usarla una vez (ver "Migración de las cotizaciones anteriores al 2026-07-22" más abajo)

## Datos

- Tablas Supabase: `cotizaciones`, `clientes`. **`clientes` no tiene columna `modificado`** (a diferencia del resto de tablas de la app) — nunca se debe incluir ese campo en un `.update()`/`.upsert()` contra esta tabla, PostgREST lo rechaza entero ("Could not find the 'modificado' column..."). Bug real: la rama de "actualizar cliente existente" de `guardarCliente()` lo incluía, así que **ninguna edición a un cliente ya existente (mismo nombre) se guardaba de verdad en Supabase** hasta el 2026-07-19 — quedaba bien en memoria durante la sesión pero se revertía al recargar la página. Crear un cliente nuevo, o editar uno cambiándole el nombre (rama de `insert`), sí funcionaba siempre porque esa rama nunca incluyó `modificado`.
- Tarifas de transporte por municipio están fijas en `TARIFAS_TRANSPORTE` / `TARIFAS_KG_TRANSPORTE` (`js/config.js`), no en base de datos
- `cliente`: `nombre`, `contacto` (persona que gestiona/recibe), `cel`, `email` (del contacto), `ciudad` (formato "Ciudad, Departamento"), `nit` (formato `NIT-DV`), `emailFacturacion` (el correo del RUT — **distinto** del email del contacto), `regimen` (uno de los 3 códigos de responsabilidad del RUT: `05. Impuesto Sobre la Renta y Complementarios Régimen Ordinario` / `13. Gran contribuyente` / `47. Régimen Simple de Tributación (SIMPLE)`), `proyectos` (arreglo — un cliente puede tener una o varias obras/proyectos a la vez, cada uno con su propio `nombre`, `contacto` y `telefono` en obra, distintos del contacto general del cliente). Todos estos (salvo Contacto/Celular/Email) se pueden autocompletar leyendo el RUT (ver más abajo) o escribirse/elegirse a mano. (No hay campo de Dirección — se evaluó pero no se incluyó, no es un dato relevante para este flujo.)

## Pantallas (`ir()` en `navegacion.js`)

`pipeline`, `historico`, `clientes`, `estadisticas`

## Lectura de RUT (autocompletar cliente desde el PDF)

En el modal de Nuevo/Editar Cliente, el botón "📄 Muéstrame el RUT del cliente" (zona de arrastrar-y-soltar o buscar archivo, ubicada al final del formulario, justo antes de los botones Cancelar/Guardar) lee el PDF del RUT **completo en el navegador** con [pdf.js](https://mozilla.github.io/pdf.js/) (CDN) — el archivo nunca se sube a Supabase ni se guarda en ningún lado, solo se procesa en memoria y se descarta.

- `_leerLineasPDF()`: pdf.js no entrega el texto en orden de lectura visual por defecto (el RUT de la DIAN suele separar "plantilla" de "valores llenados" en bloques distintos del PDF) — se reconstruyen renglones agrupando el texto por posición Y (con tolerancia) y ordenando por X, para recuperar el orden visual real.
- `_extraerDatosRut()`: busca sobre esas líneas los patrones de las casillas del formulario 001 (Razón social, NIT+DV, correo electrónico, régimen tributario, ciudad/departamento) y devuelve lo que logra reconocer.
  - `_extraerNitDv()`: el NIT+DV es una fila de casillas de un solo dígito que a veces queda pegada a otros valores de la misma franja del formulario (ej. "Dirección seccional") — no basta con tomar "la línea siguiente" a la etiqueta tal cual; se busca, en las líneas después de la etiqueta, la primera racha de solo dígitos/espacios/guiones de al menos 9 caracteres.
  - `_extraerCorreo()`: busca el correo cerca de la etiqueta "Correo electrónico" primero, y solo si no lo encuentra ahí cae a buscar en todo el documento — un PDF de RUT puede traer otros correos que no se ven a simple vista (metadatos, pie de página).
  - `_extraerRegimen()`: busca en el recuadro "Responsabilidades, Calidades y Atributos" (casilla 53) por el propio código ("NN-", ej. "05-", "13-", "47-") en la leyenda de esa sección — más confiable que buscar la frase descriptiva completa, porque esas cajas de texto son angostas y a veces cortan la palabra antes de terminar (ej. "régimen ordinario" queda como "régimen ordinar"). La frase (con la raíz de la palabra, no completa) queda como respaldo. Un RUT puede traer varios códigos a la vez; prioridad si hay más de uno: 47 Régimen Simple (reemplaza al ordinario) > 13 Gran Contribuyente > 05 régimen ordinario.
  - `_extraerCiudadDepartamento()`: País, Departamento y Ciudad/Municipio (casillas 38/39/40) quedan en una sola fila visual — se extraen solo las rachas de letras de esa línea (ignorando los códigos numéricos pegados a cada una): el primer bloque es el país, el segundo el departamento, el tercero la ciudad. Se exige que el primer bloque sea literalmente "COLOMBIA" como ancla — sin eso, otra línea con 3+ rachas de letras (ej. una dirección con guion, que se parte en varios bloques) se puede confundir con esta. Se guarda como "Ciudad, Departamento" en el campo Ciudad del cliente.
- Es un parser de **mejor esfuerzo, no infalible** (la posición exacta del texto puede variar entre PDFs) — por eso siempre rellena el formulario para que se revise antes de guardar, nunca guarda directo. Si no reconoce nada, lo dice explícitamente en vez de fallar en silencio.
- Solo llena: Razón social, NIT, Correo de facturación, Régimen tributario, Ciudad. **Nunca** toca Contacto/Celular/Email — esos son datos de la persona operativa de contacto, que el RUT no tiene y siguen siendo manuales. (El representante legal y la Dirección del RUT se evaluaron pero no se incluyeron — no son datos relevantes para este flujo.)

## Proyectos del cliente

En el modal de Nuevo/Editar Cliente, debajo de la zona del RUT: botón "+ Agregar proyecto" que arma una fila editable por proyecto (Nombre del proyecto, Contacto, Teléfono) — mismo patrón que los clientes/productos adicionales de Ajuste Diario (`js/calidad-ajuste-mezcla.js`): arreglo de trabajo (`_proyectosClienteActual`) mientras el modal está abierto, se guarda dentro del cliente (`cliente.proyectos`) al hacer Guardar. Las filas sin nombre de proyecto se descartan al guardar. `renderProyectosCliente()`/`agregarProyectoCliente()`/`eliminarProyectoCliente()` en `js/historico-clientes-stats.js`.

**Trazabilidad Cliente → Proyecto en el resto de la app**: `cliente.proyectos` es lo que alimenta los desplegables de "Destino específico/Proyecto" en Logística y "Proyecto" en Calidad (Ajuste Diario) — ver `poblarSelectProyectosDeCliente()` en `js/calidad-ajuste-mezcla.js`, el módulo que documenta ese patrón compartido.

## Ciudad y Proyecto en Nueva Cotización (campos separados)

Hasta el 2026-07-22 existía un solo campo de texto libre "Ciudad / Proyecto". Ahora son dos, y significan cosas distintas dentro del objeto `cot.cliente` que se guarda con cada cotización (no confundir con el registro persistente del cliente en la tabla `clientes`, que tiene su propio `ciudad` de RUT y su arreglo `proyectos`):

- **`cot.cliente.ciudad`**: texto libre, obligatorio — la ciudad de entrega de ESTA cotización en particular (puede no coincidir con la ciudad registrada del cliente).
- **`cot.cliente.proyecto`**: opcional al cotizar. Es un `<select>` (`poblarSelectProyectosDeCliente('cliente-proyecto', ...)`) que solo ofrece los proyectos ya registrados para ese cliente (`cliente.proyectos` — ver arriba); se repuebla al escribir/elegir el cliente (`oninput` en Razón social, `usarCliente()`, `seleccionarClienteCot()`).

**Por qué es opcional al cotizar pero obligatorio al aceptar**: en la etapa de cotizar puede que el proyecto/obra todavía no exista como tal. Pero el Proyecto es justamente el dato que la Orden de Producción hereda (`crearOrdenDesdeCotizacion()`) y que de ahí pasa a Logística para autocompletar la entrega (`aplicarOrdenAEntrega()` en `js/logistica.js`) — así que sin proyecto asignado, esa cadena se rompe. Por eso, al pasar una cotización a **Aceptada** (`cambiarEstado()` o arrastrando en el kanban del Pipeline, `onDrop()`, ambos en `js/historico-clientes-stats.js`) sin que `cot.cliente.proyecto` tenga valor:

1. `_intentarAceptarCotizacion(cot)` bloquea la aceptación, felicita al vendedor por cerrar la venta, y abre la ficha del cliente (`editarCliente()`) para que registre el proyecto y su contacto en obra.
2. Al guardar esa ficha, `guardarCliente()` retoma la aceptación pendiente (`_completarAceptacionCotizacion()`): si el cliente ya tiene proyectos, usa el único que haya o pregunta cuál si hay varios, se lo asigna a la cotización, y ahí sí la marca Aceptada y crea la Orden de Servicio (`_confirmarAceptacionCotizacion()`).
3. Si se cancela esa ficha sin guardar (`cerrarModal('modal-cliente')`), la aceptación queda pendiente sin completarse — se puede reintentar "Aceptada" más adelante.

## Formulario de Nueva Cotización se limpia solo al guardar

`guardarCotizacion()` deja el formulario en blanco (`_resetFormularioCotizacion()` en `js/cotizador.js`, mismo helper que usa `limpiarFormulario()`) apenas termina de guardar. Antes del 2026-07-21 solo limpiaba el campo Número — el cliente, los ítems, transporte y descuentos quedaban pegados en pantalla, así que en equipos donde varias personas comparten la misma sesión del navegador (no se recarga la página entre un uso y otro), el siguiente que entraba a "+Nueva Cotización" veía los datos de la última cotización guardada por otra persona (bug real, reportado así).

## Consecutivo de cotización (automático desde C100001)

Hasta el 2026-07-22 el Número se escribía a mano (con solo una sugerencia de "último usado" al lado) — causaba typos, saltos y duplicados. Ahora se asigna solo:

- `siguienteNum()` (`js/config.js`) calcula el máximo `numero` ya usado en `COTIZACIONES` y devuelve el siguiente, con un piso de `100001` (formato `C100001`, `C100002`...).
- El campo Número del formulario (`#num-cot`) es de solo lectura — ya no se puede escribir. Se autorrellena con `siguienteNum()` cada vez que el formulario queda en blanco (`_resetFormularioCotizacion()`, usado por `limpiarFormulario()`, el final de `guardarCotizacion()`, y `mostrarApp()` al iniciar sesión).
- **Por qué se recalcula otra vez justo al guardar** (`guardarCotizacion()`): el número que se ve en pantalla se calculó al abrir el formulario, y pudo quedar desactualizado si otra persona guardó una cotización mientras tanto (dos personas cotizando a la vez) — así que si ese número todavía no le pertenece a ninguna cotización guardada, se recalcula contra los datos más frescos (ya actualizados por la sincronización en tiempo real) antes de guardar. Si el número SÍ pertenece a una cotización existente, es porque se está guardando una nueva versión de ella (`cargarCotizacion()`), y conserva su propio número — nunca se le asigna uno nuevo por accidente. No hay un secuenciador atómico del lado de Supabase, así que sigue existiendo una ventana de colisión teórica (submilisegundos) si dos personas guardan literalmente al mismo tiempo; con 7 usuarios no se consideró necesario blindarlo más que esto.

### Migración de las cotizaciones anteriores al 2026-07-22

Los números viejos (escritos a mano, sin un formato fijo) no se pierden: `js/migracion-consecutivos.js` es una **herramienta de un solo uso** (no parte permanente del aplicativo — se debe borrar, junto con su `<script>` en `cotizaciones.html`, después de usarla una vez) que agrupa las cotizaciones existentes por número (una cotización con varias versiones V1/V2/V3... comparte un solo consecutivo nuevo), las ordena por fecha y les asigna `C100001`, `C100002`... en ese orden, guardando el número viejo en un campo nuevo `cot.numeroAnterior`. Donde se muestra el número a una persona (histórico, kanban del Pipeline, PDF de la cotización, referencia en la Orden de Producción) se usa `_numeroCotTexto(cot)` (`js/historico-clientes-stats.js`), que arma `"C100001 (C4562)"` si hay `numeroAnterior`, o solo `cot.numero` si no lo hay (las cotizaciones nuevas nunca tienen `numeroAnterior`). También reamarra las Órdenes de Servicio que ya apuntaban al número viejo (`orden.cotizacion`), para no romper el enlace cotización → orden.

Se corre a mano desde la consola del navegador, ya logueado en la app: `migrarConsecutivosCotizaciones()` solo muestra el plan (no escribe nada); `migrarConsecutivosCotizaciones(true)` lo ejecuta de verdad. Es idempotente (una cotización con `numeroAnterior` ya asignado se salta sola en una segunda corrida) y se niega a correr si detecta alguna cotización ya creada con el consecutivo nuevo antes de migrar las viejas — por eso **debe correrse antes de crear cualquier cotización nueva** después de este cambio, para que la numeración no se cruce.

## Qué hace

Arma cotizaciones para clientes (producto, cantidad, transporte según municipio), las guarda en Supabase, lleva el pipeline comercial y genera estadísticas/histórico por cliente. Exporta a PDF con membrete de la empresa.
