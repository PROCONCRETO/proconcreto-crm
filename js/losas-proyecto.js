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
];

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
}
function renderCarpetasProyecto() {
  const grid = document.getElementById('grid-carpetas-proyecto');
  if (!grid) return;
  const losas = LOSAS_PROYECTO.filter(l => l.proyectoId === _PROYECTO_ACTIVO_ID);
  const nMemorias = losas.filter(l => l.memoriaCalculoPath).length;
  const nPlanos = losas.filter(l => l.planoPath).length;
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
    </div>`;
}
function volverAProyectos() {
  _PROYECTO_ACTIVO_ID = null;
  document.querySelectorAll('.pantalla').forEach(el => el.classList.remove('activa'));
  document.getElementById('pantalla-proyectos').classList.add('activa');
  renderProyectos();
}
function volverACarpetasProyecto() {
  document.querySelectorAll('.pantalla').forEach(el => el.classList.remove('activa'));
  document.getElementById('pantalla-proyecto-carpetas').classList.add('activa');
  renderCarpetasProyecto();
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
}
function volverALosasProyecto() {
  _LOSA_ACTIVA_ID = null;
  document.querySelectorAll('.pantalla').forEach(el => el.classList.remove('activa'));
  document.getElementById('pantalla-proyecto-losas').classList.add('activa');
  renderLosasProyecto();
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
  document.getElementById('modal-losa-titulo').textContent = esEdit ? `✏️ Editar Losa — ${l?.nombre || ''}` : '🏗️ Nueva Losa';
  document.getElementById('ml-id').value = id || '';
  document.getElementById('ml-nombre').value = l?.nombre || '';
  document.getElementById('ml-ubicacion').value = l?.ubicacion || '';
  document.getElementById('ml-sistema').value = l?.sistema || 'prelosa';
  document.getElementById('ml-estado').value = l?.estado || 'Planeación';
  document.getElementById('ml-espesor').value = l?.espesorCm || 5;
  document.getElementById('ml-densidad').value = l?.densidadKgM3 || 2400;
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
function _alCambiarSistemaLosa() {
  const esVigueta = document.getElementById('ml-sistema').value === 'vigueta_bovedilla';
  document.getElementById('ml-bloque-prelosa').style.display = esVigueta ? 'none' : '';
  document.getElementById('ml-bloque-vigueta').style.display = esVigueta ? '' : 'none';
}

async function guardarLosa() {
  const nombre = document.getElementById('ml-nombre').value.trim();
  if (!nombre) { alert('Completa el Nombre de la losa.'); return; }
  const sistema = document.getElementById('ml-sistema').value;
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
    espesorCm: parseFloat(document.getElementById('ml-espesor').value) || 0,
    densidadKgM3: parseFloat(document.getElementById('ml-densidad').value) || 0,
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
  if (!confirm(`¿Eliminar la losa "${l.nombre}"? Se pierde toda su lista de producción y su control de despacho.`)) return;
  const idx = LOSAS_PROYECTO.findIndex(x => x.id === id);
  LOSAS_PROYECTO = LOSAS_PROYECTO.filter(x => x.id !== id);
  renderLosasProyecto();
  _ofrecerDeshacer(`🗑️ Losa "${l.nombre}" eliminada`,
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
  document.querySelectorAll('.pantalla').forEach(el => el.classList.remove('activa'));
  document.getElementById('pantalla-losa-detalle').classList.add('activa');
  renderLosaDetalle();
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
  document.getElementById('losa-barra-lista').style.display = esLista ? '' : 'none';
  document.getElementById('losa-nota-pegar').style.display = esLista ? '' : 'none';
  document.getElementById('losa-btn-programar-produccion').style.display = esProduccion ? '' : 'none';
  document.getElementById('losa-btn-cargar-produccion').style.display = esProduccion ? '' : 'none';
  document.getElementById('losa-btn-produccion-diaria').style.display = esProduccion ? '' : 'none';
  document.getElementById('losa-btn-programar-despacho').style.display = esDespacho ? '' : 'none';
  document.getElementById('losa-btn-cargar-despacho').style.display = esDespacho ? '' : 'none';
  document.getElementById('losa-btn-historial-despachos').style.display = esDespacho ? '' : 'none';
  document.getElementById('losa-card-produccion-registrada').style.display = esProduccion ? '' : 'none';
  document.getElementById('losa-detalle-bloque-bovedilla').style.display = l.sistema === 'vigueta_bovedilla' ? '' : 'none';
  renderFilasProduccion();
  if (l.sistema === 'vigueta_bovedilla') renderBovedillaLosa();
  if (esProduccion) renderProduccionRegistrada();
}

// ── Filas de producción — columnas según sistema (Prelosa/Placa Alveolar: ancho+hilos;
// Vigueta: tipo+hilos abajo/arriba) ──
function renderFilasProduccion() {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (!l) return;
  const esVigueta = l.sistema === 'vigueta_bovedilla';
  // La tabla de "Listas de Producción" (Ingeniería) pasa TAL CUAL a Producción y a Despachos,
  // de solo lectura — cada una solo le suma la ÚNICA columna de pendiente que le importa a esa
  // área (2026-10-13, a pedido del usuario): Producción ve Pend. Producción (no le compete
  // Despacho), Despachos ve Pend. Despacho (no le compete Producción). Lista no ve ninguna de
  // las dos — ahí Ingeniería solo define la lista, el pendiente es ruido mientras nada se ha
  // producido/despachado todavía.
  const esLista = _MODO_FLUJO_LOSA === 'lista';
  const esProduccion = _MODO_FLUJO_LOSA === 'produccion';
  const thead = document.getElementById('filas-produccion-thead');
  // "Unidades fabricadas" (2026-10-15, a pedido del usuario), justo antes de "Pend.
  // Producción" — solo en modo producción, igual que el resto de columnas de seguimiento.
  thead.innerHTML = `<tr>
    <th>#</th><th>Cuadro</th><th>Ejes numéricos</th><th>Ejes alfabéticos</th>
    ${esVigueta ? '<th>Vigueta</th><th>Hilos Abajo</th><th>Hilos Arriba</th>' : '<th>Ancho (cm)</th><th>Hilos</th>'}
    <th>Dimensión (m)</th><th>Cantidad</th><th>Long. total (m)</th><th>Peso (kg)</th>
    ${esLista ? '' : (esProduccion ? '<th>Unidades fabricadas</th><th>Pend. Producción</th>' : '<th>Pend. Despacho</th>')}
    <th>Observaciones</th><th></th>
  </tr>`;
  const tbody = document.getElementById('filas-produccion-body');
  const tfoot = document.getElementById('filas-produccion-tfoot');
  if (!_filasLosaActual.length) {
    tbody.innerHTML = `<tr><td colspan="15" class="empty-state"><div class="icono">📋</div><div>No hay filas todavía — agrega una a mano, pégalas desde Excel o importa el archivo.</div></td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }
  tbody.innerHTML = _filasLosaActual.map((f, i) => _filaProduccionHTML(f, i, l, esVigueta)).join('');
  if (tfoot) tfoot.innerHTML = esProduccion ? _pieAvanceProduccionHTML() : '';
}

