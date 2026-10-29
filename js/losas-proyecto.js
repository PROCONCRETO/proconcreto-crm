// ═══════════════════════════════════════
// LOSAS / ÓRDENES DE FABRICACIÓN (2026-10-11, a pedido del usuario: "donde tendríamos más
// utilidad sería en atender lo relacionado a las listas de producción y al desarrollo y
// control en producción y despachos") — extensión de Proyectos para los que suministran
// sistemas de entrepiso prefabricado (Prelosa, Vigueta y Bovedilla, Placa Alveolar).
//
// Jerarquía real confirmada con 3 Excel de proyectos ya ejecutados (Boreal Sohnos — prelosa;
// SYMA Tarso y SYMA Andes — vigueta y bovedilla): un proyecto grande no tiene una sola lista
// plana, tiene una LOSA (orden de fabricación) por cada nivel/torre — SYMA Andes llegó a
// tener 28. Cada Losa es su propio registro `datos jsonb` (tabla `losas_proyecto`, ver
// sql/2026-10-11_losas_proyecto.sql) con su propia lista de producción (filas[]) anidada
// adentro — mismo criterio que ya usa Despiece de Acero en Costeo de Producto: nadie necesita
// sincronizar en tiempo real una sola fila suelta, la Losa completa es la unidad natural.
//
// Decisiones ya confirmadas con el usuario (no son casualidad del código, quedaron así a
// propósito tras varias rondas de preguntas):
// - Control de producción: por FILA, con cantidad parcial (no por cuadro completo).
// - Trazabilidad: conteos agregados por fila, no un serial por pieza física.
// - Despacho: por REMISIÓN (como una entrega real cubre varias filas a la vez, un despacho
//   es un evento con una lista de líneas — mismo espíritu que `viaje.entregas[].productos[]`
//   en Logística), con saldo pendiente calculado en vivo (Math.max(0, total-Σeventos), mismo
//   patrón que ya usa Logística/Órdenes de Producción).
// - Bovedilla: NO lleva control fila-por-fila — es un conteo simple (cantidad requerida +
//   entradas/salidas por remisión), "como fabricar un bloque de cemento".
// - No se modela "cantidad original/nueva" — fue una particularidad de un solo proyecto, no
//   un patrón recurrente. Cada fila lleva un solo valor vigente + observaciones libres.
// - Carga de filas: las 3 formas (fila por fila, pegar desde Excel, importar archivo) — un
//   proyecto real trae 100-250+ filas por losa, capturarlas una por una sería impracticable.
// ═══════════════════════════════════════

let LOSAS_PROYECTO = [];
let _PROYECTO_ACTIVO_ID = null;
let _LOSA_ACTIVA_ID = null;

// 'lista' (Ingeniería — crea/edita la lista de producción, dueña de cuadro/dimensión/cantidad),
// 'produccion' (Planta — solo ve la lista como insumo de solo lectura y registra lo fabricado)
// o 'despacho' (Logística — solo ve la lista como insumo de solo lectura y registra lo que
// sale) — ver pantalla de Carpetas más abajo. Mismo registro de Losa, tres modos de entrada con
// permisos distintos (2026-10-13, a pedido del usuario: primero "vamos a independizar las
// listas de producción, que salen del departamento de ingeniería como un insumo para el área
// de producción, la cual al hacer la producción, genera un insumo para el área de despachos",
// y después "partamos producción de despachos en dos carpetas diferentes" — Producción y
// Despachos no solo son insumo uno del otro, son además dos áreas distintas que no deberían
// compartir pantalla).
let _MODO_FLUJO_LOSA = 'lista';

// Tabla de filas colapsable en Producción/Despacho (2026-10-21) — ver la nota junto a donde se
// inicializa, en `abrirLosaDetalle()`.
let _filasColapsadas = false;

// Arreglos de trabajo mientras se tiene abierta la pantalla de detalle de una Losa — mismo
// criterio que `_despieceAceroActual` en Costeo de Producto: se editan en memoria, y se
// persisten completos (toda la Losa de una vez) con `_guardarLosaActual()`.
let _filasLosaActual = [];
let _despachosLosaActual = [];
let _bovedillaLosaActual = null;
// Producciones programadas (2026-10-15, a pedido del usuario) — flujo de dos pasos: "+
// Programar producción" arma el lote (qué filas, cuánto se planea fabricar); "+ Cargar
// producción" confirma, línea por línea, lo que REALMENTE se fabricó frente a lo programado —
// es la única puerta de entrada real a `fila.produccion[]` ("de esta entrada es que ingresamos
// la producción"), reemplaza el registro rápido por fila que había antes. Mismo molde que
// `despachos[]`: un lote con `lineas[]`, cada línea referencia una fila por `filaId`.
// `cantidadReal: null` en una línea = todavía no se cargó esa línea.
let _programacionesLosaActual = [];
// Despachos programados (2026-10-16, a pedido del usuario: "incluyamos la misma lógica que
// tenemos en producción" — mismo molde exacto que `_programacionesLosaActual`) — "+ Programar
// despacho" arma el lote; "+ Cargar despacho" confirma línea por línea lo que REALMENTE salió,
// con la remisión real del camión. A diferencia de producción, el libro real sigue siendo
// `despachos[]` (`_despachosLosaActual`, sin cambios en su forma ni en `_pendienteDespachoFila()`
// — una remisión real cubre varias filas a la vez, por eso vive a nivel de Losa, no por fila
// como `fila.produccion[]`) — "Cargar despacho" lo alimenta (find-or-create por
// `despachoProgramadoId`) en vez de que el usuario lo arme directo, como antes.
let _despachosProgramadosLosaActual = [];

const ESTADOS_LOSA = ['Planeación', 'En producción', 'Completada', 'Cancelada'];
const _COLOR_ESTADO_LOSA = {
  'Planeación': { bg: '#FFF3CD', fg: '#8A6D00' },
  'En producción': { bg: '#D1ECF1', fg: '#0C5464' },
  'Completada': { bg: '#D4EDDA', fg: '#155724' },
  'Cancelada': { bg: '#F8D7DA', fg: '#842029' },
};
const SISTEMAS_ENTREPISO = [
  { clave: 'prelosa', etiqueta: 'Prelosa' },
  { clave: 'vigueta_bovedilla', etiqueta: 'Vigueta y Bovedilla' },
  { clave: 'placa_alveolar', etiqueta: 'Placa Alveolar' },
  { clave: 'paneles_cerramiento', etiqueta: 'Paneles de Cerramiento' },
];
// Paneles de Cerramiento (2026-10-29, a pedido del usuario: "metamos otra opción que serían los
// paneles de cerramiento... se hacen en los mismos bancos de pretensado") — a diferencia de los
// otros 3 (sistemas de ENTREPISO, horizontales), los paneles son de fachada/muro, verticales
// (casas, colegios, bodegas) — por eso el usuario pidió que el registro que acá se sigue
// llamando "Losa" internamente (`LOSAS_PROYECTO`, sin cambios, ver `_etiquetaRegistroLosa()`
// más abajo) se vea como "Unidad" en los textos visibles para este sistema: "no lo llamemos por
// losa, si no por unidad, pues en este caso no hacemos losas sino casas, escuelas, bodegas...".
// Clasificación de cada pieza — a diferencia de Vigueta (`tipoVigueta`, texto libre), acá son 5
// categorías FIJAS, así que van en un `<select>`, no un input libre. `cuchilla: true` marca las
// 2 que llevan dos largos distintos (un lado con pendiente) — ver `_esClasificacionCuchilla()`
// y `_sincronizarLargosPanel()`.
const CLASIFICACIONES_PANEL = [
  { clave: 'panel', etiqueta: 'Panel', cuchilla: false },
  { clave: 'panel_cuchilla', etiqueta: 'Panel cuchilla', cuchilla: true },
  { clave: 'dintel', etiqueta: 'Dintel', cuchilla: false },
  { clave: 'dintel_cuchilla', etiqueta: 'Dintel cuchilla', cuchilla: true },
  { clave: 'antepecho', etiqueta: 'Antepecho', cuchilla: false },
];
function _esClasificacionCuchilla(clave) {
  return CLASIFICACIONES_PANEL.find(c => c.clave === clave)?.cuchilla || false;
}
function _etiquetaClasificacionPanel(clave) {
  return CLASIFICACIONES_PANEL.find(c => c.clave === clave)?.etiqueta || clave || '—';
}
// "Losa" → "Unidad" solo en los textos VISIBLES de Paneles (confirmado con el usuario, acotado
// a propósito) — nombres internos (`LOSAS_PROYECTO`, tabla `losas_proyecto`, `_LOSA_ACTIVA_ID`,
// `_filasLosaActual`, `abrirLosaDetalle()`, `guardarLosa()`, etc.) NO se tocan. El botón
// "+ Nueva Losa" y el empty-state de `renderLosasProyecto()` tampoco — son genéricos a TODO el
// proyecto (que puede mezclar Losas de entrepiso y Unidades de Paneles a la vez), sin un sistema
// puntual conocido en ese momento para decidir la palabra.
function _etiquetaRegistroLosa(sistema) {
  return sistema === 'paneles_cerramiento' ? 'Unidad' : 'Losa';
}

// ── Cálculos — pendiente/peso (mismo criterio ya usado en Logística/Órdenes de Producción:
// total − Σ(eventos), nunca cacheado, siempre recalculado en el momento) ──
function _pendienteProduccionFila(fila) {
  const cant = Number(fila.cantidad) || 0;
  const producido = (fila.produccion || []).reduce((s, e) => s + (Number(e.cantidad) || 0), 0);
  return Math.max(0, cant - producido);
}
function _despachadoFila(filaId, despachos) {
  let total = 0;
  (despachos || []).forEach(d => (d.lineas || []).forEach(l => { if (l.filaId === filaId) total += Number(l.cantidad) || 0; }));
  return total;
}
function _pendienteDespachoFila(fila, despachos) {
  return Math.max(0, (Number(fila.cantidad) || 0) - _despachadoFila(fila.id, despachos));
}
function _fabricadoFila(fila) {
  return (fila.produccion || []).reduce((s, e) => s + (Number(e.cantidad) || 0), 0);
}
// "Disponible para despacho" (2026-10-19, a pedido del usuario: "incluir una columna... de
// disponible para despacho, que será arrastrada de la ventana de producción. Condicionar la
// programación de despachos solo para elementos que estén disponibles para despacho") — a
// diferencia de "Pend. Despacho" (`cantidad − despachado`, lo que TODAVÍA SE DEBE despachar en
// total, sin importar si ya se fabricó), esto es lo que de verdad se puede subir a un camión
// HOY: lo ya fabricado menos lo que ya salió. Nunca puede ser mayor que el pendiente de
// despacho (si los datos están sanos, fabricado ≤ cantidad siempre).
function _disponibleDespachoFila(fila, despachos) {
  return Math.max(0, _fabricadoFila(fila) - _despachadoFila(fila.id, despachos));
}
// Peso — prelosa/placa alveolar: ancho × longitud × espesor × densidad del concreto (mismo
// cálculo visto en el Excel real de Boreal: área × 0,05m × 2400 kg/m³). Vigueta: longitud ×
// un factor kg/metro lineal propio del tipo de vigueta (ej. H11 = 21,5 kg/ml, visto en el
// Excel real de SYMA Andes) — guardado como dato simple de la Losa, no como tabla de
// referencia todavía (no hay suficiente variedad confirmada como para justificarla).
function _pesoFila(fila, losa) {
  const cant = Number(fila.cantidad) || 0;
  const dim = Number(fila.dimension) || 0;
  if (losa.sistema === 'vigueta_bovedilla') {
    return dim * (Number(losa.pesoFactorKgM) || 0) * cant;
  }
  // Ancho se captura en cm (2026-10-14, a pedido del usuario) — se convierte a metros acá,
  // solo para el cálculo, igual que el espesor.
  const anchoM = (Number(fila.ancho) || 0) / 100;
  const espesorM = (Number(losa.espesorCm) || 0) / 100;
  return anchoM * dim * espesorM * (Number(losa.densidadKgM3) || 0) * cant;
}

let _contadorIdFila = 0;
function _nuevoIdFila() { _contadorIdFila++; return 'f' + Date.now() + '_' + _contadorIdFila; }

// ── Navegación Proyectos → Carpetas del proyecto → Losas (en modo lista o producción) →
// Detalle de una Losa ──
// No existe en la app ningún patrón de "pantalla completa con alcance a un registro padre"
// (confirmado explorando el código) — acá se arma uno nuevo, a mano: variables de estado
// (`_PROYECTO_ACTIVO_ID`/`_LOSA_ACTIVA_ID`/`_MODO_FLUJO_LOSA`) + activar/desactivar `.pantalla`
// directamente, sin pasar por `ir()`/subnav (esas funciones no soportan pantallas
// parametrizadas por id).
function abrirCarpetasProyecto(proyectoId) {
  const p = PROYECTOS.find(x => x.id === proyectoId);
  if (!p) return;
  _PROYECTO_ACTIVO_ID = proyectoId;
  document.querySelectorAll('.pantalla').forEach(el => el.classList.remove('activa'));
  document.getElementById('pantalla-proyecto-carpetas').classList.add('activa');
  document.getElementById('proyecto-carpetas-titulo').textContent = p.nombre;
  renderCarpetasProyecto();
  _sincronizarSubnavProyecto(null);
}
// Sub-nav dinámica de Proyectos (2026-10-16, a pedido del usuario: "como en proyectos tenemos
// un nivel adicional de subcarpetas, al costado izquierdo de la fila podemos nombrar el
// proyecto y de ahí en adelante mostrar los botones correspondientes al proyecto" — mismo
// lenguaje visual que la sub-navegación de Cotizaciones y Ventas (`.nav`/`.nav-btn`, ver
// `#subnav-proyecto-activo` en cotizaciones.html), pero con contenido dinámico — no existe
// ningún otro precedente en la app de una fila de sub-navegación cuyo contenido dependa del
// estado (confirmado explorando el código antes de construir esto). Los 5 botones de sección
// son fijos (ya vienen en el HTML); esta función solo decide si la fila se ve, actualiza el
// nombre del proyecto activo en el primer botón, y marca cuál sección queda resaltada. NO
// reemplaza la pantalla de Carpetas (sigue existiendo tal cual, a pedido explícito del
// usuario: "sin eliminar la ventana de inicio de cada proyecto") — es un atajo adicional para
// moverse entre secciones sin tener que volver a Carpetas primero. `seccion` es `null` cuando
// se está viendo la propia pantalla de Carpetas (ninguna sección puntual resaltada).
function _sincronizarSubnavProyecto(seccion) {
  const nav = document.getElementById('subnav-proyecto-activo');
  if (!nav) return;
  const p = _PROYECTO_ACTIVO_ID ? PROYECTOS.find(x => x.id === _PROYECTO_ACTIVO_ID) : null;
  if (!p) { nav.style.display = 'none'; return; }
  nav.style.display = 'flex';
  document.getElementById('subnav-proyecto-nombre-btn').textContent = `🏛️ ${p.nombre}`;
  nav.querySelectorAll('.nav-btn[data-seccion-proyecto]').forEach(b => {
    b.classList.toggle('activo', b.dataset.seccionProyecto === seccion);
  });
}
function renderCarpetasProyecto() {
  const grid = document.getElementById('grid-carpetas-proyecto');
  if (!grid) return;
  const losas = LOSAS_PROYECTO.filter(l => l.proyectoId === _PROYECTO_ACTIVO_ID);
  const nMemorias = losas.filter(l => l.memoriaCalculoPath).length;
  const nPlanos = losas.filter(l => l.planoPath).length;
  // Orden de las tarjetas (2026-10-16, a pedido del usuario: "sube despacho a primera línea y
  // ubica resumen general solo en segunda línea") — con 6 tarjetas de 190px en `.inicio-grid`
  // (flex-wrap, sin columnas fijas) entran 5 por fila; "Resumen general" va al FINAL a propósito
  // para que sea la que cae sola en la segunda fila, dejando Memorias/Planos/Listas/Producción/
  // Despachos completas en la primera.
  grid.innerHTML = `
    <div class="inicio-modulo" onclick="abrirDocumentosProyecto('memoria')">
      <span class="inicio-modulo-icono">📐</span>
      <span class="inicio-modulo-nombre">Memorias de Cálculo</span>
      <span style="font-size:11.5px;color:var(--gris-medio)">${nMemorias} archivo${nMemorias === 1 ? '' : 's'}</span>
    </div>
    <div class="inicio-modulo" onclick="abrirDocumentosProyecto('plano')">
      <span class="inicio-modulo-icono">📋</span>
      <span class="inicio-modulo-nombre">Planos de Producción</span>
      <span style="font-size:11.5px;color:var(--gris-medio)">${nPlanos} archivo${nPlanos === 1 ? '' : 's'}</span>
    </div>
    <div class="inicio-modulo" onclick="abrirLosasDeProyecto('lista')">
      <span class="inicio-modulo-icono">📄</span>
      <span class="inicio-modulo-nombre">Listas de Producción</span>
      <span style="font-size:11.5px;color:var(--gris-medio)">${losas.length} losa${losas.length === 1 ? '' : 's'}</span>
    </div>
    <div class="inicio-modulo" onclick="abrirLosasDeProyecto('produccion')">
      <span class="inicio-modulo-icono">🏗️</span>
      <span class="inicio-modulo-nombre">Producción</span>
      <span style="font-size:11.5px;color:var(--gris-medio)">${losas.length} losa${losas.length === 1 ? '' : 's'}</span>
    </div>
    <div class="inicio-modulo" onclick="abrirLosasDeProyecto('despacho')">
      <span class="inicio-modulo-icono">📦</span>
      <span class="inicio-modulo-nombre">Despachos</span>
      <span style="font-size:11.5px;color:var(--gris-medio)">${losas.length} losa${losas.length === 1 ? '' : 's'}</span>
    </div>
    <div class="inicio-modulo" onclick="abrirResumenProyecto()">
      <span class="inicio-modulo-icono">📊</span>
      <span class="inicio-modulo-nombre">Resumen general</span>
      <span style="font-size:11.5px;color:var(--gris-medio)">${losas.length} losa${losas.length === 1 ? '' : 's'}</span>
    </div>`;
}
function volverAProyectos() {
  _PROYECTO_ACTIVO_ID = null;
  document.querySelectorAll('.pantalla').forEach(el => el.classList.remove('activa'));
  document.getElementById('pantalla-proyectos').classList.add('activa');
  renderProyectos();
  _sincronizarSubnavProyecto(null);
}
function volverACarpetasProyecto() {
  document.querySelectorAll('.pantalla').forEach(el => el.classList.remove('activa'));
  document.getElementById('pantalla-proyecto-carpetas').classList.add('activa');
  renderCarpetasProyecto();
  _sincronizarSubnavProyecto(null);
}

// ── Resumen general de un Proyecto (2026-10-16, a pedido del usuario: "hagamos una ventana
// nueva en proyectos de resumen general, donde mostremos en términos absolutos y porcentuales y
// de manera gráfica el tamaño del proyecto, y el avance en producción y despachos (considerando
// todas las losas)") — a diferencia del resto de pantallas de Losas, esta NO trabaja sobre una
// sola Losa abierta (`_LOSA_ACTIVA_ID`/`_filasLosaActual`/...): agrega TODAS las Losas del
// proyecto activo, leyendo directo de `LOSAS_PROYECTO` (los datos ya cargados/persistidos), para
// que el resumen sea correcto aunque el usuario nunca haya entrado al detalle de alguna Losa en
// esta sesión.
function abrirResumenProyecto() {
  const p = PROYECTOS.find(x => x.id === _PROYECTO_ACTIVO_ID);
  document.querySelectorAll('.pantalla').forEach(el => el.classList.remove('activa'));
  document.getElementById('pantalla-proyecto-resumen').classList.add('activa');
  document.getElementById('proyecto-resumen-titulo').textContent = `📊 Resumen general${p ? ' — ' + p.nombre : ''}`;
  renderResumenProyecto();
  _sincronizarSubnavProyecto('resumen');
}

// Agrega el tamaño del proyecto y el avance ponderado por longitud (mismo criterio que
// `_pieAvanceProduccionHTML()` por Losa — ver su nota: una fila con pocas piezas muy largas pesa
// en el avance lo que corresponde a sus metros reales, no menos que una fila con muchas piezas
// cortas) SOBRE TODAS LAS FILAS DE TODAS LAS LOSAS a la vez, en vez de una Losa sola.
function _agregadosResumenProyecto(losas) {
  let totalPiezas = 0, totalMetros = 0, totalM2 = 0, totalPesoKg = 0;
  let piezasFabricadas = 0, metrosFabricados = 0;
  let piezasDespachadas = 0, metrosDespachados = 0;
  let hayM2 = false;
  losas.forEach(l => {
    const esVigueta = l.sistema === 'vigueta_bovedilla';
    if (!esVigueta && (l.filas || []).length) hayM2 = true;
    (l.filas || []).forEach(f => {
      const dim = Number(f.dimension) || 0;
      const cant = Number(f.cantidad) || 0;
      const fabricadas = cant - _pendienteProduccionFila(f);
      const despachadas = cant - _pendienteDespachoFila(f, l.despachos);
      totalPiezas += cant;
      totalMetros += dim * cant;
      if (!esVigueta) totalM2 += (Number(f.ancho) || 0) / 100 * dim * cant;
      totalPesoKg += _pesoFila(f, l);
      piezasFabricadas += fabricadas;
      metrosFabricados += dim * fabricadas;
      piezasDespachadas += despachadas;
      metrosDespachados += dim * despachadas;
    });
  });
  const pctProduccion = totalMetros > 0 ? (metrosFabricados / totalMetros) * 100 : 0;
  const pctDespacho = totalMetros > 0 ? (metrosDespachados / totalMetros) * 100 : 0;

  // Bovedilla — conteo simple por cantidad, no ponderado por longitud (no tiene filas, ver nota
  // junto al modelo de datos: "como fabricar un bloque de cemento") — solo losas vigueta_bovedilla
  // que ya tengan el bloque definido.
  let bovRequerida = 0, bovProducida = 0, bovDespachada = 0, hayBovedilla = false;
  losas.forEach(l => {
    if (l.sistema !== 'vigueta_bovedilla' || !l.bovedilla) return;
    hayBovedilla = true;
    bovRequerida += Number(l.bovedilla.cantidadRequerida) || 0;
    bovProducida += (l.bovedilla.produccion || []).reduce((s, e) => s + (Number(e.cantidad) || 0), 0);
    bovDespachada += (l.bovedilla.despacho || []).reduce((s, e) => s + (Number(e.cantidad) || 0), 0);
  });

  return {
    nLosas: losas.length, totalPiezas, totalMetros, totalM2, totalPesoKg, hayM2,
    piezasFabricadas, metrosFabricados, pctProduccion,
    piezasDespachadas, metrosDespachados, pctDespacho,
    hayBovedilla, bovRequerida, bovProducida, bovDespachada,
    pctBovProduccion: bovRequerida > 0 ? (bovProducida / bovRequerida) * 100 : 0,
    pctBovDespacho: bovRequerida > 0 ? (bovDespachada / bovRequerida) * 100 : 0,
  };
}

// Barra de avance en línea para la tabla "Avance por Losa" — mismo color semáforo
// (`_colorSemaforo()`, ya usado en los dashboards de Logística/Producción) que la tarjeta KPI
// del resumen general, para que el color signifique lo mismo en toda la pantalla.
function _barraAvanceLosaHTML(pct) {
  const color = _colorSemaforo(pct);
  return `<div style="display:flex;align-items:center;gap:8px;min-width:120px">
    <div style="flex:1;height:8px;background:var(--gris-claro);border-radius:4px;overflow:hidden">
      <div style="width:${Math.min(100, Math.max(0, pct)).toFixed(1)}%;height:100%;background:${color}"></div>
    </div>
    <span style="font-size:12px;font-weight:600;color:${color};white-space:nowrap">${pct.toFixed(1)}%</span>
  </div>`;
}

// Mismos umbrales que `_colorSemaforo()`, pero en hex literal — el `<canvas>` de Chart.js NO
// resuelve `var(--naranja)` (eso solo lo resuelve el motor de CSS del DOM, no el contexto 2D de
// un canvas: un `fillStyle`/`backgroundColor` con una variable CSS sin resolver queda en negro
// por defecto, sin error visible — se detectó así, de un vistazo, en la captura de prueba real:
// las donas salían negras en vez de naranja/rojo). `_colorSemaforo()` se sigue usando tal cual
// en el resto de la pantalla (tarjetas KPI, barras de la tabla), donde SÍ es un `<div>` normal.
function _colorSemaforoHex(pct, buenoDesde = 80, regularDesde = 50) {
  if (pct >= buenoDesde) return '#2E7D32';
  if (pct >= regularDesde) return '#E65100';
  return '#C62828';
}

let _chartsResumenProyecto = {};
// Dona con el % en el centro (plugin local a esta instancia, no registrado globalmente) — más
// fácil de leer de un vistazo que una leyenda, para un solo número de avance (a diferencia de
// `_chartCumplimiento()` en Logística, que sí necesita leyenda por tener varias categorías).
function _chartResumenAvance(canvasId, pct) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (_chartsResumenProyecto[canvasId]) _chartsResumenProyecto[canvasId].destroy();
  const avance = Math.min(100, Math.max(0, pct));
  const color = _colorSemaforoHex(pct);
  _chartsResumenProyecto[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Avance', 'Pendiente'],
      datasets: [{ data: [avance, 100 - avance], backgroundColor: [color, '#E2E8F0'], borderColor: '#fcfcfb', borderWidth: 2 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed.toFixed(1)}%` } },
      },
    },
    plugins: [{
      id: 'centroTexto_' + canvasId,
      afterDraw(chart) {
        const { ctx: c, chartArea: { left, right, top, bottom } } = chart;
        c.save();
        c.font = '700 22px Segoe UI, Arial, sans-serif';
        c.fillStyle = color;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(`${pct.toFixed(1)}%`, (left + right) / 2, (top + bottom) / 2);
        c.restore();
      },
    }],
  });
}

function renderResumenProyecto() {
  const losas = LOSAS_PROYECTO.filter(l => l.proyectoId === _PROYECTO_ACTIVO_ID);
  const a = _agregadosResumenProyecto(losas);

  // Columnas = cantidad real de tarjetas (4 o 5, según `hayM2`) — a propósito NO se reusa el
  // `repeat(4, 1fr)` fijo de `.stats-grid` (2026-10-16, a pedido del usuario: "comprime esta
  // fila en una sola" — con 5 tarjetas y 4 columnas fijas, la 5ta se iba sola a una segunda
  // fila). Sobrescribir `grid-template-columns` inline en este contenedor puntual no afecta
  // ningún otro `.stats-grid` de la app (Logística/Producción siguen con su `repeat(4, 1fr)`).
  const tarjetasTamano = [
    _tarjetaKPI(a.nLosas.toLocaleString('es-CO'), 'Losas'),
    _tarjetaKPI(a.totalPiezas.toLocaleString('es-CO'), 'Piezas planeadas'),
    _tarjetaKPI(a.totalMetros.toLocaleString('es-CO', { maximumFractionDigits: 2 }) + ' m', 'Metros lineales'),
    _tarjetaKPI((a.totalPesoKg / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' ton', 'Peso total'),
    a.hayM2 ? _tarjetaKPI(a.totalM2.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' m²', 'Área (prelosa/placa alveolar)') : '',
  ].filter(Boolean);
  const contTamano = document.getElementById('resumen-proy-tamano');
  contTamano.style.gridTemplateColumns = `repeat(${tarjetasTamano.length}, 1fr)`;
  contTamano.innerHTML = tarjetasTamano.join('');

  document.getElementById('resumen-proy-kpi-produccion').innerHTML = [
    _tarjetaKPI(`${a.piezasFabricadas.toLocaleString('es-CO')} / ${a.totalPiezas.toLocaleString('es-CO')}`, 'Piezas fabricadas', null, `${a.metrosFabricados.toFixed(2)} / ${a.totalMetros.toFixed(2)} m`),
    _tarjetaKPI(`${a.pctProduccion.toFixed(1)}%`, 'Avance ponderado (por longitud)', _colorSemaforo(a.pctProduccion)),
  ].join('');
  document.getElementById('resumen-proy-kpi-despacho').innerHTML = [
    _tarjetaKPI(`${a.piezasDespachadas.toLocaleString('es-CO')} / ${a.totalPiezas.toLocaleString('es-CO')}`, 'Piezas despachadas', null, `${a.metrosDespachados.toFixed(2)} / ${a.totalMetros.toFixed(2)} m`),
    _tarjetaKPI(`${a.pctDespacho.toFixed(1)}%`, 'Avance ponderado (por longitud)', _colorSemaforo(a.pctDespacho)),
  ].join('');

  const bovCard = document.getElementById('resumen-proy-bovedilla-card');
  if (a.hayBovedilla) {
    bovCard.style.display = '';
    document.getElementById('resumen-proy-kpi-bovedilla').innerHTML = [
      _tarjetaKPI(a.bovRequerida.toLocaleString('es-CO'), 'Requerida'),
      _tarjetaKPI(`${a.pctBovProduccion.toFixed(1)}%`, 'Avance producción', _colorSemaforo(a.pctBovProduccion), `${a.bovProducida.toLocaleString('es-CO')} / ${a.bovRequerida.toLocaleString('es-CO')}`),
      _tarjetaKPI(`${a.pctBovDespacho.toFixed(1)}%`, 'Avance despacho', _colorSemaforo(a.pctBovDespacho), `${a.bovDespachada.toLocaleString('es-CO')} / ${a.bovRequerida.toLocaleString('es-CO')}`),
    ].join('');
  } else {
    bovCard.style.display = 'none';
  }

  _chartResumenAvance('chart-resumen-produccion', a.pctProduccion);
  _chartResumenAvance('chart-resumen-despacho', a.pctDespacho);

  const tbody = document.getElementById('resumen-proy-tabla-losas-body');
  if (!losas.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><div class="icono">📋</div><div>No hay losas registradas todavía.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = losas.map(l => {
    const sis = SISTEMAS_ENTREPISO.find(s => s.clave === l.sistema);
    const col = _COLOR_ESTADO_LOSA[l.estado] || { bg: '#EEE', fg: '#555' };
    let metrosTot = 0, metrosProd = 0, metrosDesp = 0, piezasTot = 0;
    (l.filas || []).forEach(f => {
      const dim = Number(f.dimension) || 0;
      const cant = Number(f.cantidad) || 0;
      piezasTot += cant;
      metrosTot += dim * cant;
      metrosProd += dim * (cant - _pendienteProduccionFila(f));
      metrosDesp += dim * (cant - _pendienteDespachoFila(f, l.despachos));
    });
    const pctP = metrosTot > 0 ? (metrosProd / metrosTot) * 100 : 0;
    const pctD = metrosTot > 0 ? (metrosDesp / metrosTot) * 100 : 0;
    return `<tr>
      <td style="font-weight:600">${_esc(l.nombre)}</td>
      <td>${_esc(l.ubicacion) || '—'}</td>
      <td>${sis ? _esc(sis.etiqueta) : '—'}</td>
      <td><span class="badge" style="background:${col.bg};color:${col.fg}">${_esc(l.estado)}</span></td>
      <td>${piezasTot.toLocaleString('es-CO')}</td>
      <td>${_barraAvanceLosaHTML(pctP)}</td>
      <td>${_barraAvanceLosaHTML(pctD)}</td>
    </tr>`;
  }).join('');
}

// ── Memorias de Cálculo / Planos de Producción — junta en un solo lugar los PDF que ya se
// adjuntan por Losa (planoPath/memoriaCalculoPath), sin duplicar el archivo ni la lógica de
// subida (eso sigue viviendo en el modal de la Losa, ver más abajo). ──
function abrirDocumentosProyecto(tipo) {
  _TIPO_DOCUMENTO_PROYECTO = tipo; // 'plano' | 'memoria'
  document.querySelectorAll('.pantalla').forEach(el => el.classList.remove('activa'));
  document.getElementById('pantalla-proyecto-documentos').classList.add('activa');
  document.getElementById('proyecto-documentos-titulo').textContent = tipo === 'plano' ? '📋 Planos de Producción' : '📐 Memorias de Cálculo';
  renderDocumentosProyecto();
  _sincronizarSubnavProyecto(tipo);
}
let _TIPO_DOCUMENTO_PROYECTO = null;
function renderDocumentosProyecto() {
  const tbody = document.getElementById('tabla-proyecto-documentos-body');
  if (!tbody) return;
  const campoPath = _TIPO_DOCUMENTO_PROYECTO === 'plano' ? 'planoPath' : 'memoriaCalculoPath';
  const campoNombre = _TIPO_DOCUMENTO_PROYECTO === 'plano' ? 'planoNombre' : 'memoriaCalculoNombre';
  const losas = LOSAS_PROYECTO.filter(l => l.proyectoId === _PROYECTO_ACTIVO_ID && l[campoPath]);
  if (!losas.length) {
    const etiqueta = _TIPO_DOCUMENTO_PROYECTO === 'plano' ? 'un plano' : 'una memoria de cálculo';
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state"><div class="icono">${_TIPO_DOCUMENTO_PROYECTO === 'plano' ? '📋' : '📐'}</div><div>Ninguna losa de este proyecto tiene ${etiqueta} adjunto todavía — se adjunta al editar la losa, desde "Listas de Producción".</div></td></tr>`;
    return;
  }
  tbody.innerHTML = losas.map(l => `<tr>
    <td style="font-weight:600">${_esc(l.nombre)}</td>
    <td>${_esc(l.ubicacion) || '—'}</td>
    <td>${_esc(l[campoNombre])}</td>
    <td><button class="btn btn-secundario btn-xs" onclick="_abrirPdfStorage('proyectos-pdf','${_escAttr(l[campoPath])}')">👁️ Ver</button></td>
  </tr>`).join('');
}

