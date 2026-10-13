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
  const ancho = Number(fila.ancho) || 0;
  const espesorM = (Number(losa.espesorCm) || 0) / 100;
  return ancho * dim * espesorM * (Number(losa.densidadKgM3) || 0) * cant;
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
  // El imprimible para planta vive en Producción, no en Lista (2026-10-14, a pedido del
  // usuario: "esto lo hago para que más adelante podamos asignar permisos más fácil a ciertas
  // ventanas a los diferentes roles" — Ingeniería define la lista, Planta es quien imprime
  // para fabricar).
  document.getElementById('losa-btn-imprimir-produccion').style.display = esProduccion ? '' : 'none';
  document.getElementById('losa-btn-registrar-despacho').style.display = esDespacho ? '' : 'none';
  document.getElementById('losa-card-despachos').style.display = esDespacho ? '' : 'none';
  document.getElementById('losa-detalle-bloque-bovedilla').style.display = l.sistema === 'vigueta_bovedilla' ? '' : 'none';
  renderFilasProduccion();
  if (l.sistema === 'vigueta_bovedilla') renderBovedillaLosa();
  renderDespachosLosa();
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
  // Casilla de selección (2026-10-13, a pedido del usuario: "agregamos un botón de imprimir
  // listas de producción, donde se pueda seleccionar las filas...") — vive en modo producción,
  // no en lista (2026-10-14, a pedido del usuario: el imprimible para planta es de Producción,
  // para poder asignarle permisos por ventana a futuro independiente de Ingeniería), que es
  // donde vive el botón "🖨️ Imprimir" (ver imprimirListaProduccion()).
  thead.innerHTML = `<tr>
    ${esProduccion ? '<th style="width:28px"><input type="checkbox" id="chk-todas-filas-print" onchange="_toggleSeleccionTodasFilas(this.checked)"></th>' : ''}
    <th>#</th><th>Cuadro</th><th>Ejes numéricos</th><th>Ejes alfabéticos</th>
    ${esVigueta ? '<th>Vigueta</th><th>Hilos Abajo</th><th>Hilos Arriba</th>' : '<th>Ancho (m)</th><th>Hilos</th>'}
    <th>Dimensión (m)</th><th>Cantidad</th><th>Long. total (m)</th><th>Peso (kg)</th>
    ${esLista ? '' : (esProduccion ? '<th>Pend. Producción</th>' : '<th>Pend. Despacho</th>')}
    <th>Observaciones</th><th></th>
  </tr>`;
  const tbody = document.getElementById('filas-produccion-body');
  if (!_filasLosaActual.length) {
    tbody.innerHTML = `<tr><td colspan="15" class="empty-state"><div class="icono">📋</div><div>No hay filas todavía — agrega una a mano, pégalas desde Excel o importa el archivo.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = _filasLosaActual.map((f, i) => _filaProduccionHTML(f, i, l, esVigueta)).join('');
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
  const num = (valor, campo, ancho, recalcula) => esLista
    ? `<input type="number" ${campo === 'dimension' || campo === 'ancho' ? 'step="0.01"' : ''} value="${valor || 0}" oninput="_filasLosaActual[${i}].${campo}=parseFloat(this.value)||0${recalcula ? `;_actualizarFilaProduccion(${i})` : ''}" style="width:${ancho}px">`
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
      <input type="text" value="${_escAttr(a)}" oninput="_actualizarParEje(${i},'${campo}',0,this.value)" style="width:30px;text-align:center;padding:4px 2px">
      <span style="color:var(--gris-medio)">-</span>
      <input type="text" value="${_escAttr(b)}" oninput="_actualizarParEje(${i},'${campo}',1,this.value)" style="width:30px;text-align:center;padding:4px 2px">
    </div>`;
  };
  return `<tr>
    ${_MODO_FLUJO_LOSA === 'produccion' ? `<td><input type="checkbox" class="chk-fila-print" data-idx="${i}"></td>` : ''}
    <td>${i + 1}</td>
    <td>${txt(f.cuadro, 'cuadro', 50)}</td>
    <td>${par(f.ejesEntre, 'ejesEntre')}</td>
    <td>${par(f.laterales, 'laterales')}</td>
    ${esVigueta ? `
    <td>${txt(f.tipoVigueta, 'tipoVigueta', 60)}</td>
    <td>${num(f.hilosAbajo, 'hilosAbajo', 55, false)}</td>
    <td>${num(f.hilosArriba, 'hilosArriba', 55, false)}</td>
    ` : `
    <td>${num(f.ancho, 'ancho', 60, true)}</td>
    <td>${num(f.hilos, 'hilos', 50, false)}</td>
    `}
    <td>${num(f.dimension, 'dimension', 65, true)}</td>
    <td>${num(f.cantidad, 'cantidad', 55, true)}</td>
    <td id="fp-longtotal-${i}" style="text-align:right">${longTotal.toFixed(2)}</td>
    <td id="fp-peso-${i}" style="text-align:right">${peso.toFixed(1)}</td>
    ${esLista ? '' : (_MODO_FLUJO_LOSA === 'produccion'
      ? `<td id="fp-pendprod-${i}" style="text-align:right;font-weight:600;color:${pendProd > 0 ? 'var(--naranja)' : 'var(--verde)'}">${pendProd}</td>`
      : `<td id="fp-penddesp-${i}" style="text-align:right;font-weight:600;color:${pendDesp > 0 ? 'var(--naranja)' : 'var(--verde)'}">${pendDesp}</td>`)}
    <td>${txt(f.observaciones, 'observaciones', 110)}</td>
    <td style="white-space:nowrap">
      ${esLista
        ? `<button class="btn btn-rojo btn-xs" onclick="_filasLosaActual.splice(${i},1);renderFilasProduccion()">✕</button>`
        : (_MODO_FLUJO_LOSA === 'produccion'
          ? `<button class="btn btn-secundario btn-xs" onclick="abrirModalProduccionFila(${i})" title="Registrar producción">🏗️</button>`
          : '')}
    </td>
  </tr>`;
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
  _guardarLosaActual();
  renderFilasProduccion();
  alert('Lista de producción guardada.');
}

