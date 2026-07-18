// ═══════════════════════════════
// CALIDAD — DISEÑO DE MEZCLA
// ═══════════════════════════════
let DISENOS_MEZCLA = [];

function siguienteCodigoDiseno() {
  const nums = DISENOS_MEZCLA.map(d => parseInt((d.codigo || '').replace(/\D/g, '')) || 0);
  const max = nums.length ? Math.max(...nums) : 0;
  return 'DM-' + String(max + 1).padStart(3, '0');
}

function renderDisenosMezcla() {
  const tbody = document.getElementById('disenos-body');
  if (!tbody) return;
  const q = (document.getElementById('buscar-diseno')?.value || '').toLowerCase();
  let data = [...DISENOS_MEZCLA];
  if (q) data = data.filter(d => (d.codigo + ' ' + d.nombre).toLowerCase().includes(q));
  data.sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><div class="icono">🧪</div><div>No hay diseños de mezcla registrados.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(d => {
    const inactivo = d.estado === 'Inactivo';
    const ultimoActor = d.modificadoPor || d.creadoPor;
    const nombreActor = USUARIOS_CRM[ultimoActor]?.nombre || ultimoActor || '—';
    const etiquetaActor = d.modificadoPor ? 'Modificó' : 'Elaboró';
    return `<tr style="border-top:2px solid var(--azul-oscuro);${inactivo ? 'opacity:.55' : ''}">
      <td style="font-weight:700;color:var(--azul)">${d.codigo}</td>
      <td style="font-weight:600">${d.nombre}</td>
      <td style="text-align:center;font-weight:700">${d.resistenciaDiseno || '—'} MPa</td>
      <td style="text-align:center">${d.asentamiento || '—'} cm</td>
      <td style="text-align:center">${d.tamanoMaximo || '—'}</td>
      <td><span style="font-size:11px;color:var(--gris-medio)">${etiquetaActor}:</span> ${nombreActor}</td>
      <td><span class="badge" style="background:${inactivo ? '#FFEBEE' : '#E8F5E9'};color:${inactivo ? '#C62828' : '#2E7D32'}">${d.estado || 'Activo'}</span></td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-primario btn-xs" onclick="editarDiseno('${d.id}')">✏️ Editar</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarDiseno('${d.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

let _aditivosDisenoActual = [];

function renderAditivosDiseno() {
  const tbody = document.getElementById('aditivos-diseno-body');
  if (!tbody) return;
  if (!_aditivosDisenoActual.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:10px;color:var(--gris-medio);font-size:12px">Agrega los aditivos usados en esta mezcla (opcional)</td></tr>`;
    return;
  }
  tbody.innerHTML = _aditivosDisenoActual.map((a, i) => `
    <tr>
      <td>
        <select onchange="_aditivosDisenoActual[${i}].tipo=this.value">
          <option value="Superplastificante" ${a.tipo === 'Superplastificante' ? 'selected' : ''}>Superplastificante</option>
          <option value="Retardante" ${a.tipo === 'Retardante' ? 'selected' : ''}>Retardante</option>
          <option value="Acelerante" ${a.tipo === 'Acelerante' ? 'selected' : ''}>Acelerante</option>
        </select>
      </td>
      <td><input type="number" value="${a.dosis}" min="0" step="0.01" onchange="_aditivosDisenoActual[${i}].dosis=parseFloat(this.value)||0"></td>
      <td><button class="btn btn-rojo btn-xs" onclick="eliminarAditivoDiseno(${i})">✕</button></td>
    </tr>`).join('');
}

function agregarAditivoDiseno() {
  _aditivosDisenoActual.push({ tipo: 'Superplastificante', dosis: 0 });
  renderAditivosDiseno();
}

function eliminarAditivoDiseno(i) {
  _aditivosDisenoActual.splice(i, 1);
  renderAditivosDiseno();
}

function abrirModalDiseno() {
  document.getElementById('m-diseno-id').value = '';
  document.getElementById('modal-diseno-titulo').textContent = '🧪 Nuevo Diseño de Mezcla';
  document.getElementById('m-diseno-codigo').value = siguienteCodigoDiseno();
  ['m-diseno-nombre', 'm-diseno-resistencia', 'm-diseno-asentamiento', 'm-diseno-tamano', 'm-diseno-relacion', 'm-diseno-cemento', 'm-diseno-metacaolin', 'm-diseno-arena', 'm-diseno-grava', 'm-diseno-absorcion-arena', 'm-diseno-absorcion-triturado', 'm-diseno-agua', 'm-diseno-obs'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('m-diseno-estado').value = 'Activo';
  _aditivosDisenoActual = [];
  renderAditivosDiseno();
  document.getElementById('modal-diseno').classList.add('abierto');
}

function editarDiseno(id) {
  const d = DISENOS_MEZCLA.find(x => String(x.id) === String(id));
  if (!d) return;
  document.getElementById('m-diseno-id').value = d.id;
  document.getElementById('modal-diseno-titulo').textContent = '✏️ Editar Diseño de Mezcla';
  document.getElementById('m-diseno-codigo').value = d.codigo || '';
  document.getElementById('m-diseno-nombre').value = d.nombre || '';
  document.getElementById('m-diseno-resistencia').value = d.resistenciaDiseno || '';
  document.getElementById('m-diseno-asentamiento').value = d.asentamiento || '';
  agregarOpcionSiNoExiste('m-diseno-tamano', d.tamanoMaximo);
  document.getElementById('m-diseno-tamano').value = d.tamanoMaximo || '';
  document.getElementById('m-diseno-relacion').value = d.relacionAguaCemento || '';
  document.getElementById('m-diseno-cemento').value = d.materiales?.cemento || '';
  document.getElementById('m-diseno-metacaolin').value = d.materiales?.metacaolin || '';
  document.getElementById('m-diseno-arena').value = d.materiales?.arena || '';
  document.getElementById('m-diseno-grava').value = d.materiales?.grava || '';
  document.getElementById('m-diseno-absorcion-arena').value = d.materiales?.absorcionArena || '';
  document.getElementById('m-diseno-absorcion-triturado').value = d.materiales?.absorcionTriturado || '';
  document.getElementById('m-diseno-agua').value = d.materiales?.agua || '';
  // Migración: diseños antiguos con un solo aditivo de texto libre → lista nueva
  _aditivosDisenoActual = JSON.parse(JSON.stringify(d.materiales?.aditivos || (d.materiales?.aditivo ? [{ tipo: 'Superplastificante', dosis: d.materiales.dosisAditivo || 0 }] : [])));
  renderAditivosDiseno();
  document.getElementById('m-diseno-estado').value = d.estado || 'Activo';
  document.getElementById('m-diseno-obs').value = d.observaciones || '';
  document.getElementById('modal-diseno').classList.add('abierto');
}

function guardarDiseno() {
  const codigo = document.getElementById('m-diseno-codigo').value.trim();
  const nombre = document.getElementById('m-diseno-nombre').value.trim();
  const resistenciaDiseno = parseFloat(document.getElementById('m-diseno-resistencia').value);
  const tamanoMaximo = document.getElementById('m-diseno-tamano').value.trim();
  if (!codigo || !nombre || !(resistenciaDiseno > 0) || !tamanoMaximo) { alert('Completa los campos obligatorios: Código, Nombre, Resistencia de diseño y Tamaño máximo de agregado.'); return; }
  const editId = document.getElementById('m-diseno-id').value;
  const existente = editId ? DISENOS_MEZCLA.find(x => String(x.id) === String(editId)) : null;
  const materialesNuevos = {
    cemento: parseFloat(document.getElementById('m-diseno-cemento').value) || 0,
    metacaolin: parseFloat(document.getElementById('m-diseno-metacaolin').value) || 0,
    arena: parseFloat(document.getElementById('m-diseno-arena').value) || 0,
    grava: parseFloat(document.getElementById('m-diseno-grava').value) || 0,
    absorcionArena: parseFloat(document.getElementById('m-diseno-absorcion-arena').value) || 0,
    absorcionTriturado: parseFloat(document.getElementById('m-diseno-absorcion-triturado').value) || 0,
    agua: parseFloat(document.getElementById('m-diseno-agua').value) || 0,
    aditivos: JSON.parse(JSON.stringify(_aditivosDisenoActual)),
  };
  // Un diseño se va ajustando con el tiempo (materiales, resistencia, consumo de cemento).
  // Cada vez que un cambio así se guarda sobre un diseño existente, queda una marca de
  // revisión (fecha + quién la hizo) para poder avisar en Ajustes de Humedad y en el
  // Análisis Estadístico que, a partir de esa fecha, aplica una versión distinta.
  const huboCambioDeReceta = existente && (
    JSON.stringify(existente.materiales || {}) !== JSON.stringify(materialesNuevos) ||
    Number(existente.resistenciaDiseno) !== Number(resistenciaDiseno)
  );
  const revisiones = existente ? [...(existente.revisiones || [])] : [];
  if (huboCambioDeReceta) {
    revisiones.push({ fecha: new Date().toISOString().split('T')[0], modificadoPor: USUARIO_ACTUAL?.email });
  }
  const diseno = {
    id: editId || String(Date.now()),
    codigo, nombre, resistenciaDiseno, tamanoMaximo,
    asentamiento: parseFloat(document.getElementById('m-diseno-asentamiento').value) || 0,
    relacionAguaCemento: parseFloat(document.getElementById('m-diseno-relacion').value) || 0,
    materiales: materialesNuevos,
    revisiones,
    estado: document.getElementById('m-diseno-estado').value,
    observaciones: document.getElementById('m-diseno-obs').value.trim(),
    creadoPor: existente ? existente.creadoPor : USUARIO_ACTUAL?.email,
    modificadoPor: existente ? USUARIO_ACTUAL?.email : undefined,
    creadoEn: existente ? (existente.creadoEn || new Date().toISOString()) : new Date().toISOString(),
  };
  const idx = DISENOS_MEZCLA.findIndex(x => String(x.id) === String(diseno.id));
  if (idx >= 0) DISENOS_MEZCLA[idx] = diseno; else DISENOS_MEZCLA.unshift(diseno);
  sb.from('disenos_mezcla').upsert({ id: diseno.id, datos: diseno, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) console.error('Error guardando diseño:', error.message); });
  cerrarModal('modal-diseno');
  renderDisenosMezcla();
}

function eliminarDiseno(id) {
  const d = DISENOS_MEZCLA.find(x => String(x.id) === String(id));
  if (!d || !confirm(`¿Eliminar el diseño ${d.codigo} — ${d.nombre}?`)) return;
  DISENOS_MEZCLA = DISENOS_MEZCLA.filter(x => String(x.id) !== String(id));
  renderDisenosMezcla();
  sb.from('disenos_mezcla').delete().eq('id', d.id)
    .then(({ error }) => {
      if (error) { console.error('Error eliminando diseño:', error.message); alert('Error al eliminar: ' + error.message); DISENOS_MEZCLA.push(d); renderDisenosMezcla(); }
    });
}

function poblarSelectDisenos(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const activos = DISENOS_MEZCLA.filter(d => d.estado !== 'Inactivo').sort((a, b) => a.codigo.localeCompare(b.codigo));
  sel.innerHTML = '<option value="">— Selecciona un diseño —</option>' + activos.map(d => `<option value="${d.codigo}">${d.codigo} — ${d.nombre} (${d.resistenciaDiseno} MPa)</option>`).join('');
}

// La revisión más próxima (la primera) que ocurrió DESPUÉS de una fecha dada — se usa
// para avisar en pantalla (nunca en los PDF) que un registro quedó "desactualizado"
// frente a la receta vigente hoy del diseño de mezcla.
function _proximaRevisionDiseno(disenoCodigo, fecha) {
  if (!disenoCodigo || !fecha) return null;
  const d = DISENOS_MEZCLA.find(x => x.codigo === disenoCodigo);
  const posteriores = (d?.revisiones || []).filter(r => r.fecha > fecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return posteriores[0] || null;
}

// Índice de "versión" del diseño vigente en una fecha dada (0 = receta original,
// 1 = después de la primera revisión, 2 = después de la segunda, etc.).
function _segmentoRevisionDiseno(disenoCodigo, fecha) {
  const d = DISENOS_MEZCLA.find(x => x.codigo === disenoCodigo);
  const revisiones = (d?.revisiones || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  let idx = 0;
  for (const r of revisiones) { if (fecha >= r.fecha) idx++; else break; }
  return idx;
}

// ═══════════════════════════════
// CALIDAD — CONTROL DE ENSAYOS
// ═══════════════════════════════
let ENSAYOS_CALIDAD = [];
let _resultadosEnsayoActual = [];

function siguienteNumeroEnsayo() {
  const nums = ENSAYOS_CALIDAD.map(e => parseInt((e.numero || '').replace(/\D/g, '')) || 0);
  const max = nums.length ? Math.max(...nums) : 0;
  return 'ENS-' + String(max + 1).padStart(4, '0');
}

function calcularEstadoEnsayo(ensayo) {
  const resultados = ensayo.resultados || [];
  if (!resultados.length) return 'En curado';
  const finales = resultados.filter(r => Number(r.edad) >= 28);
  if (!finales.length) return 'En curado';
  const cumpleTodos = finales.every(r => Number(r.resistencia) >= Number(ensayo.resistenciaObjetivo || 0));
  return cumpleTodos ? 'Cumple' : 'No cumple';
}

// Resuelve el ajuste diario (y por tanto cliente/proyecto) vinculado a un ensayo, vía su cilindro.
function _ajusteDeEnsayo(e) {
  return AJUSTES_MEZCLA.find(x => String(x.cilindroNo) === String(e.cilindroNo));
}

// Clientes y proyectos de un ensayo (cliente/proyecto principal + adicionales del ajuste vinculado).
function _clientesProyectosEnsayo(e) {
  const a = _ajusteDeEnsayo(e);
  const clientes = new Set(), proyectos = new Set();
  if (a) {
    if (a.cliente) clientes.add(a.cliente);
    if (a.proyecto) proyectos.add(a.proyecto);
    (a.clientesAdicionales || []).forEach(c => { if (c.cliente) clientes.add(c.cliente); if (c.proyecto) proyectos.add(c.proyecto); });
  }
  return { clientes: [...clientes], proyectos: [...proyectos] };
}

function poblarFiltrosEnsayosLista() {
  const selCliente = document.getElementById('ensayos-filtro-cliente');
  const selProyecto = document.getElementById('ensayos-filtro-proyecto');
  const selResistencia = document.getElementById('ensayos-filtro-resistencia');
  if (!selCliente || !selProyecto || !selResistencia) return;

  const clientes = new Set(), proyectos = new Set();
  ENSAYOS_CALIDAD.forEach(e => {
    const ctx = _clientesProyectosEnsayo(e);
    ctx.clientes.forEach(c => clientes.add(c));
    ctx.proyectos.forEach(p => proyectos.add(p));
  });
  const prevCliente = selCliente.value, prevProyecto = selProyecto.value;
  selCliente.innerHTML = '<option value="">Todos los clientes</option>' +
    [...clientes].sort().map(c => `<option value="${c}">${c}</option>`).join('');
  selProyecto.innerHTML = '<option value="">Todos los proyectos</option>' +
    [...proyectos].sort().map(p => `<option value="${p}">${p}</option>`).join('');
  if (prevCliente) selCliente.value = prevCliente;
  if (prevProyecto) selProyecto.value = prevProyecto;

  const disenosConEnsayo = [...new Set(ENSAYOS_CALIDAD.map(e => e.disenoCodigo).filter(Boolean))]
    .map(c => DISENOS_MEZCLA.find(d => d.codigo === c) || { codigo: c, nombre: '' })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const prevResistencia = selResistencia.value;
  selResistencia.innerHTML = '<option value="">Todas las resistencias</option>' +
    disenosConEnsayo.map(d => `<option value="${d.codigo}">${d.codigo}${d.nombre ? ' — ' + d.nombre : ''}</option>`).join('');
  if (prevResistencia) selResistencia.value = prevResistencia;
}

// Aplica los filtros de la pantalla de Control de Ensayos (búsqueda, estado, cliente, proyecto, resistencia).
function _ensayosFiltrados() {
  const q = (document.getElementById('buscar-ensayo')?.value || '').toLowerCase();
  const fEstado = document.getElementById('filtro-estado-ensayo')?.value || '';
  const fCliente = document.getElementById('ensayos-filtro-cliente')?.value || '';
  const fProyecto = document.getElementById('ensayos-filtro-proyecto')?.value || '';
  const fResistencia = document.getElementById('ensayos-filtro-resistencia')?.value || '';
  let data = ENSAYOS_CALIDAD.map(e => ({ ...e, _estado: calcularEstadoEnsayo(e) }));
  if (q) data = data.filter(e => (e.numero + ' ' + String(e.cilindroNo || '') + ' ' + (e.elemento || '') + ' ' + (e.disenoCodigo || '')).toLowerCase().includes(q));
  if (fEstado) data = data.filter(e => e._estado === fEstado);
  if (fCliente) data = data.filter(e => _clientesProyectosEnsayo(e).clientes.includes(fCliente));
  if (fProyecto) data = data.filter(e => _clientesProyectosEnsayo(e).proyectos.includes(fProyecto));
  if (fResistencia) data = data.filter(e => e.disenoCodigo === fResistencia);
  data.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  return data;
}

function renderEnsayosCalidad() {
  const tbody = document.getElementById('ensayos-body');
  const resumen = document.getElementById('ensayos-resumen');
  if (!tbody) return;
  poblarFiltrosEnsayosLista();
  const data = _ensayosFiltrados();

  if (resumen) {
    const enCurado = ENSAYOS_CALIDAD.filter(e => calcularEstadoEnsayo(e) === 'En curado').length;
    const cumple = ENSAYOS_CALIDAD.filter(e => calcularEstadoEnsayo(e) === 'Cumple').length;
    const noCumple = ENSAYOS_CALIDAD.filter(e => calcularEstadoEnsayo(e) === 'No cumple').length;
    resumen.innerHTML = `
      <div style="background:white;border-radius:6px;padding:8px 14px;box-shadow:var(--sombra);border-top:3px solid #1565C0;min-width:130px"><div style="font-size:10px;font-weight:700;color:#1565C0;text-transform:uppercase">En curado</div><div style="font-size:18px;font-weight:800">${enCurado}</div></div>
      <div style="background:white;border-radius:6px;padding:8px 14px;box-shadow:var(--sombra);border-top:3px solid var(--verde);min-width:130px"><div style="font-size:10px;font-weight:700;color:var(--verde);text-transform:uppercase">Cumple</div><div style="font-size:18px;font-weight:800">${cumple}</div></div>
      <div style="background:white;border-radius:6px;padding:8px 14px;box-shadow:var(--sombra);border-top:3px solid #C62828;min-width:130px"><div style="font-size:10px;font-weight:700;color:#C62828;text-transform:uppercase">No cumple</div><div style="font-size:18px;font-weight:800">${noCumple}</div></div>`;
  }

  if (!data.length) {
    const hayFiltros = document.getElementById('buscar-ensayo')?.value || document.getElementById('filtro-estado-ensayo')?.value || document.getElementById('ensayos-filtro-cliente')?.value || document.getElementById('ensayos-filtro-proyecto')?.value || document.getElementById('ensayos-filtro-resistencia')?.value;
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state"><div class="icono">📐</div><div>${hayFiltros ? 'No hay ensayos que coincidan con los filtros seleccionados.' : 'No hay ensayos registrados.'}</div></td></tr>`;
    return;
  }
  const colorEstado = { 'En curado': '#1565C0', 'Cumple': '#2E7D32', 'No cumple': '#C62828' };
  const bgEstado = { 'En curado': '#E3F2FD', 'Cumple': '#E8F5E9', 'No cumple': '#FFEBEE' };
  tbody.innerHTML = data.map(e => {
    const ultimaResistencia = (e.resultados || []).length ? e.resultados[e.resultados.length - 1] : null;
    return `<tr style="border-top:2px solid var(--azul-oscuro)">
      <td style="font-weight:700;color:var(--azul)">${e.cilindroNo || '—'}</td>
      <td>${e.fecha ? new Date(e.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${e.disenoCodigo ? `<span style="font-size:11px;background:var(--gris-borde);color:#333;padding:2px 6px;border-radius:3px;font-weight:600">${e.disenoCodigo}</span>` : '—'}</td>
      <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${e.elemento || ''}">${e.elemento || '—'}</td>
      <td style="text-align:center">${e.resistenciaObjetivo || '—'} MPa</td>
      <td style="text-align:center">${ultimaResistencia ? Number(ultimaResistencia.resistencia).toFixed(1) + ' MPa (' + ultimaResistencia.edad + 'd)' : '—'}</td>
      <td><span class="badge" style="background:${bgEstado[e._estado]};color:${colorEstado[e._estado]}">${e._estado}</span></td>
      <td>${USUARIOS_CRM[e.creadoPor]?.nombre || e.creadoPor || '—'}</td>
      <td>
        <div class="flex-gap">
          ${e.pdfPath ? `<button class="btn btn-secundario btn-xs" onclick="verPdfEnsayo('${e.id}')">📄 Ver PDF</button>` : ''}
          <button class="btn btn-primario btn-xs" onclick="editarEnsayo('${e.id}')">✏️ Editar</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarEnsayo('${e.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// Genera un reporte imprimible (mismo membrete de las cotizaciones/certificados) con los
// ensayos que cumplen los filtros activos de Control de Ensayos, para entregar al cliente.
function verReporteEnsayosPDF() {
  const data = _ensayosFiltrados();
  if (!data.length) { alert('No hay ensayos que coincidan con los filtros para incluir en el reporte.'); return; }

  const fCliente = document.getElementById('ensayos-filtro-cliente')?.value || '';
  const fProyecto = document.getElementById('ensayos-filtro-proyecto')?.value || '';
  const fResistencia = document.getElementById('ensayos-filtro-resistencia')?.value || '';
  const filtrosTxt = [
    fCliente ? `Cliente: ${fCliente}` : '',
    fProyecto ? `Proyecto: ${fProyecto}` : '',
    fResistencia ? `Resistencia: ${fResistencia}` : '',
  ].filter(Boolean).join(' · ');
  const fechaHoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

  const colorEstado = { 'En curado': '#1565C0', 'Cumple': '#2E7D32', 'No cumple': '#C62828' };
  const bgEstado = { 'En curado': '#E3F2FD', 'Cumple': '#E8F5E9', 'No cumple': '#FFEBEE' };

  const filas = data.map(e => {
    const ultimaResistencia = (e.resultados || []).length ? e.resultados[e.resultados.length - 1] : null;
    const ctx = _clientesProyectosEnsayo(e);
    return `<tr>
      <td style="padding:5px 6px;font-weight:700;color:#003F7F">${e.cilindroNo || '—'}</td>
      <td style="padding:5px 6px">${e.fecha ? new Date(e.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td style="padding:5px 6px">${ctx.clientes.join(', ') || '—'}</td>
      <td style="padding:5px 6px">${ctx.proyectos.join(', ') || '—'}</td>
      <td style="padding:5px 6px">${e.disenoCodigo || '—'}</td>
      <td style="padding:5px 6px">${e.elemento || '—'}</td>
      <td style="padding:5px 6px;text-align:center">${e.resistenciaObjetivo || '—'} MPa</td>
      <td style="padding:5px 6px;text-align:center">${ultimaResistencia ? Number(ultimaResistencia.resistencia).toFixed(1) + ' MPa (' + ultimaResistencia.edad + 'd)' : '—'}</td>
      <td style="padding:5px 6px;text-align:center"><span style="background:${bgEstado[e._estado]};color:${colorEstado[e._estado]};padding:2px 6px;border-radius:3px;font-size:9.5px;font-weight:700">${e._estado}</span></td>
    </tr>`;
  }).join('');

  const html = `
    <div class="no-print" style="background:#1C2333;color:white;padding:12px 24px;display:flex;align-items:center;gap:16px">
      <span style="font-weight:700">Reporte de Resultados de Ensayos${fCliente ? ' — ' + fCliente : ''}</span>
      <div style="flex:1"></div>
      <button onclick="descargarReporteEnsayosPDF()" style="background:#1976D2;color:white;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-weight:700">⬇️ Descargar PDF</button>
      <button onclick="document.getElementById('vista-previa').style.display='none';document.getElementById('pantalla-control-ensayos').classList.add('activa')" style="background:#555;color:white;border:none;padding:8px 14px;border-radius:5px;cursor:pointer">← Volver</button>
    </div>
    <div class="preview-doc" id="reporte-ensayos-doc">
      <div class="preview-membrete-header">
        <img src="membrete-top.jpg" alt="">
      </div>
      <div class="preview-content" id="reporte-ensayos-content" style="padding-top:6px">
        <div style="text-align:center;margin-bottom:10px">
          <div style="font-size:13px;font-weight:700;color:#003F7F;letter-spacing:0.03em">REPORTE DE RESULTADOS DE ENSAYOS DE RESISTENCIA</div>
          ${filtrosTxt ? `<div style="font-size:10.5px;color:#555;margin-top:2px">${filtrosTxt}</div>` : ''}
          <div style="font-size:10px;color:#777">${data.length} ensayo${data.length === 1 ? '' : 's'} · Generado el ${fechaHoy}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;border:1px solid #ddd">
          <thead>
            <tr style="background:#ECEFF1">
              <th style="padding:5px 6px;text-align:left">CILINDRO</th>
              <th style="padding:5px 6px;text-align:left">FECHA</th>
              <th style="padding:5px 6px;text-align:left">CLIENTE</th>
              <th style="padding:5px 6px;text-align:left">PROYECTO</th>
              <th style="padding:5px 6px;text-align:left">DISEÑO</th>
              <th style="padding:5px 6px;text-align:left">ELEMENTO</th>
              <th style="padding:5px 6px;text-align:center">OBJETIVO</th>
              <th style="padding:5px 6px;text-align:center">RESULTADO</th>
              <th style="padding:5px 6px;text-align:center">ESTADO</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <div class="preview-membrete-footer" id="reporte-ensayos-footer">
        <div class="pf-arco"></div>
        <div class="pf-datos">
          <div class="pf-col"><span class="pf-icon">📞</span><span>+57 314 620 1650<br>+57 311 408 2285</span></div>
          <div class="pf-col"><span class="pf-icon">🏠</span><span>Autopista del Café Km2<br>Vía Chinchiná – Santa Rosa</span></div>
          <div class="pf-col"><span class="pf-icon">🌐</span><span>www.proconcreto.com.co</span></div>
        </div>
      </div>
    </div>`;

  document.getElementById('contenido-preview').innerHTML = html;
  document.getElementById('vista-previa').style.display = 'block';
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  window.scrollTo(0, 0);
}

async function descargarReporteEnsayosPDF() {
  const btn = document.querySelector('.no-print button[onclick*="descargarReporteEnsayosPDF"]');
  if (btn) { btn.textContent = '⏳ Generando...'; btn.disabled = true; }
  try {
    const { jsPDF } = window.jspdf;
    const pageW = 210, pageH = 297;
    const topImg = await cargarImagen('membrete-top.jpg');
    const headerH = pageW * (topImg.naturalHeight / topImg.naturalWidth);
    const contentEl = document.getElementById('reporte-ensayos-content');
    const contentCanvas = await html2canvas(contentEl, { scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false });
    const pxToMm = pageW / contentCanvas.width;
    const contentH_px = _alturaContenidoReal(contentCanvas);
    const footerEl = document.getElementById('reporte-ensayos-footer');
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
      sliceCanvas.getContext('2d').drawImage(contentCanvas, 0, Math.floor(cursorY), contentCanvas.width, Math.ceil(sliceH_px), 0, 0, contentCanvas.width, Math.ceil(sliceH_px));
      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, headerH + 2, pageW, sliceH_px * pxToMm);
      pdf.addImage(footerData, 'JPEG', 0, pageH - footerH, pageW, footerH);
      cursorY = bottom;
      pageIndex++;
    }
    pdf.save(`Reporte_Ensayos_${new Date().toISOString().slice(0, 10)}.pdf`);
  } finally {
    if (btn) { btn.textContent = '⬇️ Descargar PDF'; btn.disabled = false; }
  }
}

// La edad de un resultado no la digita nadie: es simplemente la cantidad de días
// entre la fecha fundida (fecha del ajuste diario/diseño ajustado por humedad) y la
// fecha en que se falló ese cilindro, ya que un mismo ensayo puede tener resultados
// a distintas edades (7, 14, 28 días...) antes de la evaluación final a los 28 días.
function _calcularEdadEnsayo(fechaFundida, fechaResultado) {
  if (!fechaFundida || !fechaResultado) return null;
  const msPorDia = 24 * 60 * 60 * 1000;
  const dias = Math.round((new Date(fechaResultado + 'T12:00') - new Date(fechaFundida + 'T12:00')) / msPorDia);
  return dias;
}

// Cada probeta es un objeto { resistencia, diametro, longitud, carga }.
//  · Laboratorio externo: se digita "resistencia" directamente.
//  · Ensayos internos: se digitan diámetro/longitud/carga y la resistencia se calcula.
// Un ensayo de resistencia (NSR-10 C.5.6.2.4) es el promedio de 2 o 3 probetas.
function _esEnsayoInterno() {
  return (document.getElementById('m-ensayo-laboratorio')?.value || '') === 'ENSAYOS INTERNOS';
}

// Factor de corrección por relación longitud/diámetro (ASTM C39 / NTC 673).
function _factorCorreccionLD(ld) {
  if (!(ld > 0) || ld >= 2.0) return 1.00;
  const tabla = [[1.00, 0.87], [1.25, 0.93], [1.50, 0.96], [1.75, 0.98], [2.00, 1.00]];
  if (ld <= 1.0) return 0.87;
  for (let i = 0; i < tabla.length - 1; i++) {
    const [x1, y1] = tabla[i], [x2, y2] = tabla[i + 1];
    if (ld >= x1 && ld <= x2) return y1 + (y2 - y1) * (ld - x1) / (x2 - x1);
  }
  return 1.00;
}

// Resistencia de una probeta interna: carga(kN) / área(mm²), corregida por L/D.
function _resistenciaProbetaInterna(diametro, longitud, carga) {
  const d = parseFloat(diametro), l = parseFloat(longitud), c = parseFloat(carga);
  if (!(d > 0) || !(c > 0)) return null;
  const area = Math.PI * d * d / 4;                 // mm²
  const factor = _factorCorreccionLD((l > 0) ? l / d : 2);
  return Math.round((c * 1000 / area) * factor * 10) / 10;  // MPa, a 1 decimal (convención de laboratorio)
}

function _promedioProbetas(probetas) {
  const vals = (probetas || [])
    .map(p => (p && typeof p === 'object') ? parseFloat(p.resistencia) : parseFloat(p))
    .filter(v => !isNaN(v) && v > 0);
  if (!vals.length) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

// Normaliza cada probeta a objeto (migra formatos viejos: número suelto o resistencia única).
function _normalizarProbeta(p) {
  if (p == null || p === '') return { resistencia: null, diametro: null, longitud: null, carga: null };
  if (typeof p === 'object') return { resistencia: (p.resistencia ?? null), diametro: (p.diametro ?? null), longitud: (p.longitud ?? null), carga: (p.carga ?? null) };
  return { resistencia: (parseFloat(p) || null), diametro: null, longitud: null, carga: null };
}

function _normalizarResultado(r) {
  if (!r.probetas) r.probetas = (Number(r.resistencia) > 0) ? [{ resistencia: Number(r.resistencia) }] : [];
  r.probetas = r.probetas.map(_normalizarProbeta);
  while (r.probetas.length < 3) r.probetas.push({ resistencia: null, diametro: null, longitud: null, carga: null });
  r.resistencia = _promedioProbetas(r.probetas);
  return r;
}

function renderResultadosEnsayo() {
  const cont = document.getElementById('resultados-ensayo-cont');
  const nota = document.getElementById('resultados-ensayo-nota');
  if (!cont) return;
  const interno = _esEnsayoInterno();
  if (nota) nota.textContent = interno
    ? 'Ensayo interno: ingresa diámetro, longitud y carga de 2 o 3 probetas; la resistencia se calcula (carga ÷ área, corregida por L/D). El resultado válido es el promedio (NSR-10 C.5.6.2.4).'
    : 'Falla 2 o 3 probetas de la misma muestra y edad; el resultado válido es el promedio (NSR-10 C.5.6.2.4).';
  const fechaFundida = document.getElementById('m-ensayo-fecha')?.value || '';
  if (!_resultadosEnsayoActual.length) {
    cont.innerHTML = `<div style="text-align:center;padding:10px;color:var(--gris-medio);font-size:12px">Agrega resultados de ensayo por edad (7, 14, 28 días...)</div>`;
    return;
  }
  _resultadosEnsayoActual.forEach(_normalizarResultado);
  cont.innerHTML = interno ? _renderResultadosInterno(fechaFundida) : _renderResultadosExterno(fechaFundida);
}

function _renderResultadosExterno(fechaFundida) {
  const filas = _resultadosEnsayoActual.map((r, i) => {
    const edad = _calcularEdadEnsayo(fechaFundida, r.fecha);
    const prom = _promedioProbetas(r.probetas);
    const inputProbeta = (j) => `<input type="number" value="${r.probetas[j].resistencia != null ? r.probetas[j].resistencia : ''}" min="0" step="0.1" placeholder="—" oninput="_setProbetaResistencia(${i},${j},this.value)" style="width:68px">`;
    return `
    <tr>
      <td style="text-align:center;font-weight:700">${edad != null ? edad + ' d' : '—'}</td>
      <td><input type="date" value="${r.fecha || ''}" onchange="_resultadosEnsayoActual[${i}].fecha=this.value;renderResultadosEnsayo()"></td>
      <td>${inputProbeta(0)}</td>
      <td>${inputProbeta(1)}</td>
      <td>${inputProbeta(2)}</td>
      <td style="text-align:center;font-weight:800;color:var(--azul)" id="prom-cell-${i}">${prom ? prom.toFixed(1) : '—'}</td>
      <td><button class="btn btn-rojo btn-xs" onclick="eliminarResultadoEnsayo(${i})">✕</button></td>
    </tr>`;
  }).join('');
  return `<table class="tabla-items" style="width:100%">
    <thead><tr><th style="width:60px">Edad <span style="font-weight:400;text-transform:none">(auto)</span></th><th style="width:130px">Fecha ensayo</th><th style="text-align:center">Probeta 1</th><th style="text-align:center">Probeta 2</th><th style="text-align:center">Probeta 3</th><th style="width:80px;text-align:center">Promedio (MPa)</th><th style="width:36px"></th></tr></thead>
    <tbody>${filas}</tbody></table>`;
}

function _renderResultadosInterno(fechaFundida) {
  return _resultadosEnsayoActual.map((r, i) => {
    const edad = _calcularEdadEnsayo(fechaFundida, r.fecha);
    const prom = _promedioProbetas(r.probetas);
    const filas = r.probetas.map((p, j) => `
      <tr>
        <td style="text-align:center;font-weight:600">${j + 1}</td>
        <td><input type="number" value="${p.diametro != null ? p.diametro : ''}" min="0" step="0.1" placeholder="mm" oninput="_setProbetaCampo(${i},${j},'diametro',this.value)" style="width:70px"></td>
        <td><input type="number" value="${p.longitud != null ? p.longitud : ''}" min="0" step="0.1" placeholder="mm" oninput="_setProbetaCampo(${i},${j},'longitud',this.value)" style="width:70px"></td>
        <td><input type="number" value="${p.carga != null ? p.carga : ''}" min="0" step="0.1" placeholder="kN" oninput="_setProbetaCampo(${i},${j},'carga',this.value)" style="width:80px"></td>
        <td style="text-align:center;font-weight:700;color:var(--azul)" id="res-cell-${i}-${j}">${p.resistencia ? Number(p.resistencia).toFixed(1) : '—'}</td>
      </tr>`).join('');
    return `
      <div style="border:1px solid var(--gris-borde);border-radius:6px;padding:10px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px">
          <div class="form-grupo" style="margin:0"><label style="font-size:11px">Fecha ensayo</label><input type="date" value="${r.fecha || ''}" onchange="_resultadosEnsayoActual[${i}].fecha=this.value;renderResultadosEnsayo()"></div>
          <div style="font-size:12px"><span style="color:var(--gris-medio)">Edad:</span> <b>${edad != null ? edad + ' d' : '—'}</b></div>
          <div style="flex:1"></div>
          <button class="btn btn-rojo btn-xs" onclick="eliminarResultadoEnsayo(${i})">✕ Quitar</button>
        </div>
        <table class="tabla-items" style="width:100%">
          <thead><tr><th style="width:60px">Probeta</th><th style="text-align:center">Diámetro (mm)</th><th style="text-align:center">Longitud (mm)</th><th style="text-align:center">Carga (kN)</th><th style="text-align:center">Resistencia (MPa)</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
        <div style="text-align:right;font-size:13px;margin-top:6px">Promedio del ensayo: <b style="color:var(--azul);font-size:15px" id="prom-cell-${i}">${prom ? prom.toFixed(1) : '—'}</b> MPa</div>
      </div>`;
  }).join('');
}

function _ensureProbeta(i, j) {
  const r = _resultadosEnsayoActual[i];
  if (!r.probetas) r.probetas = [];
  while (r.probetas.length <= j) r.probetas.push({ resistencia: null, diametro: null, longitud: null, carga: null });
  r.probetas[j] = _normalizarProbeta(r.probetas[j]);
}

function _actualizarPromedioResultado(i) {
  const prom = _promedioProbetas(_resultadosEnsayoActual[i].probetas);
  _resultadosEnsayoActual[i].resistencia = prom;
  const cell = document.getElementById('prom-cell-' + i);
  if (cell) cell.textContent = prom ? prom.toFixed(1) : '—';
}

// Externo: se digita la resistencia directamente.
function _setProbetaResistencia(i, j, val) {
  _ensureProbeta(i, j);
  _resultadosEnsayoActual[i].probetas[j].resistencia = (val === '' ? null : (parseFloat(val) || 0));
  _actualizarPromedioResultado(i);
}

// Interno: se digita diámetro/longitud/carga y la resistencia se calcula.
function _setProbetaCampo(i, j, campo, val) {
  _ensureProbeta(i, j);
  const p = _resultadosEnsayoActual[i].probetas[j];
  p[campo] = (val === '' ? null : (parseFloat(val) || 0));
  p.resistencia = _resistenciaProbetaInterna(p.diametro, p.longitud, p.carga);
  const rc = document.getElementById(`res-cell-${i}-${j}`);
  if (rc) rc.textContent = p.resistencia ? Number(p.resistencia).toFixed(1) : '—';
  _actualizarPromedioResultado(i);
}

function agregarResultadoEnsayo() {
  _resultadosEnsayoActual.push({ fecha: '', probetas: [{ resistencia: null, diametro: null, longitud: null, carga: null }, { resistencia: null, diametro: null, longitud: null, carga: null }, { resistencia: null, diametro: null, longitud: null, carga: null }], resistencia: 0 });
  renderResultadosEnsayo();
}

function eliminarResultadoEnsayo(i) {
  _resultadosEnsayoActual.splice(i, 1);
  renderResultadosEnsayo();
}

function actualizarObjetivoDesdeDiseno() {
  const codigo = document.getElementById('m-ensayo-diseno').value;
  const d = DISENOS_MEZCLA.find(x => x.codigo === codigo);
  if (d) document.getElementById('m-ensayo-objetivo').value = d.resistenciaDiseno;
}

// ── Informe de laboratorio (PDF) adjunto — bucket privado "laboratorio-pdf" en Supabase
// Storage. Cada ensayo va ligado a un N° de cilindro (del Ajuste Diario), y es justamente el
// informe de ESE cilindro el que manda el laboratorio — por eso se adjunta acá y no en Materia
// Prima (que es sobre insumos como cemento/arena, un concepto distinto). Los PDFs pesados
// (escaneados) se comprimen en el navegador antes de subirlos (ver js/compresor-pdf.js); la
// subida real a Storage se hace al Guardar, no al elegir el archivo, para no dejar archivos
// huérfanos si se cancela el modal sin guardar.
let _pdfLaboratorioPendiente = null; // { blob, nombre, comprimido, tamanoOriginal, tamanoFinal } recién elegido, listo para subir
let _pdfLaboratorioExistente = null; // { path, nombre } ya guardado en el ensayo que se está editando

function _renderZonaPdfLaboratorio() {
  const el = document.getElementById('ensayo-pdf-estado');
  if (!el) return;
  const kb = (n) => (n / 1024).toFixed(0) + ' KB';
  if (_pdfLaboratorioPendiente) {
    const p = _pdfLaboratorioPendiente;
    el.innerHTML = `<span style="color:var(--verde)">✅ ${p.nombre} — ${p.comprimido ? `comprimido de ${kb(p.tamanoOriginal)} a ${kb(p.tamanoFinal)}` : kb(p.tamanoFinal)}</span> · <a href="#" onclick="event.stopPropagation();quitarPdfLaboratorio();return false" style="color:var(--rojo)">quitar</a>`;
  } else if (_pdfLaboratorioExistente) {
    el.innerHTML = `<span style="color:var(--gris-medio)">📄 ${_pdfLaboratorioExistente.nombre || 'PDF adjunto'}</span> · <a href="#" onclick="event.stopPropagation();verPdfLaboratorio();return false">ver</a> · <a href="#" onclick="event.stopPropagation();quitarPdfLaboratorio();return false" style="color:var(--rojo)">quitar</a>`;
  } else {
    el.textContent = '';
  }
}

async function manejarArchivoLaboratorio(file) {
  if (!file) return;
  if (file.type !== 'application/pdf') { alert('Ese archivo no es un PDF.'); return; }
  if (typeof pdfjsLib === 'undefined' || typeof window.jspdf === 'undefined') { alert('No se pudo cargar el procesador de PDF — revisa tu conexión.'); return; }

  const el = document.getElementById('ensayo-pdf-estado');
  if (el) el.textContent = '⏳ Procesando...';
  try {
    const { blob, comprimido, tamanoOriginal, tamanoFinal } = await _comprimirPdfSiPesa(file);
    _pdfLaboratorioPendiente = { blob, nombre: file.name, comprimido, tamanoOriginal, tamanoFinal };
    _pdfLaboratorioExistente = null; // el nuevo reemplaza al que hubiera
    _renderZonaPdfLaboratorio();
  } catch (err) {
    console.error('Error procesando PDF de laboratorio:', err);
    if (el) el.textContent = 'No se pudo procesar este PDF.';
  }
}

function onSeleccionLaboratorio(event) {
  const file = event.target.files[0];
  manejarArchivoLaboratorio(file);
  event.target.value = '';
}

function onArrastreSobreLaboratorio(event) { event.preventDefault(); event.currentTarget.style.borderColor = 'var(--azul-claro)'; }
function onArrastreFueraLaboratorio(event) { event.currentTarget.style.borderColor = 'var(--gris-borde)'; }
function onSoltarLaboratorio(event) {
  event.preventDefault();
  event.currentTarget.style.borderColor = 'var(--gris-borde)';
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  manejarArchivoLaboratorio(file);
}

function quitarPdfLaboratorio() {
  _pdfLaboratorioPendiente = null;
  _pdfLaboratorioExistente = null;
  _renderZonaPdfLaboratorio();
}

function verPdfLaboratorio() {
  if (!_pdfLaboratorioExistente) return;
  _abrirPdfStorage('laboratorio-pdf', _pdfLaboratorioExistente.path);
}

function verPdfEnsayo(id) {
  const e = ENSAYOS_CALIDAD.find(x => String(x.id) === String(id));
  if (!e || !e.pdfPath) return;
  _abrirPdfStorage('laboratorio-pdf', e.pdfPath);
}

function abrirModalEnsayo() {
  document.getElementById('m-ensayo-id').value = '';
  document.getElementById('modal-ensayo-titulo').textContent = '📐 Nuevo Ensayo de Calidad';
  document.getElementById('m-ensayo-numero').value = siguienteNumeroEnsayo();
  document.getElementById('m-ensayo-laboratorio').value = '';
  document.getElementById('m-ensayo-fecha').value = new Date().toISOString().split('T')[0];
  poblarDatalistCilindros('datalist-cilindros-ensayo');
  document.getElementById('m-ensayo-cilindro').value = '';
  _poblarProductoClienteProyectoEnsayo('');
  document.getElementById('m-ensayo-diseno').value = '';
  document.getElementById('m-ensayo-diseno-display').value = '';
  document.getElementById('m-ensayo-objetivo').value = '';
  document.getElementById('m-ensayo-obs').value = '';
  _resultadosEnsayoActual = [];
  renderResultadosEnsayo();
  _pdfLaboratorioPendiente = null;
  _pdfLaboratorioExistente = null;
  _renderZonaPdfLaboratorio();
  document.getElementById('modal-ensayo').classList.add('abierto');
}

function editarEnsayo(id) {
  const e = ENSAYOS_CALIDAD.find(x => String(x.id) === String(id));
  if (!e) return;
  document.getElementById('m-ensayo-id').value = e.id;
  document.getElementById('modal-ensayo-titulo').textContent = '✏️ Editar Ensayo de Calidad';
  document.getElementById('m-ensayo-numero').value = e.numero || '';
  document.getElementById('m-ensayo-laboratorio').value = e.laboratorio || '';
  document.getElementById('m-ensayo-fecha').value = e.fecha || '';
  poblarDatalistCilindros('datalist-cilindros-ensayo');
  const ajusteVinculado = AJUSTES_MEZCLA.find(x => String(x.cilindroNo) === String(e.cilindroNo));
  document.getElementById('m-ensayo-cilindro').value = e.cilindroNo ? (ajusteVinculado ? _textoCilindroEnsayo(ajusteVinculado) : `Cilindro ${e.cilindroNo}`) : '';
  // Fecha, Diseño, Resistencia, Producto, Cliente y Proyecto son "automáticos": si el
  // ajuste vinculado sigue existiendo, se recalculan en vivo (igual que al elegir el
  // cilindro por primera vez); si ya no existe, se usa lo que había quedado guardado.
  if (ajusteVinculado) {
    cargarDesdeAjusteMezcla();
  } else {
    _poblarProductoClienteProyectoEnsayo(e.cilindroNo);
    document.getElementById('m-ensayo-diseno').value = e.disenoCodigo || '';
    document.getElementById('m-ensayo-diseno-display').value = _textoDisenoEnsayo(e.disenoCodigo);
    document.getElementById('m-ensayo-objetivo').value = e.resistenciaObjetivo || '';
  }
  document.getElementById('m-ensayo-obs').value = e.observaciones || '';
  _resultadosEnsayoActual = JSON.parse(JSON.stringify(e.resultados || [])).map(_normalizarResultado);
  renderResultadosEnsayo();
  _pdfLaboratorioPendiente = null;
  _pdfLaboratorioExistente = e.pdfPath ? { path: e.pdfPath, nombre: e.pdfNombre || 'informe.pdf' } : null;
  _renderZonaPdfLaboratorio();
  document.getElementById('modal-ensayo').classList.add('abierto');
}

async function guardarEnsayo() {
  const numero = document.getElementById('m-ensayo-numero').value.trim();
  const fecha = document.getElementById('m-ensayo-fecha').value;
  if (!numero || !fecha) { alert('Completa los campos obligatorios: N° Ensayo y Fecha.'); return; }
  const cilindroTexto = document.getElementById('m-ensayo-cilindro').value.trim();
  const ajusteVinculado = _ajusteDesdeTextoCilindroEnsayo(cilindroTexto);
  if (cilindroTexto && !ajusteVinculado) { alert('El cilindro escrito no corresponde a ningún Ajuste Diario. Elige uno de la lista, o borra el campo si el ensayo no tiene ajuste asociado.'); return; }
  const editId = document.getElementById('m-ensayo-id').value;
  const idFinal = editId || String(Date.now());

  let pdfPath = _pdfLaboratorioExistente?.path || '';
  let pdfNombre = _pdfLaboratorioExistente?.nombre || '';

  if (_pdfLaboratorioPendiente) {
    const ruta = `${idFinal}/${Date.now()}-${_pdfLaboratorioPendiente.nombre}`;
    const { error } = await sb.storage.from('laboratorio-pdf').upload(ruta, _pdfLaboratorioPendiente.blob, { contentType: 'application/pdf' });
    if (error) { alert('No se pudo subir el informe de laboratorio: ' + error.message); return; }
    pdfPath = ruta;
    pdfNombre = _pdfLaboratorioPendiente.nombre;
  }

  const ensayo = {
    id: idFinal,
    numero, fecha,
    laboratorio: document.getElementById('m-ensayo-laboratorio').value.trim(),
    cilindroNo: ajusteVinculado?.cilindroNo || '',
    disenoCodigo: document.getElementById('m-ensayo-diseno').value,
    // "Elemento" ya no se digita aparte: se toma del Producto que se resolvió arriba
    // en automático (a partir del cilindro), para no duplicar el mismo dato dos veces.
    elemento: document.getElementById('m-ensayo-producto').value.trim(),
    resistenciaObjetivo: parseFloat(document.getElementById('m-ensayo-objetivo').value) || 0,
    observaciones: document.getElementById('m-ensayo-obs').value.trim(),
    laboratorioTipo: _esEnsayoInterno() ? 'interno' : 'externo',
    pdfPath, pdfNombre,
    resultados: _resultadosEnsayoActual.map(r => {
      const probetas = (r.probetas || []).map(_normalizarProbeta)
        .filter(p => p.resistencia != null || p.diametro != null || p.longitud != null || p.carga != null);
      return { fecha: r.fecha || '', probetas, resistencia: _promedioProbetas(probetas), edad: _calcularEdadEnsayo(fecha, r.fecha) };
    }),
    creadoPor: USUARIO_ACTUAL?.email,
    creadoEn: editId ? (ENSAYOS_CALIDAD.find(x => String(x.id) === String(editId))?.creadoEn || new Date().toISOString()) : new Date().toISOString(),
  };
  const idx = ENSAYOS_CALIDAD.findIndex(x => String(x.id) === String(ensayo.id));
  if (idx >= 0) ENSAYOS_CALIDAD[idx] = ensayo; else ENSAYOS_CALIDAD.unshift(ensayo);
  sb.from('ensayos_calidad').upsert({ id: ensayo.id, datos: ensayo, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) console.error('Error guardando ensayo:', error.message); });
  cerrarModal('modal-ensayo');
  renderEnsayosCalidad();
}

function eliminarEnsayo(id) {
  const e = ENSAYOS_CALIDAD.find(x => String(x.id) === String(id));
  if (!e || !confirm(`¿Eliminar el ensayo ${e.numero}?`)) return;
  ENSAYOS_CALIDAD = ENSAYOS_CALIDAD.filter(x => String(x.id) !== String(id));
  renderEnsayosCalidad();
  if (e.pdfPath) sb.storage.from('laboratorio-pdf').remove([e.pdfPath]);
  sb.from('ensayos_calidad').delete().eq('id', e.id)
    .then(({ error }) => {
      if (error) { console.error('Error eliminando ensayo:', error.message); alert('Error al eliminar: ' + error.message); ENSAYOS_CALIDAD.push(e); renderEnsayosCalidad(); }
    });
}