const _TITULOS_MODO_LOSA = { lista: '📄 Listas de Producción', produccion: '🏗️ Producción', despacho: '📦 Despachos' };
function abrirLosasDeProyecto(modo) {
  _MODO_FLUJO_LOSA = modo;
  document.querySelectorAll('.pantalla').forEach(el => el.classList.remove('activa'));
  document.getElementById('pantalla-proyecto-losas').classList.add('activa');
  document.getElementById('proyecto-losas-titulo').textContent = _TITULOS_MODO_LOSA[modo] || '';
  document.getElementById('btn-nueva-losa').style.display = modo === 'lista' ? '' : 'none';
  renderLosasProyecto();
  _sincronizarSubnavProyecto(modo);
}
function volverALosasProyecto() {
  _LOSA_ACTIVA_ID = null;
  document.querySelectorAll('.pantalla').forEach(el => el.classList.remove('activa'));
  document.getElementById('pantalla-proyecto-losas').classList.add('activa');
  renderLosasProyecto();
  _sincronizarSubnavProyecto(_MODO_FLUJO_LOSA);
}

function renderLosasProyecto() {
  const tbody = document.getElementById('tabla-losas-proyecto-body');
  if (!tbody) return;
  const losas = LOSAS_PROYECTO.filter(l => l.proyectoId === _PROYECTO_ACTIVO_ID);
  if (!losas.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="icono">📋</div><div>No hay losas registradas todavía${_MODO_FLUJO_LOSA === 'lista' ? ' — crea la primera con "+ Nueva Losa".' : ' — Ingeniería todavía no ha cargado una lista de producción.'}</div></td></tr>`;
    return;
  }
  const esLista = _MODO_FLUJO_LOSA === 'lista';
  tbody.innerHTML = losas.map(l => {
    const sis = SISTEMAS_ENTREPISO.find(s => s.clave === l.sistema);
    const totalCant = (l.filas || []).reduce((s, f) => s + (Number(f.cantidad) || 0), 0);
    const totalProd = (l.filas || []).reduce((s, f) => s + Math.min(Number(f.cantidad) || 0, (f.produccion || []).reduce((s2, e) => s2 + (Number(e.cantidad) || 0), 0)), 0);
    const col = _COLOR_ESTADO_LOSA[l.estado] || { bg: '#EEE', fg: '#555' };
    return `<tr>
      <td style="font-weight:600">${_esc(l.nombre)}</td>
      <td>${_esc(l.ubicacion) || '—'}</td>
      <td>${sis ? _esc(sis.etiqueta) : '—'}</td>
      <td><span class="badge" style="background:${col.bg};color:${col.fg}">${_esc(l.estado)}</span></td>
      <td>${(l.filas || []).length} filas · ${totalProd}/${totalCant} producidas</td>
      <td style="white-space:nowrap">
        ${esLista
          ? `<button class="btn btn-primario btn-xs" onclick="abrirLosaDetalle('${_escAttr(l.id)}')">📄 Ver lista</button>
             <button class="btn btn-secundario btn-xs" onclick="abrirModalLosa('${_escAttr(l.id)}')">✏️</button>
             <button class="btn btn-rojo btn-xs" onclick="eliminarLosa('${_escAttr(l.id)}')">🗑️</button>`
          : `<button class="btn btn-primario btn-xs" onclick="abrirLosaDetalle('${_escAttr(l.id)}')">${_MODO_FLUJO_LOSA === 'despacho' ? '📦 Ver despachos' : '🏗️ Ver producción'}</button>`}
      </td>
    </tr>`;
  }).join('');
}

// ── Modal Losa (crear/editar metadata — no la lista de producción, eso vive en su propia
// pantalla de detalle) ──
function abrirModalLosa(id) {
  const esEdit = !!id;
  const l = esEdit ? LOSAS_PROYECTO.find(x => x.id === id) : null;
  // Título dinámico por sistema (2026-10-29, "Losa"/"Unidad") — `_modalLosaEsEdit`/
  // `_modalLosaNombreActual` son variables transitorias (mismo criterio que
  // `_archivosLosaPendientes`/`_archivosLosaExistentes`) para que `_alCambiarSistemaLosa()`
  // pueda recalcular el título cada vez que cambia el `<select>` de sistema, sin tener que
  // volver a leer `esEdit`/`l?.nombre` ahí.
  _modalLosaEsEdit = esEdit;
  _modalLosaNombreActual = l?.nombre || '';
  document.getElementById('ml-id').value = id || '';
  document.getElementById('ml-nombre').value = l?.nombre || '';
  document.getElementById('ml-ubicacion').value = l?.ubicacion || '';
  document.getElementById('ml-sistema').value = l?.sistema || 'prelosa';
  document.getElementById('ml-estado').value = l?.estado || 'Planeación';
  document.getElementById('ml-espesor').value = l?.espesorCm || 5;
  document.getElementById('ml-densidad').value = l?.densidadKgM3 || 2400;
  document.getElementById('ml-espesor-panel').value = (l?.sistema === 'paneles_cerramiento' && l?.espesorCm) || 4;
  document.getElementById('ml-densidad-panel').value = l?.densidadKgM3 || 2400;
  document.getElementById('ml-factor-vigueta').value = l?.pesoFactorKgM || '';
  _archivosLosaPendientes = { plano: null, memoria: null };
  _archivosLosaExistentes = {
    plano: l?.planoPath ? { path: l.planoPath, nombre: l.planoNombre } : null,
    memoria: l?.memoriaCalculoPath ? { path: l.memoriaCalculoPath, nombre: l.memoriaCalculoNombre } : null,
  };
  _renderZonaArchivoLosa('plano');
  _renderZonaArchivoLosa('memoria');
  _alCambiarSistemaLosa();
  document.getElementById('modal-losa').classList.add('abierto');
}
let _modalLosaEsEdit = false;
let _modalLosaNombreActual = '';
function _alCambiarSistemaLosa() {
  const sistema = document.getElementById('ml-sistema').value;
  const esVigueta = sistema === 'vigueta_bovedilla';
  const esPanel = sistema === 'paneles_cerramiento';
  document.getElementById('ml-bloque-prelosa').style.display = (esVigueta || esPanel) ? 'none' : '';
  document.getElementById('ml-bloque-vigueta').style.display = esVigueta ? '' : 'none';
  document.getElementById('ml-bloque-panel').style.display = esPanel ? '' : 'none';
  const etiqueta = _etiquetaRegistroLosa(sistema);
  document.getElementById('modal-losa-titulo').textContent = _modalLosaEsEdit
    ? `✏️ Editar ${etiqueta} — ${_modalLosaNombreActual}`
    : `🏗️ Nueva ${etiqueta}`;
}

async function guardarLosa() {
  const nombre = document.getElementById('ml-nombre').value.trim();
  const sistema = document.getElementById('ml-sistema').value;
  if (!nombre) { alert(`Completa el Nombre de ${sistema === 'paneles_cerramiento' ? 'la unidad' : 'la losa'}.`); return; }
  // Espesor estándar de Paneles — 4cm (macizo) u 8cm (alveolar), ya restringido por el propio
  // <select> (#ml-espesor-panel) a esas 2 opciones; esta validación es solo cinturón-y-tirantes.
  if (sistema === 'paneles_cerramiento' && !ESPESORES_ESTANDAR_PANEL.includes(parseFloat(document.getElementById('ml-espesor-panel').value))) {
    alert(`El espesor de un panel debe ser ${ESPESORES_ESTANDAR_PANEL.join(' o ')} cm.`);
    return;
  }
  const idOrig = document.getElementById('ml-id').value;
  const existente = idOrig ? LOSAS_PROYECTO.find(x => x.id === idOrig) : null;
  const idFinal = idOrig || String(Date.now());

  let planoPath = _archivosLosaExistentes.plano?.path || '';
  let planoNombre = _archivosLosaExistentes.plano?.nombre || '';
  let memoriaCalculoPath = _archivosLosaExistentes.memoria?.path || '';
  let memoriaCalculoNombre = _archivosLosaExistentes.memoria?.nombre || '';

  if (_archivosLosaPendientes.plano) {
    const ruta = `${idFinal}/${Date.now()}-${_sanearNombreArchivo(_archivosLosaPendientes.plano.nombre)}`;
    const { error } = await sb.storage.from('proyectos-pdf').upload(ruta, _archivosLosaPendientes.plano.blob, { contentType: 'application/pdf' });
    if (error) { alert('No se pudo subir el plano: ' + error.message); return; }
    planoPath = ruta; planoNombre = _archivosLosaPendientes.plano.nombre;
  }
  if (_archivosLosaPendientes.memoria) {
    const ruta = `${idFinal}/${Date.now()}-${_sanearNombreArchivo(_archivosLosaPendientes.memoria.nombre)}`;
    const { error } = await sb.storage.from('proyectos-pdf').upload(ruta, _archivosLosaPendientes.memoria.blob, { contentType: 'application/pdf' });
    if (error) { alert('No se pudo subir la memoria de cálculo: ' + error.message); return; }
    memoriaCalculoPath = ruta; memoriaCalculoNombre = _archivosLosaPendientes.memoria.nombre;
  }

  const l = {
    id: idFinal, proyectoId: _PROYECTO_ACTIVO_ID, nombre,
    ubicacion: document.getElementById('ml-ubicacion').value.trim(),
    sistema,
    estado: document.getElementById('ml-estado').value,
    espesorCm: sistema === 'paneles_cerramiento'
      ? parseFloat(document.getElementById('ml-espesor-panel').value) || 0
      : parseFloat(document.getElementById('ml-espesor').value) || 0,
    densidadKgM3: sistema === 'paneles_cerramiento'
      ? parseFloat(document.getElementById('ml-densidad-panel').value) || 0
      : parseFloat(document.getElementById('ml-densidad').value) || 0,
    pesoFactorKgM: parseFloat(document.getElementById('ml-factor-vigueta').value) || 0,
    planoPath, planoNombre, memoriaCalculoPath, memoriaCalculoNombre,
    filas: existente?.filas || [],
    despachos: existente?.despachos || [],
    bovedilla: sistema === 'vigueta_bovedilla' ? (existente?.bovedilla || { tipo: '', cantidadRequerida: 0, produccion: [], despacho: [] }) : null,
    creadoPor: existente?.creadoPor || (typeof USUARIO_ACTUAL !== 'undefined' ? USUARIO_ACTUAL?.email : '') || '',
    creadoEn: existente?.creadoEn || new Date().toISOString(),
  };
  const idx = LOSAS_PROYECTO.findIndex(x => x.id === l.id);
  const anterior = idx >= 0 ? { ...LOSAS_PROYECTO[idx] } : null;
  if (idx >= 0) LOSAS_PROYECTO[idx] = l; else LOSAS_PROYECTO.push(l);
  sb.from('losas_proyecto').upsert({ id: l.id, datos: l, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => {
      if (error) {
        if (!anterior) LOSAS_PROYECTO = LOSAS_PROYECTO.filter(x => x.id !== l.id);
        else { const i2 = LOSAS_PROYECTO.findIndex(x => x.id === l.id); if (i2 >= 0) LOSAS_PROYECTO[i2] = anterior; }
        renderLosasProyecto();
        alert('Error al guardar: ' + error.message);
      }
    });
  cerrarModal('modal-losa');
  renderLosasProyecto();
}

function eliminarLosa(id) {
  const l = LOSAS_PROYECTO.find(x => x.id === id);
  if (!l) return;
  const etiqueta = _etiquetaRegistroLosa(l.sistema);
  if (!confirm(`¿Eliminar ${etiqueta === 'Unidad' ? 'la unidad' : 'la losa'} "${l.nombre}"? Se pierde toda su lista de producción y su control de despacho.`)) return;
  const idx = LOSAS_PROYECTO.findIndex(x => x.id === id);
  LOSAS_PROYECTO = LOSAS_PROYECTO.filter(x => x.id !== id);
  renderLosasProyecto();
  _ofrecerDeshacer(`🗑️ ${etiqueta} "${l.nombre}" eliminada`,
    () => { sb.from('losas_proyecto').delete().eq('id', id).then(({ error }) => { if (error) { console.error(error.message); alert('No se pudo eliminar: ' + error.message); } }); },
    () => { LOSAS_PROYECTO.splice(Math.min(idx, LOSAS_PROYECTO.length), 0, l); renderLosasProyecto(); }
  );
}

// ── Adjuntar plano / memoria de cálculo (PDF) — reusa tal cual el mecanismo ya probado de
// Calidad para informes de laboratorio (js/compresor-pdf.js: comprimir si pesa, sanear el
// nombre para Storage, subir recién al Guardar). Bucket propio `proyectos-pdf`. ──
let _archivosLosaPendientes = { plano: null, memoria: null };
let _archivosLosaExistentes = { plano: null, memoria: null };

async function _esRealmentePdfLosa(file) {
  try {
    const buffer = await file.slice(0, 5).arrayBuffer();
    return String.fromCharCode(...new Uint8Array(buffer)) === '%PDF-';
  } catch { return false; }
}
async function manejarArchivoLosaPDF(tipo, file) {
  if (!file) return;
  if (file.type !== 'application/pdf') { alert('Ese archivo no es un PDF.'); return; }
  if (file.size > 25 * 1024 * 1024) { alert(`El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB — el máximo permitido es 25 MB.`); return; }
  if (!(await _esRealmentePdfLosa(file))) { alert('Ese archivo no es un PDF válido (no tiene la firma esperada) — puede estar dañado o ser otro tipo de archivo renombrado.'); return; }
  const { blob } = await _comprimirPdfSiPesa(file);
  _archivosLosaPendientes[tipo] = { blob, nombre: file.name };
  _archivosLosaExistentes[tipo] = null;
  _renderZonaArchivoLosa(tipo);
}
function onSeleccionArchivoLosa(tipo, event) {
  const file = event.target.files[0];
  manejarArchivoLosaPDF(tipo, file);
  event.target.value = '';
}
function onArrastreSobreArchivoLosa(event) { event.preventDefault(); event.currentTarget.style.borderColor = 'var(--azul-claro)'; }
function onArrastreFueraArchivoLosa(event) { event.currentTarget.style.borderColor = 'var(--gris-borde)'; }
function onSoltarArchivoLosa(tipo, event) {
  event.preventDefault();
  event.currentTarget.style.borderColor = 'var(--gris-borde)';
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  manejarArchivoLosaPDF(tipo, file);
}
function quitarArchivoLosa(tipo) {
  _archivosLosaPendientes[tipo] = null;
  _archivosLosaExistentes[tipo] = null;
  _renderZonaArchivoLosa(tipo);
}
function _renderZonaArchivoLosa(tipo) {
  const el = document.getElementById(`losa-${tipo}-estado`);
  if (!el) return;
  const pend = _archivosLosaPendientes[tipo];
  const exist = _archivosLosaExistentes[tipo];
  if (pend) el.innerHTML = `✅ ${_esc(pend.nombre)} (nuevo, se sube al guardar) <button type="button" class="btn btn-secundario btn-xs" onclick="quitarArchivoLosa('${tipo}')">Quitar</button>`;
  else if (exist) el.innerHTML = `📄 ${_esc(exist.nombre)} <button type="button" class="btn btn-secundario btn-xs" onclick="_abrirPdfStorage('proyectos-pdf','${_escAttr(exist.path)}')">Ver</button> <button type="button" class="btn btn-secundario btn-xs" onclick="quitarArchivoLosa('${tipo}')">Quitar</button>`;
  else el.textContent = '';
}

// ── Detalle de una Losa: lista de producción, control de producción, despachos, bovedilla ──
function abrirLosaDetalle(id) {
  const l = LOSAS_PROYECTO.find(x => x.id === id);
  if (!l) return;
  _LOSA_ACTIVA_ID = id;
  _filasLosaActual = JSON.parse(JSON.stringify(l.filas || []));
  _despachosLosaActual = JSON.parse(JSON.stringify(l.despachos || []));
  _bovedillaLosaActual = l.bovedilla ? JSON.parse(JSON.stringify(l.bovedilla)) : null;
  _programacionesLosaActual = JSON.parse(JSON.stringify(l.produccionesProgramadas || []));
  _despachosProgramadosLosaActual = JSON.parse(JSON.stringify(l.despachosProgramados || []));
  // Tabla de filas colapsada por defecto en Producción/Despacho (2026-10-21, a pedido del
  // usuario: "las listas de producción pueden ser muy largas, y para llegar abajo se demora uno
  // con el scroll... dejemos la opción de poder pincharla para que se abra cuando se necesite
  // revisar") — se fija UNA SOLA VEZ acá, al entrar a la Losa (no en `renderFilasProduccion()`,
  // que se llama una y otra vez durante la sesión — si se reiniciara ahí, cualquier guardado o
  // carga volvería a cerrar la tabla aunque el usuario la hubiera abierto a propósito). En Lista
  // no aplica — ahí la tabla es el formulario principal, siempre debe verse.
  _filasColapsadas = (_MODO_FLUJO_LOSA === 'produccion' || _MODO_FLUJO_LOSA === 'despacho');
  // Filtros del cuadro principal (2026-10-20) — se reinician UNA SOLA VEZ acá, mismo criterio
  // que `_filasColapsadas`: `renderFilasProduccion()` se llama una y otra vez durante la
  // sesión (cada guardado, cada carga), y reiniciarlos ahí borraría un filtro que el usuario
  // armó a propósito con cada acción sin relación.
  const fpFiltros = document.getElementById('fp-filtros-lista');
  if (fpFiltros) fpFiltros.innerHTML = '';
  document.querySelectorAll('.pantalla').forEach(el => el.classList.remove('activa'));
  document.getElementById('pantalla-losa-detalle').classList.add('activa');
  renderLosaDetalle();
  _sincronizarSubnavProyecto(_MODO_FLUJO_LOSA);
}

const _ICONOS_MODO_LOSA = { lista: '📄', produccion: '🏗️', despacho: '📦' };
function renderLosaDetalle() {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (!l) return;
  const sis = SISTEMAS_ENTREPISO.find(s => s.clave === l.sistema);
  const esLista = _MODO_FLUJO_LOSA === 'lista';
  const esProduccion = _MODO_FLUJO_LOSA === 'produccion';
  const esDespacho = _MODO_FLUJO_LOSA === 'despacho';
  document.getElementById('losa-detalle-titulo').textContent = `${_ICONOS_MODO_LOSA[_MODO_FLUJO_LOSA] || ''} ${l.nombre}${l.ubicacion ? ' — ' + l.ubicacion : ''} (${sis ? sis.etiqueta : ''})`;
  // Fila de "← Volver / nombre / Exportar Excel / Programar.../Cargar..." fija al bajar, mismo
  // criterio que el encabezado de la tabla (solo Producción/Despacho) — 2026-10-21, a pedido
  // del usuario: "fijemos también la fila del medio donde están los botones de Exportar excel".
  document.getElementById('losa-acciones-row').className = (esProduccion || esDespacho) ? 'acciones-row fija-al-bajar' : 'acciones-row';
  document.getElementById('losa-barra-lista').style.display = esLista ? '' : 'none';
  document.getElementById('losa-nota-pegar').style.display = esLista ? '' : 'none';
  document.getElementById('losa-btn-programar-produccion').style.display = esProduccion ? '' : 'none';
  document.getElementById('losa-btn-cargar-produccion').style.display = esProduccion ? '' : 'none';
  document.getElementById('losa-btn-produccion-diaria').style.display = esProduccion ? '' : 'none';
  document.getElementById('losa-btn-programar-despacho').style.display = esDespacho ? '' : 'none';
  document.getElementById('losa-btn-cargar-despacho').style.display = esDespacho ? '' : 'none';
  document.getElementById('losa-btn-despacho-diario').style.display = esDespacho ? '' : 'none';
  document.getElementById('losa-card-produccion-programada').style.display = esProduccion ? '' : 'none';
  document.getElementById('losa-card-produccion-registrada').style.display = esProduccion ? '' : 'none';
  document.getElementById('losa-card-despacho-programado').style.display = esDespacho ? '' : 'none';
  document.getElementById('losa-card-despachos-registrados').style.display = esDespacho ? '' : 'none';
  document.getElementById('losa-detalle-bloque-bovedilla').style.display = l.sistema === 'vigueta_bovedilla' ? '' : 'none';
  renderFilasProduccion();
  if (l.sistema === 'vigueta_bovedilla') renderBovedillaLosa();
  if (esProduccion) { renderProduccionProgramada(); renderProduccionRegistrada(); }
  if (esDespacho) { renderDespachoProgramado(); renderDespachosRegistrados(); }
}

// ── Filas de producción — columnas según sistema (Prelosa/Placa Alveolar: ancho+hilos;
// Vigueta: tipo+hilos abajo/arriba) ──
function renderFilasProduccion() {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (!l) return;
  const esVigueta = l.sistema === 'vigueta_bovedilla';
  const esPanel = l.sistema === 'paneles_cerramiento';
  // La tabla de "Listas de Producción" (Ingeniería) pasa TAL CUAL a Producción y a Despachos,
  // de solo lectura — cada una solo le suma la ÚNICA columna de pendiente que le importa a esa
  // área (2026-10-13, a pedido del usuario): Producción ve Pend. Producción (no le compete
  // Despacho), Despachos ve Pend. Despacho (no le compete Producción). Lista no ve ninguna de
  // las dos — ahí Ingeniería solo define la lista, el pendiente es ruido mientras nada se ha
  // producido/despachado todavía.
  const esLista = _MODO_FLUJO_LOSA === 'lista';
  const esProduccion = _MODO_FLUJO_LOSA === 'produccion';
  // Encabezado fijo al bajar — en las TRES vistas, incluida Lista (2026-10-18, a pedido del
  // usuario: "no está bloqueando la fila de títulos en la ventana de listas de producción,
  // bloquéala también"; hasta ahora Lista se dejaba afuera a propósito, por un bug real que un
  // encabezado `position:sticky` causó una vez en otra `.tabla-items` — un formulario largo
  // donde la tabla era solo una sección más, y al bajar por el resto del formulario el
  // encabezado se quedaba pegado tapando la única fila de producto, ver
  // docs/01-arquitectura-tecnica.md — pero se probó de nuevo con la tabla real de Lista
  // (bloque de Bovedilla debajo, en sistema vigueta) sin reproducirse: acá sí se scrollea la
  // tabla en sí misma, tiene muchas filas en los casos reales (Boreal: 247), y el encabezado se
  // suelta en cuanto se pasa de largo la tabla completa, dejando pasar el resto del formulario
  // sin taparlo). Clase ADITIVA `.tabla-items.fija-al-bajar` (css/estilos.css) en vez de cambiar
  // a `.tabla-cots` entero — esa trae su propio estilo de encabezado (fondo blanco, texto gris)
  // distinto al azul de `.tabla-items`, que no se pidió cambiar.
  const tabla = document.getElementById('tabla-filas-produccion');
  if (tabla) tabla.className = 'tabla-items fija-al-bajar';
  // Tabla colapsable, solo Producción/Despacho (2026-10-21, a pedido del usuario: "las listas
  // de producción pueden ser muy largas, y para llegar abajo se demora uno con el scroll...
  // dejemos la opción de poder pincharla para que se abra cuando se necesite revisar") — en
  // Lista NO aplica (`#losa-filas-toggle` se esconde y la tabla se ve siempre completa): ahí la
  // tabla es el formulario principal de la pantalla, no "algo que se consulta de vez en cuando".
  // `_filasColapsadas` arranca en `true` al entrar a la Losa en Producción/Despacho (se fija
  // una sola vez en `abrirLosaDetalle()`, no acá — este render se repite todo el tiempo durante
  // la sesión, y reiniciarlo acá cerraría la tabla de nuevo cada vez que algo se guarda o se
  // carga, aunque el usuario la hubiera abierto a propósito).
  const togglePanel = document.getElementById('losa-filas-toggle');
  const tablaWrap = document.getElementById('losa-filas-tabla-wrap');
  // Colapsado = esconde solo las filas individuales (`<tbody>`), no la tabla entera (corregido
  // 2026-10-16, a pedido del usuario: "mostremosla... para ver el resumen sin tener que abrir
  // el cuadro" — antes `tablaWrap.style.display='none'` escondía TODO, incluido el `<tfoot>`
  // con la fila de TOTALES y el avance ponderado, así que colapsar dejaba a ciegas justo el
  // resumen que más se necesita para una mirada rápida). Ahora `tablaWrap` siempre se ve;
  // `<thead>` y `<tfoot>` quedan siempre visibles, y solo el `<tbody>` (línea por línea, la
  // parte larga que motivó el colapsable) se esconde — el toggle visualmente baja a solo
  // encabezado + fila de TOTALES + avance, igual que se ve siempre en Lista.
  tablaWrap.style.display = '';
  if (togglePanel) {
    togglePanel.style.display = esLista ? 'none' : 'flex';
    if (!esLista) {
      document.getElementById('losa-filas-toggle-texto').textContent =
        `${_filasColapsadas ? '▶' : '▼'} ${_filasColapsadas ? 'Ver' : 'Ocultar'} tabla de ${esProduccion ? 'producción' : 'despacho'} (${_filasLosaActual.length} fila${_filasLosaActual.length === 1 ? '' : 's'})`;
    }
  }
  const thead = document.getElementById('filas-produccion-thead');
  // "Unidades fabricadas" (2026-10-15, a pedido del usuario), justo antes de "Pend.
  // Producción" — solo en modo producción, igual que el resto de columnas de seguimiento.
  // "m²" (2026-10-17, a pedido del usuario: "incluyamos una nueva fila de m2, que es el
  // resultado de multiplicar el largo por el ancho") — solo en prelosa/placa alveolar, vigueta
  // no tiene un "ancho" real (se mide en metros lineales, no en área) así que no aplica.
  // Columna de metros lineales pendientes + renombre (2026-10-22, a pedido del usuario: "metamos
  // una columna adicional de pendiente de producción y de despacho, esa en metros lineales...
  // cambiemos los nombres de estas dos últimas, por unidades faltantes, y metros long total
  // faltante") — antes "Pend. Producción"/"Pend. Despacho" solo mostraban unidades; una fila con
  // piezas largas pendientes y otra con piezas cortas pendientes podían mostrar el mismo número
  // de unidades y significar cantidades de concreto muy distintas. Se agrega "Long. total
  // faltante (m)"/"Long. total por despachar (m)" (= unidades faltantes × Dimensión de esa
  // fila) justo al lado, y se renombran las columnas de unidades para que "pendiente" (que
  // sonaba a "en curso") quede claro como "lo que falta". El nombre de Despacho ("Unidades por
  // despachar"/"Long. total por despachar") es análogo, aunque el usuario solo mencionó
  // Producción explícitamente — confirmado con el usuario que aplica igual a Despachos.
  thead.innerHTML = `<tr>
    <th>#</th><th>Cuadro</th><th>Ejes numéricos</th><th>Ejes alfabéticos</th>
    ${esVigueta
      ? '<th>Vigueta</th><th>Hilos Abajo</th><th>Hilos Arriba</th>'
      : esPanel
        ? '<th>Clasificación</th><th>Ancho (cm)</th><th>Largo A (m)</th><th>Largo B (m)</th>'
        : '<th>Ancho (cm)</th><th>Hilos</th>'}
    <th>Dimensión (m)</th><th>Cantidad</th><th>Long. total (m)</th>${esVigueta ? '' : '<th>m²</th>'}<th>Peso (kg)</th>
    ${esLista ? '' : (esProduccion
      ? '<th>Unidades fabricadas</th><th>Unidades faltantes</th><th>Long. total faltante (m)</th>'
      : '<th>Disponible despacho</th><th>Unidades por despachar</th><th>Long. total por despachar (m)</th>')}
    <th>Observaciones</th><th></th>
  </tr>`;
  const tbody = document.getElementById('fp-filas-body');
  const tfoot = document.getElementById('filas-produccion-tfoot');
  if (!_filasLosaActual.length) {
    tbody.style.display = '';
    tbody.innerHTML = `<tr><td colspan="17" class="empty-state"><div class="icono">📋</div><div>No hay filas todavía — agrega una a mano, pégalas desde Excel o importa el archivo.</div></td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }
  // Colapsado = solo se esconde el `<tbody>` (ver nota junto a `tablaWrap` más arriba) —
  // `<thead>`/`<tfoot>` quedan siempre visibles.
  tbody.style.display = (!esLista && _filasColapsadas) ? 'none' : '';
  tbody.innerHTML = _filasLosaActual.map((f, i) => _filaProduccionHTML(f, i, l, esVigueta)).join('');
  // Filtros (2026-10-20, a pedido del usuario: "en las ventanas de listas de producción,
  // producción y despachos, en los cuadros principales de cada losa, implementemos los mismos
  // filtros que implementamos en programar producción y programar despachos") — reutiliza tal
  // cual `_agregarFiltroProgramar()`/`_aplicarFiltrosProgramar()` (antes solo usadas con
  // prefijo 'mpp'/'mpd' en los modales de Programar), con prefijo 'fp' acá. El `<tbody>` se
  // reconstruye por completo en cada `renderFilasProduccion()` (cada guardado, cada carga,
  // pegar/importar) — por eso el filtro hay que REAPLICARLO acá mismo después de poblar las
  // filas nuevas; el estado del filtro en sí (los `<select>`/`<input>` de `#fp-filtros-lista`)
  // vive FUERA del `<tbody>`, así que sobrevive solo al re-render — ver `abrirLosaDetalle()`
  // para dónde se reinicia (una sola vez por navegación, mismo criterio que `_filasColapsadas`).
  // Fila de TOTALES/avance (2026-10-17/2026-10-20) — `_aplicarFiltrosProgramar('fp')` YA arma
  // el pie completo por dentro (`_pieTotalesHTML()` + `_pieAvanceProduccionHTML()` solo en
  // producción, ver esa función — se agregó ahí para que escribir en los campos del filtro
  // también lo recalcule en vivo, no solo un render completo como este), así que no hace falta
  // repetirlo acá aparte.
  _aplicarFiltrosProgramar('fp');
}
// Click en la barra "▶/▼ Ver/Ocultar tabla..." — ver la nota junto a `_filasColapsadas` y en
// `renderFilasProduccion()`.
function _toggleFilasProduccion() {
  _filasColapsadas = !_filasColapsadas;
  renderFilasProduccion();
}

// Fila de TOTALES alineada debajo de su propia columna (2026-10-17, a pedido del usuario:
// "cuadra los totales para que queden debajo de cada columna" — la primera versión era un
// solo banner de texto, de ancho completo, más fácil de armar pero más difícil de leer de un
// vistazo). El colspan de la celda "TOTALES" cubre exactamente las columnas antes de
// "Cantidad" (# + Cuadro + Ejes num. + Ejes alfa. + las 2 o 3 columnas propias del sistema +
// Dimensión), y las celdas de total van justo debajo de "Cantidad"/"Long. total (m)"/"m²" —
// mismo criterio que ya usa el colspan de la fila TOTALES de los imprimibles. El resto de
// columnas a la derecha (Peso, Pend./Fabricadas, Observaciones, la de acciones) quedan vacías
// en un último `<td colspan>`.
// Recalcula solo sobre las filas filtradas, con una señal visible de "FILTRADO" (2026-10-20, a
// pedido del usuario: "al aplicar los filtros, recalculemos los totales (con una nota o señal
// que indique la parcialidad)" — antes sumaba siempre TODA `_filasLosaActual`, sin importar si
// había un filtro activo escondiendo filas, así que el total nunca cambiaba con el filtro
// puesto y no avisaba que lo que se veía en pantalla no era el total real de la Losa.
// `_filasVisiblesFp()` devuelve `null` cuando no hay filtro (se usan todas, comportamiento de
// siempre, sin badge) o el subconjunto que pasa el filtro (aunque sean 0 filas).
function _pieTotalesHTML(l) {
  const esVigueta = l.sistema === 'vigueta_bovedilla';
  const esLista = _MODO_FLUJO_LOSA === 'lista';
  const esProduccion = _MODO_FLUJO_LOSA === 'produccion';
  const esDespacho = _MODO_FLUJO_LOSA === 'despacho';
  const filasVisibles = _filasVisiblesFp();
  const filtroActivo = filasVisibles !== null;
  const filas = filtroActivo ? filasVisibles : _filasLosaActual;
  let totalUnidades = 0, totalMetros = 0, totalM2 = 0, totalPeso = 0;
  // Totales de las columnas de seguimiento (2026-10-22, a pedido del usuario: "en los totales
  // de la parte inferior, incluyamos también los de las columnas de unidades fabricadas,
  // pendiente de producción (en unidades) y pendientes de producción (en metros)") — antes esas
  // columnas quedaban en blanco dentro de `colspanFinal` (nunca se sumaban). `totalColFabricada`
  // = "Unidades fabricadas" en Producción / "Disponible despacho" en Despacho (mismo lugar en la
  // tabla, significado distinto). Aplica igual a Despachos, aunque el usuario solo mencionó
  // Producción explícitamente (confirmado con el usuario).
  let totalColFabricada = 0, totalFaltanteUnidades = 0, totalFaltanteMetros = 0;
  filas.forEach(f => {
    const dim = Number(f.dimension) || 0;
    const cant = Number(f.cantidad) || 0;
    totalUnidades += cant;
    totalMetros += dim * cant;
    if (!esVigueta) totalM2 += (Number(f.ancho) || 0) / 100 * dim * cant;
    totalPeso += _pesoFila(f, l);
    if (esProduccion) {
      const pendProd = _pendienteProduccionFila(f);
      totalColFabricada += cant - pendProd;
      totalFaltanteUnidades += pendProd;
      totalFaltanteMetros += pendProd * dim;
    } else if (esDespacho) {
      const pendDesp = _pendienteDespachoFila(f, _despachosLosaActual);
      totalColFabricada += _disponibleDespachoFila(f, _despachosLosaActual);
      totalFaltanteUnidades += pendDesp;
      totalFaltanteMetros += pendDesp * dim;
    }
  });
  // # + Cuadro + Ejes num. + Ejes alfa. = 4, + columnas propias del sistema (3 vigueta / 2
  // prelosa), + Dimensión (m) = 1.
  const colspanInicial = 4 + (esVigueta ? 3 : 2) + 1;
  // Observaciones (1) + columna de acciones (1) — todo lo que queda DESPUÉS de las columnas de
  // seguimiento, que desde 2026-10-22 ya llevan su propia celda de total (ver arriba) en vez de
  // quedar vacías dentro de este colspan.
  const colspanFinal = 1 + 1;
  const columnasSeguimiento = esLista ? '' : `
    <td style="padding:10px;text-align:center;color:var(--azul)">${totalColFabricada}</td>
    <td style="padding:10px;text-align:center;color:var(--azul)">${totalFaltanteUnidades}</td>
    <td style="padding:10px;text-align:right;color:var(--azul)">${totalFaltanteMetros.toFixed(2)}</td>`;
  const badgeFiltro = filtroActivo
    ? ` <span style="font-size:10px;font-weight:700;color:var(--naranja);background:#FFF3E0;padding:2px 7px;border-radius:8px;vertical-align:middle" title="Estos totales son solo de las filas que pasan el filtro activo, no de toda la Losa">⚠️ FILTRADO (${filas.length}/${_filasLosaActual.length})</span>`
    : '';
  return `<tr style="background:var(--azul-suave);font-weight:700">
    <td colspan="${colspanInicial}" style="padding:10px;text-align:right;color:var(--azul)">📐 TOTALES${badgeFiltro}</td>
    <td style="padding:10px;text-align:center;color:var(--azul)">${totalUnidades}</td>
    <td style="padding:10px;text-align:right;color:var(--azul)">${totalMetros.toFixed(2)}</td>
    ${esVigueta ? '' : `<td style="padding:10px;text-align:right;color:var(--azul)">${totalM2.toFixed(2)}</td>`}
    <td style="padding:10px;text-align:right;color:var(--azul)">${totalPeso.toFixed(1)}</td>
    ${columnasSeguimiento}
    <td colspan="${colspanFinal}"></td>
  </tr>`;
}

// Exportar a Excel (2026-10-18, a pedido del usuario: "y si incluimos un botón para descargar
// en excel la tabla, y te la paso y comparas?" — surgió de una diferencia real reportada entre
// la suma manual del usuario y el total de metros lineales que mostraba ProSuite para una Losa
// real: 1376.05 vs 1425.16 — una tabla con muchas filas no cabe completa en una captura de
// pantalla para auditarla fila por fila). Mismo patrón ya establecido en
// `exportarEstadisticasProduccionExcel()` (`js/estadisticas-produccion.js`): aoa_to_sheet →
// book_new → book_append_sheet → writeFile. Exporta EXACTAMENTE las mismas columnas que se ven
// en pantalla en el modo activo (Lista/Producción/Despacho) — mismos cálculos de
// `_filaProduccionHTML()` por fila, sin redondear antes de sumar — más una fila de TOTALES al
// final que replica la misma fórmula de `_pieTotalesHTML()`, para que una diferencia entre lo
// que alguien suma a mano y lo que muestra la pantalla quede auditable fila por fila en el
// mismo archivo.
function exportarFilasLosaExcel() {
  if (typeof XLSX === 'undefined') { alert('La librería de Excel no cargó. Verifica tu conexión.'); return; }
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (!l) return;
  if (!_filasLosaActual.length) { alert('No hay filas para exportar.'); return; }
  const esVigueta = l.sistema === 'vigueta_bovedilla';
  const esPanel = l.sistema === 'paneles_cerramiento';
  const esLista = _MODO_FLUJO_LOSA === 'lista';
  const esProduccion = _MODO_FLUJO_LOSA === 'produccion';
  const proy = PROYECTOS.find(x => x.id === _PROYECTO_ACTIVO_ID);
  const sis = SISTEMAS_ENTREPISO.find(s => s.clave === l.sistema);

  const encabezado = [
    '#', 'Cuadro', 'Ejes numéricos', 'Ejes alfabéticos',
    ...(esVigueta ? ['Vigueta', 'Hilos Abajo', 'Hilos Arriba'] : esPanel ? ['Clasificación', 'Ancho (cm)', 'Largo A (m)', 'Largo B (m)'] : ['Ancho (cm)', 'Hilos']),
    'Dimensión (m)', 'Cantidad', 'Long. total (m)',
    ...(esVigueta ? [] : ['m²']),
    'Peso (kg)',
    // Columna de metros lineales faltantes + renombre (2026-10-22, ver nota en
    // `renderFilasProduccion()`) — mismas 3 columnas y mismos nombres que ya se ven en pantalla.
    ...(esLista ? [] : (esProduccion
      ? ['Unidades fabricadas', 'Unidades faltantes', 'Long. total faltante (m)']
      : ['Disponible despacho', 'Unidades por despachar', 'Long. total por despachar (m)'])),
    'Observaciones',
  ];

  let totalUnidades = 0, totalMetros = 0, totalM2 = 0, totalPeso = 0;
  let totalColFabricada = 0, totalFaltanteUnidades = 0, totalFaltanteMetros = 0;
  const filas = _filasLosaActual.map((f, i) => {
    const dim = Number(f.dimension) || 0;
    const cant = Number(f.cantidad) || 0;
    const longTotal = dim * cant;
    const m2 = esVigueta ? 0 : (Number(f.ancho) || 0) / 100 * dim * cant;
    const peso = _pesoFila(f, l);
    totalUnidades += cant; totalMetros += longTotal; totalM2 += m2; totalPeso += peso;
    const pendProd = _pendienteProduccionFila(f);
    const pendDesp = _pendienteDespachoFila(f, _despachosLosaActual);
    const dispDesp = _disponibleDespachoFila(f, _despachosLosaActual);
    const pendProdM = pendProd * dim;
    const pendDespM = pendDesp * dim;
    if (esProduccion) { totalColFabricada += cant - pendProd; totalFaltanteUnidades += pendProd; totalFaltanteMetros += pendProdM; }
    else if (!esLista) { totalColFabricada += dispDesp; totalFaltanteUnidades += pendDesp; totalFaltanteMetros += pendDespM; }
    return [
      i + 1, f.cuadro || '', f.ejesEntre || '', f.laterales || '',
      ...(esVigueta
        ? [f.tipoVigueta || '', Number(f.hilosAbajo) || 0, Number(f.hilosArriba) || 0]
        : esPanel
          ? [_etiquetaClasificacionPanel(f.clasificacion), Number(f.ancho) || 0, Number(f.largoA) || 0, Number(f.largoB) || 0]
          : [Number(f.ancho) || 0, Number(f.hilos) || 0]),
      dim, cant, longTotal,
      ...(esVigueta ? [] : [m2]),
      peso,
      ...(esLista ? [] : (esProduccion ? [cant - pendProd, pendProd, pendProdM] : [dispDesp, pendDesp, pendDespM])),
      f.observaciones || '',
    ];
  });

  const filaTotales = [
    'TOTALES', '', '',
    '',
    ...(esVigueta ? ['', '', ''] : esPanel ? ['', '', '', ''] : ['', '']),
    '', totalUnidades, totalMetros,
    ...(esVigueta ? [] : [totalM2]),
    totalPeso,
    ...(esLista ? [] : [totalColFabricada, totalFaltanteUnidades, totalFaltanteMetros]),
    '',
  ];

  const modoTxt = esLista ? 'Lista de producción' : (esProduccion ? 'Producción' : 'Despacho');
  const rows = [
    [`${l.nombre}${l.ubicacion ? ' — ' + l.ubicacion : ''} (${sis ? sis.etiqueta : ''})`],
    ['Proyecto:', proy?.nombre || '—'],
    ['Vista:', modoTxt],
    ['Generado:', new Date().toLocaleString('es-CO')],
    [],
    encabezado,
    ...filas,
    filaTotales,
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Filas');
  const fecha = new Date().toISOString().slice(0, 10);
  const nombreLosa = (l.nombre || 'losa').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().replace(/\s+/g, '_');
  XLSX.writeFile(wb, `Losa_${nombreLosa}_${modoTxt.replace(/\s+/g, '_')}_${fecha}.xlsx`);
}

// Fila de avance al pie de la tabla, solo en modo producción (2026-10-15, a pedido del
// usuario: "pongamos al final... una fila de porcentaje de avance, donde el avance y el
// faltante sea ponderado, no por unidad (osea, longitud por unidades)") — pondera cada fila por
// su longitud total (dimensión × cantidad), no por cantidad de piezas sueltas: una fila con
// pocas piezas muy largas pesa en el avance tanto como corresponde a sus metros reales, no
// menos que una fila con muchas piezas cortas.
function _pieAvanceProduccionHTML() {
  // Mismo criterio de "recalcula solo sobre lo filtrado, con señal" que `_pieTotalesHTML()`
  // (2026-10-20, ver su nota) — `null` de `_filasVisiblesFp()` = sin filtro, usa todas.
  const filasVisibles = _filasVisiblesFp();
  const filtroActivo = filasVisibles !== null;
  const filas = filtroActivo ? filasVisibles : _filasLosaActual;
  let totalPonderado = 0, avancePonderado = 0;
  filas.forEach(f => {
    const dim = Number(f.dimension) || 0;
    const cant = Number(f.cantidad) || 0;
    const fabricadas = cant - _pendienteProduccionFila(f);
    totalPonderado += dim * cant;
    avancePonderado += dim * fabricadas;
  });
  const pctAvance = totalPonderado > 0 ? (avancePonderado / totalPonderado) * 100 : 0;
  const pctFaltante = 100 - pctAvance;
  const numCols = document.querySelectorAll('#filas-produccion-thead th').length || 1;
  const badgeFiltro = filtroActivo
    ? ` <span style="font-size:10px;font-weight:700;color:var(--naranja);background:#FFF3E0;padding:2px 7px;border-radius:8px;vertical-align:middle" title="Este avance es solo de las filas que pasan el filtro activo, no de toda la Losa">⚠️ FILTRADO (${filas.length}/${_filasLosaActual.length})</span>`
    : '';
  return `<tr style="background:var(--azul-suave);font-weight:700">
    <td colspan="${numCols}" style="padding:10px;text-align:center;color:var(--azul)">
      📊 Avance de producción (ponderado por longitud): ${pctAvance.toFixed(1)}% avance · ${pctFaltante.toFixed(1)}% faltante${badgeFiltro}
    </td>
  </tr>`;
}
// En modo 'lista' (Ingeniería) las celdas base son editables; en modo 'produccion'
// (Planta/Logística) se muestran de solo lectura — esa zona solo puede REGISTRAR avance
// (🏗️ producción, abajo el botón de despacho), nunca tocar cuadro/dimensión/cantidad, que son
// el insumo que recibe de Ingeniería.
function _filaProduccionHTML(f, i, l, esVigueta) {
  const esPanel = l.sistema === 'paneles_cerramiento';
  const longTotal = (Number(f.dimension) || 0) * (Number(f.cantidad) || 0);
  // m² (2026-10-17, a pedido del usuario) = ancho(m) × largo × cantidad — mismo patrón que
  // "Long. total (m)" (multiplica por cantidad, no es un valor por unidad), para que sumarla
  // en la fila de TOTALES dé directamente los m² reales de toda la Losa. Solo aplica a
  // prelosa/placa alveolar — vigueta no tiene un "ancho" real.
  const m2 = esVigueta ? 0 : (Number(f.ancho) || 0) / 100 * (Number(f.dimension) || 0) * (Number(f.cantidad) || 0);
  const peso = _pesoFila(f, l);
  const pendProd = _pendienteProduccionFila(f);
  const pendDesp = _pendienteDespachoFila(f, _despachosLosaActual);
  const dispDesp = _disponibleDespachoFila(f, _despachosLosaActual);
  // Despachado (2026-10-22, filtro nuevo "Despachado" — ver `TIPOS_FILTRO_PROGRAMAR`) — total
  // ya despachado de esta fila, parcial o completo, sin importar lo que falte.
  const despachado = _despachadoFila(f.id, _despachosLosaActual);
  // Long. total faltante/por despachar (2026-10-22) = unidades faltantes × Dimensión de ESTA
  // fila — todas las piezas de una fila comparten la misma medida, igual que "Long. total (m)".
  const pendProdM = pendProd * (Number(f.dimension) || 0);
  const pendDespM = pendDesp * (Number(f.dimension) || 0);
  const esLista = _MODO_FLUJO_LOSA === 'lista';
  // Candado de medidas ya fabricadas (2026-10-20, a pedido del usuario: "me preocupa que se
  // modifique la lista y se cambie algo que ya está fabricado o despachado... el ancho, largo,
  // cantidad y número de hilos... deberíamos congelar también la fila en la lista de
  // producción, para indicarle a quien vaya a modificar que dicho material ya se fabricó") — en
  // cuanto una fila tiene AL MENOS una unidad fabricada, su ancho/largo/hilos (o
  // Vigueta/Hilos Abajo/Hilos Arriba) quedan de solo lectura en la Lista: ya no hay forma de
  // "arreglarlos" editando, porque lo físico ya existe con esa medida — si de verdad hace falta
  // una medida distinta, se agrega una fila nueva (no se reinterpreta esta). La Cantidad es la
  // ÚNICA de las "importantes" que sigue editable (es normal que cambie el total planeado), con
  // un piso = lo ya fabricado (`_validarCantidadMinima()`, más abajo). Como el ancho/largo/hilos
  // ya no pueden cambiar una vez fabricados, el peso/m² que se calculan siempre en vivo desde la
  // fila (`_pesoFila()`, etc.) dejan de poder "correrse por arte de magia" — no hace falta
  // congelar nada en los registros de producción/despacho aparte, el candado de la Lista ya lo
  // garantiza en el origen.
  const fabricado = _fabricadoFila(f);
  const bloqueado = fabricado > 0;
  const TITULO_BLOQUEO = '🔒 Ya tiene unidades fabricadas — esta medida no se puede modificar. Si necesitas una medida distinta, agrega una fila nueva.';
  const txt = (valor, campo, ancho, candado, sincroniza) => {
    if (esLista && candado && bloqueado) {
      return `<input type="text" value="${_escAttr(valor || '')}" disabled title="${TITULO_BLOQUEO}" style="width:${ancho}px;background:var(--gris-fondo);color:var(--gris-medio);cursor:not-allowed">`;
    }
    return esLista
      ? `<input type="text" value="${_escAttr(valor || '')}" oninput="_filasLosaActual[${i}].${campo}=this.value${sincroniza ? `;_actualizarFilaProduccion(${i})` : ''}" style="width:${ancho}px">`
      : _esc(valor || '—');
  };
  // Sin el "|| 0" en `value` (2026-10-14, a pedido del usuario: "deja todos los campos sin
  // datos, pues algunos están incluyendo ceros de entrada que me dificultan la digitación") —
  // una fila nueva arranca en 0 internamente (ver `agregarFilaProduccion()`), pero el campo se
  // ve vacío hasta que el usuario escribe; `parseFloat(this.value)||0` en el oninput sigue
  // guardando 0 si lo deja vacío, así que el dato no cambia, solo la comodidad de digitar.
  const num = (valor, campo, ancho, recalcula, onchangeExtra, candado) => {
    if (esLista && candado && bloqueado) {
      return `<input type="number" value="${valor || 0}" disabled title="${TITULO_BLOQUEO}" style="width:${ancho}px;background:var(--gris-fondo);color:var(--gris-medio);cursor:not-allowed">`;
    }
    return esLista
      ? `<input type="number" ${campo === 'dimension' ? 'step="0.01"' : ''} value="${valor || ''}" oninput="_filasLosaActual[${i}].${campo}=parseFloat(this.value)||0${recalcula ? `;_actualizarFilaProduccion(${i})` : ''}" ${onchangeExtra ? `onchange="${onchangeExtra}"` : ''} style="width:${ancho}px">`
      : (valor || 0);
  };
  // "Ejes numéricos"/"Ejes alfabéticos" (2026-10-13, a pedido del usuario) — de entrada
  // aparecen como dos cuadros de texto chicos separados por un guion ("(cuadro) - (cuadro)"),
  // en vez de un solo campo de texto libre — coincide con cómo se ve el dato en los Excel
  // reales ("1-1´", "I-G": un eje de inicio y uno de fin), pero sigue guardándose como un solo
  // string (`ejesEntre`/`laterales`, sin cambiar el modelo de datos ni el mapeo de Importar/
  // Pegar, que ya traían ese valor combinado en una sola celda).
  // Anchos de campo ampliados (2026-10-19, reportado por el usuario con una captura real: "no
  // se ve con claridad los números digitados... aparecen cortados" — ej. "50" se veía como
  // "5C", recortado por las flechitas nativas del <input type="number"> en un campo angosto).
  // Junto con quitar esas flechitas (`css/estilos.css`), se les da más aire a los campos más
  // apretados para que un número de 2 cifras quepa cómodo.
  const par = (valor, campo) => {
    if (!esLista) return _esc(valor || '—');
    const idx = (valor || '').indexOf('-');
    const a = idx >= 0 ? valor.slice(0, idx) : (valor || '');
    const b = idx >= 0 ? valor.slice(idx + 1) : '';
    return `<div style="display:flex;align-items:center;gap:2px">
      <input type="text" value="${_escAttr(a)}" oninput="_actualizarParEje(${i},'${campo}',0,this.value)" style="width:28px;text-align:center;padding:4px 2px">
      <span style="color:var(--gris-medio)">-</span>
      <input type="text" value="${_escAttr(b)}" oninput="_actualizarParEje(${i},'${campo}',1,this.value)" style="width:28px;text-align:center;padding:4px 2px">
    </div>`;
  };
  // Paneles de Cerramiento (2026-10-29) — Clasificación antepuesta a las medidas (a pedido del
  // usuario), y los dos largos (`largoA`/`largoB`) en vez de una sola "Dimensión" editable:
  // `dimension` pasa a ser un valor DERIVADO (promedio de los dos, ver `_sincronizarLargosPanel()`),
  // así que para Panel esa columna se muestra de solo lectura (celda `fp-dimension-${i}`,
  // repintada por `_actualizarFilaProduccion()`), nunca como `<input>` editable directo — editar
  // el promedio a mano no tendría cómo repartirse de vuelta entre los dos largos reales.
  const selClasif = (valor) => {
    const opciones = CLASIFICACIONES_PANEL.map(c => `<option value="${c.clave}" ${c.clave === valor ? 'selected' : ''}>${c.etiqueta}</option>`).join('');
    if (esLista && bloqueado) {
      return `<select disabled title="${TITULO_BLOQUEO}" style="width:118px;padding:4px;background:var(--gris-fondo);color:var(--gris-medio)">${opciones}</select>`;
    }
    return esLista
      ? `<select onchange="_filasLosaActual[${i}].clasificacion=this.value;_sincronizarLargosPanel(${i})" style="width:118px;padding:4px;border:1px solid var(--gris-borde);border-radius:4px">${opciones}</select>`
      : _etiquetaClasificacionPanel(valor);
  };
  const largoNum = (valor, campo, deshabilitado) => {
    if (esLista && bloqueado) {
      return `<input type="number" value="${valor || 0}" disabled title="${TITULO_BLOQUEO}" style="width:50px;background:var(--gris-fondo);color:var(--gris-medio);cursor:not-allowed">`;
    }
    if (!esLista) return _esc(valor != null && valor !== '' ? valor : '—');
    if (deshabilitado) {
      return `<input type="number" value="${valor || 0}" disabled title="Se copia automáticamente de Largo A — solo editable si la clasificación es 'cuchilla'" style="width:50px;background:var(--gris-fondo);color:var(--gris-medio);cursor:not-allowed">`;
    }
    return `<input type="number" step="0.01" value="${valor || ''}" oninput="_filasLosaActual[${i}].${campo}=parseFloat(this.value)||0;_sincronizarLargosPanel(${i})" style="width:50px">`;
  };
  return `<tr data-cuadro="${_escAttr(f.cuadro || '')}" data-eje-num="${_escAttr(f.ejesEntre || '')}" data-eje-alfa="${_escAttr(f.laterales || '')}" data-ancho="${f.ancho || 0}" data-hilos="${f.hilos || 0}" data-dimension="${f.dimension || 0}" data-clasificacion="${_escAttr(f.clasificacion || '')}" data-fabricado="${fabricado}" data-pend-prod="${pendProd}" data-pend-desp="${pendDesp}" data-disponible="${dispDesp}" data-despachado="${despachado}">
    <td>${i + 1}</td>
    <td>${txt(f.cuadro, 'cuadro', 48, false, true)}</td>
    <td>${par(f.ejesEntre, 'ejesEntre')}</td>
    <td>${par(f.laterales, 'laterales')}</td>
    ${esVigueta ? `
    <td>${txt(f.tipoVigueta, 'tipoVigueta', 54, true)}</td>
    <td>${num(f.hilosAbajo, 'hilosAbajo', 44, false, '', true)}</td>
    <td>${num(f.hilosArriba, 'hilosArriba', 44, false, '', true)}</td>
    ` : esPanel ? `
    <td>${selClasif(f.clasificacion)}</td>
    <td>${num(f.ancho, 'ancho', 54, true, `_validarAnchoPanel(${i})`, true)}</td>
    <td>${largoNum(f.largoA, 'largoA', false)}</td>
    <td id="fp-largob-${i}">${largoNum(f.largoB, 'largoB', !_esClasificacionCuchilla(f.clasificacion))}</td>
    ` : `
    <td>${num(f.ancho, 'ancho', 54, true, l.sistema === 'prelosa' ? `_validarAnchoPrelosa(${i})` : '', true)}</td>
    <td>${num(f.hilos, 'hilos', 44, true, '', true)}</td>
    `}
    ${esPanel
      ? `<td id="fp-dimension-${i}" style="text-align:right">${(Number(f.dimension) || 0).toFixed(2)}</td>`
      : `<td>${num(f.dimension, 'dimension', 58, true, '', true)}</td>`}
    <td>${num(f.cantidad, 'cantidad', 50, true, `_validarCantidadMinima(${i})`)}</td>
    <td id="fp-longtotal-${i}" style="text-align:right">${longTotal.toFixed(2)}</td>
    ${esVigueta ? '' : `<td id="fp-m2-${i}" style="text-align:right">${m2.toFixed(2)}</td>`}
    <td id="fp-peso-${i}" style="text-align:right">${peso.toFixed(1)}</td>
    ${esLista ? '' : (_MODO_FLUJO_LOSA === 'produccion'
      ? `<td style="text-align:right">${(Number(f.cantidad) || 0) - pendProd}</td><td id="fp-pendprod-${i}" style="text-align:right;font-weight:600;color:${pendProd > 0 ? 'var(--naranja)' : 'var(--verde)'}">${pendProd}</td><td id="fp-pendprodm-${i}" style="text-align:right;font-weight:600;color:${pendProd > 0 ? 'var(--naranja)' : 'var(--verde)'}">${pendProdM.toFixed(2)}</td>`
      : `<td id="fp-dispdesp-${i}" style="text-align:right;font-weight:600;color:${dispDesp > 0 ? 'var(--verde)' : 'var(--gris-medio)'}">${dispDesp}</td><td id="fp-penddesp-${i}" style="text-align:right;font-weight:600;color:${pendDesp > 0 ? 'var(--naranja)' : 'var(--verde)'}">${pendDesp}</td><td id="fp-penddespm-${i}" style="text-align:right;font-weight:600;color:${pendDesp > 0 ? 'var(--naranja)' : 'var(--verde)'}">${pendDespM.toFixed(2)}</td>`)}
    <td>${txt(f.observaciones, 'observaciones', 90)}</td>
    <td style="white-space:nowrap">
      ${esLista
        ? (bloqueado
          ? `<span title="${TITULO_BLOQUEO}" style="cursor:help">🔒</span>`
          : `<button class="btn btn-rojo btn-xs" onclick="_filasLosaActual.splice(${i},1);renderFilasProduccion()">✕</button>`)
        : ''}
    </td>
  </tr>`;
}
// Estandarización de ancho de prelosa (2026-10-16, a pedido del usuario: "el ancho del elemento
// no se debe salir de 20 30 40 o 50cm por estandarización... no puede ser menos, no puede ser
// mas ni puede ser intermedio") — esta es la validación "en caliente" al terminar de escribir
// (onchange, no oninput — para no interrumpir a mitad de tecleo); el bloqueo real que cubre
// también Pegar/Importar vive en `guardarListaProduccion()`, más abajo.
const ANCHOS_ESTANDAR_PRELOSA = [20, 30, 40, 50];
function _validarAnchoPrelosa(i) {
  const f = _filasLosaActual[i];
  if (!f || !f.ancho) return; // 0/vacío: el usuario puede seguir escribiendo, no interrumpir
  if (!ANCHOS_ESTANDAR_PRELOSA.includes(Number(f.ancho))) {
    alert(`El ancho de la prelosa debe ser 20, 30, 40 o 50 cm por estandarización — no se admiten medidas intermedias. Corrige el ancho de la fila "Cuadro ${f.cuadro || i + 1}".`);
    f.ancho = 0;
    renderFilasProduccion();
  }
}
// Paneles de Cerramiento (2026-10-29) — anchos estándar 25 y 50 cm (corregidos por el usuario;
// el espesor, 4 u 8 cm, se valida a nivel de la Unidad completa, ver `guardarLosa()`, no por
// fila). Mismo patrón exacto de `_validarAnchoPrelosa()`.
const ANCHOS_ESTANDAR_PANEL = [25, 50];
const ESPESORES_ESTANDAR_PANEL = [4, 8];
function _validarAnchoPanel(i) {
  const f = _filasLosaActual[i];
  if (!f || !f.ancho) return;
  if (!ANCHOS_ESTANDAR_PANEL.includes(Number(f.ancho))) {
    alert(`El ancho de un panel debe ser 25 o 50 cm por estandarización — no se admiten medidas intermedias. Corrige el ancho de la fila "Cuadro ${f.cuadro || i + 1}".`);
    f.ancho = 0;
    renderFilasProduccion();
  }
}
// Piso de Cantidad = lo ya fabricado (2026-10-20, a pedido del usuario: "la cantidad... la
// respuesta es que la editemos hasta el piso de lo ya fabricado") — a diferencia de
// ancho/largo/hilos (bloqueados del todo una vez hay fabricación, ver `_filaProduccionHTML()`),
// la Cantidad sí sigue editable después de fabricar algo: es normal que cambie el total
// planeado (agregar o quitar unidades) sin que eso tenga nada que ver con las que ya se
// hicieron — pero nunca puede quedar por debajo de lo que ya existe físicamente. Validación "en
// caliente" (onchange); el bloqueo real que cubre también Pegar/Importar vive en
// `guardarListaProduccion()`, más abajo.
function _validarCantidadMinima(i) {
  const f = _filasLosaActual[i];
  if (!f) return;
  const fabricado = _fabricadoFila(f);
  if (fabricado > 0 && (Number(f.cantidad) || 0) < fabricado) {
    alert(`La cantidad no puede quedar por debajo de ${fabricado}, que es lo que ya se fabricó del cuadro "${f.cuadro || i + 1}".`);
    f.cantidad = fabricado;
    renderFilasProduccion();
  }
}

// Actualización quirúrgica (solo las celdas calculadas) al cambiar ancho/dimensión/cantidad —
// mismo motivo que `_actualizarFilaDespieceAcero()` en Costeo de Producto: un render completo
// en cada tecla destruye el <input> que se está escribiendo y hace perder el foco a mitad de
// un decimal (bug real ya corregido una vez ahí, mismo riesgo acá).
function _actualizarFilaProduccion(i) {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  const f = _filasLosaActual[i];
  if (!l || !f) return;
  const esVigueta = l.sistema === 'vigueta_bovedilla';
  const esPanel = l.sistema === 'paneles_cerramiento';
  const longTotal = (Number(f.dimension) || 0) * (Number(f.cantidad) || 0);
  const m2 = esVigueta ? 0 : (Number(f.ancho) || 0) / 100 * (Number(f.dimension) || 0) * (Number(f.cantidad) || 0);
  const peso = _pesoFila(f, l);
  const pendProd = _pendienteProduccionFila(f);
  const pendDesp = _pendienteDespachoFila(f, _despachosLosaActual);
  const dispDesp = _disponibleDespachoFila(f, _despachosLosaActual);
  // Long. total faltante/por despachar en metros (2026-10-22, ver nota en `_filaProduccionHTML()`).
  const pendProdM = pendProd * (Number(f.dimension) || 0);
  const pendDespM = pendDesp * (Number(f.dimension) || 0);
  const elLong = document.getElementById(`fp-longtotal-${i}`); if (elLong) elLong.textContent = longTotal.toFixed(2);
  const elM2 = document.getElementById(`fp-m2-${i}`); if (elM2) elM2.textContent = m2.toFixed(2);
  const elPeso = document.getElementById(`fp-peso-${i}`); if (elPeso) elPeso.textContent = peso.toFixed(1);
  const elPP = document.getElementById(`fp-pendprod-${i}`); if (elPP) { elPP.textContent = pendProd; elPP.style.color = pendProd > 0 ? 'var(--naranja)' : 'var(--verde)'; }
  const elPPM = document.getElementById(`fp-pendprodm-${i}`); if (elPPM) { elPPM.textContent = pendProdM.toFixed(2); elPPM.style.color = pendProd > 0 ? 'var(--naranja)' : 'var(--verde)'; }
  const elDD = document.getElementById(`fp-dispdesp-${i}`); if (elDD) { elDD.textContent = dispDesp; elDD.style.color = dispDesp > 0 ? 'var(--verde)' : 'var(--gris-medio)'; }
  const elPD = document.getElementById(`fp-penddesp-${i}`); if (elPD) { elPD.textContent = pendDesp; elPD.style.color = pendDesp > 0 ? 'var(--naranja)' : 'var(--verde)'; }
  const elPDM = document.getElementById(`fp-penddespm-${i}`); if (elPDM) { elPDM.textContent = pendDespM.toFixed(2); elPDM.style.color = pendDesp > 0 ? 'var(--naranja)' : 'var(--verde)'; }
  // Paneles de Cerramiento (2026-10-29) — "Dimensión" es derivada (promedio de largoA/largoB,
  // ver `_sincronizarLargosPanel()`), así que necesita repintarse acá igual que Long. total/m²/
  // Peso; Largo B necesita repintar la CELDA completa (no solo el texto), porque su estado
  // habilitado/deshabilitado cambia según la Clasificación elegida.
  if (esPanel) {
    const elDim = document.getElementById(`fp-dimension-${i}`);
    if (elDim) elDim.textContent = (Number(f.dimension) || 0).toFixed(2);
    const elLargoB = document.getElementById(`fp-largob-${i}`);
    if (elLargoB) {
      const esCuchilla = _esClasificacionCuchilla(f.clasificacion);
      elLargoB.innerHTML = esCuchilla
        ? `<input type="number" step="0.01" value="${f.largoB || ''}" oninput="_filasLosaActual[${i}].largoB=parseFloat(this.value)||0;_sincronizarLargosPanel(${i})" style="width:50px">`
        : `<input type="number" value="${f.largoB || 0}" disabled title="Se copia automáticamente de Largo A — solo editable si la clasificación es 'cuchilla'" style="width:50px;background:var(--gris-fondo);color:var(--gris-medio);cursor:not-allowed">`;
    }
  }
  // Filtros (2026-10-20) — mientras se edita una fila en Lista (Cuadro/Ejes/Ancho/Hilos, los
  // mismos campos que ofrece el filtro), el `data-*` del `<tr>` que lee `_aplicarFiltrosProgramar()`
  // quedaría desactualizado sin esto (esta función solo toca celdas puntuales, nunca reconstruye
  // el `<tr>` completo — así no se pierde el foco a mitad de tecleo). Se sincroniza acá, en el
  // único lugar que ya corre en cada edición relevante, y se reaplica el filtro de inmediato por
  // si la fila deja de cumplir (o empieza a cumplir) con lo que se tecleó. A PROPÓSITO antes de
  // refrescar el pie de TOTALES/avance (más abajo): esos dos ahora recalculan solo sobre las
  // filas visibles cuando hay un filtro activo (2026-10-20, ver nota junto a `_pieTotalesHTML()`)
  // — si se refrescaran antes de sincronizar el dataset, usarían el estado de ESTA fila
  // desactualizado un instante.
  const tr = document.getElementById(`fp-longtotal-${i}`)?.closest('tr');
  if (tr) {
    tr.dataset.cuadro = f.cuadro || '';
    tr.dataset.ejeNum = f.ejesEntre || '';
    tr.dataset.ejeAlfa = f.laterales || '';
    tr.dataset.ancho = f.ancho || 0;
    tr.dataset.hilos = f.hilos || 0;
    tr.dataset.dimension = f.dimension || 0;
    tr.dataset.clasificacion = f.clasificacion || '';
    // Fabricado no cambia por editar esta fila (depende de fila.produccion[], no de lo
    // planeado) — pero pendiente/disponible SÍ dependen de Cantidad, que es la única de las
    // "importantes" que sigue editable incluso ya fabricada (ver candado más arriba).
    tr.dataset.fabricado = _fabricadoFila(f);
    tr.dataset.pendProd = pendProd;
    tr.dataset.pendDesp = pendDesp;
    tr.dataset.disponible = dispDesp;
    // Despachado tampoco cambia por editar esta fila (depende de `losa.despachos[]`, no de lo
    // planeado) — se sincroniza igual, mismo criterio que Fabricado.
    tr.dataset.despachado = _despachadoFila(f.id, _despachosLosaActual);
  }
  // La fila de TOTALES depende de TODAS las filas, no solo de esta — `_aplicarFiltrosProgramar('fp')`
  // ya la refresca por dentro (ver esa función), así que no hace falta repetirlo acá; sigue sin
  // tocar el <tbody>, así no se pierde el foco de ningún input a mitad de tecleo.
  _aplicarFiltrosProgramar('fp');
}

// Paneles de Cerramiento (2026-10-29) — único punto de entrada que mantiene Largo A/Largo B/
// Dimensión consistentes entre sí, llamado desde el oninput de Largo A, el oninput de Largo B y
// el onchange de Clasificación (ver `_filaProduccionHTML()`). Si la clasificación NO es
// "cuchilla" (Panel/Dintel/Antepecho), Largo B siempre copia a Largo A — no hay dos largos
// reales que guardar. `dimension` = promedio de los dos, la fórmula exacta del volumen de un
// trapecio (ancho constante, altura variando linealmente entre los dos largos) — es el único
// campo que el resto del código (peso, Long. total, filtro "Largo de pieza", resumen por
// medidas, impresos, Excel) necesita conocer; ningún otro lugar se entera de que hay 2 largos,
// salvo el cálculo de ocupación de banco/cinta, que a propósito usa el MÁXIMO en vez del
// promedio (ver `_metrosPorAnchoProgramar()`, más abajo — instrucción explícita del usuario).
function _sincronizarLargosPanel(i) {
  const f = _filasLosaActual[i];
  if (!f) return;
  if (!_esClasificacionCuchilla(f.clasificacion)) f.largoB = f.largoA;
  f.dimension = ((Number(f.largoA) || 0) + (Number(f.largoB) || 0)) / 2;
  _actualizarFilaProduccion(i);
}

// Recompone el valor combinado ("1-1´", "I-G"...) de Ejes numéricos/Ejes alfabéticos a partir
// de los dos cuadros de texto chicos — `parte` 0 = antes del guion, 1 = después.
function _actualizarParEje(i, campo, parte, valor) {
  const f = _filasLosaActual[i];
  if (!f) return;
  const actual = f[campo] || '';
  const idx = actual.indexOf('-');
  const a = idx >= 0 ? actual.slice(0, idx) : actual;
  const b = idx >= 0 ? actual.slice(idx + 1) : '';
  const nuevaA = parte === 0 ? valor : a;
  const nuevaB = parte === 1 ? valor : b;
  f[campo] = (nuevaA || nuevaB) ? `${nuevaA}-${nuevaB}` : '';
  _actualizarFilaProduccion(i);
}

function agregarFilaProduccion() {
  _filasLosaActual.push({ id: _nuevoIdFila(), cuadro: '', ejesEntre: '', laterales: '', ancho: 0, hilos: 0, tipoVigueta: '', hilosAbajo: 0, hilosArriba: 0, clasificacion: 'panel', largoA: 0, largoB: 0, dimension: 0, cantidad: 0, observaciones: '', produccion: [] });
  renderFilasProduccion();
}

// (b) Pegar desde Excel — columnas en el mismo orden que la tabla visible: Cuadro, Ejes
// numéricos, Ejes alfabéticos, [Ancho, Hilos] o [Vigueta, Hilos Abajo, Hilos Arriba], Dimensión,
// Cantidad (ver nota en la pantalla). El valor de cada celda de ejes sigue siendo un solo texto
// combinado (ej. "1-1´"), igual que en el Excel real — el guion se separa solo al mostrarlo
// en los dos cuadros chicos (ver `par()` en `_filaProduccionHTML`).
// Excel en configuración regional en español copia los decimales con COMA ("3,5") en vez de
// punto — `parseFloat()` de JS se detiene en la coma y pierde el decimal (`parseFloat("3,5")`
// da 3, no 3.5) — 2026-10-20, reportado por el usuario: "cuando intento pegar un cuadro de
// excel... los decimales vienen con comas y al pegarlo solo queda el entero sin los decimales".
// Para los campos de esta pantalla (dimensión en metros, ancho en cm, cantidad y conteos de
// hilos) nunca hace falta un separador de miles, así que basta con tratar la coma como
// separador decimal. Usado tanto en Pegar como en Importar Excel/CSV — ahí el problema es
// menos común (SheetJS suele traer los números ya parseados), pero una celda de texto o un CSV
// exportado en español puede traer la misma coma.
function _parseFloatEs(valor) {
  return parseFloat(String(valor ?? '').trim().replace(',', '.')) || 0;
}
function onPasteFilasProduccion(event) {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (!l) return;
  const texto = (event.clipboardData || window.clipboardData).getData('text');
  if (!texto || !texto.trim()) return;
  event.preventDefault();
  const esVigueta = l.sistema === 'vigueta_bovedilla';
  const filas = texto.split(/\r?\n/).filter(r => r.trim() !== '').map(linea => {
    const cols = linea.split('\t');
    const base = { id: _nuevoIdFila(), cuadro: cols[0] || '', ejesEntre: cols[1] || '', laterales: cols[2] || '', observaciones: '', produccion: [] };
    if (esVigueta) {
      return { ...base, tipoVigueta: cols[3] || '', hilosAbajo: _parseFloatEs(cols[4]), hilosArriba: _parseFloatEs(cols[5]), dimension: _parseFloatEs(cols[6]), cantidad: _parseFloatEs(cols[7]), ancho: 0, hilos: 0 };
    }
    return { ...base, ancho: _parseFloatEs(cols[3]), hilos: _parseFloatEs(cols[4]), dimension: _parseFloatEs(cols[5]), cantidad: _parseFloatEs(cols[6]), tipoVigueta: '', hilosAbajo: 0, hilosArriba: 0 };
  });
  _filasLosaActual = _filasLosaActual.concat(filas);
  renderFilasProduccion();
  alert(`Se agregaron ${filas.length} fila(s) pegadas. Revísalas en la tabla y guarda cuando estén correctas.`);
}

// (c) Importar archivo Excel/CSV — reusa SheetJS (ya cargado en la app) y `_normHdr()`
// (js/catalogo.js, ya usado para el import de Catálogo) para mapear columnas por nombre de
// encabezado, tolerante a mayúsculas/tildes — sirve directo con los Excel reales de la
// empresa (mismos encabezados vistos en Boreal/SYMA: CUADRO, DIMENSIONES, CANTIDAD...).
function abrirImportarFilasExcel() { document.getElementById('input-importar-filas').click(); }
function onSeleccionImportarFilas(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (typeof XLSX === 'undefined') { alert('La librería de Excel no cargó. Verifica tu conexión.'); return; }
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (!l) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      // La fila de encabezados no siempre es la primera (algunos de estos Excel reales traen
      // un título arriba, ej. "BOREAL PLANTA 1...") — se busca la primera fila que tenga "CUADRO".
      let filaHdr = aoa.findIndex(r => r.map(c => _normHdr(c)).includes('cuadro'));
      if (filaHdr < 0) filaHdr = 0;
      const hdr = aoa[filaHdr].map(_normHdr);
      const col = (claves) => hdr.findIndex(h => claves.includes(h));
      const ci = {
        ejesEntre: col(['ejesentre']), laterales: col(['laterales', 'literales']), cuadro: col(['cuadro']),
        ancho: col(['anchoprelosa', 'ancho']), hilos: col(['hilos']),
        tipoVigueta: col(['vigueta']), hilosAbajo: col(['hilosabajo']), hilosArriba: col(['hilosarriba']),
        dimension: col(['dimensiones', 'dimension', 'nuevadimension']),
        cantidad: col(['cantidad', 'cantidadporlosa', 'cantidadnueva']),
        observaciones: col(['observacionesparaobra', 'observaciones']),
      };
      if (ci.cuadro < 0 || ci.dimension < 0 || ci.cantidad < 0) {
        alert('El archivo debe tener al menos las columnas "Cuadro", "Dimensiones" y "Cantidad".');
        return;
      }
      const nuevas = [];
      for (let i = filaHdr + 1; i < aoa.length; i++) {
        const r = aoa[i];
        const cuadro = String(r[ci.cuadro] ?? '').trim();
        const dimension = _parseFloatEs(r[ci.dimension]);
        const cantidad = _parseFloatEs(r[ci.cantidad]);
        if (!cuadro && !dimension && !cantidad) continue;
        nuevas.push({
          id: _nuevoIdFila(),
          ejesEntre: ci.ejesEntre >= 0 ? String(r[ci.ejesEntre] ?? '').trim() : '',
          laterales: ci.laterales >= 0 ? String(r[ci.laterales] ?? '').trim() : '',
          cuadro,
          ancho: ci.ancho >= 0 ? _parseFloatEs(r[ci.ancho]) : 0,
          hilos: ci.hilos >= 0 ? _parseFloatEs(r[ci.hilos]) : 0,
          tipoVigueta: ci.tipoVigueta >= 0 ? String(r[ci.tipoVigueta] ?? '').trim() : '',
          hilosAbajo: ci.hilosAbajo >= 0 ? _parseFloatEs(r[ci.hilosAbajo]) : 0,
          hilosArriba: ci.hilosArriba >= 0 ? _parseFloatEs(r[ci.hilosArriba]) : 0,
          dimension, cantidad,
          observaciones: ci.observaciones >= 0 ? String(r[ci.observaciones] ?? '').trim() : '',
          produccion: [],
        });
      }
      if (!nuevas.length) { alert('No se encontró ninguna fila válida en el archivo.'); return; }
      _filasLosaActual = _filasLosaActual.concat(nuevas);
      renderFilasProduccion();
      alert(`Se importaron ${nuevas.length} fila(s). Revísalas en la tabla y guarda cuando estén correctas.`);
    } catch (err) {
      console.error('Error importando filas:', err);
      alert('No se pudo leer el archivo — revisa que sea un Excel/CSV válido.');
    }
  };
  reader.readAsArrayBuffer(file);
}

// Solo descarta filas 100% vacías — igual criterio que `guardarDespieceAcero()` en Costeo de
// Producto, para no perder una fila a medio llenar si se captura columna por columna.
function guardarListaProduccion() {
  _filasLosaActual = _filasLosaActual.filter(f =>
    (f.ejesEntre || '').trim() || (f.cuadro || '').trim() || (f.dimension || 0) > 0 || (f.cantidad || 0) > 0
  );
  // Bloqueo real de ancho estandarizado de prelosa (2026-10-16) — cubre Pegar/Importar además
  // de la digitación manual (que ya avisa al vuelo en `_validarAnchoPrelosa()`), para que no se
  // cuele una medida intermedia por ninguna de las 3 vías de carga.
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (l && l.sistema === 'prelosa') {
    const invalidas = _filasLosaActual.filter(f => !ANCHOS_ESTANDAR_PRELOSA.includes(Number(f.ancho)));
    if (invalidas.length) {
      alert(`El ancho de la prelosa debe ser 20, 30, 40 o 50 cm por estandarización. Corrige el ancho de: ${invalidas.map(f => f.cuadro || '(sin cuadro)').join(', ')}.`);
      return;
    }
  }
  // Mismo bloqueo, anchos propios de Paneles (2026-10-29).
  if (l && l.sistema === 'paneles_cerramiento') {
    const invalidas = _filasLosaActual.filter(f => !ANCHOS_ESTANDAR_PANEL.includes(Number(f.ancho)));
    if (invalidas.length) {
      alert(`El ancho de un panel debe ser 25 o 50 cm por estandarización. Corrige el ancho de: ${invalidas.map(f => f.cuadro || '(sin cuadro)').join(', ')}.`);
      return;
    }
  }
  // Bloqueo real de medidas ya fabricadas (2026-10-20) — cubre Pegar/Importar y cualquier otra
  // vía que mute `_filasLosaActual` directo, además de la UI de solo lectura de
  // `_filaProduccionHTML()` (que ya evita que se puedan tocar a mano). Compara contra la
  // ÚLTIMA versión persistida de la Losa (`l.filas`, no lo que haya en memoria), para detectar
  // si un campo bloqueado de verdad cambió en esta sesión de edición.
  if (l) {
    const esVigueta = l.sistema === 'vigueta_bovedilla';
    const esPanel = l.sistema === 'paneles_cerramiento';
    const camposBloqueados = esVigueta
      ? ['dimension', 'tipoVigueta', 'hilosAbajo', 'hilosArriba']
      : esPanel
        ? ['dimension', 'ancho', 'clasificacion', 'largoA', 'largoB']
        : ['dimension', 'ancho', 'hilos'];
    const ETIQUETA_CAMPO = { dimension: 'largo', ancho: 'ancho', hilos: 'número de hilos', tipoVigueta: 'tipo de vigueta', hilosAbajo: 'hilos abajo', hilosArriba: 'hilos arriba', clasificacion: 'clasificación', largoA: 'largo A', largoB: 'largo B' };
    const originales = l.filas || [];
    for (const f of _filasLosaActual) {
      const fabricado = _fabricadoFila(f);
      if (fabricado <= 0) continue;
      if ((Number(f.cantidad) || 0) < fabricado) {
        alert(`El cuadro "${f.cuadro || '—'}" ya tiene ${fabricado} unidad(es) fabricada(s) — la cantidad no puede quedar por debajo de eso.`);
        return;
      }
      const original = originales.find(x => x.id === f.id);
      if (!original) continue;
      const campoCambiado = camposBloqueados.find(c => String(f[c] ?? '') !== String(original[c] ?? ''));
      if (campoCambiado) {
        alert(`El cuadro "${f.cuadro || '—'}" ya tiene ${fabricado} unidad(es) fabricada(s) — no se puede cambiar su ${ETIQUETA_CAMPO[campoCambiado]}. Si necesitas una medida distinta, agrega una fila nueva con la medida correcta.`);
        return;
      }
    }
    // Una fila ya fabricada no puede desaparecer de la lista (por ejemplo, al pegar un bloque
    // que reemplace filas existentes) — perdería el historial de producción/despacho que vive
    // adentro de ella.
    const idsActuales = new Set(_filasLosaActual.map(f => f.id));
    const borradaConHistorial = originales.find(f => !idsActuales.has(f.id) && _fabricadoFila(f) > 0);
    if (borradaConHistorial) {
      alert(`El cuadro "${borradaConHistorial.cuadro || '—'}" ya tiene unidades fabricadas y no puede eliminarse de la lista.`);
      return;
    }
  }
  _guardarLosaActual();
  renderFilasProduccion();
  alert('Lista de producción guardada.');
}

// Genera el PDF con el mismo membrete (cabecera repetida + pie con arco/datos de contacto) y la
// misma paginación con corte en fila blanca que el resto de documentos oficiales — mismo
// cuerpo exacto que `descargarFormatoProduccionAjuste()` (js/calidad-ajuste-mezcla.js). Usado
// por `descargarPDFProgramacionProduccion()` — queda factorizado aparte por si otro imprimible
// con membrete lo necesita más adelante (ya sirvió para la Lista de Producción completa, que se
// quitó el 2026-10-16 al quedar redundante con el imprimible de la programación del día).
async function _descargarPDFConMembrete(contentElId, footerElId, nombreArchivo, btnId) {
  const btn = document.getElementById(btnId);
  if (btn) { btn.textContent = '⏳ Generando...'; btn.disabled = true; }
  try {
    const { jsPDF } = window.jspdf;
    const pageW = 210, pageH = 297;

    const topImg = await cargarImagen('membrete-top.jpg');
    const headerH = pageW * (topImg.naturalHeight / topImg.naturalWidth);

    const contentEl = document.getElementById(contentElId);
    const contentCanvas = await html2canvas(contentEl, { scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false });
    const pxToMm = pageW / contentCanvas.width;
    const contentH_px = _alturaContenidoReal(contentCanvas);

    const footerEl = document.getElementById(footerElId);
    const footerCanvas = await html2canvas(footerEl, { scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false });
    const footerH = footerCanvas.height * pxToMm;

    const availH = pageH - headerH - footerH - 6;
    const pageH_px = availH / pxToMm;

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const footerData = footerCanvas.toDataURL('image/jpeg', 0.95);

    let cursorY = 0, pageIndex = 0, guard = 0;
    while (cursorY < contentH_px - 1 && guard < 60) {
      guard++;
      let bottom = Math.min(contentH_px, cursorY + pageH_px);
      if (bottom < contentH_px) bottom = _filaBlancaCerca(contentCanvas, Math.floor(bottom), cursorY + pageH_px * 0.55);
      const sliceH_px = bottom - cursorY;
      if (sliceH_px <= 1) break;

      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(topImg, 'JPEG', 0, 0, pageW, headerH);

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = contentCanvas.width;
      sliceCanvas.height = Math.ceil(sliceH_px);
      sliceCanvas.getContext('2d').drawImage(
        contentCanvas, 0, Math.floor(cursorY),
        contentCanvas.width, Math.ceil(sliceH_px),
        0, 0, contentCanvas.width, Math.ceil(sliceH_px)
      );
      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, headerH + 2, pageW, sliceH_px * pxToMm);
      pdf.addImage(footerData, 'JPEG', 0, pageH - footerH, pageW, footerH);

      cursorY = bottom;
      pageIndex++;
    }

    pdf.save(nombreArchivo);
  } finally {
    if (btn) { btn.textContent = '⬇️ Descargar PDF'; btn.disabled = false; }
  }
}
// Persiste la Losa completa (filas + despachos + bovedilla + producciones programadas) de una
// sola vez — mismo criterio que el resto de la app: un solo upsert del registro completo, nunca
// escrituras parciales.
function _guardarLosaActual() {
  const idx = LOSAS_PROYECTO.findIndex(x => x.id === _LOSA_ACTIVA_ID);
  if (idx < 0) return;
  const l = { ...LOSAS_PROYECTO[idx], filas: _filasLosaActual, despachos: _despachosLosaActual, bovedilla: _bovedillaLosaActual, produccionesProgramadas: _programacionesLosaActual, despachosProgramados: _despachosProgramadosLosaActual };
  LOSAS_PROYECTO[idx] = l;
  sb.from('losas_proyecto').upsert({ id: l.id, datos: l, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) { console.error('Error guardando losa:', error.message); alert('No se pudo guardar: ' + error.message); } });
}