function _toggleSeleccionTodasFilas(marcar) {
  document.querySelectorAll('.chk-fila-print').forEach(chk => { chk.checked = marcar; });
}

// Imprimible para pasar a planta (2026-10-13, a pedido del usuario: "agregamos un botón de
// imprimir listas de producción, donde se pueda seleccionar las filas y de esto me salga un
// imprimible para pasar a planta y puedan ellos fabricar lo que se necesita") — mismo patrón
// ya usado en Órdenes de Producción/Logística (`verPDFOrden()`/`imprimirProgramacionDia()`,
// js/ordenes-produccion.js / js/logistica.js): un `<div>` con estilo inline se arma en
// memoria, se muestra en el `#vista-previa` compartido de toda la app, y "Descargar PDF" lo
// rasteriza con html2canvas + jsPDF.
function imprimirListaProduccion() {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (!l) return;
  const p = PROYECTOS.find(x => x.id === _PROYECTO_ACTIVO_ID);
  const sis = SISTEMAS_ENTREPISO.find(s => s.clave === l.sistema);
  const esVigueta = l.sistema === 'vigueta_bovedilla';
  const seleccionadas = Array.from(document.querySelectorAll('.chk-fila-print:checked')).map(chk => parseInt(chk.dataset.idx, 10));
  // Si no se marcó ninguna fila, se imprimen todas — más amigable que bloquear con una alerta
  // pidiendo que marques algo primero.
  const indices = seleccionadas.length ? seleccionadas : _filasLosaActual.map((_, i) => i);
  const filas = indices.map(i => _filasLosaActual[i]).filter(Boolean);
  if (!filas.length) { alert('No hay filas para imprimir.'); return; }

  let totalPiezas = 0, totalMetros = 0, totalPeso = 0;
  const filasHTML = filas.map((f, n) => {
    const longTotal = (Number(f.dimension) || 0) * (Number(f.cantidad) || 0);
    const peso = _pesoFila(f, l);
    totalPiezas += Number(f.cantidad) || 0;
    totalMetros += longTotal;
    totalPeso += peso;
    const colEspecifica = esVigueta
      ? `<td style="padding:5px 6px;border-bottom:1px solid #eee;font-size:11px">${_esc(f.tipoVigueta) || '—'}</td><td style="padding:5px 6px;border-bottom:1px solid #eee;text-align:center;font-size:11px">${f.hilosAbajo || 0}</td><td style="padding:5px 6px;border-bottom:1px solid #eee;text-align:center;font-size:11px">${f.hilosArriba || 0}</td>`
      : `<td style="padding:5px 6px;border-bottom:1px solid #eee;text-align:center;font-size:11px">${f.ancho || 0}</td><td style="padding:5px 6px;border-bottom:1px solid #eee;text-align:center;font-size:11px">${f.hilos || 0}</td>`;
    return `<tr>
      <td style="padding:5px 6px;border-bottom:1px solid #eee;font-size:11px;color:#888">${n + 1}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #eee;font-size:11px;font-weight:600">${_esc(f.cuadro) || '—'}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #eee;font-size:11px">${_esc(f.ejesEntre) || '—'}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #eee;font-size:11px">${_esc(f.laterales) || '—'}</td>
      ${colEspecifica}
      <td style="padding:5px 6px;border-bottom:1px solid #eee;text-align:right;font-size:11px">${(Number(f.dimension) || 0).toFixed(2)}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #eee;text-align:center;font-size:11px;font-weight:700">${f.cantidad || 0}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #eee;text-align:right;font-size:11px">${longTotal.toFixed(2)}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #eee;text-align:right;font-size:11px">${peso.toFixed(1)}</td>
      <td style="padding:5px 6px;border-bottom:1px solid #eee;font-size:11px;color:#555">${_esc(f.observaciones) || ''}</td>
    </tr>`;
  }).join('');

  const html = `
  <div id="lp-preview-doc" style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:0;color:#222">
    <div style="background:#001F3F;color:white;padding:18px 24px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:17px;font-weight:700">Proconcreto Prefabricados</div>
        <div style="font-size:11px;opacity:0.6;margin-top:2px">LISTA DE PRODUCCIÓN</div>
      </div>
      <div style="background:#8BC53F;padding:8px 16px;border-radius:6px;text-align:right">
        <div style="font-size:16px;font-weight:700;color:#001F3F">${_esc(l.nombre)}</div>
        <div style="font-size:10px;color:#001F3F;opacity:0.85">${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      </div>
    </div>
    <div style="padding:14px 16px;border-bottom:1px solid #eee">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">
        <div><div style="font-size:10px;color:#888">Proyecto</div><div style="font-size:12px;font-weight:600;margin-top:2px">${_esc(p?.nombre) || '—'}</div></div>
        <div><div style="font-size:10px;color:#888">Ubicación</div><div style="font-size:12px;margin-top:2px">${_esc(l.ubicacion) || '—'}</div></div>
        <div><div style="font-size:10px;color:#888">Sistema</div><div style="font-size:12px;margin-top:2px">${sis ? _esc(sis.etiqueta) : '—'}</div></div>
        <div><div style="font-size:10px;color:#888">Piezas / filas</div><div style="font-size:12px;margin-top:2px">${totalPiezas} piezas en ${filas.length} fila${filas.length === 1 ? '' : 's'}</div></div>
      </div>
    </div>
    <div style="padding:14px 16px">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f5f5f5">
          <th style="padding:6px;text-align:left;font-size:10px;color:#555">#</th>
          <th style="padding:6px;text-align:left;font-size:10px;color:#555">Cuadro</th>
          <th style="padding:6px;text-align:left;font-size:10px;color:#555">Ejes num.</th>
          <th style="padding:6px;text-align:left;font-size:10px;color:#555">Ejes alfa.</th>
          ${esVigueta
            ? '<th style="padding:6px;text-align:left;font-size:10px;color:#555">Vigueta</th><th style="padding:6px;text-align:center;font-size:10px;color:#555">Hilos ab.</th><th style="padding:6px;text-align:center;font-size:10px;color:#555">Hilos ar.</th>'
            : '<th style="padding:6px;text-align:center;font-size:10px;color:#555">Ancho (m)</th><th style="padding:6px;text-align:center;font-size:10px;color:#555">Hilos</th>'}
          <th style="padding:6px;text-align:right;font-size:10px;color:#555">Dim. (m)</th>
          <th style="padding:6px;text-align:center;font-size:10px;color:#555">Cant.</th>
          <th style="padding:6px;text-align:right;font-size:10px;color:#555">Long. tot. (m)</th>
          <th style="padding:6px;text-align:right;font-size:10px;color:#555">Peso (kg)</th>
          <th style="padding:6px;text-align:left;font-size:10px;color:#555">Observaciones</th>
        </tr></thead>
        <tbody>${filasHTML}</tbody>
        <tfoot>
          <tr style="background:#E8F5E9">
            <td colspan="${esVigueta ? 7 : 6}" style="padding:7px 6px;text-align:right;font-size:11px;font-weight:700;color:#1B5E20">TOTALES</td>
            <td style="padding:7px 6px;text-align:center;font-size:11px;font-weight:700;color:#1B5E20">${totalPiezas}</td>
            <td style="padding:7px 6px;text-align:right;font-size:11px;font-weight:700;color:#1B5E20">${totalMetros.toFixed(2)}</td>
            <td style="padding:7px 6px;text-align:right;font-size:11px;font-weight:700;color:#1B5E20">${totalPeso.toFixed(1)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #eee">
      <div style="padding:16px">
        <div style="border-top:1px solid #333;margin-top:36px;padding-top:6px;text-align:center">
          <div style="font-size:11px;color:#888">Entregado por (Ingeniería)</div>
        </div>
      </div>
      <div style="padding:16px">
        <div style="border-top:1px solid #333;margin-top:36px;padding-top:6px;text-align:center">
          <div style="font-size:11px;color:#888">Recibido en planta</div>
        </div>
      </div>
    </div>
    <div style="background:#f5f5f5;padding:8px 16px;text-align:center;font-size:10px;color:#999">
      Proconcreto Prefabricados · Autopista del Café Km2, Vía Chinchiná – Santa Rosa · www.proconcreto.com.co
    </div>
  </div>`;

  document.getElementById('contenido-preview').innerHTML = `
    <div class="no-print" style="background:#1C2333;color:white;padding:12px 24px;display:flex;align-items:center;gap:16px">
      <span style="font-weight:700">Lista de Producción — ${_esc(l.nombre)}</span>
      <div style="flex:1"></div>
      <button onclick="descargarPDFListaProduccion()" style="background:#1D9E75;color:white;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-weight:700" id="btn-pdf-lista">⬇️ Descargar PDF</button>
      <button onclick="document.getElementById('vista-previa').style.display='none';document.getElementById('pantalla-losa-detalle').classList.add('activa')" style="background:#555;color:white;border:none;padding:8px 14px;border-radius:5px;cursor:pointer">← Volver</button>
    </div>
    <div class="preview-doc" style="padding:0">${html}</div>`;
  document.getElementById('vista-previa').style.display = 'block';
  document.querySelectorAll('.pantalla').forEach(p2 => p2.classList.remove('activa'));
  window.scrollTo(0, 0);
}

