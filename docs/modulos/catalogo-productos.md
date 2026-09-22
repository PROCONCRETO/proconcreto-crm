# Módulo: Catálogo de Productos

## Archivos

- `js/catalogo.js` (566 líneas)

## Datos

- Tabla Supabase: `productos` (con auto-siembra la primera vez que se carga la app, ver `cargarCatalogo()` en `datos-realtime.js`)
- Fuente original: `Catalogo_Productos_Proconcreto.xlsx` / `.pdf`, y `Plantilla_Importar_Productos.xlsx` para cargas masivas

## Pantallas

`productos` (admin del catálogo)

## Qué hace

Administra el catálogo de mezclas/productos que se ofrecen (usado por el cotizador), con soporte de importación/exportación vía Excel (SheetJS).

### Nombres duplicados (2026-08-04)

Checkbox "Solo duplicados" + tarjeta-resumen clicable en `renderProductosAdmin()` (`js/catalogo.js`). Un producto se marca duplicado si otro producto (activo u oculto) tiene el mismo nombre normalizado (may/min y espacios). Fila resaltada en amarillo + badge "⚠️ Duplicado". Como `productos` tiene RLS que bloquea lecturas con la anon key, la detección se hace en el navegador sobre `CATALOGO` ya cargado (sesión autenticada), no por consulta directa.

### Resolver duplicados (2026-08-04)

Botón "🔗 Resolver duplicados" (abre `modal-resolver-duplicados`) — limpieza masiva de los productos duplicados que llegaron migrados de un programa contable que genera un código nuevo (sufijo `-01`/`-02`/`-03`...) cada vez que cambia la receta, conservando el mismo nombre. `_gruposDuplicadosResolver()` agrupa por nombre normalizado; si hay exactamente un código SIN sufijo de versión en el grupo, se preselecciona como el vigente (a pedido del usuario, después de confirmar que Cotizaciones/Producción/Calidad guardan su propia copia de nombre/precio y no dependen de que el producto siga activo). Los grupos sin un candidato claro quedan resaltados en amarillo y requieren elegir manualmente cuál código se queda activo (radio buttons).

**Nunca se borra un producto** — solo se ocultan los códigos no elegidos (mismo mecanismo que "🚫 Ocultar", `activo=false`), así que Cotizaciones/Órdenes/Producción/Calidad ya guardadas quedan intactas. Lo único que sí se **borra de verdad** es el Costeo de Producto redundante en Centro de Costos (`_borrarCosteoProductoDB()` en `js/costeo-producto.js`, compartido con `eliminarCosteoProducto()`), con un checkbox por grupo (marcado por defecto cuando aplica) — es la única parte que el usuario pidió explícitamente que sí quedara limpia de duplicados. `aplicarResolverDuplicados()` muestra un resumen con `confirm()` antes de tocar nada.

### Exportar Excel (2026-08-04)

Botón "⬇️ Exportar Excel" (`exportarCatalogoExcel()` en `js/catalogo.js`, misma librería SheetJS que ya usaba "Descargar plantilla") — exporta exactamente lo que está en pantalla, no siempre el catálogo completo: respeta los filtros activos (grupo, búsqueda, ver/solo ocultos, solo duplicados) y el orden actual. `_productosAdmVisibleActual` guarda ese set en cada `renderProductosAdmin()`. Incluye columnas que no trae la plantilla de importación (Estado, Desde Costeo) porque este export es para revisar/archivar, no para reimportar. Archivo `Catalogo_Productos_Proconcreto_YYYY-MM-DD.xlsx`.

### Eliminar definitivamente (2026-08-04)

Botón "🗑️ Eliminar" (`eliminarProductoDefinitivo()` en `js/catalogo.js`) — único borrado REAL de productos en la app (`sb.from('productos').delete(...)`), a pedido explícito del usuario ("no me gusta cargar basura"). Solo aparece para productos que ya están **ocultos** y **sin Costeo de Producto asociado**; si tiene costeo, primero hay que borrarlo desde Centro de Costos. El `confirm()` antes de borrar advierte explícitamente que no hay forma de garantizar desde la app que el código no aparezca en alguna cotización/orden histórica — esos módulos guardan su propia copia de nombre/precio (no dependen del catálogo vivo), así que seguirían mostrándose bien, pero cualquier función que vuelva a buscar el código en `CATALOGO` ya no lo encontraría. Por eso queda restringido a productos ya ocultos (que ya pasaron ese filtro antes) en vez de ofrecerse sobre cualquier producto.