// ── Control de Producción — flujo de dos pasos (2026-10-15, a pedido del usuario, reemplaza el
// registro rápido por fila que había antes): "+ Programar producción" arma el lote de lo que se
// va a fabricar (qué filas, cuánto); "+ Cargar producción" confirma, línea por línea, lo que
// REALMENTE se fabricó frente a lo programado — "de esta entrada es que ingresamos la
// producción", es la única puerta de entrada a `fila.produccion[]`. Mismo molde que
// `despachos[]`: un lote con `lineas[]` que referencian cada fila por `filaId`, precargado solo
// con las filas que tienen saldo pendiente.
// `programacionId` opcional (2026-10-21, a pedido del usuario: "metamos otro cuadro
// intermedio... donde incluyamos las producciones programadas. de esta manera podemos hacer
// varias programaciones, editarlas e imprimirlas luego de su programación inicial") — si se
// pasa, reabre este mismo modal en modo EDICIÓN sobre una programación ya guardada (ver
// `editarProgramacionProduccion()`), precargando fecha/observaciones/cantidades ya digitadas en
// vez de arrancar en blanco. Sin el parámetro, se comporta exactamente igual que siempre (nueva
// programación). Las filas que se ofrecen siguen siendo las de saldo pendiente de producción —
// una programación todavía sin cargar NO resta nada del pendiente (eso solo lo hace
// `fila.produccion[]`, que se alimenta en "+ Cargar producción"), así que no hace falta ninguna
// lógica especial para "liberar" lo que esta programación ya traía reservado.
function abrirModalProgramarProduccion(programacionId) {
  const editando = programacionId ? _programacionesLosaActual.find(x => x.id === programacionId) : null;
  document.getElementById('mpp-id').value = editando ? editando.id : '';
  document.getElementById('modal-programar-produccion-titulo').textContent = editando ? '✏️ Editar programación de producción' : '📋 Programar producción';
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  const esVigueta = !!l && l.sistema === 'vigueta_bovedilla';
  const esPanel = !!l && l.sistema === 'paneles_cerramiento';
  const conPendiente = _filasLosaActual.filter(f => _pendienteProduccionFila(f) > 0);
  document.getElementById('mpp-fecha').value = editando ? (editando.fecha || _fmtISO(new Date())) : _fmtISO(new Date());
  document.getElementById('mpp-observaciones').value = editando ? (editando.observaciones || '') : '';
  document.getElementById('mpp-filtros-lista').innerHTML = '';
  // Encabezado dinámico: columnas de ancho/hilos cambian según el sistema, igual que la tabla
  // principal (ver nota junto a las columnas más abajo). Paneles de Cerramiento (2026-10-29)
  // muestra Clasificación/Ancho/Largo A/Largo B, de solo lectura — mismo criterio.
  document.getElementById('mpp-filas-thead').innerHTML = `<tr>
    <th style="width:28px"><input type="checkbox" onchange="_marcarTodasFilasProgramar(this.checked)"></th>
    <th>Cuadro</th><th>Ejes num.</th><th>Ejes alfa.</th>
    ${esVigueta
      ? '<th>Vigueta</th><th>Hilos Abajo</th><th>Hilos Arriba</th>'
      : esPanel
        ? '<th>Clasif.</th><th>Ancho (cm)</th><th>Largo A</th><th>Largo B</th>'
        : '<th>Ancho (cm)</th><th>Hilos</th>'}
    <th>Dimensión</th><th>Pendiente</th><th>A programar</th>
  </tr>`;
  const tbody = document.getElementById('mpp-filas-body');
  const colspanVacio = esVigueta ? 10 : esPanel ? 11 : 9;
  if (!conPendiente.length) {
    tbody.innerHTML = `<tr><td colspan="${colspanVacio}" style="text-align:center;color:var(--gris-medio);padding:10px">No hay filas con saldo pendiente de producción.</td></tr>`;
  } else {
    // Casilla a la izquierda (2026-10-15, a pedido del usuario: "pueda seleccionar una fila, y
    // automáticamente se programen las cantidades pendientes de esa fila, pues por lo general
    // siempre se funden juntas") — marcar la fila precarga "A programar" con el pendiente
    // completo; desmarcarla lo vuelve a dejar en 0. El campo sigue editable a mano aparte, por
    // si se quiere programar solo una parte. Los `data-*` alimentan los filtros de abajo (2026-
    // 10-15, a pedido del usuario: "hagamos que pueda uno seleccionar el tipo de filtro a
    // aplicar" — cuadro, ejes numéricos/alfabéticos, ancho, hilos). `oninput` recalcula el
    // resumen de bancos (2026-10-19, ver `_actualizarResumenBancosProgramar()`).
    // Columnas "Ejes num."/"Ejes alfa." (2026-10-19, a pedido del usuario: "agreguemos
    // nuevamente los ejes numéricos y alfabéticos en el cuadro que se abre de programación de
    // despachos y de producción") y "Ancho"/"Hilos" (o "Vigueta"/"Hilos Abajo"/"Hilos Arriba",
    // 2026-10-22, a pedido del usuario: "incluyamos las filas de ancho y número de hilos") — de
    // solo lectura, mismo valor crudo que ya alimenta los filtros (`data-eje-num`/`data-eje-alfa`/
    // `data-ancho`/`data-hilos`), para poder verificar a simple vista qué cuadro cae en qué eje
    // y qué medida tiene sin tener que adivinar — importante sobre todo para distinguir a mano
    // los "bancos de producción de prelosa" (dos anchos como mucho por programación, ver
    // `_topeMetrosBanco()`).
    tbody.innerHTML = conPendiente.map(f => {
      const pend = _pendienteProduccionFila(f);
      const lineaExistente = editando ? (editando.lineas || []).find(l2 => l2.filaId === f.id) : null;
      const valorInicial = lineaExistente ? lineaExistente.cantidadProgramada : 0;
      const colEspecifica = esVigueta
        ? `<td>${_esc(f.tipoVigueta) || '—'}</td><td style="text-align:center">${f.hilosAbajo || 0}</td><td style="text-align:center">${f.hilosArriba || 0}</td>`
        : esPanel
          ? `<td>${_etiquetaClasificacionPanel(f.clasificacion)}</td><td style="text-align:center">${f.ancho || 0}</td><td style="text-align:right">${(Number(f.largoA) || 0).toFixed(2)} m</td><td style="text-align:right">${(Number(f.largoB) || 0).toFixed(2)} m</td>`
          : `<td style="text-align:center">${f.ancho || 0}</td><td style="text-align:center">${f.hilos || 0}</td>`;
      return `<tr data-cuadro="${_escAttr(f.cuadro || '')}" data-eje-num="${_escAttr(f.ejesEntre || '')}" data-eje-alfa="${_escAttr(f.laterales || '')}" data-ancho="${f.ancho || 0}" data-hilos="${f.hilos || 0}" data-dimension="${f.dimension || 0}" data-clasificacion="${_escAttr(f.clasificacion || '')}" data-fabricado="${_fabricadoFila(f)}" data-pend-prod="${pend}" data-pend-desp="${_pendienteDespachoFila(f, _despachosLosaActual)}" data-disponible="${_disponibleDespachoFila(f, _despachosLosaActual)}" data-despachado="${_despachadoFila(f.id, _despachosLosaActual)}">
        <td><input type="checkbox" class="mpp-chk-fila" onchange="_marcarFilaProgramar(this)"></td>
        <td>${_esc(f.cuadro || '')}</td>
        <td>${_esc(f.ejesEntre) || '—'}</td>
        <td>${_esc(f.laterales) || '—'}</td>
        ${colEspecifica}
        <td>${f.dimension || 0} m</td>
        <td>${pend}</td>
        <td><input type="number" min="0" max="${pend}" value="${valorInicial}" data-fila-id="${_escAttr(f.id)}" data-pendiente="${pend}" oninput="_actualizarResumenBancosProgramar()" style="width:70px"></td>
      </tr>`;
    }).join('');
  }
  document.getElementById('modal-programar-produccion').classList.add('abierto');
  _actualizarResumenBancosProgramar();
}
function _marcarFilaProgramar(checkbox) {
  const input = checkbox.closest('tr').querySelector('input[data-fila-id]');
  if (input) input.value = checkbox.checked ? input.dataset.pendiente : 0;
  _actualizarResumenBancosProgramar();
}
// Bancos de producción de prelosa (2026-10-19, a pedido del usuario: "los bancos de producción
// de prelosa son dos cintas de 96 metros útiles por cinta. Lo más común es programar un banco
// (las dos cintas) de 50cm de ancho... en otras ocasiones se programa una cinta de 50cm y otra
// de 20, 30 o 40cm... condicionemos para que sean máximo 96 metros por cinta, en función del
// ancho. Programemos también para que se puedan programar solo dos anchos") — cada cinta
// fabrica un único ancho a la vez, y como mucho 2 anchos distintos en toda la programación del
// día (una cinta por ancho). Solo aplica a PRELOSA — Placa Alveolar y Vigueta y Bovedilla no se
// fabrican en estas cintas, el usuario habló específicamente de "bancos de producción de
// prelosa".
// **Tope por ancho, corregido (2026-10-20, a pedido del usuario: "estamos limitando a 96
// metros que es lo de una cinta, pero en realidad debe ser eso por 2, en el caso que se
// programe todo de 50cm de ancho, o todo de 40 o 30 o 20")** — el tope de 96 m es por CINTA,
// no por ancho: si el día se programa con un solo ancho, ese ancho usa las 2 cintas completas
// (96×2 = 192 m); si se programan 2 anchos distintos, cada uno usa solo UNA cinta (96 m cada
// uno, porque una cinta no se puede repartir entre dos anchos a la vez). `_topeMetrosBanco()`
// calcula el tope según cuántos anchos distintos hay en ese momento en la programación.
// Tope por cinta subido de 96 a 98 m útiles (2026-10-20, a pedido del usuario: "modifiquemos la
// programación de los bancos a 98 metros por cinta, 196 metros de prelosa por banco (dos
// cintas)" — confirmado que el "196" es 98×2, mismo modelo de siempre, solo cambia la cifra).
const BANCO_PRELOSA_METROS_UTILES = 98;
const BANCO_PRELOSA_NUM_CINTAS = 2;
const BANCO_PRELOSA_MAX_ANCHOS = 2;
// Paneles de Cerramiento (2026-10-29, a pedido del usuario: "se hacen en los mismos bancos de
// pretensado, por lo que tendrían las mismas condiciones"; y al preguntar los números reales:
// "mismo numero de la prelosa, por siempre a no ser que lo corrijamos") — mismo valor hoy, pero
// constantes INDEPENDIENTES a propósito, para poder ajustar una sin tocar la otra más adelante.
const BANCO_PANEL_METROS_UTILES = 98;
const BANCO_PANEL_NUM_CINTAS = 2;
const BANCO_PANEL_MAX_ANCHOS = 2;
// Único punto que sabe qué sistema tiene tope de bancos y con qué números — `null` = sin tope
// (Vigueta/Placa Alveolar). Generaliza `_topeMetrosBanco()`/`_metrosPorAnchoProgramar()`/
// `_actualizarResumenBancosProgramar()`/la validación de `guardarProgramacionProduccion()` para
// que sirvan igual en Prelosa y en Paneles sin duplicar ninguna de esas 4 funciones.
function _configBancoSistema(sistema) {
  if (sistema === 'prelosa') return { metrosUtiles: BANCO_PRELOSA_METROS_UTILES, numCintas: BANCO_PRELOSA_NUM_CINTAS, maxAnchos: BANCO_PRELOSA_MAX_ANCHOS };
  if (sistema === 'paneles_cerramiento') return { metrosUtiles: BANCO_PANEL_METROS_UTILES, numCintas: BANCO_PANEL_NUM_CINTAS, maxAnchos: BANCO_PANEL_MAX_ANCHOS };
  return null;
}
function _topeMetrosBanco(cantidadAnchos, cfg) {
  return cantidadAnchos <= 1 ? cfg.metrosUtiles * cfg.numCintas : cfg.metrosUtiles;
}
// Metros de ocupación por ancho de lo que se está programando AHORA en el modal — para Paneles,
// el usuario pidió explícitamente usar el MÁXIMO de los dos largos de cada pieza cuchilla, no el
// promedio (`dimension`, que sí es correcto para peso/Long. total — ver `_sincronizarLargosPanel()`):
// "debes hacer los cálculos de ocupación del banco o la cinta con el más largo" — el molde/la
// cinta reserva espacio físico según el lado más largo de la pieza, sin importar que el otro
// lado sea más corto.
function _metrosPorAnchoProgramar(prefijo) {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  const esPanel = !!l && l.sistema === 'paneles_cerramiento';
  const porAncho = new Map();
  document.querySelectorAll(`#${prefijo}-filas-body input[data-fila-id]`).forEach(inp => {
    const cantidad = parseFloat(inp.value) || 0;
    if (cantidad <= 0) return;
    const f = _filasLosaActual.find(x => x.id === inp.dataset.filaId);
    if (!f) return;
    const ancho = Number(f.ancho) || 0;
    const largo = esPanel ? Math.max(Number(f.largoA) || 0, Number(f.largoB) || 0) : (Number(f.dimension) || 0);
    const metros = largo * cantidad;
    porAncho.set(ancho, (porAncho.get(ancho) || 0) + metros);
  });
  return porAncho;
}
function _actualizarResumenBancosProgramar() {
  const cont = document.getElementById('mpp-resumen-bancos');
  if (!cont) return;
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  const cfg = l && _configBancoSistema(l.sistema);
  if (!cfg) { cont.innerHTML = ''; return; }
  const porAncho = _metrosPorAnchoProgramar('mpp');
  if (!porAncho.size) { cont.innerHTML = ''; return; }
  const anchos = Array.from(porAncho.keys()).sort((a, b) => a - b);
  const excesoAnchos = anchos.length > cfg.maxAnchos;
  const tope = _topeMetrosBanco(anchos.length, cfg);
  const filasHTML = anchos.map(a => {
    const m = porAncho.get(a);
    const excedido = m > tope;
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;padding:2px 0;color:${excedido ? 'var(--rojo)' : 'var(--gris-texto)'}">
      <span>${a} cm${anchos.length <= 1 ? ` (${cfg.numCintas} cintas)` : ' (1 cinta)'}</span>
      <span style="display:flex;align-items:center;gap:6px">
        <span style="font-weight:700">${m.toFixed(2)} / ${tope} m${excedido ? ' ⚠️' : ''}</span>
        <button type="button" title="Quitar el ancho ${a} cm de esta programación (incluye filas escondidas por el filtro)" onclick="_quitarAnchoProgramar(${a})" style="border:none;background:none;color:var(--gris-medio);cursor:pointer;font-size:13px;line-height:1;padding:0 2px">✕</button>
      </span>
    </div>`;
  }).join('');
  cont.innerHTML = `<div style="margin:4px 0 8px;padding:8px 10px;background:var(--gris-fondo);border-radius:var(--radio)">
    <div style="font-size:11px;font-weight:700;color:var(--gris-medio);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Bancos de producción (${cfg.numCintas} cintas de ${cfg.metrosUtiles} m c/u)</div>
    ${filasHTML}
    ${excesoAnchos ? `<div style="font-size:11.5px;color:var(--rojo);font-weight:600;margin-top:4px">⚠️ Solo se pueden programar ${cfg.maxAnchos} anchos distintos por día (una cinta por ancho) — hay ${anchos.length}.</div>` : ''}
  </div>`;
}
// Quita de la programación todas las cantidades de un ancho específico (2026-10-16, a pedido
// del usuario: el filtro de la tabla esconde filas que ya tienen una cantidad puesta, y esa
// cantidad sigue contando para el tope de bancos aunque no se vea en pantalla — caso real: el
// usuario filtró por "ancho 50", programó 100.80 m, y el sistema igual lo bloqueó porque una
// fila de ancho 40 escondida por el filtro tenía 8.76 m puestos de antes, sin que se notara).
// Pone en 0 el "A programar" y desmarca el checkbox de TODAS las filas de ese ancho, estén o no
// visibles bajo el filtro actual (usa el `data-ancho` del propio `<tr>`, no el filtro), para
// poder deshacer un ancho que no se quería incluir sin tener que ir a cazarlo a mano.
function _quitarAnchoProgramar(ancho) {
  document.querySelectorAll('#mpp-filas-body tr[data-ancho]').forEach(tr => {
    if (Number(tr.dataset.ancho) !== ancho) return;
    const inp = tr.querySelector('input[data-fila-id]');
    if (inp) inp.value = 0;
    const chk = tr.querySelector('.mpp-chk-fila');
    if (chk) chk.checked = false;
  });
  _actualizarResumenBancosProgramar();
}
// "Marcar todas" solo actúa sobre las filas visibles — si hay un filtro de rango de cuadro
// activo, respeta ese recorte (coincide con lo que el usuario está viendo, no con la lista
// completa escondida detrás del filtro).
function _marcarTodasFilasProgramar(marcar) {
  document.querySelectorAll('#mpp-filas-body tr').forEach(tr => {
    if (tr.style.display === 'none') return;
    const chk = tr.querySelector('.mpp-chk-fila');
    if (!chk) return;
    chk.checked = marcar;
    _marcarFilaProgramar(chk);
  });
}
// Filtros por tipo, combinables (2026-10-15, a pedido del usuario: "hagamos que pueda uno
// seleccionar el tipo de filtro a aplicar... permite agregar filtros adicionales, de forma
// tal que pueda yo por ejemplo acotar entre ejes A y C y ejes 3 y 4... o entre los cuadros 10
// al 30, de 50cm de ancho") — reemplaza el filtro fijo de "Desde/Hasta cuadro" (en proyectos
// grandes, Boreal real tuvo 247 filas en una sola Losa) por una lista de filtros que el
// usuario arma a su gusto, cada uno de un tipo distinto, combinados con Y (una fila solo se ve
// si pasa TODOS los filtros activos a la vez). Compartido tal cual entre Programar producción
// (prefijo 'mpp') y Programar despacho ('mpd'). Oculta filas con display:none en vez de volver
// a renderizar la tabla, para no perder cantidades ya digitadas en filas fuera del filtro.
// "Ancho de prelosa"/"Número de hilos" solo aparecen si el sistema no es vigueta (esos campos
// no existen ahí) y usan un solo desplegable de VALOR EXACTO (`soloValorUnico`, 2026-10-19, a
// pedido del usuario: "se nos debe habilitar solamente una casilla para las opciones de número
// de hilos y ancho, que sea un desplegable con los anchos y número de hilos que hay disponibles
// en la lista") — a diferencia de Desde/Hasta, son valores estandarizados (20/30/40/50cm, pocos
// hilos distintos), así que elegir de una lista de los que de verdad existen en esta Losa evita
// escribir un número que no aplica a ningún cuadro. Ejes numéricos/alfabéticos: el valor de la
// fila ya es en sí un RANGO ("1-2", "A-B" — ver `par()` en `_filaProduccionHTML`); "pasa el
// filtro" si ese rango queda CONTENIDO dentro del rango pedido (2026-10-19, corregido — antes
// pasaba con que solo se CRUZARAN, y el usuario reportó el bug real: "cuando aplico los
// filtros de los ejes numéricos y alfabéticos, me está mostrando cuadros que no pertenecen a
// dichos ejes" — un cuadro que va de eje 2 a eje 5 ya NO aparece al filtrar "entre eje 3 y 4",
// porque se sale de ese rango; solo entran cuadros cuyo rango completo cae adentro, igual
// criterio que ya usan cuadro/ancho/hilos — más consistente y menos sorprendente).
// "Fabricado"/"Pendiente de producción"/"Pendiente de despacho"/"Disponible para despacho"
// (2026-10-20, a pedido del usuario: "agreguemos los filtros de pendientes y fabricado") — a
// diferencia de ancho/hilos (pocos valores estandarizados, desplegable de valor exacto), estas
// cantidades pueden ser cualquier número entre 0 y la cantidad total de la fila, así que usan
// el mismo Desde/Hasta que ya tenían cuadro/ejes (sin marca especial — caen por defecto en la
// rama Desde/Hasta de `_filtroValorAreaHTML()`). Disponibles en los TRES lugares que comparten
// `TIPOS_FILTRO_PROGRAMAR` (modales Programar producción/despacho y el cuadro principal de cada
// Losa, prefijo `fp`) y en AMBOS sistemas (a diferencia de ancho/hilos, vigueta sí tiene
// pendiente/fabricado/disponible — lo que no tiene es un "ancho" real).
const TIPOS_FILTRO_PROGRAMAR = [
  { id: 'cuadro', label: 'Entre cuadros' },
  { id: 'ejeNum', label: 'Entre ejes numéricos' },
  { id: 'ejeAlfa', label: 'Entre ejes alfabéticos' },
  // `sistemas` (2026-10-29 — reemplaza a `soloConAncho`, que ya no alcanzaba con 4 sistemas:
  // "Ancho" sí debe verse en Paneles (tiene ancho real 25/50cm) pero "Número de hilos" NO (no
  // existe ese campo ahí) — un booleano de 2 vías no distingue eso) — lista explícita de
  // sistemas donde el tipo aplica; sin `sistemas`, disponible en los 4 (como Cuadro/Ejes/
  // "Largo de pieza"/los 5 de estado). Etiqueta de "ancho" ya no dice "de prelosa" — hace
  // tiempo que también lo comparte Placa Alveolar, y ahora Paneles.
  { id: 'ancho', label: 'Ancho', soloValorUnico: true, sistemas: ['prelosa', 'placa_alveolar', 'paneles_cerramiento'] },
  { id: 'hilos', label: 'Número de hilos', soloValorUnico: true, sistemas: ['prelosa', 'placa_alveolar'] },
  // Paneles de Cerramiento (2026-10-29) — mismo mecanismo `soloValorUnico` (desplegable con los
  // valores reales presentes), pero de TEXTO en vez de número — ver `_valoresDisponiblesFiltro()`/
  // `_filaPasaFiltroProgramar()`, generalizados para aceptar ambos tipos de valor.
  { id: 'clasificacion', label: 'Clasificación', soloValorUnico: true, sistemas: ['paneles_cerramiento'] },
  // "Largo de pieza" (2026-10-27, a pedido del usuario: "agreguemos el filtro a los cuadros de
  // las ventanas de proyectos... de largo de la pieza para los diferentes sistemas") — mismo
  // mecanismo exacto que Ancho/Hilos (desplegable con los valores de `f.dimension` que de
  // verdad existen en esta Losa, `soloValorUnico`), pero sin `sistemas`: a diferencia de
  // Ancho/Hilos, `dimension` SÍ existe igual en los 4 sistemas — "para los diferentes sistemas"
  // en las propias palabras del usuario.
  { id: 'dimension', label: 'Largo de pieza', soloValorUnico: true },
  // `soloPrefijos` (2026-10-22, a pedido del usuario: "en los modales de programar no
  // deberíamos mostrar solamente lo faltante?... en programación de producción, solo deberíamos
  // mostrar lo pendiente de producción, y en programación de despachos, solo deberíamos mostrar
  // lo pendiente de despacho") — estos 5 tipos "de estado" (a diferencia de Cuadro/Ejes/Ancho/
  // Hilos, que son posición/medida, siempre relevantes) solo tienen sentido como FILTRO
  // ADICIONAL en el cuadro principal (`fp`, que muestra TODAS las filas sin importar su
  // estado). Dentro de los modales de Programar, la lista de filas YA está pre-filtrada en el
  // origen a lo único que tiene sentido programar ahí — `conPendiente` en
  // `abrirModalProgramarProduccion()` (solo `_pendienteProduccionFila(f) > 0`) y `conDisponible`
  // en `abrirModalProgramarDespacho()` (solo `_disponibleDespachoFila(f, ...) > 0`) — así que
  // ofrecer ahí un filtro de estado sería o redundante (ej. "Pendiente de producción" en `mpp`
  // sería siempre Sí, porque la lista entera ya lo es) o directamente contrario al propósito del
  // modal (ej. "Despachado" ahí invita a programar algo que ya salió). Sin `soloPrefijos` =
  // disponible en los 3 (`fp`/`mpp`/`mpd`), como Cuadro/Ejes/Ancho/Hilos.
  { id: 'fabricado', label: 'Fabricado', soloSiNo: true, soloPrefijos: ['fp'] },
  { id: 'pendProd', label: 'Pendiente de producción', soloSiNo: true, soloPrefijos: ['fp'] },
  { id: 'pendDesp', label: 'Pendiente de despacho', soloSiNo: true, soloPrefijos: ['fp'] },
  { id: 'disponible', label: 'Disponible para despacho', soloSiNo: true, soloPrefijos: ['fp'] },
  { id: 'despachado', label: 'Despachado', soloSiNo: true, soloPrefijos: ['fp'] },
];
// Tipos "Sí/No" — se aplican directo al elegir el TIPO en la lista, sin un segundo desplegable
// (corregido 2026-10-22, a pedido del usuario: "no está funcionando los últimos 4 filtros" →
// al investigar resultó que SÍ filtraban bien técnicamente, pero el usuario esperaba que elegir
// "Fabricado" en la lista ya mostrara las piezas fabricadas directo, sin tener que elegir
// ADEMÁS "Sí" en un segundo desplegable — "es claro el nombre del filtro", y confirmó que cada
// uno debe mostrar "las piezas [fabricadas/pendientes/disponibles] (totales y parciales por
// renglón)" apenas se elige, sin una opción "No" — a diferencia del primer intento (2026-10-20)
// que sí tenía un desplegable Sí/No/Todos, este ya no lo necesita: el nombre del tipo ES el
// criterio completo (mayor a 0), y quitar el filtro (botón "✕") es la única forma de volver a
// "Todos" para este criterio. El id de cada tipo coincide a propósito con la clave del dataset
// (`tr.dataset[tipo]`, vía `data-pend-prod`/`data-pend-desp` → `pendProd`/`pendDesp` en
// camelCase automático del DOM) para no necesitar un mapeo aparte.
const TIPOS_FILTRO_SI_NO = ['fabricado', 'pendProd', 'pendDesp', 'disponible', 'despachado'];
// Generalizado para texto (2026-10-29, "Clasificación" de Paneles) — hasta ahora todo tipo
// `soloValorUnico` (Ancho/Hilos/Largo de pieza) era numérico; `clasificacion` guarda una clave
// de texto (`f.clasificacion`, ej. "panel_cuchilla"), que `Number()` siempre convierte a NaN.
function _valoresDisponiblesFiltro(tipo) {
  const set = new Set();
  _filasLosaActual.forEach(f => {
    const raw = f[tipo];
    const v = Number(raw);
    if (!isNaN(v) && v !== 0) { set.add(v); return; }
    if (typeof raw === 'string' && raw.trim()) set.add(raw);
  });
  return Array.from(set).sort((a, b) => typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)));
}
function _filtroValorAreaHTML(tipo, prefijo) {
  const t = TIPOS_FILTRO_PROGRAMAR.find(x => x.id === tipo);
  if (t && t.soloValorUnico) {
    const valores = _valoresDisponiblesFiltro(tipo);
    const opciones = valores.map(v => `<option value="${v}">${tipo === 'clasificacion' ? _etiquetaClasificacionPanel(v) : v}</option>`).join('');
    return `<select data-rol="valor" onchange="_aplicarFiltrosProgramar('${prefijo}')" style="width:170px;padding:6px;border:1px solid var(--gris-borde);border-radius:var(--radio);font-size:12px">
      <option value="">Todos</option>${opciones}
    </select>`;
  }
  if (t && t.soloSiNo) {
    // Sin segundo desplegable (2026-10-22, ver nota en `TIPOS_FILTRO_SI_NO`) — el tipo ya
    // elegido en el primer `<select>` es el criterio completo, este span es solo confirmación
    // visual de que el filtro quedó activo.
    return `<span style="font-size:11px;color:var(--verde);padding:6px 4px;white-space:nowrap">✓ filtro aplicado</span>`;
  }
  const esAlfa = tipo === 'ejeAlfa';
  return `<input type="${esAlfa ? 'text' : 'number'}" placeholder="Desde" data-rol="desde" oninput="_aplicarFiltrosProgramar('${prefijo}')" style="width:80px;padding:6px;border:1px solid var(--gris-borde);border-radius:var(--radio)">
    <input type="${esAlfa ? 'text' : 'number'}" placeholder="Hasta" data-rol="hasta" oninput="_aplicarFiltrosProgramar('${prefijo}')" style="width:80px;padding:6px;border:1px solid var(--gris-borde);border-radius:var(--radio)">`;
}
function _filaFiltroProgramarHTML(prefijo, sistema) {
  const opciones = TIPOS_FILTRO_PROGRAMAR
    .filter(t => !t.soloPrefijos || t.soloPrefijos.includes(prefijo))
    .filter(t => !t.sistemas || t.sistemas.includes(sistema))
    .map(t => `<option value="${t.id}">${t.label}</option>`).join('');
  return `<div class="filtro-programar-fila" style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
    <select data-tipo onchange="_cambiarTipoFiltroProgramar(this,'${prefijo}')" style="flex:1;padding:6px;border:1px solid var(--gris-borde);border-radius:var(--radio);font-size:12px">${opciones}</select>
    <span class="filtro-valor-area" style="display:flex;gap:6px">${_filtroValorAreaHTML('cuadro', prefijo)}</span>
    <button type="button" class="btn btn-rojo btn-xs" onclick="this.closest('.filtro-programar-fila').remove();_aplicarFiltrosProgramar('${prefijo}')">✕</button>
  </div>`;
}
function _agregarFiltroProgramar(prefijo) {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  document.getElementById(`${prefijo}-filtros-lista`).insertAdjacentHTML('beforeend', _filaFiltroProgramarHTML(prefijo, l?.sistema));
}
function _cambiarTipoFiltroProgramar(select, prefijo) {
  select.closest('.filtro-programar-fila').querySelector('.filtro-valor-area').innerHTML = _filtroValorAreaHTML(select.value, prefijo);
  _aplicarFiltrosProgramar(prefijo);
}
function _parRangoFiltro(valor, numerico) {
  const idx = (valor || '').indexOf('-');
  const a = (idx >= 0 ? valor.slice(0, idx) : (valor || '')).trim();
  const b = (idx >= 0 ? valor.slice(idx + 1) : '').trim();
  const pa = numerico ? parseFloat(a) : a.toUpperCase();
  const pb = numerico ? parseFloat(b) : b.toUpperCase();
  const va = numerico ? !isNaN(pa) : !!pa;
  const vb = numerico ? !isNaN(pb) : !!pb;
  if (!va && !vb) return null;
  if (!vb) return [pa, pa];
  if (!va) return [pb, pb];
  return pa <= pb ? [pa, pb] : [pb, pa];
}
function _filaPasaFiltroProgramar(tr, filtro) {
  const { tipo, desde, hasta, valorUnico } = filtro;
  // Generalizado a cualquier tipo `soloValorUnico` (2026-10-27, antes hardcodeado a
  // `tipo === 'ancho' || tipo === 'hilos'` — se agregó "Largo de pieza" con el mismo mecanismo,
  // sin tener que volver a listar su id acá) — el id del tipo siempre coincide con la clave del
  // dataset (`data-dimension` → `dataset.dimension`), mismo criterio que los demás.
  const tDef = TIPOS_FILTRO_PROGRAMAR.find(t => t.id === tipo);
  if (tDef && tDef.soloValorUnico) {
    // Texto o número (2026-10-29, "Clasificación" de Paneles es de texto) — si `valorUnico` ya
    // es un número (Ancho/Hilos/Largo de pieza), compara numérico como siempre; si no, compara
    // el dataset crudo tal cual (string contra string).
    const raw = tr.dataset[tipo];
    if (typeof valorUnico === 'number') {
      const v = parseFloat(raw);
      return !isNaN(v) && v === valorUnico;
    }
    return raw === valorUnico;
  }
  // Contra un único `data-*` numérico (ver `TIPOS_FILTRO_SI_NO`, mismo id de tipo que la clave
  // del dataset) — elegir el tipo ya significa "mayor a 0" (2026-10-22, ya no hay un "No"
  // seleccionable, ver nota junto a `TIPOS_FILTRO_SI_NO`).
  if (TIPOS_FILTRO_SI_NO.includes(tipo)) {
    const v = parseFloat(tr.dataset[tipo]);
    return !isNaN(v) && v > 0;
  }
  if (tipo === 'cuadro') {
    const v = parseFloat(tr.dataset.cuadro);
    return !isNaN(v) && (desde == null || v >= desde) && (hasta == null || v <= hasta);
  }
  const rango = _parRangoFiltro(tipo === 'ejeNum' ? tr.dataset.ejeNum : tr.dataset.ejeAlfa, tipo === 'ejeNum');
  if (!rango) return false;
  // CONTENIDO dentro del rango pedido, no solo cruzado (ver nota más arriba) — el rango de la
  // fila debe caer completo adentro de [desde, hasta].
  return (desde == null || rango[0] >= desde) && (hasta == null || rango[1] <= hasta);
}
// Arma (sin aplicar todavía) la lista de criterios activos de un set de filtros — extraído de
// `_aplicarFiltrosProgramar()` (2026-10-20) para poder preguntar "¿hay algún filtro configurado
// ahora mismo?" desde otros lugares, como `_pieTotalesHTML()`/`_pieAvanceProduccionHTML()` (ver
// nota ahí: recalculan solo sobre las filas visibles cuando esto no viene vacío).
function _filtrosProgramarActivos(prefijo) {
  return Array.from(document.querySelectorAll(`#${prefijo}-filtros-lista .filtro-programar-fila`)).map(fila => {
    const tipo = fila.querySelector('[data-tipo]').value;
    const t = TIPOS_FILTRO_PROGRAMAR.find(x => x.id === tipo);
    if (t && t.soloValorUnico) {
      const valorRaw = fila.querySelector('[data-rol="valor"]').value;
      if (valorRaw === '') return { tipo, valorUnico: null };
      // Texto o número (2026-10-29, ver nota en `_filaPasaFiltroProgramar()`) — "Clasificación"
      // llega como clave de texto (ej. "panel_cuchilla"), que `parseFloat()` no sabe convertir.
      const num = parseFloat(valorRaw);
      return { tipo, valorUnico: isNaN(num) ? valorRaw : num };
    }
    // Sin `<select>` de valor que leer (2026-10-22) — elegir el tipo en la lista YA es el
    // criterio completo, siempre activo mientras esta fila de filtro exista.
    if (t && t.soloSiNo) return { tipo, siNo: 'si' };
    const esAlfa = tipo === 'ejeAlfa';
    const desdeRaw = fila.querySelector('[data-rol="desde"]').value.trim();
    const hastaRaw = fila.querySelector('[data-rol="hasta"]').value.trim();
    return {
      tipo,
      desde: desdeRaw === '' ? null : (esAlfa ? desdeRaw.toUpperCase() : parseFloat(desdeRaw)),
      hasta: hastaRaw === '' ? null : (esAlfa ? hastaRaw.toUpperCase() : parseFloat(hastaRaw)),
    };
  }).filter(f => f.desde != null || f.hasta != null || f.valorUnico != null || f.siNo != null);
}
function _aplicarFiltrosProgramar(prefijo) {
  const filtros = _filtrosProgramarActivos(prefijo);
  document.querySelectorAll(`#${prefijo}-filas-body tr[data-cuadro]`).forEach(tr => {
    tr.style.display = filtros.every(f => _filaPasaFiltroProgramar(tr, f)) ? '' : 'none';
  });
  // Bug real reportado (2026-10-22, "no me está funcionando los subtotales de los cuadros
  // cuando filtro"): esta función (disparada por cada tecla/cambio en los campos del filtro,
  // ver `_filtroValorAreaHTML()`) solo escondía/mostraba filas — nunca refrescaba el pie de
  // TOTALES/avance, que solo se recalculaba en un `renderFilasProduccion()` completo (guardar,
  // cargar, agregar fila...) o en `_actualizarFilaProduccion()` (editar una fila). Filtrar
  // escribiendo en los campos del filtro no pasa por NINGUNO de esos dos caminos, así que el
  // pie se quedaba con los totales de antes de filtrar — el filtro "visualmente" escondía filas
  // bien, pero el aviso ⚠️ FILTRADO (ver `_pieTotalesHTML()`) y los números de abajo nunca
  // llegaban a reflejarlo. Solo aplica al cuadro principal (prefijo `fp` — los modales `mpp`/
  // `mpd` no tienen un pie de TOTALES equivalente, sus resúmenes de bancos/peso ya se
  // actualizan aparte, desde el `oninput` de cada cantidad, sin depender del filtro).
  if (prefijo === 'fp') {
    const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
    const tfoot = document.getElementById('filas-produccion-tfoot');
    if (l && tfoot) {
      const esProduccion = _MODO_FLUJO_LOSA === 'produccion';
      tfoot.innerHTML = _pieTotalesHTML(l) + (esProduccion ? _pieAvanceProduccionHTML() : '');
    }
  }
}
// Subconjunto de `_filasLosaActual` que pasa el filtro activo del cuadro principal (prefijo
// `fp`) — `null` cuando no hay ningún filtro configurado (ver `_filtrosProgramarActivos()`),
// para que quien llame pueda distinguir "sin filtro, usa todas las filas" de "con filtro, 0
// filas pasan" (que sí es un resultado válido, no lo mismo que "sin filtro"). Recalcula
// `_filaPasaFiltroProgramar()` directo contra cada `<tr>` en vez de leer `tr.style.display` —
// así no depende de que `_aplicarFiltrosProgramar('fp')` ya se haya corrido antes en esta misma
// pasada (orden que sí importaba cuando esto se agregó, ver nota en `_actualizarFilaProduccion()`).
function _filasVisiblesFp() {
  const filtros = _filtrosProgramarActivos('fp');
  if (!filtros.length) return null;
  const trs = document.querySelectorAll('#fp-filas-body tr[data-cuadro]');
  return _filasLosaActual.filter((f, i) => trs[i] && filtros.every(ft => _filaPasaFiltroProgramar(trs[i], ft)));
}
function guardarProgramacionProduccion() {
  const fecha = document.getElementById('mpp-fecha').value;
  if (!fecha) { alert('Elige una fecha.'); return; }
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  const inputs = document.querySelectorAll('#mpp-filas-body input[data-fila-id]');
  const lineas = [];
  inputs.forEach(inp => {
    const cantidadProgramada = parseFloat(inp.value) || 0;
    if (cantidadProgramada > 0) lineas.push({ filaId: inp.dataset.filaId, cantidadProgramada, cantidadReal: null });
  });
  if (!lineas.length) { alert('Ingresa al menos una cantidad a programar.'); return; }
  // Tope duro de bancos (2026-10-19, generalizado 2026-10-29 para Paneles de Cerramiento —
  // mismo tope, constantes propias, ver `_configBancoSistema()`) — mismo cálculo que
  // `_actualizarResumenBancosProgramar()`, pero recalculado contra `lineas` (lo que de verdad se
  // va a guardar) en vez de confiar en lo que se veía en pantalla.
  const cfgBanco = l && _configBancoSistema(l.sistema);
  if (cfgBanco) {
    const esPanel = l.sistema === 'paneles_cerramiento';
    const porAncho = new Map();
    lineas.forEach(ln => {
      const f = _filasLosaActual.find(x => x.id === ln.filaId);
      if (!f) return;
      const ancho = Number(f.ancho) || 0;
      // Ocupación con el largo MÁS LARGO en piezas cuchilla, no el promedio (2026-10-29,
      // instrucción explícita del usuario — ver nota en `_metrosPorAnchoProgramar()`).
      const largo = esPanel ? Math.max(Number(f.largoA) || 0, Number(f.largoB) || 0) : (Number(f.dimension) || 0);
      const metros = largo * ln.cantidadProgramada;
      porAncho.set(ancho, (porAncho.get(ancho) || 0) + metros);
    });
    if (porAncho.size > cfgBanco.maxAnchos) {
      alert(`Solo se pueden programar ${cfgBanco.maxAnchos} anchos distintos por día (una cinta por ancho) — esta programación tiene ${porAncho.size}: ${Array.from(porAncho.keys()).sort((a, b) => a - b).join(', ')} cm. Quita cantidades de alguno de los anchos antes de guardar.`);
      return;
    }
    const tope = _topeMetrosBanco(porAncho.size, cfgBanco);
    for (const [ancho, metros] of porAncho) {
      if (metros > tope) {
        const explicacion = porAncho.size <= 1
          ? `usa las ${cfgBanco.numCintas} cintas completas (${cfgBanco.numCintas} × ${cfgBanco.metrosUtiles} = ${tope} m)`
          : `solo tiene disponible 1 cinta de ${cfgBanco.metrosUtiles} m útiles (hay otro ancho programado ese día, cada uno usa una sola cinta)`;
        alert(`El ancho ${ancho} cm suma ${metros.toFixed(2)} m, pero ${explicacion} — reduce las cantidades programadas de ese ancho antes de guardar.`);
        return;
      }
    }
  }
  // Edita in-situ si `#mpp-id` trae una programación existente (ver
  // `abrirModalProgramarProduccion(programacionId)`/`editarProgramacionProduccion()`), en vez
  // de crear una nueva — ninguna línea de esa programación puede tener `cantidadReal` todavía
  // (si lo tuviera, ya no aparecería en la tarjeta "Producciones programadas" desde donde se
  // llega a editar), así que reconstruir `lineas` desde cero acá es seguro.
  const editId = document.getElementById('mpp-id').value;
  const observaciones = document.getElementById('mpp-observaciones').value.trim();
  if (editId) {
    const idx = _programacionesLosaActual.findIndex(x => x.id === editId);
    if (idx >= 0) _programacionesLosaActual[idx] = { ..._programacionesLosaActual[idx], fecha, observaciones, lineas };
  } else {
    _programacionesLosaActual.push({ id: String(Date.now()), fecha, observaciones, lineas });
  }
  _guardarLosaActual();
  cerrarModal('modal-programar-produccion');
  renderProduccionProgramada();
  alert(editId ? 'Programación de producción actualizada.' : 'Producción programada guardada. Cuando se fabrique, regístrala con "+ Cargar producción".');
}