async function descargarPDFListaProduccion() {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  const btn = document.getElementById('btn-pdf-lista');
  if (btn) { btn.textContent = '⏳ Generando...'; btn.disabled = true; }
  try {
    const { jsPDF } = window.jspdf;
    const el = document.getElementById('lp-preview-doc');
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210, pageH = 297;
    const imgH = (canvas.height * pageW) / canvas.width;
    let y = 0;
    while (y < imgH) {
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, -y, pageW, imgH);
      y += pageH;
    }
    const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '_');
    const nombreLosa = (l?.nombre || 'losa').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().replace(/\s+/g, '_');
    pdf.save(`Lista_Produccion_${nombreLosa}_${fecha}.pdf`);
  } finally {
    if (btn) { btn.textContent = '⬇️ Descargar PDF'; btn.disabled = false; }
  }
}

// Persiste la Losa completa (filas + despachos + bovedilla) de una sola vez — mismo criterio
// que el resto de la app: un solo upsert del registro completo, nunca escrituras parciales.
function _guardarLosaActual() {
  const idx = LOSAS_PROYECTO.findIndex(x => x.id === _LOSA_ACTIVA_ID);
  if (idx < 0) return;
  const l = { ...LOSAS_PROYECTO[idx], filas: _filasLosaActual, despachos: _despachosLosaActual, bovedilla: _bovedillaLosaActual };
  LOSAS_PROYECTO[idx] = l;
  sb.from('losas_proyecto').upsert({ id: l.id, datos: l, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) { console.error('Error guardando losa:', error.message); alert('No se pudo guardar: ' + error.message); } });
}