### Las tarjetas del resumen filtran al hacer clic (2026-08-04, ampliado 2026-08-21)

"Productos activos", "Ocultos", "Nombres duplicados", "Costeados", "Sin costear" y "Mostrados" tienen cursor de mano y, al hacer clic, dejan los checkboxes del toolbar en el estado exacto que representan (`_filtroProdAdmActivos/Ocultos/Duplicados/Costeados/SinCostear/Todos()` en `js/catalogo.js`) — a pedido del usuario, para que todas se comporten igual que ya lo hacía "Nombres duplicados". "Ocultos" necesitó un checkbox nuevo, **"Solo ocultos"** (distinto de "Ver ocultos", que mezcla activos+ocultos): cuando está marcado manda sobre "Ver ocultos" y filtra para mostrar únicamente los inactivos. "Mostrados" limpia todos los filtros (buscador, grupo, ambos checkboxes de ocultos, duplicados, costeados/sin costear) para ver el catálogo completo sin filtrar.

**Costeados / Sin costear (2026-08-21, a pedido del usuario)**: dos checkboxes nuevos (`solo-costeados-prod`/`solo-sin-costear-prod`) que filtran usando el mismo `tieneCosteo(p)` que ya decide el badge "🏗️ Desde Costeo" (ver abajo) — mutuamente excluyentes (marcar uno desmarca el otro, tanto desde el checkbox como desde la tarjeta), ya que un producto no puede estar en las dos categorías a la vez.

### Resaltado y orden de productos "Desde Costeo" (2026-08-04, orden ajustado 2026-08-21)

Un producto se marca "🏗️ Desde Costeo" (borde azul en la fila + badge) si tiene un registro en `COSTEO_PRODUCTOS` (es decir, su precio de lista se calcula desde un Costeo de Producto en Centro de Costos, no se edita a mano). Estos productos se ordenan al inicio del listado, en el orden de `COSTEO_PRODUCTOS` tal como llega a memoria. Desde 2026-08-21 ese orden ya no es solo "por fecha de creación" — `COSTEO_PRODUCTOS` se normaliza con `_normalizarOrdenLista()` (`js/config.js`) al cargar/recargar, así que refleja el orden manual que se arrastre en Centro de Costos › Costeo de Producto (ver `docs/modulos/costeo.md`) sin que esta pantalla tenga que hacer nada aparte. El resto de productos (sin costeo) mantiene el orden alfabético de siempre.

### Precio bloqueado para productos con Costeo (2026-08-04)

`_productoTieneCosteo(codigo)` (helper compartido) bloquea la edición manual de Precio Lista/Mínimo para estos productos, tanto en los inputs inline de la tabla (`disabled`) como en el modal "Editar producto" (`abrirModalProducto`/`guardarProducto`, con aviso `#mp-aviso-costeo`) — a pedido del usuario, para que no se desincronicen del costo real. `guardarProducto()` además fuerza el valor existente aunque el campo se reactive por algún medio. El único camino para cambiar el precio de estos productos sigue siendo Centro de Costos › Costeo de Producto (con su propio modal de aprobación, ver `costeo.md`).

### Productos "especiales / borrador" — costear sin comprometerlos al catálogo (2026-09-22)

A pedido del usuario: "en muchas ocasiones, resultan productos especiales o nuevos que debemos costear... estos no son productos de línea desde un principio, por lo que ponerlos en lista de precios no lo veo muy conveniente. podríamos hacer una ventana en borrador... sin que pasen a ser producto de línea y sin tener que crear el producto como tal". Al mostrar de ejemplo el filtro "Solo ocultos"/"Solo duplicados" ya existente en esta misma pantalla, quedó claro que no hacía falta un módulo ni una tabla aparte — bastaba con una marca nueva sobre el producto y filtros a juego, reutilizando toda la infraestructura de "producto oculto" que ya existía.