// Imprimible de la PROGRAMACIÓN (2026-10-15, a pedido del usuario: "la idea es poder imprimir
// lo que se espera producir, osea la programación de producción que damos con el primer botón"
// — vive dentro del propio modal "+ Programar producción", a la misma altura de "Guardar
// programación"). Lee lo que esté digitado en ese momento en el modal — no hace falta haber
// guardado antes. Mismo lenguaje gráfico que el resto de documentos oficiales de la empresa
// (membrete + clases compartidas, ver `verFormatoProduccionAjuste()` en
// js/calidad-ajuste-mezcla.js), pero con solo las filas/cantidades programadas: es un plan a
// futuro, no lleva pendientes ni unidades fabricadas. Es el ÚNICO imprimible de esta pantalla
// desde el 2026-10-16 — el que sacaba la Lista de Producción completa se quitó por quedar
// redundante (nadie lo usaba frente a este, que sí refleja el plan real del día).
// Resumen por medidas al pie de los imprimibles de programación (2026-10-17, a pedido del
// usuario: "incluyamos un resumen, que muestre la cantidad por medidas, esto porque en
// ocasiones la medida es la misma para varios cuadros en el plano... y termina siendo más
// fácil revisar unos totales que cuadro por cuadro") — agrupa las líneas que comparten la
// misma medida real de la pieza: Ancho+Dimensión en prelosa/placa alveolar (dos piezas del
// mismo ancho y largo son intercambiables); Vigueta+Dimensión en vigueta (el tipo de vigueta
// es parte de la medida, no solo un dato aparte — dos viguetas del mismo largo pero de tipo
// distinto NO son la misma pieza). Compartido entre `imprimirProgramacionProduccion()` e
// `imprimirProgramacionDespacho()`.
// Rediseño "el resumen gana más relevancia" (2026-10-22, a pedido del usuario: "el cuadro
// resumen es más importante que el cuadro detallado al momento de fabricar y de despachar...
// que el resumen gane más relevancia" — montado a partir de un mockup que el usuario aprobó,
// ver `docs/modulos/proyectos.md`) — ahora va PRIMERO en la página (antes del cuadro detallado,
// ver `_htmlProgramacionProduccion()`/`_htmlProgramacionDespacho()`), con 3 tiles grandes de
// totales generales de toda la Losa arriba, y una tarjeta por cada ancho/hilos (con acento de
// color, insignia de piezas y una fila TOTAL grande) en vez de una tabla plana — mismo criterio
// de agrupación de siempre (medida+hilos+dimensión, bloques por medida+hilos SOLAMENTE), pero
// la medida+hilos ahora SIEMPRE va en el encabezado de la tarjeta (antes solo en el título
// cuando había más de un bloque; con una sola tarjeta de ancho completo cuando hay un único
// bloque, ya no hace falta la rama `conMedidaHilos` que alternaba entre columnas y título).
function _resumenPorMedidasHTML(lineas, l) {
  const esVigueta = l.sistema === 'vigueta_bovedilla';
  const esPanel = l.sistema === 'paneles_cerramiento';
  // "Hilos" (2026-10-19, a pedido del usuario: "incluir una columna con el número de hilos") —
  // entra también en la CLAVE de agrupación, no solo como columna — dos líneas del mismo
  // ancho/vigueta y dimensión pero con distinto número de hilos NO son la misma pieza
  // (distinto refuerzo), así que agruparlas bajo un solo número de hilos sería engañoso.
  // Vigueta no tiene un único campo "hilos" (son dos: Abajo/Arriba) — se muestra combinado
  // "2+1", mismo formato corto que ya se usa en el resto de la pantalla para esos dos campos.
  // Paneles de Cerramiento (2026-10-29) — la clave de agrupación usa Clasificación en vez de
  // Hilos (no aplica), y a diferencia de los demás sistemas, la clave de FILA (dentro de una
  // tarjeta) incluye `largoA`/`largoB` por separado, no solo `dimension` (el promedio): dos
  // piezas cuchilla con el mismo promedio pero largos reales distintos (ej. 3.0/3.0 vs 2.5/3.5)
  // podrían agruparse como si fueran la misma pieza si solo se mirara el promedio, y no lo son.
  const grupos = new Map();
  let totalPiezasAll = 0, totalMetrosAll = 0, totalPesoAll = 0;
  lineas.forEach(({ f, cantidad }) => {
    const dim = Number(f.dimension) || 0;
    const medida = esVigueta ? (f.tipoVigueta || '—') : (Number(f.ancho) || 0);
    const hilosTxt = esVigueta ? `${Number(f.hilosAbajo) || 0}+${Number(f.hilosArriba) || 0}` : String(Number(f.hilos) || 0);
    const largoA = Number(f.largoA) || 0, largoB = Number(f.largoB) || 0;
    const peso = _pesoFila({ ...f, cantidad }, l);
    totalPiezasAll += cantidad;
    totalMetrosAll += dim * cantidad;
    totalPesoAll += peso;
    const clave = esPanel
      ? `${medida}__${f.clasificacion || ''}__${largoA.toFixed(2)}__${largoB.toFixed(2)}`
      : `${medida}__${hilosTxt}__${dim.toFixed(2)}`;
    if (!grupos.has(clave)) grupos.set(clave, { medida, hilosTxt, dim, clasificacion: f.clasificacion, largoA, largoB, cantidad: 0, peso: 0 });
    const g = grupos.get(clave);
    g.cantidad += cantidad;
    // Mismo peso por unidad para todas las líneas de un mismo grupo (comparten ancho/vigueta y
    // dimensión, que es justo lo que determina el peso por pieza) — sumar `_pesoFila()` línea
    // por línea da el mismo resultado que peso-por-unidad × cantidad total del grupo.
    g.peso += peso;
  });
  // Orden: Panel por [ancho, orden natural de CLASIFICACIONES_PANEL, largoA] — Panel → Panel
  // cuchilla → Dintel → Dintel cuchilla → Antepecho, el orden en que el operario agrupa el
  // trabajo; los demás sistemas, orden alfanumérico de siempre.
  const filas = Array.from(grupos.values()).sort((a, b) => {
    if (esPanel) {
      const ia = CLASIFICACIONES_PANEL.findIndex(c => c.clave === a.clasificacion);
      const ib = CLASIFICACIONES_PANEL.findIndex(c => c.clave === b.clasificacion);
      return (a.medida - b.medida) || (ia - ib) || (a.largoA - b.largoA);
    }
    return a.dim - b.dim || String(a.medida).localeCompare(String(b.medida));
  });

  // Un cuadro aparte por cada ancho/hilos (o ancho/clasificación en Panel) distinto (2026-10-22,
  // a pedido del usuario: "cuando se tengan dos anchos o dos cantidades de hilos diferentes,
  // independiza en un cuadro una medida y en el otro otra medida, para facilidad del operario al
  // momento de producir") — agrupa las filas ya calculadas en un nivel más arriba, SIN la
  // dimensión/largos: cada combinación distinta se separa en su propia tarjeta con su propio
  // título y su propia fila TOTAL, en vez de una sola tabla mezclando filas de distinta medida —
  // coincide con el caso real que lo motivó: los "bancos de producción de prelosa" (ver
  // `_topeMetrosBanco()`), donde cada cinta se arma con un ancho fijo, así que ver de un vistazo
  // "esto es lo de la cinta de 50cm, esto lo de la de 30cm" es justo lo que facilita el montaje.
  // En Panel, la misma lógica separa además "Panel" de "Dintel" de "Panel cuchilla" — piezas que
  // se arman distinto en planta, mismo criterio exacto.
  const bloquesMap = new Map();
  filas.forEach(g => {
    const claveBloque = esPanel ? `${g.medida}__${g.clasificacion}` : `${g.medida}__${g.hilosTxt}`;
    if (!bloquesMap.has(claveBloque)) bloquesMap.set(claveBloque, { medida: g.medida, hilosTxt: g.hilosTxt, clasificacion: g.clasificacion, filas: [], cantidad: 0 });
    const b = bloquesMap.get(claveBloque);
    b.filas.push(g);
    b.cantidad += g.cantidad;
  });
  const bloques = Array.from(bloquesMap.values());

  function tarjetaHTML(b) {
    // Piezas cuchilla llevan Largo A/Largo B como 2 columnas separadas (en vez de un solo
    // "Largo") — son dos largos reales distintos, mostrar el promedio solo confundiría.
    const conDosLargos = esPanel && _esClasificacionCuchilla(b.clasificacion);
    const titulo = esVigueta
      ? `VIGUETA ${_esc(b.medida)} · ${b.hilosTxt} HILOS`
      : esPanel
        ? `ANCHO ${b.medida} CM · ${_etiquetaClasificacionPanel(b.clasificacion).toUpperCase()}`
        : `ANCHO ${b.medida} CM · ${b.hilosTxt} HILOS`;
    let totMetros = 0, totPeso = 0;
    const filasHTML = b.filas.map(g => {
      const longTotal = g.dim * g.cantidad;
      totMetros += longTotal;
      totPeso += g.peso;
      const colMedida = conDosLargos
        ? `<td style="padding:4px 0">${g.largoA.toFixed(2)} m</td><td style="padding:4px 0">${g.largoB.toFixed(2)} m</td>`
        : `<td style="padding:4px 0">${g.dim.toFixed(2)} m</td>`;
      return `<tr style="border-top:1px solid #EDF2F7">
        ${colMedida}
        <td style="padding:4px 0;text-align:center;font-weight:700">${g.cantidad}</td>
        <td style="padding:4px 0;text-align:right">${longTotal.toFixed(2)} m</td>
        <td style="padding:4px 0;text-align:right">${g.peso.toFixed(1)} kg</td>
      </tr>`;
    }).join('');
    const theadMedida = conDosLargos
      ? `<th style="padding:3px 0;font-weight:700;font-size:10px">Largo A</th><th style="padding:3px 0;font-weight:700;font-size:10px">Largo B</th>`
      : `<th style="padding:3px 0;font-weight:700;font-size:10px">Largo</th>`;
    const colspanTotal = conDosLargos ? 2 : 1;
    return `<div style="background:#fff;border:1px solid #CBD5E0;border-left:5px solid #1565C0;border-radius:8px;padding:12px 14px;box-shadow:0 2px 6px rgba(0,63,127,0.08)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:13px;font-weight:800;color:#003F7F">${titulo}</div>
        <div style="font-size:10px;font-weight:700;color:#1565C0;background:#E3F0FB;padding:2px 8px;border-radius:10px;white-space:nowrap">${b.cantidad} pzs</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="color:#4A5568;text-align:left">
          ${theadMedida}
          <th style="padding:3px 0;font-weight:700;font-size:10px;text-align:center">Cant.</th>
          <th style="padding:3px 0;font-weight:700;font-size:10px;text-align:right">Long. tot.</th>
          <th style="padding:3px 0;font-weight:700;font-size:10px;text-align:right">Peso</th>
        </tr></thead>
        <tbody>${filasHTML}</tbody>
        <tfoot><tr style="background:#E3F0FB">
          <td colspan="${colspanTotal}" style="padding:6px 0 6px 6px;font-weight:800;color:#003F7F;border-radius:4px 0 0 4px">TOTAL</td>
          <td style="padding:6px 0;text-align:center;font-weight:800;color:#003F7F;font-size:14px">${b.cantidad}</td>
          <td style="padding:6px 0;text-align:right;font-weight:800;color:#003F7F;font-size:14px">${totMetros.toFixed(2)} m</td>
          <td style="padding:6px 6px 6px 0;text-align:right;font-weight:800;color:#003F7F;font-size:14px;border-radius:0 4px 4px 0">${totPeso.toFixed(1)} kg</td>
        </tr></tfoot>
      </table>
    </div>`;
  }

  // Grilla de 2 columnas cuando hay más de un bloque (envuelve a una fila nueva si hay más de
  // 2) — "un cuadro una medida y en el otro otra medida": el caso típico es exactamente 2 (una
  // por cinta/banco), así que quedan uno al lado del otro, como las 2 cintas reales en planta.
  // Con un solo bloque (el caso más común), su tarjeta ocupa el ancho completo (`1fr`), sin
  // dejar una columna vacía al lado.
  const tarjetasHTML = bloques.map(tarjetaHTML).join('');
  const gridCols = bloques.length > 1 ? 'repeat(2,1fr)' : '1fr';
  const _tile = (valor, etiqueta) => `<div style="background:#E3F0FB;border-radius:8px;padding:10px 8px;text-align:center">
    <div style="font-size:26px;font-weight:800;color:#003F7F;line-height:1">${valor}</div>
    <div style="font-size:9px;font-weight:700;color:#8898AA;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px">${etiqueta}</div>
  </div>`;
  return `
    <div style="margin-bottom:14px">
      <div style="font-size:15px;font-weight:800;color:#003F7F;letter-spacing:0.03em;margin-bottom:8px">RESUMEN POR MEDIDAS</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
        ${_tile(totalPiezasAll, 'Piezas totales')}
        ${_tile(totalMetrosAll.toFixed(2) + ' m', 'Long. total')}
        ${_tile((totalPesoAll / 1000).toFixed(2) + ' ton', 'Peso total')}
      </div>
      <div style="display:grid;grid-template-columns:${gridCols};gap:14px">${tarjetasHTML}</div>
    </div>`;
}