// ── Control de Producción (por fila) ──
let _FILA_PRODUCCION_INDEX = null;
function abrirModalProduccionFila(i) {
  _FILA_PRODUCCION_INDEX = i;
  const f = _filasLosaActual[i];
  document.getElementById('mpf-fecha').value = _fmtISO(new Date());
  document.getElementById('mpf-cantidad').value = '';
  document.getElementById('mpf-tipo').value = 'Vaciado';
  document.getElementById('modal-produccion-fila-titulo').textContent = `🏗️ Registrar producción — Cuadro ${f?.cuadro || ''}`;
  document.getElementById('modal-produccion-fila').classList.add('abierto');
}
function guardarProduccionFila() {
  if (_FILA_PRODUCCION_INDEX == null) return;
  const cantidad = parseFloat(document.getElementById('mpf-cantidad').value) || 0;
  if (cantidad <= 0) { alert('Ingresa una cantidad mayor a cero.'); return; }
  const fecha = document.getElementById('mpf-fecha').value;
  if (!fecha) { alert('Elige una fecha.'); return; }
  const f = _filasLosaActual[_FILA_PRODUCCION_INDEX];
  if (!f) return;
  f.produccion = f.produccion || [];
  f.produccion.push({ fecha, cantidad, tipo: document.getElementById('mpf-tipo').value });
  _guardarLosaActual();
  cerrarModal('modal-produccion-fila');
  renderFilasProduccion();
}

