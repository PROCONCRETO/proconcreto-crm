# Arquitectura Técnica (estado real, 2026-07-15)

## Stack

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | HTML + CSS + JavaScript vanilla, sin framework ni build step | Todo cuelga de un único `cotizaciones.html` (~1,500 líneas) que carga 13 archivos JS por `<script src>` con cache-busting manual (`?v=YYYYMMDDx`) |
| Backend | [Supabase](https://supabase.com) (Postgres + Auth + Realtime), cliente cargado por CDN | Proyecto `wyfjmgywyqluzoymxoyp` (`https://wyfjmgywyqluzoymxoyp.supabase.co`), configurado en `js/config.js` con la key pública/anon. No hay servidor de aplicación propio. |
| Hosting | GitHub Pages, repo `proconcreto/proconcreto-crm`, rama `main` | Sitio estático — Pages sirve directo lo que hay en el repo |
| Librerías de terceros (CDN) | Chart.js, jsPDF, html2canvas, SheetJS (xlsx.js) | Gráficos, generación de PDF de cotizaciones/certificados, e importación/exportación de Excel |
| Dev local | `serve.ps1` (servidor HTTP casero en PowerShell, puerto 8080) | Sirve los estáticos y expone `POST /guardar-cotizacion` para respaldar cotizaciones como JSON en `cotizaciones-guardadas/` (local, fuera del repo) |

## Marca del aplicativo — "ProSuite" (2026-08-25)

El aplicativo (este mismo CRM/ERP interno, todos sus módulos) tiene nombre propio desde ahora: **ProSuite**, distinto del logo de la empresa (Proconcreto Prefabricados, `logo.png`) — la relación es "Proconcreto es la empresa, ProSuite es la herramienta que usan". A pedido del usuario ("necesito que le des una identidad a la imagen... para que empiece a generar recordación en los usuarios"), se le dio identidad visual propia en vez de dejarlo como texto plano:

- **Ícono**: un cuadrado redondeado azul (`#003F7F`, el mismo `--azul` que ya domina toda la interfaz) con una "P" blanca y una placa verde (`#8BC53F`, el verde de "Pro" en el logo de Proconcreto) superpuesta en la esquina — el verde es la costura visual intencional entre ambas marcas. Es un `<svg>` inline (rects + text, sin paths complejos) para que se vea nítido a cualquier tamaño, reutilizado tal cual como favicon (`<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,...">`, sin archivo aparte) y en los dos puntos donde aparece la marca en `cotizaciones.html`.
- **Wordmark**: "Pro" en verde + "Suite" en el color que mejor contraste haga con el fondo (blanco sobre el nav azul oscuro `#001F3F`; el propio `--azul` sobre el fondo blanco del login) — clases `.prosuite-wordmark`/`.ps-pro`/`.ps-suite`/`.ps-suite-claro` en `css/estilos.css`.
- **Dónde aparece**: reemplazó el logo de Proconcreto en el nav superior (`.nav-logo`, el punto de mayor frecuencia de uso, a propósito — es donde más construye recordación en el día a día) — el logo de la empresa se queda intacto en el login (`logo.png`, sin tocar) y ahí se le sumó la marca ProSuite justo debajo, como el producto que ofrece esa empresa. `<title>` pasó de "PROCONCRETO — Sistema de Cotizaciones" a "ProSuite — Proconcreto".

### Marca de agua del logo de Proconcreto (2026-08-25)

A pedido del usuario ("una marca de agua sutil que muestre el logo grande en todas las ventanas") — maquetado primero como Artifact (captura real de la pantalla "Nueva Cotización" con la marca ya aplicada) y aprobado antes de subirlo, mismo criterio que otras decisiones de diseño de esta sesión.

- `.marca-agua` (`css/estilos.css`) — el `<img src="logo.png">` de siempre, pero grande (`62vw`, máx. 900px) y centrado. `position: fixed` para que no se mueva con el scroll (siempre visible, en cualquier punto de cualquier pantalla) y `pointer-events: none` para que nunca intercepte un clic.
- Un solo `<div class="marca-agua">` justo después de `<body>` en `cotizaciones.html` — como todas las `.pantalla` viven superpuestas en el mismo documento (ver "Navegación" más abajo), un único elemento alcanza para las pantallas del aplicativo entero, sin repetirlo por módulo.
- **Bug real, corregido el mismo día ("no veo la marca de agua")**: la primera versión la ponía DETRÁS del contenido (`z-index: -1` sobre `<body>` con `isolation: isolate`) — semánticamente lo esperado para una "marca de agua", pero como casi toda pantalla de esta app es tarjetas blancas apiladas una encima de otra, casi no queda fondo visible en ningún momento — el logo quedaba tapado casi siempre, invisible en la práctica (confirmado con una captura real: apenas se alcanzaba a ver una esquina de "PREFABRICADOS" en un huequito entre dos tarjetas). Corrección: ahora va **encima** del contenido (`z-index: 5`, por debajo de `.modal-overlay` que usa 200, así un modal abierto sí la tapa) pero con `mix-blend-mode: multiply` en vez de una capa gris opaca — las zonas oscuras del logo oscurecen levemente lo que haya debajo (tarjeta blanca, fondo gris, barra azul) sin taparlo, así se ve como marca de agua real sobre cualquier superficie sin esconderse ni estorbar la lectura de campos/tablas. `isolation: isolate` en `<body>` acota ese `mix-blend-mode` a que solo se mezcle con el contenido de la app. Opacidad final: **15%**.

## Calculadora en campos numéricos (`js/calculadora-inputs.js`, 2026-08-25)

A pedido del usuario ("donde se escriban datos numéricos, poder hacer operaciones básicas") — cualquier `<input type="number">` de TODA la app admite escribir una operación (`+ - * /`, con paréntesis y precedencia normal) en vez de solo el resultado ya calculado, ej. escribir `1500+320` y que al salir del campo quede `1820`.

- **Por qué no se tocó ningún `<input>` existente**: un `<input type="number">` nativo rechaza los caracteres `+ * /` al escribirlos (el navegador los bloquea antes de que lleguen a JS) — no hay forma de que admitan una operación quedándose como `type="number"`. La solución es un único listener delegado en `document` (fase de captura, `focusin`/`focusout`) que cambia el input a `type="text"` SOLO mientras tiene el foco (para poder escribir la operación) y lo devuelve a `type="number"` al salir, ya evaluado. Como el listener vive en `document`, no en cada input, funciona automático con filas que se agreguen después en tiempo real (Insumos, Máquinas, ítems de cotización, etc.) sin tocar ni un archivo de los que arman esas filas.
- **Evaluación segura**: `_evaluarExpresionNumerica()` exige que el texto completo pase una lista blanca de caracteres (`\d\s.,+\-*/()` — nada de letras ni símbolos) antes de pasarlo a `Function(...)` — con esa lista blanca es físicamente imposible construir una instrucción JS distinta de una cuenta aritmética. Verificado con un caso real de intento malicioso (`alert(1)`): no se ejecuta, el campo queda vacío.
- Los eventos `input`/`change` se disparan de nuevo sobre el campo después de escribir el resultado, para que el `oninput`/`onchange` que ya trae cada fila (el que actualiza el dato real del formulario) se entere del valor calculado — no hace falta ningún cambio en la lógica de ningún módulo.
- Un número negativo simple (`-5`) o un número normal sin operador (`250`) no se tocan — solo se evalúa si de verdad hay un operador aparte de un posible `-` inicial.

## Cómo se guardan los datos en Supabase

Patrón consistente en casi todas las tablas: **una columna JSONB `datos`** con el objeto completo, más metadatos mínimos (`estado`, `creado`). Es decir, no hay un esquema relacional normalizado por campo — agregar un campo nuevo a una entidad es agregarlo al objeto JS y ya, sin migración de base de datos.

Tablas identificadas en el código (`js/datos-realtime.js` es el punto central que las carga todas al abrir la app):

| Tabla | Módulo(s) que la usan |
|---|---|
| `cotizaciones` | `cotizador.js`, `historico-clientes-stats.js` |
| `clientes` | `cotizador.js`, `historico-clientes-stats.js` |
| `ordenes_servicio` | `ordenes-produccion.js`, `historico-clientes-stats.js` |
| `producciones` | `produccion-diaria.js` |
| `productos` | `catalogo.js` |
| `disenos_mezcla` | `calidad-mezclas.js` |
| `ensayos_calidad` | `calidad-mezclas.js` |
| `materia_prima` | `produccion-materia-prima.js` |
| `no_conformidades` | (ninguno — tabla y datos se conservan en Supabase, pero la app ya no la consulta desde 2026-08-17, ver `docs/modulos/calidad.md`) |
| `ajustes_mezcla` | `calidad-ajuste-mezcla.js` |
| `entregas_programadas` | `logistica.js` |
| `parametros_mo`, `clases_salariales`, `cuadrillas_productivas` | `costeo-mano-obra.js` — módulo Costeo, ver `docs/modulos/costeo.md`. Tablas nuevas (2026-07-26), hay que correr `sql/2026-07-26_costeo_mano_obra.sql` en Supabase antes de usarlas. |

Además de las tablas (Postgres), hay un bucket de **Supabase Storage** para archivos binarios reales (no JSONB): `laboratorio-pdf` (privado, solo autenticados) — informes de laboratorio en PDF adjuntos a un Ensayo de Calidad (ligado al N° de cilindro), comprimidos en el navegador antes de subirse si pesan mucho (`js/compresor-pdf.js`). El registro en la tabla `ensayos_calidad` solo guarda la referencia al archivo (`pdfPath`), nunca el binario.

## Navegación (`js/navegacion.js`)

Dos niveles: `activarModulo(modulo)` cambia de módulo (Cotizaciones/Producción/Logística/Calidad/Productos — los botones grandes del nav superior), `ir(pantalla)` cambia de sub-pantalla dentro del módulo activo (los botones del subnav). Todas las `.pantalla` del HTML viven en el mismo documento a la vez; solo se les agrega/quita la clase `activa` para mostrarlas.

**Invariante importante**: cada rama de `activarModulo()` tiene que dejar activada la pantalla por defecto de ESE módulo (quitando `activa` de todas las `.pantalla` primero) — si un módulo nuevo no lo hace, al entrar desde otro módulo queda visible la pantalla del módulo anterior en vez de la propia (bug real, corregido 2026-07-17: al módulo Cotizaciones le faltaba este bloque, así que entrar desde Calidad/Logística/Producción dejaba la pantalla anterior en pantalla en vez de "Nueva Cotización").

**Barras de navegación fijas al hacer scroll** (2026-08-19, a pedido del usuario): `.nav-top` (módulos) y `.nav` (subnav del módulo activo) usan `position: sticky` en `css/estilos.css` — `.nav-top` ancla en `top: 0`, `.nav` justo debajo en `top: 50px` (la altura fija de `.nav-top`), así ambas quedan siempre visibles sin taparse entre sí mientras se baja por una pantalla larga.

## Autenticación

Supabase Auth con email/contraseña (`js/auth.js`): login, recuperación de contraseña por email, cambio de contraseña. Los usuarios del equipo y su rol/cargo (solo informativo, no de permisos) están hardcodeados en `USUARIOS_CRM` dentro de `js/config.js`. No hay control de acceso diferenciado por rol para la mayoría de módulos — cualquier cuenta autenticada los ve todos.

**Excepción: Centro de Costos (2026-08-04).** Es el único módulo con control de acceso por usuario, a pedido explícito ("me preocupa que entren personas y nos puedan alterar la estructura"). Dos capas:
- **UI** (`_esUsuarioCentroCostos()` en `js/config.js`, lista `_EMAILS_CENTRO_COSTOS`): oculta el botón de nav y bloquea `activarModulo('costeo')`/`ir(pantalla)` para las pantallas de Centro de Costos si el correo no está en la lista. Es solo conveniencia — cualquiera con acceso a la consola del navegador puede evadirla.
- **RLS en Supabase** (`sql/2026-08-04_rls_centro_costos.sql`, función `es_usuario_centro_costos()`): la protección real. Las 6 tablas del módulo (`maquinaria_equipos`, `cuadrillas_productivas`, `clases_salariales`, `insumos_costos`, `parametros_mo`, `costeo_productos`) antes no tenían RLS — cualquiera con la anon key pública podía escribir ahí directo vía API REST, sin iniciar sesión. Ahora exigen sesión autenticada para leer, y ser uno de los 3 correos autorizados para insertar/actualizar/borrar. Si cambia quién debe tener acceso, hay que actualizar ambos lados (la lista en JS y la función SQL).

## Auditoría de seguridad (2026-08-04)

A pedido explícito del usuario ("busca huecos de seguridad en todo el código... cerremos todos los huecos sin importar el riesgo, quiero disminuirlo al máximo"), se revisó RLS de las 17 tablas, se buscaron secretos filtrados, y se auditó XSS almacenado. Hallazgos y qué se hizo:

- **Crítico, corregido — `clientes` y `cotizaciones` sin RLS.** Confirmado en vivo con la anon key pública, sin sesión: se podían leer los 103 clientes (nombre, celular, correo, NIT/cédula, dirección) y las 101 cotizaciones completas, y también insertar/borrar registros sin ninguna credencial. Son las tablas más antiguas de la app, de antes de que el proyecto empezara a usar RLS en algo. Corregido con `sql/2026-08-04_rls_clientes_cotizaciones.sql` — a diferencia de Centro de Costos, aquí no hay restricción por correo (todo el equipo de ventas necesita leer/escribir), solo exige sesión iniciada.
- **XSS almacenado, corregido en ~250 puntos.** Como esas dos tablas eran de escritura libre, alguien podía insertar un cliente con HTML/JS malicioso en el nombre y ejecutarlo en el navegador del primer empleado que lo viera (Histórico de Clientes, Cotizador, Órdenes, Logística...). Se agregó `_esc()` (escape HTML genérico) en `js/config.js` y se aplicó en los ~14 archivos que interpolan texto libre (nombre/contacto/causa/observaciones/etc.) dentro de `innerHTML` — nombre de cliente, contacto, proyecto, causas de reprogramación, observaciones de logística/producción, notas de seguimiento, nombres de producto/insumo/máquina/cuadrilla en Centro de Costos, y los documentos PDF/impresos (cotización, orden de producción, formato de producción, programación de viajes). **Cuidado si se toca este código**: unas pocas funciones (`_textoCilindroEnsayo`/`_clienteResumenAjuste` en `calidad-ajuste-mezcla.js`, `_textoProductoCosteo` en `costeo-producto.js`, `_textoProducto` en `calidad-ajuste-mezcla.js`) construyen un texto compuesto que se usa para *comparar por igualdad* contra lo que el navegador devuelve de un `<input>+<datalist>` — escapar DENTRO de esas funciones rompe esa comparación (el navegador decodifica el HTML al leer `.value`, así que un texto reescapado nunca vuelve a calzar). El escape en esos casos va en el sitio de despliegue de solo lectura, no dentro de la función compartida.
- **Revisado, pendiente de tu decisión — `productos`.** Ya tenía RLS (bloqueaba lecturas anónimas), pero no hay forma de confirmar desde afuera si la política de escritura ya existente limita a alguien en particular. Se dejó `sql/2026-08-04_rls_productos_centro_costos.sql` para alinearla con los mismos 3 correos de Centro de Costos (borra dinámicamente cualquier política de escritura existente y la reemplaza, para que no quede una vieja política más permisiva compitiendo con la nueva). Depende de que `sql/2026-08-04_rls_centro_costos.sql` ya se haya corrido antes (usa la misma función `es_usuario_centro_costos()`).
- **Revisado, sin hallazgos**: bucket de Storage `laboratorio-pdf` correctamente privado (usa URLs firmadas, no lista archivos sin sesión); no hay llaves/tokens filtrados más allá de la anon key pública (segura de exponer por diseño); no hay riesgo de inyección SQL (todo pasa por el cliente de Supabase, sin construir filtros con strings concatenados).

### Segunda pasada (2026-08-04) — auditoría independiente, "olvida lo anterior y audita de nuevo"

- **Crítico, requiere acción manual del usuario en Supabase — registro público de cuentas abierto.** Se probó `POST /auth/v1/signup` directo contra la API de Supabase (sin pasar por la app) con un correo Gmail cualquiera → devolvió 200, cuenta creada. Exige confirmar el correo antes de poder iniciar sesión (confirmado: login sin confirmar devuelve `email_not_confirmed`), pero cualquiera puede confirmar su propio correo en segundos. Esto rompe el supuesto detrás de las políticas RLS `to authenticated using (true)` agregadas en la primera pasada (`clientes`, `cotizaciones`, lectura de `productos` y de las tablas de Centro de Costos) — "autenticado" ya no implica "empleado real de Proconcreto". **No se puede cerrar con SQL/RLS** — es una configuración de Supabase Auth (Dashboard → Authentication → Settings/Providers) que solo el usuario puede cambiar. Se creó una cuenta de prueba real (`zzz.auditoria.seguridad.borrar.este.usuario@gmail.com`) que el usuario debe borrar manualmente en Authentication → Users (no se puede borrar con la anon key, requiere la clave de servicio).
- **Alto, corregido — Subresource Integrity (SRI) en scripts de terceros.** Los 7 `<script src="https://...">` (Supabase JS, Chart.js, jsPDF, html2canvas, SheetJS, JSZip, pdf.js) no tenían `integrity`/`crossorigin` — si el CDN fuera comprometido, código malicioso se ejecutaría con la confianza total de la página. Se calculó el hash SHA-384 real de cada archivo (descargándolo y hasheándolo, no confiando en un hash de terceros) y se agregó `integrity="sha384-..." crossorigin="anonymous"` a los 7. De paso se fijó `@supabase/supabase-js@2` (versión flotante) a `@2.112.0` (versión exacta) — con SRI, una versión flotante se hubiera roto en cuanto jsDelivr sirviera un patch nuevo de la librería. **Nota**: el worker de pdf.js (`pdf.worker.min.js`, cargado dinámicamente vía `pdfjsLib.GlobalWorkerOptions.workerSrc`, no como `<script>`) queda sin SRI — los Workers no soportan el atributo `integrity` de la misma forma; se aceptó como riesgo residual menor (mismo CDN, misma versión ya fijada del script principal).
- **Medio, sin corregir todavía — validación de archivos subidos solo del lado del cliente.** El informe de laboratorio (`accept="application/pdf"`) no se valida en el servidor; el `contentType` se fuerza a `'application/pdf'` en el código sin inspeccionar el archivo real, y no hay límite de tamaño. Mitigado parcialmente por ser un bucket privado con URLs firmadas.
- **Medio, sin corregir todavía — rastro de auditoría falsificable.** `creadoPor`/`modificadoPor` se toman de `USUARIO_ACTUAL?.email` en el navegador y se guardan tal cual — cualquier cuenta autenticada podría, en teoría, atribuirle una acción a otra persona. Arreglarlo de raíz requeriría fijar estos campos por trigger/default en Postgres (`auth.jwt()`), no confiar en lo que manda el cliente — cambio más grande, pendiente de decidir con el usuario.
- **Bajo/informativo**: varios `alert('Error: ' + error.message)` reenvían el mensaje crudo de Postgres/PostgREST (a veces incluye nombre de tabla/columna) a un usuario ya autenticado — impacto bajo. La sesión de Supabase vive en `localStorage` por defecto (comportamiento estándar de la librería, no un bug de la app) — es la razón de fondo por la que el XSS de la primera pasada era tan grave (robo de sesión), y por la que vale la pena mantener la disciplina de escapar HTML hacia adelante.

## Sincronización en vivo requiere REPLICA IDENTITY FULL en tablas con RLS (2026-08-21)

El usuario reportó que "en vivo" no funciona de verdad — hay que hacer Ctrl+F5 para ver cambios de otros usuarios en vez de que aparezcan solos. Revisando el código de `suscribirRealtime()`/`rerenderPantallaActiva()` (`js/datos-realtime.js`) no se encontró ningún bug — la suscripción a las 16 tablas está completa y correcta, y cada `recargarXRT()` vuelve a pedir los datos completos (no depende del contenido del evento, así que ni siquiera importaría si el payload viene incompleto).

**Causa real, del lado de Supabase, no del código de la app**: Postgres Realtime exige `REPLICA IDENTITY FULL` en cualquier tabla con RLS habilitado para poder evaluar la política sobre los eventos de replicación lógica — sin esto, Realtime puede filtrar (no entregar) esos eventos aun con una política totalmente permisiva (`using (true)`), porque la fila que le llega no trae datos suficientes para evaluarla. Ninguno de los scripts que activaron RLS el 2026-08-04 (`sql/2026-08-04_rls_*.sql`, ver Auditoría de seguridad arriba) incluía este paso — coincide con que el problema apareció justo después de esa fecha. Corregido en `sql/2026-08-21_reparar_realtime_con_rls.sql` — pendiente de que el usuario lo corra en el SQL Editor de Supabase (no se puede aplicar con la anon key). El script también revalida que esas tablas sigan en la publicación `supabase_realtime`, por si alguna se hubiera quedado afuera.

## Por qué seguir así por ahora

Es el stack que ya está en producción, sin deuda de infraestructura (sin servidor que mantener, sin build) y le ha funcionado a la operación. No se propone una reescritura salvo que el usuario decida migrar a un stack moderno (Next.js, etc.) — si eso se decide, se documentará como un ADR nuevo en [docs/decisiones/](decisiones/).

## Riesgos/deuda técnica observados (para decidir prioridad, no para actuar de una)

- **Sin roles/permisos**, salvo Centro de Costos (ver sección Autenticación) — el resto de módulos sigue sin control de acceso diferenciado.
- **RLS de `clientes`/`cotizaciones`/`productos`(escritura) pendiente de aplicar en Supabase** — los scripts ya están listos (ver sección Auditoría de seguridad) pero solo el usuario los puede correr (requieren el SQL Editor del dashboard, no la anon key).
- **Datos sensibles en el repo público**: `js/config.js` incluye celulares personales del equipo y la key pública de Supabase (esta última es segura de exponer por diseño).
- **Un solo archivo HTML gigante** (~1,500 líneas) concentra todas las pantallas — dificulta mantenimiento a largo plazo.
- **Sin tests automatizados.**