// Encabezado + partido en 2 columnas del cuadro detallado (2026-10-22, ver nota en
// `_htmlProgramacionProduccion()`) — compartido entre Producción y Despacho, que solo difieren
// en si llevan columna de Peso o no (`conPeso`) y en qué `<td>`s arma cada `<tr>` el que llama.
// `esPanel` (2026-10-29) reestructura las columnas propias a un array en vez de concatenación
// lineal — Clasif./Ancho/Largo A/Largo B en vez de Ancho(o Vigueta)/Hilos/Largo, sin "Hilos"
// (no aplica a Paneles).
function _cuadroDetalladoTheadHTML(esVigueta, esPanel, conPeso) {
  const th = (txt, align) => `<th style="padding:3px 4px;text-align:${align || 'left'};font-weight:700">${txt}</th>`;
  const colsPropias = esPanel
    ? th('Clasif.') + th('Ancho', 'center') + th('Largo A', 'right') + th('Largo B', 'right')
    : th(esVigueta ? 'Vigueta' : 'Ancho', 'center') + th('Hilos', 'center') + th('Largo', 'right');
  return th('#') + th('Cuadro') + colsPropias + th('Cant.', 'center') + (conPeso ? th('Peso', 'right') : '') + th('Observ.');
}
function _cuadroDetalladoDosColsHTML(filasHTML, theadRowHTML) {
  if (!filasHTML.length) return '';
  const mitad = Math.ceil(filasHTML.length / 2);
  const col = subset => `<table style="width:100%;border-collapse:collapse;font-size:9.5px">
    <thead><tr style="background:#EDF2F7;color:#4A5568">${theadRowHTML}</tr></thead>
    <tbody>${subset.join('')}</tbody>
  </table>`;
  const izquierda = filasHTML.slice(0, mitad);
  const derecha = filasHTML.slice(mitad);
  return `<div style="display:flex;flex-direction:column;gap:6px;padding-top:6px;border-top:1px dashed #CBD5E0;margin-top:4px">
    <div style="font-size:9px;font-weight:700;color:#8898AA;text-transform:uppercase;letter-spacing:0.08em">Detalle por cuadro — orden de referencia</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${col(izquierda)}
      ${derecha.length ? col(derecha) : '<div></div>'}
    </div>
  </div>`;
}