// Fila de avance al pie de la tabla, solo en modo producción (2026-10-15, a pedido del
// usuario: "pongamos al final... una fila de porcentaje de avance, donde el avance y el
// faltante sea ponderado, no por unidad (osea, longitud por unidades)") — pondera cada fila por
// su longitud total (dimensión × cantidad), no por cantidad de piezas sueltas: una fila con
// pocas piezas muy largas pesa en el avance tanto como corresponde a sus metros reales, no
// menos que una fila con muchas piezas cortas.
function _pieAvanceProduccionHTML() {
  let totalPonderado = 0, avancePonderado = 0;
  _filasLosaActual.forEach(f => {
    const dim = Number(f.dimension) || 0;
    const cant = Number(f.cantidad) || 0;
    const fabricadas = cant - _pendienteProduccionFila(f);
    totalPonderado += dim * cant;
    avancePonderado += dim * fabricadas;
  });
  const pctAvance = totalPonderado > 0 ? (avancePonderado / totalPonderado) * 100 : 0;
  const pctFaltante = 100 - pctAvance;
  const numCols = document.querySelectorAll('#filas-produccion-thead th').length || 1;
  return `<tr style="background:var(--azul-suave);font-weight:700">
    <td colspan="${numCols}" style="padding:10px;text-align:center;color:var(--azul)">
      📊 Avance de producción (ponderado por longitud): ${pctAvance.toFixed(1)}% avance · ${pctFaltante.toFixed(1)}% faltante
    </td>
  </tr>`;
}
// En modo 'lista' (Ingeniería) las celdas base son editables; en modo 'produccion'
// (Planta/Logística) se muestran de solo lectura — esa zona solo puede REGISTRAR avance
// (🏗️ producción, abajo el botón de despacho), nunca tocar cuadro/dimensión/cantidad, que son
// el insumo que recibe de Ingeniería.
function _filaProduccionHTML(f, i, l, esVigueta) {
  const longTotal = (Number(f.dimension) || 0) * (Number(f.cantidad) || 0);
  const peso = _pesoFila(f, l);
  const pendProd = _pendienteProduccionFila(f);
  const pendDesp = _pendienteDespachoFila(f, _despachosLosaActual);
  const esLista = _MODO_FLUJO_LOSA === 'lista';
  const txt = (valor, campo, ancho) => esLista
    ? `<input type="text" value="${_escAttr(valor || '')}" oninput="_filasLosaActual[${i}].${campo}=this.value" style="width:${ancho}px">`
    : _esc(valor || '—');
  // Sin el "|| 0" en `value` (2026-10-14, a pedido del usuario: "deja todos los campos sin
  // datos, pues algunos están incluyendo ceros de entrada que me dificultan la digitación") —
  // una fila nueva arranca en 0 internamente (ver `agregarFilaProduccion()`), pero el campo se
  // ve vacío hasta que el usuario escribe; `parseFloat(this.value)||0` en el oninput sigue
  // guardando 0 si lo deja vacío, así que el dato no cambia, solo la comodidad de digitar.
  const num = (valor, campo, ancho, recalcula, onchangeExtra) => esLista
    ? `<input type="number" ${campo === 'dimension' ? 'step="0.01"' : ''} value="${valor || ''}" oninput="_filasLosaActual[${i}].${campo}=parseFloat(this.value)||0${recalcula ? `;_actualizarFilaProduccion(${i})` : ''}" ${onchangeExtra ? `onchange="${onchangeExtra}"` : ''} style="width:${ancho}px">`
    : (valor || 0);
  // "Ejes numéricos"/"Ejes alfabéticos" (2026-10-13, a pedido del usuario) — de entrada
  // aparecen como dos cuadros de texto chicos separados por un guion ("(cuadro) - (cuadro)"),
  // en vez de un solo campo de texto libre — coincide con cómo se ve el dato en los Excel
  // reales ("1-1´", "I-G": un eje de inicio y uno de fin), pero sigue guardándose como un solo
  // string (`ejesEntre`/`laterales`, sin cambiar el modelo de datos ni el mapeo de Importar/
  // Pegar, que ya traían ese valor combinado en una sola celda).
  const par = (valor, campo) => {
    if (!esLista) return _esc(valor || '—');
    const idx = (valor || '').indexOf('-');
    const a = idx >= 0 ? valor.slice(0, idx) : (valor || '');
    const b = idx >= 0 ? valor.slice(idx + 1) : '';
    return `<div style="display:flex;align-items:center;gap:2px">
      <input type="text" value="${_escAttr(a)}" oninput="_actualizarParEje(${i},'${campo}',0,this.value)" style="width:24px;text-align:center;padding:4px 2px">
      <span style="color:var(--gris-medio)">-</span>
      <input type="text" value="${_escAttr(b)}" oninput="_actualizarParEje(${i},'${campo}',1,this.value)" style="width:24px;text-align:center;padding:4px 2px">
    </div>`;
  };
  return `<tr>
    <td>${i + 1}</td>
    <td>${txt(f.cuadro, 'cuadro', 40)}</td>
    <td>${par(f.ejesEntre, 'ejesEntre')}</td>
    <td>${par(f.laterales, 'laterales')}</td>
    ${esVigueta ? `
    <td>${txt(f.tipoVigueta, 'tipoVigueta', 48)}</td>
    <td>${num(f.hilosAbajo, 'hilosAbajo', 38, false)}</td>
    <td>${num(f.hilosArriba, 'hilosArriba', 38, false)}</td>
    ` : `
    <td>${num(f.ancho, 'ancho', 44, true, l.sistema === 'prelosa' ? `_validarAnchoPrelosa(${i})` : '')}</td>
    <td>${num(f.hilos, 'hilos', 38, false)}</td>
    `}
    <td>${num(f.dimension, 'dimension', 50, true)}</td>
    <td>${num(f.cantidad, 'cantidad', 42, true)}</td>
    <td id="fp-longtotal-${i}" style="text-align:right">${longTotal.toFixed(2)}</td>
    <td id="fp-peso-${i}" style="text-align:right">${peso.toFixed(1)}</td>
    ${esLista ? '' : (_MODO_FLUJO_LOSA === 'produccion'
      ? `<td style="text-align:right">${(Number(f.cantidad) || 0) - pendProd}</td><td id="fp-pendprod-${i}" style="text-align:right;font-weight:600;color:${pendProd > 0 ? 'var(--naranja)' : 'var(--verde)'}">${pendProd}</td>`
      : `<td id="fp-penddesp-${i}" style="text-align:right;font-weight:600;color:${pendDesp > 0 ? 'var(--naranja)' : 'var(--verde)'}">${pendDesp}</td>`)}
    <td>${txt(f.observaciones, 'observaciones', 90)}</td>
    <td style="white-space:nowrap">
      ${esLista
        ? `<button class="btn btn-rojo btn-xs" onclick="_filasLosaActual.splice(${i},1);renderFilasProduccion()">✕</button>`
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

// Actualización quirúrgica (solo las celdas calculadas) al cambiar ancho/dimensión/cantidad —
// mismo motivo que `_actualizarFilaDespieceAcero()` en Costeo de Producto: un render completo
// en cada tecla destruye el <input> que se está escribiendo y hace perder el foco a mitad de
// un decimal (bug real ya corregido una vez ahí, mismo riesgo acá).
function _actualizarFilaProduccion(i) {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  const f = _filasLosaActual[i];
  if (!l || !f) return;
  const longTotal = (Number(f.dimension) || 0) * (Number(f.cantidad) || 0);
  const peso = _pesoFila(f, l);
  const pendProd = _pendienteProduccionFila(f);
  const pendDesp = _pendienteDespachoFila(f, _despachosLosaActual);
  const elLong = document.getElementById(`fp-longtotal-${i}`); if (elLong) elLong.textContent = longTotal.toFixed(2);
  const elPeso = document.getElementById(`fp-peso-${i}`); if (elPeso) elPeso.textContent = peso.toFixed(1);
  const elPP = document.getElementById(`fp-pendprod-${i}`); if (elPP) { elPP.textContent = pendProd; elPP.style.color = pendProd > 0 ? 'var(--naranja)' : 'var(--verde)'; }
  const elPD = document.getElementById(`fp-penddesp-${i}`); if (elPD) { elPD.textContent = pendDesp; elPD.style.color = pendDesp > 0 ? 'var(--naranja)' : 'var(--verde)'; }
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
}

function agregarFilaProduccion() {
  _filasLosaActual.push({ id: _nuevoIdFila(), cuadro: '', ejesEntre: '', laterales: '', ancho: 0, hilos: 0, tipoVigueta: '', hilosAbajo: 0, hilosArriba: 0, dimension: 0, cantidad: 0, observaciones: '', produccion: [] });
  renderFilasProduccion();
}

// (b) Pegar desde Excel — columnas en el mismo orden que la tabla visible: Cuadro, Ejes
// numéricos, Ejes alfabéticos, [Ancho, Hilos] o [Vigueta, Hilos Abajo, Hilos Arriba], Dimensión,
// Cantidad (ver nota en la pantalla). El valor de cada celda de ejes sigue siendo un solo texto
// combinado (ej. "1-1´"), igual que en el Excel real — el guion se separa solo al mostrarlo
// en los dos cuadros chicos (ver `par()` en `_filaProduccionHTML`).
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
      return { ...base, tipoVigueta: cols[3] || '', hilosAbajo: parseFloat(cols[4]) || 0, hilosArriba: parseFloat(cols[5]) || 0, dimension: parseFloat(cols[6]) || 0, cantidad: parseFloat(cols[7]) || 0, ancho: 0, hilos: 0 };
    }
    return { ...base, ancho: parseFloat(cols[3]) || 0, hilos: parseFloat(cols[4]) || 0, dimension: parseFloat(cols[5]) || 0, cantidad: parseFloat(cols[6]) || 0, tipoVigueta: '', hilosAbajo: 0, hilosArriba: 0 };
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
        const dimension = parseFloat(r[ci.dimension]) || 0;
        const cantidad = parseFloat(r[ci.cantidad]) || 0;
        if (!cuadro && !dimension && !cantidad) continue;
        nuevas.push({
          id: _nuevoIdFila(),
          ejesEntre: ci.ejesEntre >= 0 ? String(r[ci.ejesEntre] ?? '').trim() : '',
          laterales: ci.laterales >= 0 ? String(r[ci.laterales] ?? '').trim() : '',
          cuadro,
          ancho: ci.ancho >= 0 ? (parseFloat(r[ci.ancho]) || 0) : 0,
          hilos: ci.hilos >= 0 ? (parseFloat(r[ci.hilos]) || 0) : 0,
          tipoVigueta: ci.tipoVigueta >= 0 ? String(r[ci.tipoVigueta] ?? '').trim() : '',
          hilosAbajo: ci.hilosAbajo >= 0 ? (parseFloat(r[ci.hilosAbajo]) || 0) : 0,
          hilosArriba: ci.hilosArriba >= 0 ? (parseFloat(r[ci.hilosArriba]) || 0) : 0,
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
function abrirModalProgramarProduccion() {
  const conPendiente = _filasLosaActual.filter(f => _pendienteProduccionFila(f) > 0);
  document.getElementById('mpp-fecha').value = _fmtISO(new Date());
  document.getElementById('mpp-observaciones').value = '';
  document.getElementById('mpp-filtro-desde').value = '';
  document.getElementById('mpp-filtro-hasta').value = '';
  const tbody = document.getElementById('mpp-filas-body');
  if (!conPendiente.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--gris-medio);padding:10px">No hay filas con saldo pendiente de producción.</td></tr>`;
  } else {
    // Casilla a la izquierda (2026-10-15, a pedido del usuario: "pueda seleccionar una fila, y
    // automáticamente se programen las cantidades pendientes de esa fila, pues por lo general
    // siempre se funden juntas") — marcar la fila precarga "A programar" con el pendiente
    // completo; desmarcarla lo vuelve a dejar en 0. El campo sigue editable a mano aparte, por
    // si se quiere programar solo una parte. `data-cuadro` alimenta el filtro de rango de abajo.
    tbody.innerHTML = conPendiente.map(f => {
      const pend = _pendienteProduccionFila(f);
      return `<tr data-cuadro="${_escAttr(f.cuadro || '')}">
        <td><input type="checkbox" class="mpp-chk-fila" onchange="_marcarFilaProgramar(this)"></td>
        <td>${_esc(f.cuadro || '')}</td>
        <td>${f.dimension || 0} m</td>
        <td>${pend}</td>
        <td><input type="number" min="0" max="${pend}" value="0" data-fila-id="${_escAttr(f.id)}" data-pendiente="${pend}" style="width:70px"></td>
      </tr>`;
    }).join('');
  }
  document.getElementById('modal-programar-produccion').classList.add('abierto');
}
function _marcarFilaProgramar(checkbox) {
  const input = checkbox.closest('tr').querySelector('input[data-fila-id]');
  if (input) input.value = checkbox.checked ? input.dataset.pendiente : 0;
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
// Filtro "Desde cuadro / Hasta cuadro" (2026-10-15, a pedido del usuario) — en proyectos
// grandes (Boreal real tuvo 247 filas en una sola Losa) acota la tabla a un rango contiguo de
// cuadros en vez de tener que buscarlos a mano. Oculta filas con display:none en vez de
// volver a renderizar la tabla, para no perder cantidades ya digitadas en filas que quedan
// fuera del rango. `cuadro` no numérico queda oculto mientras el filtro esté activo (no hay
// forma de ubicarlo en un rango numérico) — sin filtro, se ve todo sin importar el formato.
function _aplicarFiltroCuadroProgramar() {
  const desdeRaw = document.getElementById('mpp-filtro-desde').value;
  const hastaRaw = document.getElementById('mpp-filtro-hasta').value;
  const desde = desdeRaw === '' ? null : parseFloat(desdeRaw);
  const hasta = hastaRaw === '' ? null : parseFloat(hastaRaw);
  document.querySelectorAll('#mpp-filas-body tr[data-cuadro]').forEach(tr => {
    if (desde == null && hasta == null) { tr.style.display = ''; return; }
    const cuadroNum = parseFloat(tr.dataset.cuadro);
    const dentro = !isNaN(cuadroNum) && (desde == null || cuadroNum >= desde) && (hasta == null || cuadroNum <= hasta);
    tr.style.display = dentro ? '' : 'none';
  });
}
function guardarProgramacionProduccion() {
  const fecha = document.getElementById('mpp-fecha').value;
  if (!fecha) { alert('Elige una fecha.'); return; }
  const inputs = document.querySelectorAll('#mpp-filas-body input[data-fila-id]');
  const lineas = [];
  inputs.forEach(inp => {
    const cantidadProgramada = parseFloat(inp.value) || 0;
    if (cantidadProgramada > 0) lineas.push({ filaId: inp.dataset.filaId, cantidadProgramada, cantidadReal: null });
  });
  if (!lineas.length) { alert('Ingresa al menos una cantidad a programar.'); return; }
  _programacionesLosaActual.push({ id: String(Date.now()), fecha, observaciones: document.getElementById('mpp-observaciones').value.trim(), lineas });
  _guardarLosaActual();
  cerrarModal('modal-programar-produccion');
  alert('Producción programada guardada. Cuando se fabrique, regístrala con "+ Cargar producción".');
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
let _fechaProgramacionImpresa = null;
function imprimirProgramacionProduccion() {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (!l) return;
  const p = PROYECTOS.find(x => x.id === _PROYECTO_ACTIVO_ID);
  const sis = SISTEMAS_ENTREPISO.find(s => s.clave === l.sistema);
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

  let totalPiezas = 0, totalMetros = 0;
  const filasHTML = lineas.map(({ f, cantidad }, n) => {
    const longTotal = (Number(f.dimension) || 0) * cantidad;
    totalPiezas += cantidad;
    totalMetros += longTotal;
    return `<tr>
      <td style="color:#888">${n + 1}</td>
      <td style="font-weight:600">${_esc(f.cuadro) || '—'}</td>
      <td>${_esc(f.ejesEntre) || '—'}</td>
      <td>${_esc(f.laterales) || '—'}</td>
      <td style="text-align:right">${(Number(f.dimension) || 0).toFixed(2)}</td>
      <td style="text-align:center;font-weight:700">${cantidad}</td>
      <td style="text-align:right">${longTotal.toFixed(2)}</td>
    </tr>`;
  }).join('');

  const html = `
    <div class="no-print" style="background:#1C2333;color:white;padding:12px 24px;display:flex;align-items:center;gap:16px">
      <span style="font-weight:700">Programación de Producción — ${_esc(l.nombre)}</span>
      <div style="flex:1"></div>
      <button onclick="descargarPDFProgramacionProduccion()" style="background:#1976D2;color:white;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-weight:700" id="btn-pdf-programacion">⬇️ Descargar PDF</button>
      <button onclick="document.getElementById('vista-previa').style.display='none';document.getElementById('pantalla-losa-detalle').classList.add('activa')" style="background:#555;color:white;border:none;padding:8px 14px;border-radius:5px;cursor:pointer">← Volver</button>
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
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-top:4px;font-size:10.5px">
            <div><b>SISTEMA:</b> ${sis ? _esc(sis.etiqueta) : '—'}</div>
            <div><b>PIEZAS A PROGRAMAR:</b> ${totalPiezas} piezas en ${lineas.length} fila${lineas.length === 1 ? '' : 's'}</div>
          </div>
          ${observaciones ? `<div style="margin-top:4px;font-size:10.5px"><b>OBSERVACIONES:</b> ${_esc(observaciones)}</div>` : ''}
        </div>
        <table class="preview-tabla">
          <thead><tr>
            <th>#</th><th>Cuadro</th><th>Ejes num.</th><th>Ejes alfa.</th>
            <th>Dim. (m)</th><th>Cant. a programar</th><th>Long. tot. (m)</th>
          </tr></thead>
          <tbody>${filasHTML}</tbody>
          <tfoot><tr class="total-row">
            <td colspan="5" style="text-align:right">TOTALES</td>
            <td style="text-align:center">${totalPiezas}</td>
            <td style="text-align:right">${totalMetros.toFixed(2)}</td>
          </tr></tfoot>
        </table>
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

  document.getElementById('contenido-preview').innerHTML = html;
  // El modal queda tapado por el fondo oscuro de #vista-previa si no se cierra primero (el
  // z-index de los modales es mayor al de #vista-previa) — mismo motivo por el que "← Volver"
  // reactiva pantalla-losa-detalle en vez de reabrir el modal.
  cerrarModal('modal-programar-produccion');
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
  renderProduccionRegistrada();
  alert('Producción cargada.');
}

// "Producciones registradas" — mismo espíritu que "📦 Despachos registrados", pero del lado de
// Producción (2026-10-15, a pedido del usuario: "incluyamos... algo similar a lo que tenemos en
// Despachos de Despachos Registrados... fila a fila lo producido y seleccionándola podamos ver
// el resumen... lo realmente fabricado"). Lista las programaciones que ya tienen AL MENOS una
// línea cargada (`cantidadReal != null`) — una programación sin nada cargado todavía no es
// "producción", es solo un plan, no aparece acá (si está 100% pendiente, vive en "+ Cargar
// producción"). "Contenido" cuenta solo lo REALMENTE fabricado, no lo programado.
function renderProduccionRegistrada() {
  const tbody = document.getElementById('produccion-registrada-body');
  if (!tbody) return;
  const conCarga = _programacionesLosaActual.filter(p => (p.lineas || []).some(l => l.cantidadReal != null));
  if (!conCarga.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--gris-medio);padding:10px">No hay producción cargada todavía.</td></tr>`;
    return;
  }
  tbody.innerHTML = conCarga.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(p => {
    const cargadas = (p.lineas || []).filter(l => l.cantidadReal != null);
    const pendientes = (p.lineas || []).length - cargadas.length;
    const totalFabricado = cargadas.reduce((s, l) => s + (Number(l.cantidadReal) || 0), 0);
    return `<tr onclick="verDetalleProduccionRegistrada('${_escAttr(p.id)}')" style="cursor:pointer">
      <td>${p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${cargadas.length} fila(s), ${totalFabricado} piezas fabricadas${pendientes > 0 ? ` (${pendientes} por cargar)` : ''}</td>
      <td>${_esc(p.observaciones) || '—'}</td>
    </tr>`;
  }).join('');
}
// Detalle de solo lectura al seleccionar una fila de "Producciones registradas" — mismo
// contenido que ve "+ Cargar producción" (Cuadro / Programado / Producido), pero sin inputs:
// es historial, no una carga en curso.
function verDetalleProduccionRegistrada(id) {
  const p = _programacionesLosaActual.find(x => x.id === id);
  if (!p) return;
  document.getElementById('vdp-fecha').textContent = p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : '—';
  document.getElementById('vdp-observaciones').textContent = p.observaciones || '—';
  document.getElementById('vdp-filas-body').innerHTML = (p.lineas || []).map(linea => {
    const f = _filasLosaActual.find(x => x.id === linea.filaId);
    const cargada = linea.cantidadReal != null;
    return `<tr>
      <td>${_esc(f?.cuadro || '—')}</td>
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
// columnas Cuadro/Ancho/Largo/Cant. a fabricar/Total fabricado quedan FIJAS a la izquierda
// (`position:sticky;left:...`, mismo mecanismo que ya usa `.tabla-cots th` para fijarse arriba
// al bajar, pero en el eje horizontal) porque en una Losa grande las columnas de fecha pueden
// ser muchas — se desplazan con la barra horizontal sin perder de vista qué fila es cada una.
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
  const AW = { cuadro: 60, ancho: 70, largo: 70, cantidad: 100, total: 110 };
  let acum = 0;
  const leftCuadro = acum; acum += AW.cuadro;
  const leftAncho = acum; if (!esVigueta) acum += AW.ancho;
  const leftLargo = acum; acum += AW.largo;
  const leftCantidad = acum; acum += AW.cantidad;
  const leftTotal = acum;
  const numColsFijas = esVigueta ? 4 : 5;
  // z-index 5 en los `<th>` ya viene de `.tabla-cots th` (también les da el `top:0` que los fija
  // arriba al bajar) — acá solo hace falta agregar el `left` para fijarlos también a la
  // izquierda. Los `<td>`/`<tfoot><td>` sí necesitan su propio z-index + fondo sólido (si no, el
  // contenido de las columnas de fecha se vería "por debajo" al desplazar la barra).
  const thFijo = (leftPx, w, texto) => `<th style="position:sticky;left:${leftPx}px;width:${w}px;min-width:${w}px;text-align:center">${texto}</th>`;
  const tdFijo = (leftPx, w, texto, extra) => `<td style="position:sticky;left:${leftPx}px;width:${w}px;min-width:${w}px;z-index:2;background:#fff;${extra || ''}">${texto}</td>`;

  thead.innerHTML = `<tr>
    ${thFijo(leftCuadro, AW.cuadro, 'Cuadro')}
    ${esVigueta ? '' : thFijo(leftAncho, AW.ancho, 'Ancho (cm)')}
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
      ${tdFijo(leftLargo, AW.largo, (Number(f.dimension) || 0).toFixed(2), 'text-align:center')}
      ${tdFijo(leftCantidad, AW.cantidad, f.cantidad || 0, 'text-align:center')}
      ${tdFijo(leftTotal, AW.total, filaTotal || 0, 'text-align:center;font-weight:700')}
      ${celdas}
    </tr>`;
  }).join('');

  tfoot.innerHTML = fechas.length ? `<tr style="font-weight:700">
    ${tdFijo(leftCuadro, AW.cuadro, 'Total día', 'background:var(--azul-suave)')}
    ${esVigueta ? '' : tdFijo(leftAncho, AW.ancho, '', 'background:var(--azul-suave)')}
    ${tdFijo(leftLargo, AW.largo, '', 'background:var(--azul-suave)')}
    ${tdFijo(leftCantidad, AW.cantidad, granTotalCantidad, 'background:var(--azul-suave);text-align:center')}
    ${tdFijo(leftTotal, AW.total, granTotalFabricado, 'background:var(--azul-suave);text-align:center')}
    ${totalesPorFecha.map(t => `<td style="text-align:center;background:var(--azul-suave)">${t || ''}</td>`).join('')}
  </tr>` : '';

  document.getElementById('modal-produccion-diaria').classList.add('abierto');
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
function abrirModalProgramarDespacho() {
  const conPendiente = _filasLosaActual.filter(f => _pendienteDespachoFila(f, _despachosLosaActual) > 0);
  document.getElementById('mpd-fecha').value = _fmtISO(new Date());
  document.getElementById('mpd-observaciones').value = '';
  document.getElementById('mpd-filtro-desde').value = '';
  document.getElementById('mpd-filtro-hasta').value = '';
  const tbody = document.getElementById('mpd-filas-body');
  if (!conPendiente.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--gris-medio);padding:10px">No hay filas con saldo pendiente de despacho.</td></tr>`;
  } else {
    tbody.innerHTML = conPendiente.map(f => {
      const pend = _pendienteDespachoFila(f, _despachosLosaActual);
      return `<tr data-cuadro="${_escAttr(f.cuadro || '')}">
        <td><input type="checkbox" class="mpd-chk-fila" onchange="_marcarFilaProgramarDespacho(this)"></td>
        <td>${_esc(f.cuadro || '')}</td>
        <td>${f.dimension || 0} m</td>
        <td>${pend}</td>
        <td><input type="number" min="0" max="${pend}" value="0" data-fila-id="${_escAttr(f.id)}" data-pendiente="${pend}" style="width:70px"></td>
      </tr>`;
    }).join('');
  }
  document.getElementById('modal-programar-despacho').classList.add('abierto');
}
function _marcarFilaProgramarDespacho(checkbox) {
  const input = checkbox.closest('tr').querySelector('input[data-fila-id]');
  if (input) input.value = checkbox.checked ? input.dataset.pendiente : 0;
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
function _aplicarFiltroCuadroProgramarDespacho() {
  const desdeRaw = document.getElementById('mpd-filtro-desde').value;
  const hastaRaw = document.getElementById('mpd-filtro-hasta').value;
  const desde = desdeRaw === '' ? null : parseFloat(desdeRaw);
  const hasta = hastaRaw === '' ? null : parseFloat(hastaRaw);
  document.querySelectorAll('#mpd-filas-body tr[data-cuadro]').forEach(tr => {
    if (desde == null && hasta == null) { tr.style.display = ''; return; }
    const cuadroNum = parseFloat(tr.dataset.cuadro);
    const dentro = !isNaN(cuadroNum) && (desde == null || cuadroNum >= desde) && (hasta == null || cuadroNum <= hasta);
    tr.style.display = dentro ? '' : 'none';
  });
}
function guardarProgramacionDespacho() {
  const fecha = document.getElementById('mpd-fecha').value;
  if (!fecha) { alert('Elige una fecha.'); return; }
  const inputs = document.querySelectorAll('#mpd-filas-body input[data-fila-id]');
  const lineas = [];
  inputs.forEach(inp => {
    const cantidadProgramada = parseFloat(inp.value) || 0;
    if (cantidadProgramada > 0) lineas.push({ filaId: inp.dataset.filaId, cantidadProgramada, cantidadReal: null });
  });
  if (!lineas.length) { alert('Ingresa al menos una cantidad a programar.'); return; }
  _despachosProgramadosLosaActual.push({ id: String(Date.now()), fecha, observaciones: document.getElementById('mpd-observaciones').value.trim(), lineas });
  _guardarLosaActual();
  cerrarModal('modal-programar-despacho');
  alert('Despacho programado guardado. Cuando salga el camión, regístralo con "+ Cargar despacho".');
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
  alert('Despacho cargado.');
}

// "Historial de despachos" — mismo patrón que "🏗️ Producciones registradas" de Producción,
// como modal (a pedido del usuario) en vez de tarjeta siempre visible — reemplaza la tarjeta
// "📦 Despachos registrados" que había antes. Lista las `despachosProgramados[]` que ya tienen
// AL MENOS una línea cargada; "Contenido" cuenta solo lo REALMENTE despachado, no lo
// programado.
function abrirHistorialDespachos() {
  const tbody = document.getElementById('hd-filas-body');
  const conCarga = _despachosProgramadosLosaActual.filter(p => (p.lineas || []).some(l => l.cantidadReal != null));
  if (!conCarga.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--gris-medio);padding:10px">No hay despachos cargados todavía.</td></tr>`;
  } else {
    tbody.innerHTML = conCarga.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(p => {
      const cargadas = (p.lineas || []).filter(l => l.cantidadReal != null);
      const pendientes = (p.lineas || []).length - cargadas.length;
      const totalDespachado = cargadas.reduce((s, l) => s + (Number(l.cantidadReal) || 0), 0);
      return `<tr onclick="verDetalleDespachoRegistrado('${_escAttr(p.id)}')" style="cursor:pointer">
        <td>${_esc(p.remision) || '—'}</td>
        <td>${p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
        <td>${cargadas.length} fila(s), ${totalDespachado} piezas despachadas${pendientes > 0 ? ` (${pendientes} por cargar)` : ''}</td>
        <td>${_esc(p.observaciones) || '—'}</td>
      </tr>`;
    }).join('');
  }
  document.getElementById('modal-historial-despachos').classList.add('abierto');
}
// Detalle de solo lectura al seleccionar una fila del historial — mismo contenido que ve "+
// Cargar despacho" (Cuadro / Programado / Despachado), sin inputs: es historial.
function verDetalleDespachoRegistrado(id) {
  const p = _despachosProgramadosLosaActual.find(x => x.id === id);
  if (!p) return;
  document.getElementById('vdd-remision').textContent = p.remision || '—';
  document.getElementById('vdd-fecha').textContent = p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : '—';
  document.getElementById('vdd-observaciones').textContent = p.observaciones || '—';
  document.getElementById('vdd-filas-body').innerHTML = (p.lineas || []).map(linea => {
    const f = _filasLosaActual.find(x => x.id === linea.filaId);
    const cargada = linea.cantidadReal != null;
    return `<tr>
      <td>${_esc(f?.cuadro || '—')}</td>
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