- **Campo nuevo `especial` (boolean)** en `productos` (columna real, `sql/2026-09-22_productos_especiales.sql` — correrlo una sola vez en el SQL Editor de Supabase). Un producto especial SIEMPRE nace con `activo=false` — reutiliza tal cual el mecanismo que ya excluye productos ocultos de `PRODUCTOS`/Cotizaciones (`PRODUCTOS = CATALOGO.filter(p => p.activo !== false)`), sin tocar `js/cotizador.js` para nada: mientras un producto es especial, sencillamente no aparece para cotizar.
- **Sí se puede costear** aunque esté inactivo — `_productosDisponiblesParaCostear()` (`js/costeo-producto.js`) amplía la búsqueda de Costeo de Producto de `PRODUCTOS` (solo activos) a `CATALOGO.filter(p => p.activo !== false || p.especial === true)`. Sin riesgo nuevo: Centro de Costos (el módulo entero, no solo Productos) ya es de acceso restringido (`activarModulo()`/`ir()`, `js/navegacion.js`). Las sugerencias del buscador de Costeo muestran un badge "🔬 Especial" para que quede claro con qué se está trabajando.
- **"⬆️ Activar a línea"** (`_activarProductoEspecial()`) reemplaza a "🚫 Ocultar"/"↩️ Reactivar" en la fila de un producto especial — pone `especial=false, activo=true` juntos, con una confirmación explícita y más enfática que la de Ocultar/Reactivar normal (pregunta si ya se completó la revisión de precio y costeo). **Quién puede hacerlo** ya estaba resuelto en dos capas antes de este cambio — no hizo falta ninguna tabla ni política RLS nueva: la pantalla de Productos completa exige ser de Centro de Costos para entrar, y la tabla `productos` en Supabase ya exige lo mismo para poder escribir (`sql/2026-08-04_rls_productos_centro_costos.sql`, "actualizar solo centro de costos"). Se preguntó explícitamente por esto — el usuario contestó: "que solo lo puedan hacer quienes están autorizados para hacerlo... que no lo pueda cotizar cualquiera pues se corre el riesgo de que vaya sin revisión profunda" — ya cumplido por la restricción existente; lo nuevo es solo el paso de confirmación deliberado.
- **Bug real corregido de paso, necesario para que la protección funcione**: `guardarProducto()` fijaba `activo: true` a secas en CADA guardado (nuevo o edición), sin mirar el estado anterior — así que editar cualquier campo de un producto ya oculto (o de un especial recién creado) lo reactivaba de contrabando sin que nadie lo pidiera, lo que habría dejado sin efecto la protección de "activar a línea" apenas alguien tocara el nombre o el grupo del producto. Ahora `activo` se preserva del producto existente al editar (`existente.activo !== false`); un producto nuevo nace activo, salvo que se marque especial (nace oculto). Mismo criterio para `especial`: el checkbox del modal solo se lee al CREAR — editando un especial ya existente, el checkbox queda oculto/informativo y el valor se preserva sin importar qué diga el DOM, cinturón de seguridad adicional.
- **Filtros nuevos** en la barra de Productos: "Ver especiales" / "Solo especiales" (mismo patrón que "Ver ocultos"/"Solo ocultos", pero como eje independiente — un especial siempre está oculto, pero mezclarlo sin distinción con los descontinuados de siempre no dejaba encontrarlos por su cuenta). Por defecto, los especiales NO aparecen en el listado (ni con "Ver ocultos" marcado) — hace falta "Ver especiales" o "Solo especiales" a propósito.
- **Tarjeta "Especiales"** nueva en el resumen (clic filtra igual que las demás). **"Ocultos" se redefinió** para YA NO incluir especiales (`CATALOGO.length - activos - especiales`, bajo el invariante de que un especial nunca está `activo=true` a la vez) — antes de este cambio, un especial habría inflado el número de "Ocultos" mezclado con los descontinuados de verdad.
- Verificado con un arnés real — 29 aserciones: el mapeo de la columna cruda de Supabase a `CATALOGO.especial`; los filtros (vista general los excluye, "Solo especiales" los aísla, "Ver ocultos" solo no los muestra); las tarjetas KPI; el badge y el botón "Activar a línea" en la fila; el modal mostrando/ocultando el checkbox según se cree o se edite un especial ya existente; el ciclo completo de guardado (especial nuevo nace oculto, se preserva al editar pase lo que pase con el checkbox); la regresión específica del bug de reactivación accidental (editar un producto oculto normal ya NO lo reactiva); `_activarProductoEspecial()` de punta a punta (incluido que `PRODUCTOS` lo incluye recién activado); y que Costeo de Producto puede buscar y encontrar un especial inactivo, pero no un oculto genuino — sin errores de consola.