let _fechaProgramacionImpresa = null;
// HTML del imprimible de Programación de Producción, factorizado (2026-10-21, a pedido del
// usuario: "metamos otro cuadro intermedio... donde incluyamos las producciones programadas...
// podamos editarlas e imprimirlas luego de su programación inicial") — antes solo existía
// `imprimirProgramacionProduccion()`, que arma `lineas` leyendo EN VIVO los `<input>` del modal
// abierto; ahora también hace falta imprimir una programación YA GUARDADA directo desde la
// tarjeta "Producciones programadas", sin pasar por el modal (`imprimirProgramacionProduccionGuardada()`,
// más abajo). Las dos arman `lineas` a su manera y le pasan el resto a esta función, que
// construye el HTML idéntico en ambos casos. `origen` ('modal' | 'tarjeta') solo cambia a dónde
// vuelve el botón "← Volver": si se imprimió desde el modal abierto, reabre ese modal (ver nota
// 2026-10-19 más abajo); si se imprimió directo desde la tarjeta, no había ningún modal abierto
// que reabrir, así que solo regresa a la pantalla de la Losa.
function _htmlProgramacionProduccion(l, p, sis, esVigueta, fecha, observaciones, lineas, origen) {
  const esPanel = l.sistema === 'paneles_cerramiento';
  let totalPiezas = 0;
  // Cuadro detallado partido en 2 columnas, de menor jerarquía (2026-10-22, a pedido del
  // usuario: "el cuadro resumen es más importante que el cuadro detallado al momento de
  // fabricar y de despachar... hagamos un mockup de el cuadro detallado partido en dos
  // columnas... para que el resumen gane más relevancia" — montado a partir de un mockup que
  // el usuario aprobó, ver `docs/modulos/proyectos.md`) — antes era UNA tabla ancha con su
  // propia fila de TOTALES; ahora RESUMEN POR MEDIDAS va primero en la página (más abajo) con
  // sus propios tiles de totales, así que esta tabla ya no necesita repetirlos, ni "Long. tot.
  // (m)" por fila (trivial = Largo × Cantidad, y el agrupado ya se ve en el resumen) — queda
  // solo como referencia rápida de "qué cuadro es cuál", con la columna "Observaciones (cant.
  // real)" en blanco para que planta anote a mano la cantidad real lograda.
  const filas = lineas.map(({ f, cantidad }, n) => {
    totalPiezas += cantidad;
    // Paneles de Cerramiento (2026-10-29) — fila propia, sin "Hilos" (no aplica): Clasificación,
    // Ancho, Largo A y Largo B en vez de Ancho(o Vigueta)/Hilos/Largo.
    if (esPanel) {
      return `<tr style="border-bottom:1px solid #EDF2F7">
        <td style="padding:3px 4px;color:#999">${n + 1}</td>
        <td style="padding:3px 4px;font-weight:600">${_esc(f.cuadro) || '—'}</td>
        <td style="padding:3px 4px">${_etiquetaClasificacionPanel(f.clasificacion)}</td>
        <td style="padding:3px 4px;text-align:center">${f.ancho || 0}</td>
        <td style="padding:3px 4px;text-align:right">${(Number(f.largoA) || 0).toFixed(2)}</td>
        <td style="padding:3px 4px;text-align:right">${(Number(f.largoB) || 0).toFixed(2)}</td>
        <td style="padding:3px 4px;text-align:center;font-weight:700">${cantidad}</td>
        <td style="padding:3px 4px;min-width:45px"></td>
      </tr>`;
    }
    const hilosTxt = esVigueta ? `${Number(f.hilosAbajo) || 0}+${Number(f.hilosArriba) || 0}` : String(Number(f.hilos) || 0);
    const colEspecifica = esVigueta
      ? `<td style="padding:3px 4px">${_esc(f.tipoVigueta) || '—'}</td>`
      : `<td style="padding:3px 4px;text-align:center">${f.ancho || 0}</td>`;
    return `<tr style="border-bottom:1px solid #EDF2F7">
      <td style="padding:3px 4px;color:#999">${n + 1}</td>
      <td style="padding:3px 4px;font-weight:600">${_esc(f.cuadro) || '—'}</td>
      ${colEspecifica}
      <td style="padding:3px 4px;text-align:center">${hilosTxt}</td>
      <td style="padding:3px 4px;text-align:right">${(Number(f.dimension) || 0).toFixed(2)}</td>
      <td style="padding:3px 4px;text-align:center;font-weight:700">${cantidad}</td>
      <td style="padding:3px 4px;min-width:45px"></td>
    </tr>`;
  });
  const detalleHTML = _cuadroDetalladoDosColsHTML(filas, _cuadroDetalladoTheadHTML(esVigueta, esPanel, false));

  // "← Volver" reabre el modal en vez de solo mostrar la pantalla de atrás (2026-10-19, a
  // pedido del usuario: "cuando le doy imprimir y luego le doy volver, se me cierra la ventana
  // de programar producción... garanticemos que cuando le demos volver, volvamos a la ventana
  // como la teníamos digitada") — `cerrarModal()` (llamado más abajo antes de mostrar la vista
  // previa, para que el fondo oscuro del modal no la tape) solo quita la clase `.abierto`, no
  // borra nada del DOM ni de los valores de los `<input>`/`<select>` — así que todo lo digitado
  // (cantidades, filtros) seguía intacto todo este tiempo, solo escondido. Re-agregar `.abierto`
  // al volver lo muestra exactamente como se dejó, sin tener que guardar/restaurar nada aparte.
  // Solo aplica si `origen === 'modal'` — imprimir directo desde la tarjeta nunca abrió el modal.
  const volverOnclick = origen === 'modal'
    ? "document.getElementById('vista-previa').style.display='none';document.getElementById('pantalla-losa-detalle').classList.add('activa');document.getElementById('modal-programar-produccion').classList.add('abierto')"
    : "document.getElementById('vista-previa').style.display='none';document.getElementById('pantalla-losa-detalle').classList.add('activa')";
  return `
    <div class="no-print" style="background:#1C2333;color:white;padding:12px 24px;display:flex;align-items:center;gap:16px">
      <span style="font-weight:700">Programación de Producción — ${_esc(l.nombre)}</span>
      <div style="flex:1"></div>
      <button onclick="descargarPDFProgramacionProduccion()" style="background:#1976D2;color:white;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-weight:700" id="btn-pdf-programacion">⬇️ Descargar PDF</button>
      <button onclick="${volverOnclick}" style="background:#555;color:white;border:none;padding:8px 14px;border-radius:5px;cursor:pointer">← Volver</button>
    </div>
    <div class="preview-doc" id="pp-preview-doc">
      <div class="preview-membrete-header"><img src="membrete-top.jpg" alt=""></div>
      <div class="preview-content" id="pp-preview-content" style="padding-top:6px">
        <div style="text-align:center;font-size:12px;font-weight:700;color:#003F7F;letter-spacing:0.03em;margin-bottom:8px">PROGRAMACIÓN DE PRODUCCIÓN</div>
        <div style="padding-bottom:6px;border-bottom:1px solid #eee;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div style="font-size:14px;font-weight:700;color:#003F7F">${_esc(l.nombre)}${l.ubicacion ? ' — ' + _esc(l.ubicacion) : ''}</div>
            <div style="font-size:11px;color:#555">${fecha ? new Date(fecha + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</div>
          </div>
          <div style="font-size:12px;font-weight:600;margin-top:2px">${_esc(p?.nombre) || '—'}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-top:6px;text-align:center">
            <div><div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.04em">Sistema</div><div style="font-size:12px;font-weight:700;color:#003F7F;margin-top:2px">${sis ? _esc(sis.etiqueta) : '—'}</div></div>
            <div><div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.04em">Piezas a programar</div><div style="font-size:12px;font-weight:700;color:#003F7F;margin-top:2px">${totalPiezas} piezas en ${lineas.length} fila${lineas.length === 1 ? '' : 's'}</div></div>
          </div>
          ${observaciones ? `<div style="margin-top:6px;font-size:10.5px"><b>OBSERVACIONES:</b> ${_esc(observaciones)}</div>` : ''}
        </div>
        ${_resumenPorMedidasHTML(lineas, l)}
        ${detalleHTML}
        <div class="preview-firma" style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
          <div style="border-top:1px solid #333;padding-top:6px;text-align:center;font-size:11px;color:#555">Programado por</div>
          <div style="border-top:1px solid #333;padding-top:6px;text-align:center;font-size:11px;color:#555">Recibido en planta</div>
        </div>
      </div>
      <div class="preview-membrete-footer" id="pp-preview-footer">
        <div class="pf-arco"></div>
        <div class="pf-datos">
          <div class="pf-col"><span class="pf-icon">📞</span><span>+57 314 620 1650<br>+57 311 408 2285</span></div>
          <div class="pf-col"><span class="pf-icon">🏠</span><span>Autopista del Café Km2<br>Vía Chinchiná – Santa Rosa</span></div>
          <div class="pf-col"><span class="pf-icon">🌐</span><span>www.proconcreto.com.co</span></div>
        </div>
      </div>
    </div>`;
}
function imprimirProgramacionProduccion() {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (!l) return;
  const p = PROYECTOS.find(x => x.id === _PROYECTO_ACTIVO_ID);
  const sis = SISTEMAS_ENTREPISO.find(s => s.clave === l.sistema);
  const esVigueta = l.sistema === 'vigueta_bovedilla';
  const fecha = document.getElementById('mpp-fecha').value;
  const observaciones = document.getElementById('mpp-observaciones').value.trim();
  const lineas = [];
  document.querySelectorAll('#mpp-filas-body input[data-fila-id]').forEach(inp => {
    const cantidad = parseFloat(inp.value) || 0;
    if (cantidad <= 0) return;
    const f = _filasLosaActual.find(x => x.id === inp.dataset.filaId);
    if (f) lineas.push({ f, cantidad });
  });
  if (!lineas.length) { alert('Ingresa al menos una cantidad a programar antes de imprimir.'); return; }
  _fechaProgramacionImpresa = fecha || new Date().toISOString().split('T')[0];
  document.getElementById('contenido-preview').innerHTML = _htmlProgramacionProduccion(l, p, sis, esVigueta, fecha, observaciones, lineas, 'modal');
  // El modal queda tapado por el fondo oscuro de #vista-previa si no se cierra primero (el
  // z-index de los modales es mayor al de #vista-previa) — mismo motivo por el que "← Volver"
  // reactiva pantalla-losa-detalle en vez de reabrir el modal.
  cerrarModal('modal-programar-produccion');
  document.getElementById('vista-previa').style.display = 'block';
  document.querySelectorAll('.pantalla').forEach(p2 => p2.classList.remove('activa'));
  window.scrollTo(0, 0);
}
// "🖨️ Formato" directo desde la tarjeta "Producciones programadas" (2026-10-21) — imprime una
// programación ya guardada sin necesidad de abrir el modal primero. `lineas` se arma desde
// `prog.lineas[].cantidadProgramada` cruzado con `_filasLosaActual` EN VIVO (el ancho/dimensión/
// peso de cada fila nunca se congelan en ningún lado de esta pantalla, siempre se leen
// actuales — mismo criterio que toda la Losa).
function imprimirProgramacionProduccionGuardada(id) {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (!l) return;
  const prog = _programacionesLosaActual.find(x => x.id === id);
  if (!prog) return;
  const p = PROYECTOS.find(x => x.id === _PROYECTO_ACTIVO_ID);
  const sis = SISTEMAS_ENTREPISO.find(s => s.clave === l.sistema);
  const esVigueta = l.sistema === 'vigueta_bovedilla';
  const lineas = [];
  (prog.lineas || []).forEach(ln => {
    const cantidad = Number(ln.cantidadProgramada) || 0;
    if (cantidad <= 0) return;
    const f = _filasLosaActual.find(x => x.id === ln.filaId);
    if (f) lineas.push({ f, cantidad });
  });
  if (!lineas.length) { alert('Esta programación no tiene líneas para imprimir.'); return; }
  _fechaProgramacionImpresa = prog.fecha || new Date().toISOString().split('T')[0];
  document.getElementById('contenido-preview').innerHTML = _htmlProgramacionProduccion(l, p, sis, esVigueta, prog.fecha, prog.observaciones || '', lineas, 'tarjeta');
  document.getElementById('vista-previa').style.display = 'block';
  document.querySelectorAll('.pantalla').forEach(p2 => p2.classList.remove('activa'));
  window.scrollTo(0, 0);
}
async function descargarPDFProgramacionProduccion() {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  const fecha = (_fechaProgramacionImpresa || new Date().toISOString().split('T')[0]).replace(/-/g, '_');
  const nombreLosa = (l?.nombre || 'losa').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().replace(/\s+/g, '_');
  await _descargarPDFConMembrete('pp-preview-content', 'pp-preview-footer', `Programacion_Produccion_${nombreLosa}_${fecha}.pdf`, 'btn-pdf-programacion');
}

// "Cargar producción" — elige una programación y, frente a cada "teórico programado", deja
// digitar lo que realmente se produjo. Una línea ya cargada (`cantidadReal != null`) sigue
// siendo editable (2026-10-16, a pedido del usuario: "permitamos que se puedan también editar
// producciones ya cargadas, pues es posible que se cometan errores en el camino que se deban
// solucionar") — ya no es de solo lectura; se corrige con el mismo campo, sin duplicar el
// registro de producción (ver `guardarCargaProduccion()`, que ACTUALIZA la entrada existente en
// `fila.produccion[]` en vez de agregar una nueva).
function abrirModalCargarProduccion() {
  const todas = _programacionesLosaActual;
  const select = document.getElementById('mcp-select-programacion');
  document.getElementById('mcp-sin-programaciones').style.display = todas.length ? 'none' : '';
  if (!todas.length) {
    select.innerHTML = '';
    document.getElementById('mcp-contenido').style.display = 'none';
    document.getElementById('mcp-btn-guardar').style.display = 'none';
  } else {
    select.innerHTML = todas.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(p => {
      const totalProgramado = (p.lineas || []).reduce((s, l) => s + (Number(l.cantidadProgramada) || 0), 0);
      const porCargar = (p.lineas || []).filter(l => l.cantidadReal == null).length;
      const fechaTxt = p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : '—';
      return `<option value="${_escAttr(p.id)}">${fechaTxt} — ${(p.lineas || []).length} fila(s), ${totalProgramado} piezas programadas${porCargar > 0 ? ` (${porCargar} por cargar)` : ' (completa, editable)'}</option>`;
    }).join('');
    _renderLineasCargarProduccion();
  }
  document.getElementById('modal-cargar-produccion').classList.add('abierto');
}
function _renderLineasCargarProduccion() {
  const select = document.getElementById('mcp-select-programacion');
  const p = _programacionesLosaActual.find(x => x.id === select.value);
  const tbody = document.getElementById('mcp-filas-body');
  if (!p) { document.getElementById('mcp-contenido').style.display = 'none'; document.getElementById('mcp-btn-guardar').style.display = 'none'; return; }
  document.getElementById('mcp-contenido').style.display = '';
  document.getElementById('mcp-btn-guardar').style.display = '';
  tbody.innerHTML = (p.lineas || []).map((linea, li) => {
    const f = _filasLosaActual.find(x => x.id === linea.filaId);
    const cargada = linea.cantidadReal != null;
    const valorActual = cargada ? linea.cantidadReal : linea.cantidadProgramada;
    return `<tr${cargada ? ' style="background:#F1F8F4"' : ''}>
      <td>${_esc(f?.cuadro || '—')}</td>
      <td>${linea.cantidadProgramada}</td>
      <td>
        <input type="number" min="0" value="${valorActual}" data-linea-idx="${li}" style="width:70px">
        ${cargada ? '<span style="font-size:10px;color:var(--verde);margin-left:4px">✓ cargado</span>' : ''}
      </td>
    </tr>`;
  }).join('');
}
function guardarCargaProduccion() {
  const select = document.getElementById('mcp-select-programacion');
  const p = _programacionesLosaActual.find(x => x.id === select.value);
  if (!p) return;
  const inputs = document.querySelectorAll('#mcp-filas-body input[data-linea-idx]');
  let huboAlguna = false;
  inputs.forEach(inp => {
    if (inp.value === '') return; // se deja en blanco a propósito: sin cambios en esta línea
    const idx = parseInt(inp.dataset.lineaIdx, 10);
    const linea = p.lineas[idx];
    if (!linea) return;
    const nuevaCantidad = parseFloat(inp.value) || 0;
    const yaEstabaCargada = linea.cantidadReal != null;
    if (yaEstabaCargada && nuevaCantidad === linea.cantidadReal) return; // sin cambios reales
    linea.cantidadReal = nuevaCantidad;
    huboAlguna = true;
    const f = _filasLosaActual.find(x => x.id === linea.filaId);
    if (f) {
      f.produccion = f.produccion || [];
      // Corrige la entrada existente de esta programación en vez de duplicarla — una línea
      // solo empuja UNA entrada a fila.produccion[] en toda su vida, se edita in situ.
      const entradaExistente = f.produccion.find(e => e.programacionId === p.id);
      if (entradaExistente) entradaExistente.cantidad = nuevaCantidad;
      else if (nuevaCantidad > 0) f.produccion.push({ fecha: p.fecha, cantidad: nuevaCantidad, tipo: 'Vaciado', programacionId: p.id });
    }
  });
  if (!huboAlguna) { alert('Ingresa al menos una cantidad producida, o cambia alguna ya cargada para corregirla.'); return; }
  _guardarLosaActual();
  cerrarModal('modal-cargar-produccion');
  renderFilasProduccion();
  // La programación recién cargada puede dejar de tener TODAS sus líneas en null (pasa de
  // "programada" a "registrada") — se refrescan ambas tarjetas juntas, siempre.
  renderProduccionProgramada();
  renderProduccionRegistrada();
  alert('Producción cargada.');
}