// ── Control de Despacho (a nivel Losa, con líneas — una remisión real cubre varias filas a
// la vez, mismo espíritu que `viaje.entregas[].productos[]` en Logística) ──
function abrirModalDespachoLosa() {
  const l = LOSAS_PROYECTO.find(x => x.id === _LOSA_ACTIVA_ID);
  if (!l) return;
  document.getElementById('mdl-remision').value = '';
  document.getElementById('mdl-fecha').value = _fmtISO(new Date());
  document.getElementById('mdl-observaciones').value = '';
  const conPendiente = _filasLosaActual.filter(f => _pendienteDespachoFila(f, _despachosLosaActual) > 0);
  const tbody = document.getElementById('mdl-filas-body');
  if (!conPendiente.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--gris-medio);padding:10px">No hay filas con saldo pendiente de despacho.</td></tr>`;
  } else {
    tbody.innerHTML = conPendiente.map(f => {
      const pend = _pendienteDespachoFila(f, _despachosLosaActual);
      return `<tr>
        <td>${_esc(f.cuadro || '')}</td>
        <td>${f.dimension || 0} m</td>
        <td>${pend}</td>
        <td><input type="number" min="0" max="${pend}" value="0" data-fila-id="${_escAttr(f.id)}" style="width:70px"></td>
      </tr>`;
    }).join('');
  }
  document.getElementById('modal-despacho-losa').classList.add('abierto');
}
function guardarDespachoLosa() {
  const remision = document.getElementById('mdl-remision').value.trim();
  if (!remision) { alert('Ingresa el número de remisión.'); return; }
  const fecha = document.getElementById('mdl-fecha').value;
  if (!fecha) { alert('Elige una fecha.'); return; }
  const inputs = document.querySelectorAll('#mdl-filas-body input[data-fila-id]');
  const lineas = [];
  inputs.forEach(inp => {
    const cantidad = parseFloat(inp.value) || 0;
    if (cantidad > 0) lineas.push({ filaId: inp.dataset.filaId, cantidad });
  });
  if (!lineas.length) { alert('Ingresa al menos una cantidad a despachar.'); return; }
  _despachosLosaActual.push({ id: String(Date.now()), remision, fecha, observaciones: document.getElementById('mdl-observaciones').value.trim(), lineas });
  _guardarLosaActual();
  cerrarModal('modal-despacho-losa');
  renderFilasProduccion();
  renderDespachosLosa();
}
function renderDespachosLosa() {
  const tbody = document.getElementById('despachos-losa-body');
  if (!tbody) return;
  if (!_despachosLosaActual.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--gris-medio);padding:10px">No hay despachos registrados todavía.</td></tr>`;
    return;
  }
  tbody.innerHTML = _despachosLosaActual.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(d => {
    const totalPiezas = (d.lineas || []).reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
    return `<tr>
      <td>${_esc(d.remision)}</td>
      <td>${d.fecha ? new Date(d.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${(d.lineas || []).length} fila(s), ${totalPiezas} piezas</td>
      <td>${_esc(d.observaciones) || '—'}</td>
    </tr>`;
  }).join('');
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