// "Producciones programadas" (2026-10-21, a pedido del usuario: "metamos otro cuadro
// intermedio, entre el cuadro general y el cuadro de producciones registradas, donde
// incluyamos las producciones programadas. de esta manera podemos hacer varias
// programaciones, editarlas e imprimirlas luego de su programación inicial. cuando se carga la
// producción asociada a una programación, esta programación baja al cuadro de producciones
// registradas") — tarjeta SIEMPRE VISIBLE (modo producción), entre la tabla de filas y
// "Producciones registradas". Lista las programaciones que TODAVÍA no tienen NINGUNA línea
// cargada (`every(l => l.cantidadReal == null)`) — el complemento exacto del filtro de
// "Producciones registradas" (`some(...)`, más abajo): en cuanto se carga la primera línea de
// una programación, desaparece de acá y aparece allá, sin tocar nada aparte ni duplicar
// ningún dato. Mismas tres acciones (Formato/Editar/Borrar) que el resto de tarjetas de esta
// pantalla.
function renderProduccionProgramada() {
  const tbody = document.getElementById('produccion-programada-body');
  if (!tbody) return;
  const sinCargar = _programacionesLosaActual.filter(p => (p.lineas || []).every(l => l.cantidadReal == null));
  if (!sinCargar.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--gris-medio);padding:10px">No hay producciones programadas todavía.</td></tr>`;
    return;
  }
  tbody.innerHTML = sinCargar.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(p => {
    const totalProgramado = (p.lineas || []).reduce((s, l) => s + (Number(l.cantidadProgramada) || 0), 0);
    return `<tr>
      <td>${p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${(p.lineas || []).length} fila(s), ${totalProgramado} piezas programadas</td>
      <td>${_esc(p.observaciones) || '—'}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-secundario btn-xs" onclick="imprimirProgramacionProduccionGuardada('${_escAttr(p.id)}')">🖨️ Formato</button>
          <button class="btn btn-primario btn-xs" onclick="editarProgramacionProduccion('${_escAttr(p.id)}')">✏️ Editar</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarProgramacionProduccion('${_escAttr(p.id)}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}
// "✏️ Editar" — reabre "+ Programar producción" en modo edición sobre esta programación (ver
// `abrirModalProgramarProduccion(programacionId)`).
function editarProgramacionProduccion(id) {
  abrirModalProgramarProduccion(id);
}
// "🗑️ Borrar" — a diferencia de `eliminarProduccionRegistrada()`, acá NUNCA hay nada que
// deshacer en `fila.produccion[]`: una programación solo aparece en esta tarjeta mientras
// ninguna de sus líneas tiene `cantidadReal`, así que borrarla no mueve ningún pendiente.
function eliminarProgramacionProduccion(id) {
  const p = _programacionesLosaActual.find(x => x.id === id);
  if (!p) return;
  const fechaTxt = p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : 'sin fecha';
  if (!confirm(`¿Eliminar la programación de producción del ${fechaTxt}? Todavía no tiene nada cargado, así que no afecta ningún pendiente.`)) return;
  _programacionesLosaActual = _programacionesLosaActual.filter(x => x.id !== id);
  _guardarLosaActual();
  renderProduccionProgramada();
}

// "Producciones registradas" — mismo espíritu que "📦 Despachos registrados", pero del lado de
// Producción (2026-10-15, a pedido del usuario: "incluyamos... algo similar a lo que tenemos en
// Despachos de Despachos Registrados... fila a fila lo producido y seleccionándola podamos ver
// el resumen... lo realmente fabricado"). Lista las programaciones que ya tienen AL MENOS una
// línea cargada (`cantidadReal != null`) — una programación sin nada cargado todavía no es
// "producción", es solo un plan, no aparece acá (si está 100% pendiente, vive en "+ Cargar
// producción"). "Contenido" cuenta solo lo REALMENTE fabricado, no lo programado.
// Columna ACCIONES (2026-10-18, a pedido del usuario: "manejemos la misma lógica de la ventana
// que tenemos por ejemplo en ajuste diario de mezclas, con las acciones en el lado derecho
// teniendo las mismas tres, del formato, editar y borrar") — reemplaza el clic sobre la fila
// (que abría el detalle de solo lectura) por tres botones explícitos, mismo patrón visual EXACTO
// que `renderAjustesMezcla()` en `js/calidad-ajuste-mezcla.js`: 👁️ Detalle (el mismo detalle de
// solo lectura que antes abría el clic en la fila — se llamó "🖨️ Formato" hasta 2026-10-19,
// renombrado a pedido del usuario: "en realidad no generamos un imprimible... nombrémoslo como
// Detalle y cambiemos el loguito", no genera ningún PDF, a diferencia de "+ Programar
// producción" → "🖨️ Formato" en la tarjeta de arriba, que sí imprime), ✏️ Editar (abre "+ Cargar
// producción" con esta programación ya seleccionada — reutiliza la edición in-situ que ya
// existía ahí) y 🗑️ Borrar (elimina la programación completa, con confirmación).
function renderProduccionRegistrada() {
  const tbody = document.getElementById('produccion-registrada-body');
  if (!tbody) return;
  const conCarga = _programacionesLosaActual.filter(p => (p.lineas || []).some(l => l.cantidadReal != null));
  if (!conCarga.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--gris-medio);padding:10px">No hay producción cargada todavía.</td></tr>`;
    return;
  }
  tbody.innerHTML = conCarga.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(p => {
    const cargadas = (p.lineas || []).filter(l => l.cantidadReal != null);
    const pendientes = (p.lineas || []).length - cargadas.length;
    const totalFabricado = cargadas.reduce((s, l) => s + (Number(l.cantidadReal) || 0), 0);
    return `<tr>
      <td>${p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${cargadas.length} fila(s), ${totalFabricado} piezas fabricadas${pendientes > 0 ? ` (${pendientes} por cargar)` : ''}</td>
      <td>${_esc(p.observaciones) || '—'}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-secundario btn-xs" onclick="verDetalleProduccionRegistrada('${_escAttr(p.id)}')">👁️ Detalle</button>
          <button class="btn btn-primario btn-xs" onclick="editarProduccionRegistrada('${_escAttr(p.id)}')">✏️ Editar</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarProduccionRegistrada('${_escAttr(p.id)}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}
// "✏️ Editar" (2026-10-18) — abre "+ Cargar producción" con esta programación ya seleccionada
// en el combo, en vez de que el usuario tenga que volver a buscarla. La edición en sí ya existía
// (ver `guardarCargaProduccion()`, corrige in-situ la entrada de `fila.produccion[]` en vez de
// duplicarla) — esto solo evita el paso manual de selección.
function editarProduccionRegistrada(id) {
  abrirModalCargarProduccion();
  const select = document.getElementById('mcp-select-programacion');
  if (select) { select.value = id; _renderLineasCargarProduccion(); }
}
// "🗑️ Borrar" (2026-10-18) — elimina la programación completa (plan + lo cargado), no solo la
// carga: coincide con el mismo criterio de `eliminarAjusteMezcla()` (el botón borra el registro
// entero). Deshace también el crédito real en `fila.produccion[]` de cada línea que haya sido
// cargada, para que el pendiente de producción de esas filas vuelva a subir — si no se hiciera,
// la fila quedaría con piezas "fabricadas" fantasma que ya no tienen ninguna programación detrás.
function eliminarProduccionRegistrada(id) {
  const p = _programacionesLosaActual.find(x => x.id === id);
  if (!p) return;
  const fechaTxt = p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : 'sin fecha';
  if (!confirm(`¿Eliminar la producción registrada del ${fechaTxt}? Se borra la programación completa y las cantidades fabricadas que tenía cargadas — el pendiente de producción de esas filas vuelve a subir.`)) return;
  (p.lineas || []).forEach(linea => {
    const f = _filasLosaActual.find(x => x.id === linea.filaId);
    if (f && f.produccion) f.produccion = f.produccion.filter(e => e.programacionId !== p.id);
  });
  _programacionesLosaActual = _programacionesLosaActual.filter(x => x.id !== id);
  _guardarLosaActual();
  renderFilasProduccion();
  renderProduccionRegistrada();
}
// Detalle de solo lectura ("👁️ Detalle") — mismo
// contenido que ve "+ Cargar producción" (Cuadro / Programado / Producido), pero sin inputs:
// es historial, no una carga en curso.
// Columnas Ancho/Hilos (o Vigueta/Hilos Abajo/Hilos Arriba) + Largo (2026-10-19, a pedido del
// usuario: "en el detalle de producción cargada, metamos las columnas de largo, ancho y número
// de hilos") — mismo criterio que ya usan los modales de Programar producción/despacho y la
// matriz de Producción diaria: de solo lectura, tomadas de la fila real (`_filasLosaActual`),
// para identificar de un vistazo qué medida tiene cada cuadro sin tener que cruzar con la lista
// principal. El `<thead>` ahora tiene id propio (`#vdp-thead`) porque se reconstruye por
// completo cada vez que se abre el modal.
function verDetalleProduccionRegistrada(id) {
  const p = _programacionesLosaActual.find(x => x.id === id);
  if (!p) return;
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  const esVigueta = !!l && l.sistema === 'vigueta_bovedilla';
  document.getElementById('vdp-fecha').textContent = p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : '—';
  document.getElementById('vdp-observaciones').textContent = p.observaciones || '—';
  document.getElementById('vdp-thead').innerHTML = `<tr>
    <th>Cuadro</th>
    ${esVigueta ? '<th>Vigueta</th><th>Hilos Abajo</th><th>Hilos Arriba</th>' : '<th>Ancho (cm)</th><th>Hilos</th>'}
    <th>Largo (m)</th>
    <th>Programado</th><th>Producido</th>
  </tr>`;
  document.getElementById('vdp-filas-body').innerHTML = (p.lineas || []).map(linea => {
    const f = _filasLosaActual.find(x => x.id === linea.filaId);
    const cargada = linea.cantidadReal != null;
    const colEspecifica = esVigueta
      ? `<td>${_esc(f?.tipoVigueta) || '—'}</td><td style="text-align:center">${f?.hilosAbajo || 0}</td><td style="text-align:center">${f?.hilosArriba || 0}</td>`
      : `<td style="text-align:center">${f?.ancho || 0}</td><td style="text-align:center">${f?.hilos || 0}</td>`;
    return `<tr>
      <td>${_esc(f?.cuadro || '—')}</td>
      ${colEspecifica}
      <td style="text-align:center">${f?.dimension || 0}</td>
      <td>${linea.cantidadProgramada}</td>
      <td>${cargada ? linea.cantidadReal : '<span style="color:var(--naranja)">Pendiente</span>'}</td>
    </tr>`;
  }).join('');
  document.getElementById('modal-detalle-produccion').classList.add('abierto');
}

// "Ver producción diaria" — matriz fila × fecha, mismo formato que los Excel reales
// compartidos por el usuario (una columna por día de producción). Siempre lista TODAS las
// filas de la Losa (2026-10-15, a pedido del usuario), no solo las que ya tienen producción —
// antes, si todavía no se había cargado ninguna producción, no se veía ninguna fila. Las
// columnas Cuadro/Ancho/Hilos/Largo/Cant. a fabricar/Total fabricado quedan FIJAS a la
// izquierda (`position:sticky;left:...`, mismo mecanismo que ya usa `.tabla-cots th` para
// fijarse arriba al bajar, pero en el eje horizontal) porque en una Losa grande las columnas
// de fecha pueden ser muchas — se desplazan con la barra horizontal sin perder de vista qué
// fila es cada una.
function abrirMatrizProduccionDiaria() {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  const esVigueta = l?.sistema === 'vigueta_bovedilla';
  const fechasSet = new Set();
  _filasLosaActual.forEach(f => (f.produccion || []).forEach(e => { if (e.fecha) fechasSet.add(e.fecha); }));
  const fechas = Array.from(fechasSet).sort();
  const thead = document.getElementById('pd-thead');
  const tbody = document.getElementById('pd-tbody');
  const tfoot = document.getElementById('pd-tfoot');

  // Anchos fijos para las columnas congeladas — position:sticky necesita un "left" numérico,
  // no sirve con anchos automáticos; thead/tbody/tfoot usan exactamente el mismo ancho por
  // columna para que las celdas queden alineadas.
  // "Hilos" (2026-10-19, a pedido del usuario: "incluyamos una columna con el número de
  // hilos") — prelosa/placa alveolar trae una sola columna "Hilos" (`f.hilos`); vigueta trae
  // "Hilos Abajo"/"Hilos Arriba" por separado (`f.hilosAbajo`/`f.hilosArriba`), mismo criterio
  // que ya usan los modales de Programar producción/despacho — NUNCA un solo "hilos" genérico
  // para vigueta. Sigue siendo parte del bloque FIJO a la izquierda (el usuario lo recordó
  // explícitamente: "para esta ventana... debemos bloquear las columnas hasta TOTAL FABRICADO"),
  // así que entra en la misma cascada de `left` acumulado que el resto de columnas congeladas.
  const AW = { cuadro: 60, ancho: 70, hilos: 55, hilosAbajo: 60, hilosArriba: 60, largo: 70, cantidad: 100, total: 110 };
  let acum = 0;
  const leftCuadro = acum; acum += AW.cuadro;
  const leftAncho = acum; if (!esVigueta) acum += AW.ancho;
  const leftHilos = acum; if (!esVigueta) acum += AW.hilos;
  const leftHilosAbajo = acum; if (esVigueta) acum += AW.hilosAbajo;
  const leftHilosArriba = acum; if (esVigueta) acum += AW.hilosArriba;
  const leftLargo = acum; acum += AW.largo;
  const leftCantidad = acum; acum += AW.cantidad;
  const leftTotal = acum;
  const numColsFijas = 6;
  // z-index 5 en los `<th>` ya viene de `.tabla-cots th` (también les da el `top:0` que los fija
  // arriba al bajar) — acá solo hace falta agregar el `left` para fijarlos también a la
  // izquierda. Los `<td>`/`<tfoot><td>` sí necesitan su propio z-index + fondo sólido (si no, el
  // contenido de las columnas de fecha se vería "por debajo" al desplazar la barra).
  const thFijo = (leftPx, w, texto) => `<th style="position:sticky;left:${leftPx}px;width:${w}px;min-width:${w}px;text-align:center">${texto}</th>`;
  const tdFijo = (leftPx, w, texto, extra) => `<td style="position:sticky;left:${leftPx}px;width:${w}px;min-width:${w}px;z-index:2;background:#fff;${extra || ''}">${texto}</td>`;

  thead.innerHTML = `<tr>
    ${thFijo(leftCuadro, AW.cuadro, 'Cuadro')}
    ${esVigueta ? '' : thFijo(leftAncho, AW.ancho, 'Ancho (cm)')}
    ${esVigueta ? '' : thFijo(leftHilos, AW.hilos, 'Hilos')}
    ${esVigueta ? thFijo(leftHilosAbajo, AW.hilosAbajo, 'Hilos Abajo') : ''}
    ${esVigueta ? thFijo(leftHilosArriba, AW.hilosArriba, 'Hilos Arriba') : ''}
    ${thFijo(leftLargo, AW.largo, 'Largo (m)')}
    ${thFijo(leftCantidad, AW.cantidad, 'Cant. a fabricar')}
    ${thFijo(leftTotal, AW.total, 'Total fabricado')}
    ${fechas.map(fe => `<th style="text-align:center;min-width:55px">${new Date(fe + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })}</th>`).join('')}
  </tr>`;

  if (!_filasLosaActual.length) {
    tbody.innerHTML = `<tr><td colspan="${numColsFijas + fechas.length}" style="text-align:center;color:var(--gris-medio);padding:14px">No hay filas en esta Losa todavía.</td></tr>`;
    tfoot.innerHTML = '';
    document.getElementById('modal-produccion-diaria').classList.add('abierto');
    return;
  }

  const totalesPorFecha = fechas.map(() => 0);
  let granTotalCantidad = 0, granTotalFabricado = 0;
  tbody.innerHTML = _filasLosaActual.map(f => {
    let filaTotal = 0;
    const celdas = fechas.map((fe, fi) => {
      const cant = (f.produccion || []).filter(e => e.fecha === fe).reduce((s, e) => s + (Number(e.cantidad) || 0), 0);
      filaTotal += cant;
      totalesPorFecha[fi] += cant;
      return `<td style="text-align:center">${cant || ''}</td>`;
    }).join('');
    granTotalCantidad += Number(f.cantidad) || 0;
    granTotalFabricado += filaTotal;
    return `<tr>
      ${tdFijo(leftCuadro, AW.cuadro, _esc(f.cuadro) || '—', 'font-weight:600')}
      ${esVigueta ? '' : tdFijo(leftAncho, AW.ancho, f.ancho || 0, 'text-align:center')}
      ${esVigueta ? '' : tdFijo(leftHilos, AW.hilos, f.hilos || 0, 'text-align:center')}
      ${esVigueta ? tdFijo(leftHilosAbajo, AW.hilosAbajo, f.hilosAbajo || 0, 'text-align:center') : ''}
      ${esVigueta ? tdFijo(leftHilosArriba, AW.hilosArriba, f.hilosArriba || 0, 'text-align:center') : ''}
      ${tdFijo(leftLargo, AW.largo, (Number(f.dimension) || 0).toFixed(2), 'text-align:center')}
      ${tdFijo(leftCantidad, AW.cantidad, f.cantidad || 0, 'text-align:center')}
      ${tdFijo(leftTotal, AW.total, filaTotal || 0, 'text-align:center;font-weight:700')}
      ${celdas}
    </tr>`;
  }).join('');

  tfoot.innerHTML = fechas.length ? `<tr style="font-weight:700">
    ${tdFijo(leftCuadro, AW.cuadro, 'Total día', 'background:var(--azul-suave)')}
    ${esVigueta ? '' : tdFijo(leftAncho, AW.ancho, '', 'background:var(--azul-suave)')}
    ${esVigueta ? '' : tdFijo(leftHilos, AW.hilos, '', 'background:var(--azul-suave)')}
    ${esVigueta ? tdFijo(leftHilosAbajo, AW.hilosAbajo, '', 'background:var(--azul-suave)') : ''}
    ${esVigueta ? tdFijo(leftHilosArriba, AW.hilosArriba, '', 'background:var(--azul-suave)') : ''}
    ${tdFijo(leftLargo, AW.largo, '', 'background:var(--azul-suave)')}
    ${tdFijo(leftCantidad, AW.cantidad, granTotalCantidad, 'background:var(--azul-suave);text-align:center')}
    ${tdFijo(leftTotal, AW.total, granTotalFabricado, 'background:var(--azul-suave);text-align:center')}
    ${totalesPorFecha.map(t => `<td style="text-align:center;background:var(--azul-suave)">${t || ''}</td>`).join('')}
  </tr>` : '';

  document.getElementById('modal-produccion-diaria').classList.add('abierto');
}

// "Ver despacho diario" — matriz fila × fecha, misma filosofía EXACTA que "Producción diaria"
// (2026-10-19, a pedido del usuario: "este botón nos hace falta, pues es en este donde puedo
// revisar lo que se ha despachado al detalle... desarrollemoslo con la misma filosofia del
// boton que tenemos en producción"). Única diferencia real de fondo: la producción vive EN
// CADA FILA (`fila.produccion[]`), pero el despacho vive a nivel de LOSA
// (`_despachosLosaActual[]` — cada evento trae una `fecha` y una lista de `lineas[]` que
// referencian varias filas a la vez, como una remisión real cubre varias piezas) — así que acá
// se arma primero un mapa filaId→fecha→cantidad recorriendo los despachos UNA sola vez, en vez
// de filtrar `fila.produccion` directo como hace Producción diaria. Mismas columnas fijas
// (Cuadro/Ancho/Hilos (o Vigueta/Hilos Abajo/Hilos Arriba)/Largo/Cantidad/Total despachado,
// `position:sticky`) congeladas a la izquierda, mismas fechas desplazables a la derecha.
function abrirMatrizDespachoDiaria() {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  const esVigueta = l?.sistema === 'vigueta_bovedilla';
  const fechasSet = new Set();
  const porFilaFecha = new Map(); // filaId -> Map(fecha -> cantidad)
  _despachosLosaActual.forEach(d => {
    if (!d.fecha) return;
    fechasSet.add(d.fecha);
    (d.lineas || []).forEach(linea => {
      if (!linea.filaId) return;
      if (!porFilaFecha.has(linea.filaId)) porFilaFecha.set(linea.filaId, new Map());
      const m = porFilaFecha.get(linea.filaId);
      m.set(d.fecha, (m.get(d.fecha) || 0) + (Number(linea.cantidad) || 0));
    });
  });
  const fechas = Array.from(fechasSet).sort();
  const thead = document.getElementById('dd-thead');
  const tbody = document.getElementById('dd-tbody');
  const tfoot = document.getElementById('dd-tfoot');

  const AW = { cuadro: 60, ancho: 70, hilos: 55, hilosAbajo: 60, hilosArriba: 60, largo: 70, cantidad: 100, total: 110 };
  let acum = 0;
  const leftCuadro = acum; acum += AW.cuadro;
  const leftAncho = acum; if (!esVigueta) acum += AW.ancho;
  const leftHilos = acum; if (!esVigueta) acum += AW.hilos;
  const leftHilosAbajo = acum; if (esVigueta) acum += AW.hilosAbajo;
  const leftHilosArriba = acum; if (esVigueta) acum += AW.hilosArriba;
  const leftLargo = acum; acum += AW.largo;
  const leftCantidad = acum; acum += AW.cantidad;
  const leftTotal = acum;
  const numColsFijas = 6;
  const thFijo = (leftPx, w, texto) => `<th style="position:sticky;left:${leftPx}px;width:${w}px;min-width:${w}px;text-align:center">${texto}</th>`;
  const tdFijo = (leftPx, w, texto, extra) => `<td style="position:sticky;left:${leftPx}px;width:${w}px;min-width:${w}px;z-index:2;background:#fff;${extra || ''}">${texto}</td>`;

  thead.innerHTML = `<tr>
    ${thFijo(leftCuadro, AW.cuadro, 'Cuadro')}
    ${esVigueta ? '' : thFijo(leftAncho, AW.ancho, 'Ancho (cm)')}
    ${esVigueta ? '' : thFijo(leftHilos, AW.hilos, 'Hilos')}
    ${esVigueta ? thFijo(leftHilosAbajo, AW.hilosAbajo, 'Hilos Abajo') : ''}
    ${esVigueta ? thFijo(leftHilosArriba, AW.hilosArriba, 'Hilos Arriba') : ''}
    ${thFijo(leftLargo, AW.largo, 'Largo (m)')}
    ${thFijo(leftCantidad, AW.cantidad, 'Cantidad')}
    ${thFijo(leftTotal, AW.total, 'Total despachado')}
    ${fechas.map(fe => `<th style="text-align:center;min-width:55px">${new Date(fe + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })}</th>`).join('')}
  </tr>`;

  if (!_filasLosaActual.length) {
    tbody.innerHTML = `<tr><td colspan="${numColsFijas + fechas.length}" style="text-align:center;color:var(--gris-medio);padding:14px">No hay filas en esta Losa todavía.</td></tr>`;
    tfoot.innerHTML = '';
    document.getElementById('modal-despacho-diario').classList.add('abierto');
    return;
  }

  const totalesPorFecha = fechas.map(() => 0);
  let granTotalCantidad = 0, granTotalDespachado = 0;
  tbody.innerHTML = _filasLosaActual.map(f => {
    const mFecha = porFilaFecha.get(f.id);
    let filaTotal = 0;
    const celdas = fechas.map((fe, fi) => {
      const cant = mFecha ? (mFecha.get(fe) || 0) : 0;
      filaTotal += cant;
      totalesPorFecha[fi] += cant;
      return `<td style="text-align:center">${cant || ''}</td>`;
    }).join('');
    granTotalCantidad += Number(f.cantidad) || 0;
    granTotalDespachado += filaTotal;
    return `<tr>
      ${tdFijo(leftCuadro, AW.cuadro, _esc(f.cuadro) || '—', 'font-weight:600')}
      ${esVigueta ? '' : tdFijo(leftAncho, AW.ancho, f.ancho || 0, 'text-align:center')}
      ${esVigueta ? '' : tdFijo(leftHilos, AW.hilos, f.hilos || 0, 'text-align:center')}
      ${esVigueta ? tdFijo(leftHilosAbajo, AW.hilosAbajo, f.hilosAbajo || 0, 'text-align:center') : ''}
      ${esVigueta ? tdFijo(leftHilosArriba, AW.hilosArriba, f.hilosArriba || 0, 'text-align:center') : ''}
      ${tdFijo(leftLargo, AW.largo, (Number(f.dimension) || 0).toFixed(2), 'text-align:center')}
      ${tdFijo(leftCantidad, AW.cantidad, f.cantidad || 0, 'text-align:center')}
      ${tdFijo(leftTotal, AW.total, filaTotal || 0, 'text-align:center;font-weight:700')}
      ${celdas}
    </tr>`;
  }).join('');

  tfoot.innerHTML = fechas.length ? `<tr style="font-weight:700">
    ${tdFijo(leftCuadro, AW.cuadro, 'Total día', 'background:var(--azul-suave)')}
    ${esVigueta ? '' : tdFijo(leftAncho, AW.ancho, '', 'background:var(--azul-suave)')}
    ${esVigueta ? '' : tdFijo(leftHilos, AW.hilos, '', 'background:var(--azul-suave)')}
    ${esVigueta ? tdFijo(leftHilosAbajo, AW.hilosAbajo, '', 'background:var(--azul-suave)') : ''}
    ${esVigueta ? tdFijo(leftHilosArriba, AW.hilosArriba, '', 'background:var(--azul-suave)') : ''}
    ${tdFijo(leftLargo, AW.largo, '', 'background:var(--azul-suave)')}
    ${tdFijo(leftCantidad, AW.cantidad, granTotalCantidad, 'background:var(--azul-suave);text-align:center')}
    ${tdFijo(leftTotal, AW.total, granTotalDespachado, 'background:var(--azul-suave);text-align:center')}
    ${totalesPorFecha.map(t => `<td style="text-align:center;background:var(--azul-suave)">${t || ''}</td>`).join('')}
  </tr>` : '';

  document.getElementById('modal-despacho-diario').classList.add('abierto');
}

// ── Control de Despacho — mismo flujo de dos pasos que Producción (2026-10-16, a pedido del
// usuario: "incluyamos la misma lógica que tenemos en producción, con los tres botones
// superiores de programar despacho, cargar despacho e historial de despachos"). Reemplaza el
// registro directo de un solo paso que había antes: "+ Programar despacho" arma el lote de lo
// que se va a despachar; "+ Cargar despacho" confirma, línea por línea, lo que REALMENTE salió
// frente a lo programado, con la remisión real del camión. `despachos[]`
// (`_despachosLosaActual`) sigue siendo el libro real — sin cambios en su forma ni en
// `_pendienteDespachoFila()` — "Cargar despacho" lo alimenta (find-or-create por
// `despachoProgramadoId`) en vez de que el usuario lo arme directo como antes.
// Filtrado por DISPONIBLE, no por pendiente (2026-10-19, a pedido del usuario: "incluir una
// columna... de disponible para despacho, que será arrastrada de la ventana de producción.
// Condicionar la programación de despachos solo para elementos que estén disponibles para
// despacho") — antes se ofrecía programar hasta el pendiente TOTAL de despacho
// (`cantidad − despachado`), sin importar si ya se había fabricado o no; ahora solo se ofrecen
// (y se puede programar hasta) las piezas que YA existen físicamente en planta
// (`_disponibleDespachoFila()` = fabricado − despachado). Una fila con pendiente de despacho
// pero nada fabricado todavía simplemente no aparece acá.
// `despachoProgramadoId` opcional (2026-10-21) — mismo mecanismo de edición que
// `abrirModalProgramarProduccion(programacionId)`, ver esa nota para el porqué. Una
// programación de despacho sin cargar no resta nada de lo disponible (solo lo hace
// `guardarCargaDespacho()`, vía `despachos[]`), así que la lista de filas ofrecidas no
// necesita ningún ajuste especial en modo edición.
function abrirModalProgramarDespacho(despachoProgramadoId) {
  const editando = despachoProgramadoId ? _despachosProgramadosLosaActual.find(x => x.id === despachoProgramadoId) : null;
  document.getElementById('mpd-id').value = editando ? editando.id : '';
  document.getElementById('modal-programar-despacho-titulo').textContent = editando ? '✏️ Editar programación de despacho' : '📋 Programar despacho';
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  const esVigueta = !!l && l.sistema === 'vigueta_bovedilla';
  const esPanel = !!l && l.sistema === 'paneles_cerramiento';
  const conDisponible = _filasLosaActual.filter(f => _disponibleDespachoFila(f, _despachosLosaActual) > 0);
  document.getElementById('mpd-fecha').value = editando ? (editando.fecha || _fmtISO(new Date())) : _fmtISO(new Date());
  document.getElementById('mpd-observaciones').value = editando ? (editando.observaciones || '') : '';
  document.getElementById('mpd-filtros-lista').innerHTML = '';
  // Encabezado dinámico — ver la misma nota en `abrirModalProgramarProduccion()`.
  document.getElementById('mpd-filas-thead').innerHTML = `<tr>
    <th style="width:28px"><input type="checkbox" onchange="_marcarTodasFilasProgramarDespacho(this.checked)"></th>
    <th>Cuadro</th><th>Ejes num.</th><th>Ejes alfa.</th>
    ${esVigueta
      ? '<th>Vigueta</th><th>Hilos Abajo</th><th>Hilos Arriba</th>'
      : esPanel
        ? '<th>Clasif.</th><th>Ancho (cm)</th><th>Largo A</th><th>Largo B</th>'
        : '<th>Ancho (cm)</th><th>Hilos</th>'}
    <th>Dimensión</th><th>Disponible</th><th>A programar</th>
  </tr>`;
  const tbody = document.getElementById('mpd-filas-body');
  const colspanVacio = esVigueta ? 10 : esPanel ? 11 : 9;
  if (!conDisponible.length) {
    tbody.innerHTML = `<tr><td colspan="${colspanVacio}" style="text-align:center;color:var(--gris-medio);padding:10px">No hay piezas disponibles para despacho todavía (nada fabricado pendiente de despachar).</td></tr>`;
  } else {
    // Columnas "Ejes num."/"Ejes alfa."/"Ancho"/"Hilos" (2026-10-19/2026-10-22, ver nota en
    // `abrirModalProgramarProduccion()`).
    tbody.innerHTML = conDisponible.map(f => {
      const disp = _disponibleDespachoFila(f, _despachosLosaActual);
      const lineaExistente = editando ? (editando.lineas || []).find(l2 => l2.filaId === f.id) : null;
      const valorInicial = lineaExistente ? lineaExistente.cantidadProgramada : 0;
      const colEspecifica = esVigueta
        ? `<td>${_esc(f.tipoVigueta) || '—'}</td><td style="text-align:center">${f.hilosAbajo || 0}</td><td style="text-align:center">${f.hilosArriba || 0}</td>`
        : esPanel
          ? `<td>${_etiquetaClasificacionPanel(f.clasificacion)}</td><td style="text-align:center">${f.ancho || 0}</td><td style="text-align:right">${(Number(f.largoA) || 0).toFixed(2)} m</td><td style="text-align:right">${(Number(f.largoB) || 0).toFixed(2)} m</td>`
          : `<td style="text-align:center">${f.ancho || 0}</td><td style="text-align:center">${f.hilos || 0}</td>`;
      return `<tr data-cuadro="${_escAttr(f.cuadro || '')}" data-eje-num="${_escAttr(f.ejesEntre || '')}" data-eje-alfa="${_escAttr(f.laterales || '')}" data-ancho="${f.ancho || 0}" data-hilos="${f.hilos || 0}" data-dimension="${f.dimension || 0}" data-clasificacion="${_escAttr(f.clasificacion || '')}" data-fabricado="${_fabricadoFila(f)}" data-pend-prod="${_pendienteProduccionFila(f)}" data-pend-desp="${_pendienteDespachoFila(f, _despachosLosaActual)}" data-disponible="${disp}" data-despachado="${_despachadoFila(f.id, _despachosLosaActual)}">
        <td><input type="checkbox" class="mpd-chk-fila" onchange="_marcarFilaProgramarDespacho(this)"></td>
        <td>${_esc(f.cuadro || '')}</td>
        <td>${_esc(f.ejesEntre) || '—'}</td>
        <td>${_esc(f.laterales) || '—'}</td>
        ${colEspecifica}
        <td>${f.dimension || 0} m</td>
        <td>${disp}</td>
        <td><input type="number" min="0" max="${disp}" value="${valorInicial}" data-fila-id="${_escAttr(f.id)}" data-disponible="${disp}" oninput="_actualizarResumenPesoDespacho()" style="width:70px"></td>
      </tr>`;
    }).join('');
  }
  _poblarSelectVehiculoDespacho();
  if (editando && editando.vehiculo) document.getElementById('mpd-vehiculo').value = editando.vehiculo;
  document.getElementById('modal-programar-despacho').classList.add('abierto');
  _actualizarResumenPesoDespacho();
}
function _marcarFilaProgramarDespacho(checkbox) {
  const input = checkbox.closest('tr').querySelector('input[data-fila-id]');
  if (input) input.value = checkbox.checked ? input.dataset.disponible : 0;
  _actualizarResumenPesoDespacho();
}
// Peso del despacho vs. capacidad del vehículo (2026-10-19, a pedido del usuario: "condicionemos
// también el peso del despacho a la capacidad que tenemos de los vehículos sencillos como lo
// tenemos codificado actualmente en la ventana de logística. podríamos poner un desplegable para
// escoger el tipo de vehículo y en función de este, programar el peso máximo") — reutiliza
// `CAPACIDAD_VEHICULO` (toneladas) de `js/logistica.js` tal cual, sin duplicar el catálogo de
// vehículos: si la flota cambia ahí, acá se actualiza sola. `logistica.js` carga antes que este
// archivo (ver orden de `<script>` en cotizaciones.html), así que la `const` ya existe como
// variable global de nivel superior cuando se usa acá (mismo mecanismo que ya usa toda la app
// con `sb` de `js/config.js` — ver memoria de sesión sobre por qué esto SÍ funciona aunque sea
// `const`, a diferencia de intentar engancharlo vía `window.X`).
function _poblarSelectVehiculoDespacho() {
  const select = document.getElementById('mpd-vehiculo');
  if (!select) return;
  select.innerHTML = '<option value="">Selecciona un vehículo...</option>' +
    Object.keys(CAPACIDAD_VEHICULO).map(v => `<option value="${_escAttr(v)}">${_esc(v)} (${CAPACIDAD_VEHICULO[v]} ton)</option>`).join('');
  select.value = '';
}
function _pesoProgramadoDespacho() {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (!l) return 0;
  let totalKg = 0;
  document.querySelectorAll('#mpd-filas-body input[data-fila-id]').forEach(inp => {
    const cantidad = parseFloat(inp.value) || 0;
    if (cantidad <= 0) return;
    const f = _filasLosaActual.find(x => x.id === inp.dataset.filaId);
    if (f) totalKg += _pesoFila({ ...f, cantidad }, l);
  });
  return totalKg;
}
function _actualizarResumenPesoDespacho() {
  const cont = document.getElementById('mpd-resumen-peso');
  if (!cont) return;
  const totalKg = _pesoProgramadoDespacho();
  const vehiculo = document.getElementById('mpd-vehiculo')?.value;
  const capacidadTon = vehiculo ? CAPACIDAD_VEHICULO[vehiculo] : null;
  const excedido = capacidadTon && totalKg > capacidadTon * 1000;
  cont.innerHTML = `<span style="color:${excedido ? 'var(--rojo)' : 'var(--gris-texto)'};font-weight:700">${(totalKg / 1000).toFixed(2)} ton${capacidadTon ? ' / ' + capacidadTon + ' ton' : ''}${excedido ? ' ⚠️ supera la capacidad' : ''}</span>`;
}
function _marcarTodasFilasProgramarDespacho(marcar) {
  document.querySelectorAll('#mpd-filas-body tr').forEach(tr => {
    if (tr.style.display === 'none') return;
    const chk = tr.querySelector('.mpd-chk-fila');
    if (!chk) return;
    chk.checked = marcar;
    _marcarFilaProgramarDespacho(chk);
  });
}
function guardarProgramacionDespacho() {
  const fecha = document.getElementById('mpd-fecha').value;
  if (!fecha) { alert('Elige una fecha.'); return; }
  const vehiculo = document.getElementById('mpd-vehiculo').value;
  if (!vehiculo) { alert('Selecciona el vehículo que va a cargar este despacho — el peso máximo se calcula según su capacidad.'); return; }
  const inputs = document.querySelectorAll('#mpd-filas-body input[data-fila-id]');
  const lineas = [];
  // Tope duro contra lo DISPONIBLE (2026-10-19) — el `max` del <input> es solo una sugerencia
  // visual (no impide escribir un número mayor a mano), así que se vuelve a comprobar acá contra
  // el disponible real de cada fila en este momento antes de guardar, no solo contra el atributo
  // `data-disponible` que quedó congelado al abrir el modal.
  for (const inp of inputs) {
    const cantidadProgramada = parseFloat(inp.value) || 0;
    if (cantidadProgramada <= 0) continue;
    const f = _filasLosaActual.find(x => x.id === inp.dataset.filaId);
    const disp = f ? _disponibleDespachoFila(f, _despachosLosaActual) : 0;
    if (cantidadProgramada > disp) {
      alert(`El cuadro "${f?.cuadro || '—'}" solo tiene ${disp} unidad(es) disponible(s) para despacho (lo fabricado menos lo ya despachado) — corrige la cantidad a programar antes de guardar.`);
      return;
    }
    lineas.push({ filaId: inp.dataset.filaId, cantidadProgramada, cantidadReal: null });
  }
  if (!lineas.length) { alert('Ingresa al menos una cantidad a programar.'); return; }
  // Capacidad del vehículo — informativo, YA NO bloquea el guardado (corregido 2026-10-20, a
  // pedido del usuario: "mostremos el aviso de que supera el peso máximo a modo informativo
  // pero sin restringir el despacho" — antes era un tope duro que impedía guardar del todo si
  // el peso programado pasaba de la capacidad; en la práctica a veces sí hace falta sobrecargar
  // un vehículo a propósito, y el aviso no debía impedirlo). El aviso en sí se mantiene, en
  // vivo, mientras se arma la programación — `_actualizarResumenPesoDespacho()` ya muestra el
  // peso en rojo con "⚠️ supera la capacidad" apenas se pasa, antes incluso de intentar guardar
  // — así que acá ya no hace falta recalcular el peso total ni la capacidad, se quitó junto con
  // el bloqueo (nada más lo usaba).
  // Edita in-situ si `#mpd-id` trae una programación existente — ver la misma nota en
  // `guardarProgramacionProduccion()`.
  const editId = document.getElementById('mpd-id').value;
  const observaciones = document.getElementById('mpd-observaciones').value.trim();
  if (editId) {
    const idx = _despachosProgramadosLosaActual.findIndex(x => x.id === editId);
    if (idx >= 0) _despachosProgramadosLosaActual[idx] = { ..._despachosProgramadosLosaActual[idx], fecha, observaciones, vehiculo, lineas };
  } else {
    _despachosProgramadosLosaActual.push({ id: String(Date.now()), fecha, observaciones, vehiculo, lineas });
  }
  _guardarLosaActual();
  cerrarModal('modal-programar-despacho');
  renderDespachoProgramado();
  alert(editId ? 'Programación de despacho actualizada.' : 'Despacho programado guardado. Cuando salga el camión, regístralo con "+ Cargar despacho".');
}

// Imprimible de la PROGRAMACIÓN DE DESPACHO (2026-10-17, a pedido del usuario: "en la
// programación de despachos, incluyamos el botón de imprimir, para poder pasar el impreso de
// lo que se debe organizar y cargar en el viaje") — mismo patrón EXACTO que
// `imprimirProgramacionProduccion()` (membrete + clases compartidas, resumen por medidas al
// pie), con dos diferencias: título/firmas propios de despacho, y SIN remisión (esa se captura
// recién en "+ Cargar despacho" — acá todavía es solo un plan, el camión ni ha llegado).
// Factorizada en `_htmlProgramacionDespacho()` (2026-10-21) — mismo motivo exacto que
// `_htmlProgramacionProduccion()`: hace falta imprimir también una programación YA GUARDADA
// directo desde la tarjeta "Despachos programados", sin abrir el modal
// (`imprimirProgramacionDespachoGuardada()`, más abajo).
function _htmlProgramacionDespacho(l, p, sis, esVigueta, fecha, observaciones, vehiculo, lineas, origen) {
  const esPanel = l.sistema === 'paneles_cerramiento';
  // Peso como columna adicional (2026-10-17, a pedido del usuario: "en el imprimible de
  // despachos, a diferencia del de producción, es muy importante incluir el peso... " —
  // logística necesita saber cuánto pesa lo que va en cada viaje, a producción no le hace
  // falta en SU imprimible, ver el que no lo lleva más arriba). Reusa `_pesoFila()` (mismo
  // cálculo exacto de la pantalla normal), pero sobre la CANTIDAD que se está imprimiendo —
  // que puede ser menor a `f.cantidad` si solo se programa una parte de la fila — en vez de la
  // cantidad total de la fila.
  let totalPiezas = 0, totalPeso = 0;
  // Cuadro detallado partido en 2 columnas, de menor jerarquía (2026-10-22, ver nota en
  // `_htmlProgramacionProduccion()` — mismo criterio, con la columna de Peso que sí le sirve a
  // Despacho para repartir la carga entre viajes, aunque el peso total ya se vea arriba en
  // "Vehículo (X ton)" y en el RESUMEN POR MEDIDAS).
  const filas = lineas.map(({ f, cantidad }, n) => {
    const peso = _pesoFila({ ...f, cantidad }, l);
    totalPiezas += cantidad;
    totalPeso += peso;
    // Paneles de Cerramiento (2026-10-29) — ver nota análoga en `_htmlProgramacionProduccion()`.
    if (esPanel) {
      return `<tr style="border-bottom:1px solid #EDF2F7">
        <td style="padding:3px 4px;color:#999">${n + 1}</td>
        <td style="padding:3px 4px;font-weight:600">${_esc(f.cuadro) || '—'}</td>
        <td style="padding:3px 4px">${_etiquetaClasificacionPanel(f.clasificacion)}</td>
        <td style="padding:3px 4px;text-align:center">${f.ancho || 0}</td>
        <td style="padding:3px 4px;text-align:right">${(Number(f.largoA) || 0).toFixed(2)}</td>
        <td style="padding:3px 4px;text-align:right">${(Number(f.largoB) || 0).toFixed(2)}</td>
        <td style="padding:3px 4px;text-align:center;font-weight:700">${cantidad}</td>
        <td style="padding:3px 4px;text-align:right">${peso.toFixed(1)}</td>
        <td style="padding:3px 4px;min-width:45px"></td>
      </tr>`;
    }
    const hilosTxt = esVigueta ? `${Number(f.hilosAbajo) || 0}+${Number(f.hilosArriba) || 0}` : String(Number(f.hilos) || 0);
    const colEspecifica = esVigueta
      ? `<td style="padding:3px 4px">${_esc(f.tipoVigueta) || '—'}</td>`
      : `<td style="padding:3px 4px;text-align:center">${f.ancho || 0}</td>`;
    return `<tr style="border-bottom:1px solid #EDF2F7">
      <td style="padding:3px 4px;color:#999">${n + 1}</td>
      <td style="padding:3px 4px;font-weight:600">${_esc(f.cuadro) || '—'}</td>
      ${colEspecifica}
      <td style="padding:3px 4px;text-align:center">${hilosTxt}</td>
      <td style="padding:3px 4px;text-align:right">${(Number(f.dimension) || 0).toFixed(2)}</td>
      <td style="padding:3px 4px;text-align:center;font-weight:700">${cantidad}</td>
      <td style="padding:3px 4px;text-align:right">${peso.toFixed(1)}</td>
      <td style="padding:3px 4px;min-width:45px"></td>
    </tr>`;
  });
  const detalleHTML = _cuadroDetalladoDosColsHTML(filas, _cuadroDetalladoTheadHTML(esVigueta, esPanel, true));

  // "← Volver" reabre el modal — ver la nota junto al mismo botón en
  // `_htmlProgramacionProduccion()`, mismo motivo exacto. Solo si `origen === 'modal'`.
  const volverOnclick = origen === 'modal'
    ? "document.getElementById('vista-previa').style.display='none';document.getElementById('pantalla-losa-detalle').classList.add('activa');document.getElementById('modal-programar-despacho').classList.add('abierto')"
    : "document.getElementById('vista-previa').style.display='none';document.getElementById('pantalla-losa-detalle').classList.add('activa')";
  return `
    <div class="no-print" style="background:#1C2333;color:white;padding:12px 24px;display:flex;align-items:center;gap:16px">
      <span style="font-weight:700">Programación de Despacho — ${_esc(l.nombre)}</span>
      <div style="flex:1"></div>
      <button onclick="descargarPDFProgramacionDespacho()" style="background:#1976D2;color:white;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-weight:700" id="btn-pdf-programacion-despacho">⬇️ Descargar PDF</button>
      <button onclick="${volverOnclick}" style="background:#555;color:white;border:none;padding:8px 14px;border-radius:5px;cursor:pointer">← Volver</button>
    </div>
    <div class="preview-doc" id="pd-prog-preview-doc">
      <div class="preview-membrete-header"><img src="membrete-top.jpg" alt=""></div>
      <div class="preview-content" id="pd-prog-preview-content" style="padding-top:6px">
        <div style="text-align:center;font-size:12px;font-weight:700;color:#003F7F;letter-spacing:0.03em;margin-bottom:8px">PROGRAMACIÓN DE DESPACHO</div>
        <div style="padding-bottom:6px;border-bottom:1px solid #eee;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div style="font-size:14px;font-weight:700;color:#003F7F">${_esc(l.nombre)}${l.ubicacion ? ' — ' + _esc(l.ubicacion) : ''}</div>
            <div style="font-size:11px;color:#555">${fecha ? new Date(fecha + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</div>
          </div>
          <div style="font-size:12px;font-weight:600;margin-top:2px">${_esc(p?.nombre) || '—'}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px;margin-top:6px;text-align:center">
            <div><div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.04em">Sistema</div><div style="font-size:12px;font-weight:700;color:#003F7F;margin-top:2px">${sis ? _esc(sis.etiqueta) : '—'}</div></div>
            <div><div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.04em">Piezas a programar</div><div style="font-size:12px;font-weight:700;color:#003F7F;margin-top:2px">${totalPiezas} piezas en ${lineas.length} fila${lineas.length === 1 ? '' : 's'}</div></div>
            <div><div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.04em">Vehículo (${(totalPeso / 1000).toFixed(2)} ton)</div><div style="font-size:12px;font-weight:700;color:#003F7F;margin-top:2px">${_esc(vehiculo) || '—'}</div></div>
          </div>
          ${observaciones ? `<div style="margin-top:6px;font-size:10.5px"><b>OBSERVACIONES:</b> ${_esc(observaciones)}</div>` : ''}
        </div>
        ${_resumenPorMedidasHTML(lineas, l)}
        ${detalleHTML}
        <div class="preview-firma" style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
          <div style="border-top:1px solid #333;padding-top:6px;text-align:center;font-size:11px;color:#555">Programado por</div>
          <div style="border-top:1px solid #333;padding-top:6px;text-align:center;font-size:11px;color:#555">Cargado por</div>
        </div>
      </div>
      <div class="preview-membrete-footer" id="pd-prog-preview-footer">
        <div class="pf-arco"></div>
        <div class="pf-datos">
          <div class="pf-col"><span class="pf-icon">📞</span><span>+57 314 620 1650<br>+57 311 408 2285</span></div>
          <div class="pf-col"><span class="pf-icon">🏠</span><span>Autopista del Café Km2<br>Vía Chinchiná – Santa Rosa</span></div>
          <div class="pf-col"><span class="pf-icon">🌐</span><span>www.proconcreto.com.co</span></div>
        </div>
      </div>
    </div>`;
}
function imprimirProgramacionDespacho() {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (!l) return;
  const p = PROYECTOS.find(x => x.id === _PROYECTO_ACTIVO_ID);
  const sis = SISTEMAS_ENTREPISO.find(s => s.clave === l.sistema);
  const esVigueta = l.sistema === 'vigueta_bovedilla';
  const fecha = document.getElementById('mpd-fecha').value;
  const observaciones = document.getElementById('mpd-observaciones').value.trim();
  const vehiculo = document.getElementById('mpd-vehiculo').value;
  const lineas = [];
  document.querySelectorAll('#mpd-filas-body input[data-fila-id]').forEach(inp => {
    const cantidad = parseFloat(inp.value) || 0;
    if (cantidad <= 0) return;
    const f = _filasLosaActual.find(x => x.id === inp.dataset.filaId);
    if (f) lineas.push({ f, cantidad });
  });
  if (!lineas.length) { alert('Ingresa al menos una cantidad a programar antes de imprimir.'); return; }
  _fechaProgramacionImpresa = fecha || new Date().toISOString().split('T')[0];
  document.getElementById('contenido-preview').innerHTML = _htmlProgramacionDespacho(l, p, sis, esVigueta, fecha, observaciones, vehiculo, lineas, 'modal');
  // El modal queda tapado por el fondo oscuro de #vista-previa si no se cierra primero (el
  // z-index de los modales es mayor al de #vista-previa).
  cerrarModal('modal-programar-despacho');
  document.getElementById('vista-previa').style.display = 'block';
  document.querySelectorAll('.pantalla').forEach(p2 => p2.classList.remove('activa'));
  window.scrollTo(0, 0);
}
// "🖨️ Formato" directo desde la tarjeta "Despachos programados" (2026-10-21) — ver
// `imprimirProgramacionProduccionGuardada()`, mismo patrón exacto.
function imprimirProgramacionDespachoGuardada(id) {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (!l) return;
  const prog = _despachosProgramadosLosaActual.find(x => x.id === id);
  if (!prog) return;
  const p = PROYECTOS.find(x => x.id === _PROYECTO_ACTIVO_ID);
  const sis = SISTEMAS_ENTREPISO.find(s => s.clave === l.sistema);
  const esVigueta = l.sistema === 'vigueta_bovedilla';
  const lineas = [];
  (prog.lineas || []).forEach(ln => {
    const cantidad = Number(ln.cantidadProgramada) || 0;
    if (cantidad <= 0) return;
    const f = _filasLosaActual.find(x => x.id === ln.filaId);
    if (f) lineas.push({ f, cantidad });
  });
  if (!lineas.length) { alert('Esta programación no tiene líneas para imprimir.'); return; }
  _fechaProgramacionImpresa = prog.fecha || new Date().toISOString().split('T')[0];
  document.getElementById('contenido-preview').innerHTML = _htmlProgramacionDespacho(l, p, sis, esVigueta, prog.fecha, prog.observaciones || '', prog.vehiculo || '', lineas, 'tarjeta');
  document.getElementById('vista-previa').style.display = 'block';
  document.querySelectorAll('.pantalla').forEach(p2 => p2.classList.remove('activa'));
  window.scrollTo(0, 0);
}
async function descargarPDFProgramacionDespacho() {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  const fecha = (_fechaProgramacionImpresa || new Date().toISOString().split('T')[0]).replace(/-/g, '_');
  const nombreLosa = (l?.nombre || 'losa').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().replace(/\s+/g, '_');
  await _descargarPDFConMembrete('pd-prog-preview-content', 'pd-prog-preview-footer', `Programacion_Despacho_${nombreLosa}_${fecha}.pdf`, 'btn-pdf-programacion-despacho');
}

// "Cargar despacho" — mismo patrón que "Cargar producción" (línea ya cargada sigue siendo
// editable, para poder corregir errores), más la remisión real del camión, que producción no
// necesita. Al guardar, reconstruye por completo la entrada de esta programación en el libro
// real `despachos[]` (find-or-create por `despachoProgramadoId`) a partir de TODAS las líneas
// ya cargadas de este plan — nunca parcial ni duplicado, así `_pendienteDespachoFila()` sigue
// funcionando exactamente igual que antes, sin tocar su fórmula.
function abrirModalCargarDespacho() {
  const todas = _despachosProgramadosLosaActual;
  const select = document.getElementById('mcd-select-programacion');
  document.getElementById('mcd-sin-programaciones').style.display = todas.length ? 'none' : '';
  document.getElementById('mcd-fecha').value = _fmtISO(new Date());
  document.getElementById('mcd-remision').value = ''; // se vuelve a prellenar en _renderLineasCargarDespacho() según la programación elegida
  if (!todas.length) {
    select.innerHTML = '';
    document.getElementById('mcd-contenido').style.display = 'none';
    document.getElementById('mcd-btn-guardar').style.display = 'none';
  } else {
    select.innerHTML = todas.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(p => {
      const totalProgramado = (p.lineas || []).reduce((s, l) => s + (Number(l.cantidadProgramada) || 0), 0);
      const porCargar = (p.lineas || []).filter(l => l.cantidadReal == null).length;
      const fechaTxt = p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : '—';
      return `<option value="${_escAttr(p.id)}">${fechaTxt} — ${(p.lineas || []).length} fila(s), ${totalProgramado} piezas programadas${porCargar > 0 ? ` (${porCargar} por cargar)` : ' (completa, editable)'}</option>`;
    }).join('');
    _renderLineasCargarDespacho();
  }
  document.getElementById('modal-cargar-despacho').classList.add('abierto');
}
function _renderLineasCargarDespacho() {
  const select = document.getElementById('mcd-select-programacion');
  const p = _despachosProgramadosLosaActual.find(x => x.id === select.value);
  const tbody = document.getElementById('mcd-filas-body');
  if (!p) { document.getElementById('mcd-contenido').style.display = 'none'; document.getElementById('mcd-btn-guardar').style.display = 'none'; return; }
  document.getElementById('mcd-contenido').style.display = '';
  document.getElementById('mcd-btn-guardar').style.display = '';
  const inpRemision = document.getElementById('mcd-remision');
  if (!inpRemision.value) inpRemision.value = p.remision || '';
  tbody.innerHTML = (p.lineas || []).map((linea, li) => {
    const f = _filasLosaActual.find(x => x.id === linea.filaId);
    const cargada = linea.cantidadReal != null;
    const valorActual = cargada ? linea.cantidadReal : linea.cantidadProgramada;
    return `<tr${cargada ? ' style="background:#F1F8F4"' : ''}>
      <td>${_esc(f?.cuadro || '—')}</td>
      <td>${linea.cantidadProgramada}</td>
      <td>
        <input type="number" min="0" value="${valorActual}" data-linea-idx="${li}" style="width:70px">
        ${cargada ? '<span style="font-size:10px;color:var(--verde);margin-left:4px">✓ cargado</span>' : ''}
      </td>
    </tr>`;
  }).join('');
}
function guardarCargaDespacho() {
  const remision = document.getElementById('mcd-remision').value.trim();
  if (!remision) { alert('Ingresa el número de remisión.'); return; }
  const fecha = document.getElementById('mcd-fecha').value;
  if (!fecha) { alert('Elige una fecha.'); return; }
  const select = document.getElementById('mcd-select-programacion');
  const p = _despachosProgramadosLosaActual.find(x => x.id === select.value);
  if (!p) return;
  const inputs = document.querySelectorAll('#mcd-filas-body input[data-linea-idx]');
  let huboAlguna = false;
  inputs.forEach(inp => {
    if (inp.value === '') return; // se deja en blanco a propósito: sin cambios en esta línea
    const idx = parseInt(inp.dataset.lineaIdx, 10);
    const linea = p.lineas[idx];
    if (!linea) return;
    const nuevaCantidad = parseFloat(inp.value) || 0;
    const yaEstabaCargada = linea.cantidadReal != null;
    if (yaEstabaCargada && nuevaCantidad === linea.cantidadReal) return; // sin cambios reales
    linea.cantidadReal = nuevaCantidad;
    huboAlguna = true;
  });
  if (!huboAlguna) { alert('Ingresa al menos una cantidad despachada, o cambia alguna ya cargada para corregirla.'); return; }
  p.remision = remision;
  const lineasReales = (p.lineas || []).filter(l => l.cantidadReal != null && l.cantidadReal > 0).map(l => ({ filaId: l.filaId, cantidad: l.cantidadReal }));
  let entrada = _despachosLosaActual.find(d => d.despachoProgramadoId === p.id);
  if (entrada) {
    entrada.remision = remision; entrada.fecha = fecha; entrada.observaciones = p.observaciones; entrada.lineas = lineasReales;
  } else {
    _despachosLosaActual.push({ id: String(Date.now()), despachoProgramadoId: p.id, remision, fecha, observaciones: p.observaciones, lineas: lineasReales });
  }
  _guardarLosaActual();
  cerrarModal('modal-cargar-despacho');
  renderFilasProduccion();
  // Misma razón que en `guardarCargaProduccion()`: la programación recién cargada puede pasar
  // de "programada" a "registrada" — se refrescan las dos tarjetas juntas, siempre.
  renderDespachoProgramado();
  renderDespachosRegistrados();
  alert('Despacho cargado.');
}

// "Despachos programados" (2026-10-21) — misma lógica EXACTA que "Producciones programadas"
// (ver esa nota junto a `renderProduccionProgramada()`), del lado de Despacho. Trae además la
// columna "Vehículo" (acá sí hay un dato propio de la programación que vale la pena ver de un
// vistazo, a diferencia de Producción).
function renderDespachoProgramado() {
  const tbody = document.getElementById('despacho-programado-body');
  if (!tbody) return;
  const sinCargar = _despachosProgramadosLosaActual.filter(p => (p.lineas || []).every(l => l.cantidadReal == null));
  if (!sinCargar.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--gris-medio);padding:10px">No hay despachos programados todavía.</td></tr>`;
    return;
  }
  tbody.innerHTML = sinCargar.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(p => {
    const totalProgramado = (p.lineas || []).reduce((s, l) => s + (Number(l.cantidadProgramada) || 0), 0);
    return `<tr>
      <td>${p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${(p.lineas || []).length} fila(s), ${totalProgramado} piezas programadas</td>
      <td>${_esc(p.vehiculo) || '—'}</td>
      <td>${_esc(p.observaciones) || '—'}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-secundario btn-xs" onclick="imprimirProgramacionDespachoGuardada('${_escAttr(p.id)}')">🖨️ Formato</button>
          <button class="btn btn-primario btn-xs" onclick="editarProgramacionDespacho('${_escAttr(p.id)}')">✏️ Editar</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarProgramacionDespacho('${_escAttr(p.id)}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}
function editarProgramacionDespacho(id) {
  abrirModalProgramarDespacho(id);
}
function eliminarProgramacionDespacho(id) {
  const p = _despachosProgramadosLosaActual.find(x => x.id === id);
  if (!p) return;
  const fechaTxt = p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : 'sin fecha';
  if (!confirm(`¿Eliminar la programación de despacho del ${fechaTxt}? Todavía no tiene nada cargado, así que no afecta ningún pendiente.`)) return;
  _despachosProgramadosLosaActual = _despachosProgramadosLosaActual.filter(x => x.id !== id);
  _guardarLosaActual();
  renderDespachoProgramado();
}

// "Despachos registrados" — misma lógica EXACTA que "🏗️ Producciones registradas" de
// Producción (2026-10-17, a pedido del usuario: "en la ventana de despachos, eliminaste el
// segundo cuadro que mostraba el resumen de despachos... inclúyelo nuevamente, con la misma
// lógica que tiene en la ventana de producción, el segundo cuadro de Producciones
// registradas") — tarjeta SIEMPRE VISIBLE debajo de la tabla de filas (no modal: el intento
// anterior lo había puesto detrás de un botón "📜 Historial de despachos", que se quitó del
// todo para volver al mismo patrón de tarjeta que Producción). Lista las
// `despachosProgramados[]` que ya tienen AL MENOS una línea cargada; "Contenido" cuenta solo
// lo REALMENTE despachado, no lo programado.
// Columna ACCIONES — misma lógica EXACTA que "🏗️ Producciones registradas" (2026-10-18, a
// pedido del usuario: ver nota junto a `renderProduccionRegistrada()`).
function renderDespachosRegistrados() {
  const tbody = document.getElementById('despachos-registrados-body');
  if (!tbody) return;
  const conCarga = _despachosProgramadosLosaActual.filter(p => (p.lineas || []).some(l => l.cantidadReal != null));
  if (!conCarga.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--gris-medio);padding:10px">No hay despachos cargados todavía.</td></tr>`;
    return;
  }
  tbody.innerHTML = conCarga.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(p => {
    const cargadas = (p.lineas || []).filter(l => l.cantidadReal != null);
    const pendientes = (p.lineas || []).length - cargadas.length;
    const totalDespachado = cargadas.reduce((s, l) => s + (Number(l.cantidadReal) || 0), 0);
    return `<tr>
      <td>${_esc(p.remision) || '—'}</td>
      <td>${p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${cargadas.length} fila(s), ${totalDespachado} piezas despachadas${pendientes > 0 ? ` (${pendientes} por cargar)` : ''}</td>
      <td>${_esc(p.observaciones) || '—'}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-secundario btn-xs" onclick="verDetalleDespachoRegistrado('${_escAttr(p.id)}')">👁️ Detalle</button>
          <button class="btn btn-primario btn-xs" onclick="editarDespachoRegistrado('${_escAttr(p.id)}')">✏️ Editar</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarDespachoRegistrado('${_escAttr(p.id)}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}
// "✏️ Editar" — abre "+ Cargar despacho" con esta programación ya seleccionada.
function editarDespachoRegistrado(id) {
  abrirModalCargarDespacho();
  const select = document.getElementById('mcd-select-programacion');
  if (select) { select.value = id; _renderLineasCargarDespacho(); }
}
// "🗑️ Borrar" — elimina la programación completa (plan + lo cargado), igual que
// `eliminarProduccionRegistrada()`, y ADEMÁS quita la entrada correspondiente del libro real
// `despachos[]` (`despachoProgramadoId === p.id`) — a diferencia de Producción, acá sí hay un
// segundo lugar donde queda la carga (`guardarCargaDespacho()` lo crea aparte, por remisión), y
// si no se borrara también de ahí, el peso/los totales de despacho seguirían contando piezas
// que ya no tienen ninguna programación detrás.
function eliminarDespachoRegistrado(id) {
  const p = _despachosProgramadosLosaActual.find(x => x.id === id);
  if (!p) return;
  const fechaTxt = p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : 'sin fecha';
  if (!confirm(`¿Eliminar el despacho registrado (remisión ${p.remision || '—'}, ${fechaTxt})? Se borra la programación completa y las cantidades despachadas que tenía cargadas — el pendiente de despacho de esas filas vuelve a subir.`)) return;
  _despachosLosaActual = _despachosLosaActual.filter(d => d.despachoProgramadoId !== p.id);
  _despachosProgramadosLosaActual = _despachosProgramadosLosaActual.filter(x => x.id !== id);
  _guardarLosaActual();
  renderFilasProduccion();
  renderDespachosRegistrados();
}
// Detalle de solo lectura ("👁️ Detalle") — mismo contenido que ve "+ Cargar despacho" (Cuadro /
// Programado / Despachado), sin inputs: es historial.
// Columnas Ancho/Hilos (o Vigueta/Hilos Abajo/Hilos Arriba) + Largo (2026-10-19, a pedido del
// usuario: mismo cambio pedido para "Detalle de producción cargada", aplicado también acá
// ("ten en cuenta los cambios que hemos hecho hoy también en la ventana de despachos en
// proyectos") — ver la nota completa en `verDetalleProduccionRegistrada()`, es exactamente el
// mismo criterio.
function verDetalleDespachoRegistrado(id) {
  const p = _despachosProgramadosLosaActual.find(x => x.id === id);
  if (!p) return;
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  const esVigueta = !!l && l.sistema === 'vigueta_bovedilla';
  document.getElementById('vdd-remision').textContent = p.remision || '—';
  document.getElementById('vdd-fecha').textContent = p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : '—';
  document.getElementById('vdd-observaciones').textContent = p.observaciones || '—';
  document.getElementById('vdd-thead').innerHTML = `<tr>
    <th>Cuadro</th>
    ${esVigueta ? '<th>Vigueta</th><th>Hilos Abajo</th><th>Hilos Arriba</th>' : '<th>Ancho (cm)</th><th>Hilos</th>'}
    <th>Largo (m)</th>
    <th>Programado</th><th>Despachado</th>
  </tr>`;
  document.getElementById('vdd-filas-body').innerHTML = (p.lineas || []).map(linea => {
    const f = _filasLosaActual.find(x => x.id === linea.filaId);
    const cargada = linea.cantidadReal != null;
    const colEspecifica = esVigueta
      ? `<td>${_esc(f?.tipoVigueta) || '—'}</td><td style="text-align:center">${f?.hilosAbajo || 0}</td><td style="text-align:center">${f?.hilosArriba || 0}</td>`
      : `<td style="text-align:center">${f?.ancho || 0}</td><td style="text-align:center">${f?.hilos || 0}</td>`;
    return `<tr>
      <td>${_esc(f?.cuadro || '—')}</td>
      ${colEspecifica}
      <td style="text-align:center">${f?.dimension || 0}</td>
      <td>${linea.cantidadProgramada}</td>
      <td>${cargada ? linea.cantidadReal : '<span style="color:var(--naranja)">Pendiente</span>'}</td>
    </tr>`;
  }).join('');
  document.getElementById('modal-detalle-despacho').classList.add('abierto');
}

// ── Bovedilla — sin control fila-por-fila, solo cantidad requerida + entradas/salidas por
// remisión (a pedido del usuario: "no es tan riguroso su control... como fabricar un bloque
// de cemento") ──
// En modo 'lista' (Ingeniería) se edita tipo/cantidad requerida, sin ver el seguimiento. En
// modo 'produccion' se ve tipo/cantidad de solo lectura + SOLO las entradas (lo que define
// Ingeniería no se toca acá). En modo 'despacho', igual pero con SOLO las salidas — Producción
// y Despachos quedan tan separados en Bovedilla como en las filas normales.
function renderBovedillaLosa() {
  const b = _bovedillaLosaActual;
  const esLista = _MODO_FLUJO_LOSA === 'lista';
  const esProduccion = _MODO_FLUJO_LOSA === 'produccion';
  const esDespacho = _MODO_FLUJO_LOSA === 'despacho';
  document.getElementById('bov-campos-editables').style.display = esLista ? '' : 'none';
  document.getElementById('bov-campos-solo-lectura').style.display = esLista ? 'none' : '';
  document.getElementById('bov-resumen').style.display = esLista ? 'none' : '';
  document.getElementById('bov-seguimiento').style.display = esLista ? 'none' : '';
  document.getElementById('bov-columna-produccion').style.display = esProduccion ? '' : 'none';
  document.getElementById('bov-columna-despacho').style.display = esDespacho ? '' : 'none';
  if (esLista) {
    const elTipo = document.getElementById('bov-tipo');
    const elCant = document.getElementById('bov-cantidad-requerida');
    if (elTipo) elTipo.value = b?.tipo || '';
    if (elCant) elCant.value = b?.cantidadRequerida || 0;
    return;
  }
  document.getElementById('bov-campos-solo-lectura').textContent = `Tipo: ${b?.tipo || '—'} — Cantidad requerida: ${Number(b?.cantidadRequerida) || 0}`;
  const req = Number(b?.cantidadRequerida) || 0;
  if (esProduccion) {
    const prod = (b?.produccion || []).reduce((s, e) => s + (Number(e.cantidad) || 0), 0);
    document.getElementById('bov-resumen').textContent = `Producido: ${prod} · Pendiente producción: ${Math.max(0, req - prod)}`;
    _renderEventosBovedilla('produccion', 'bov-produccion-body');
  } else {
    const desp = (b?.despacho || []).reduce((s, e) => s + (Number(e.cantidad) || 0), 0);
    document.getElementById('bov-resumen').textContent = `Despachado: ${desp} · Pendiente despacho: ${Math.max(0, req - desp)}`;
    _renderEventosBovedilla('despacho', 'bov-despacho-body');
  }
}
function _renderEventosBovedilla(campo, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const eventos = (_bovedillaLosaActual && _bovedillaLosaActual[campo]) || [];
  if (!eventos.length) { tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--gris-medio);padding:8px">Sin registros.</td></tr>`; return; }
  tbody.innerHTML = eventos.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(e => `<tr>
    <td>${e.remision ? _esc(e.remision) : '—'}</td>
    <td>${e.fecha ? new Date(e.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
    <td style="text-align:right">${e.cantidad}</td>
  </tr>`).join('');
}
function guardarDatosBovedilla() {
  if (!_bovedillaLosaActual) _bovedillaLosaActual = { tipo: '', cantidadRequerida: 0, produccion: [], despacho: [] };
  _bovedillaLosaActual.tipo = document.getElementById('bov-tipo').value.trim();
  _bovedillaLosaActual.cantidadRequerida = parseFloat(document.getElementById('bov-cantidad-requerida').value) || 0;
  _guardarLosaActual();
  renderBovedillaLosa();
  alert('Datos de bovedilla guardados.');
}
let _TIPO_EVENTO_BOVEDILLA = null;
function abrirModalEventoBovedilla(tipo) {
  _TIPO_EVENTO_BOVEDILLA = tipo; // 'produccion' | 'despacho'
  document.getElementById('meb-titulo').textContent = tipo === 'produccion' ? '📥 Registrar entrada de bovedilla' : '📦 Registrar despacho de bovedilla';
  document.getElementById('meb-remision').value = '';
  document.getElementById('meb-fecha').value = _fmtISO(new Date());
  document.getElementById('meb-cantidad').value = '';
  document.getElementById('modal-evento-bovedilla').classList.add('abierto');
}
function guardarEventoBovedilla() {
  const cantidad = parseFloat(document.getElementById('meb-cantidad').value) || 0;
  if (cantidad <= 0) { alert('Ingresa una cantidad mayor a cero.'); return; }
  const fecha = document.getElementById('meb-fecha').value;
  if (!fecha) { alert('Elige una fecha.'); return; }
  const remision = document.getElementById('meb-remision').value.trim();
  if (_TIPO_EVENTO_BOVEDILLA === 'despacho' && !remision) { alert('Ingresa el número de remisión.'); return; }
  if (!_bovedillaLosaActual) _bovedillaLosaActual = { tipo: '', cantidadRequerida: 0, produccion: [], despacho: [] };
  _bovedillaLosaActual[_TIPO_EVENTO_BOVEDILLA].push({ fecha, cantidad, remision: remision || null });
  _guardarLosaActual();
  cerrarModal('modal-evento-bovedilla');
  renderBovedillaLosa();
}
