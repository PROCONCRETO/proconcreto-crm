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
    return `<tr style="border-top:2px solid var(--azul-oscuro);${inactivo ? 'opacity:.55' : ''}">
      <td style="font-weight:700;color:var(--azul)">${d.codigo}</td>
      <td style="font-weight:600">${d.nombre}</td>
      <td style="text-align:center;font-weight:700">${d.resistenciaDiseno || '—'} MPa</td>
      <td style="text-align:center">${d.asentamiento || '—'} cm</td>
      <td style="text-align:center">${d.tamanoMaximo || '—'}</td>
      <td style="text-align:center">${d.relacionAguaCemento || '—'}</td>
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
  const diseno = {
    id: editId || String(Date.now()),
    codigo, nombre, resistenciaDiseno, tamanoMaximo,
    asentamiento: parseFloat(document.getElementById('m-diseno-asentamiento').value) || 0,
    relacionAguaCemento: parseFloat(document.getElementById('m-diseno-relacion').value) || 0,
    materiales: {
      cemento: parseFloat(document.getElementById('m-diseno-cemento').value) || 0,
      metacaolin: parseFloat(document.getElementById('m-diseno-metacaolin').value) || 0,
      arena: parseFloat(document.getElementById('m-diseno-arena').value) || 0,
      grava: parseFloat(document.getElementById('m-diseno-grava').value) || 0,
      absorcionArena: parseFloat(document.getElementById('m-diseno-absorcion-arena').value) || 0,
      absorcionTriturado: parseFloat(document.getElementById('m-diseno-absorcion-triturado').value) || 0,
      agua: parseFloat(document.getElementById('m-diseno-agua').value) || 0,
      aditivos: JSON.parse(JSON.stringify(_aditivosDisenoActual)),
    },
    estado: document.getElementById('m-diseno-estado').value,
    observaciones: document.getElementById('m-diseno-obs').value.trim(),
    creadoPor: USUARIO_ACTUAL?.email,
    creadoEn: editId ? (DISENOS_MEZCLA.find(x => String(x.id) === String(editId))?.creadoEn || new Date().toISOString()) : new Date().toISOString(),
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

function renderEnsayosCalidad() {
  const tbody = document.getElementById('ensayos-body');
  const resumen = document.getElementById('ensayos-resumen');
  if (!tbody) return;
  const q = (document.getElementById('buscar-ensayo')?.value || '').toLowerCase();
  const fEstado = document.getElementById('filtro-estado-ensayo')?.value || '';
  let data = ENSAYOS_CALIDAD.map(e => ({ ...e, _estado: calcularEstadoEnsayo(e) }));
  if (q) data = data.filter(e => (e.numero + ' ' + (e.elemento || '') + ' ' + (e.disenoCodigo || '')).toLowerCase().includes(q));
  if (fEstado) data = data.filter(e => e._estado === fEstado);
  data.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

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
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><div class="icono">📐</div><div>No hay ensayos registrados.</div></td></tr>`;
    return;
  }
  const colorEstado = { 'En curado': '#1565C0', 'Cumple': '#2E7D32', 'No cumple': '#C62828' };
  const bgEstado = { 'En curado': '#E3F2FD', 'Cumple': '#E8F5E9', 'No cumple': '#FFEBEE' };
  tbody.innerHTML = data.map(e => {
    const ultimaResistencia = (e.resultados || []).length ? e.resultados[e.resultados.length - 1] : null;
    return `<tr style="border-top:2px solid var(--azul-oscuro)">
      <td style="font-weight:700;color:var(--azul)">${e.numero}</td>
      <td>${e.fecha ? new Date(e.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${e.disenoCodigo ? `<span style="font-size:11px;background:var(--gris-borde);color:#333;padding:2px 6px;border-radius:3px;font-weight:600">${e.disenoCodigo}</span>` : '—'}</td>
      <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${e.elemento || ''}">${e.elemento || '—'}</td>
      <td style="text-align:center">${e.resistenciaObjetivo || '—'} MPa</td>
      <td style="text-align:center">${ultimaResistencia ? ultimaResistencia.resistencia + ' MPa (' + ultimaResistencia.edad + 'd)' : '—'}</td>
      <td><span class="badge" style="background:${bgEstado[e._estado]};color:${colorEstado[e._estado]}">${e._estado}</span></td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-primario btn-xs" onclick="editarEnsayo('${e.id}')">✏️ Editar</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarEnsayo('${e.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function poblarSelectOrdenesEnsayo() {
  const sel = document.getElementById('m-ensayo-orden');
  if (!sel) return;
  let html = '<option value="">— Sin orden asociada —</option>';
  (ORDENES || []).forEach(o => { html += `<option value="${o.numero}">${o.numero} — ${o.cliente || ''}</option>`; });
  sel.innerHTML = html;
}

function renderResultadosEnsayo() {
  const tbody = document.getElementById('resultados-ensayo-body');
  if (!tbody) return;
  if (!_resultadosEnsayoActual.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:10px;color:var(--gris-medio);font-size:12px">Agrega resultados de ensayo por edad (7, 14, 28 días...)</td></tr>`;
    return;
  }
  tbody.innerHTML = _resultadosEnsayoActual.map((r, i) => `
    <tr>
      <td><input type="number" value="${r.edad}" min="1" onchange="_resultadosEnsayoActual[${i}].edad=parseInt(this.value)||0"></td>
      <td><input type="date" value="${r.fecha || ''}" onchange="_resultadosEnsayoActual[${i}].fecha=this.value"></td>
      <td><input type="number" value="${r.resistencia}" min="0" step="0.1" onchange="_resultadosEnsayoActual[${i}].resistencia=parseFloat(this.value)||0"></td>
      <td><button class="btn btn-rojo btn-xs" onclick="eliminarResultadoEnsayo(${i})">✕</button></td>
    </tr>`).join('');
}

function agregarResultadoEnsayo() {
  _resultadosEnsayoActual.push({ edad: 28, fecha: '', resistencia: 0 });
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

function abrirModalEnsayo() {
  document.getElementById('m-ensayo-id').value = '';
  document.getElementById('modal-ensayo-titulo').textContent = '📐 Nuevo Ensayo de Calidad';
  document.getElementById('m-ensayo-numero').value = siguienteNumeroEnsayo();
  document.getElementById('m-ensayo-fecha').value = new Date().toISOString().split('T')[0];
  poblarSelectDisenos('m-ensayo-diseno');
  poblarSelectOrdenesEnsayo();
  poblarSelectCilindros();
  document.getElementById('m-ensayo-cilindro').value = '';
  document.getElementById('m-ensayo-diseno').value = '';
  document.getElementById('m-ensayo-orden').value = '';
  document.getElementById('m-ensayo-elemento').value = '';
  document.getElementById('m-ensayo-probetas').value = '';
  document.getElementById('m-ensayo-objetivo').value = '';
  document.getElementById('m-ensayo-responsable').value = '';
  document.getElementById('m-ensayo-obs').value = '';
  _resultadosEnsayoActual = [];
  renderResultadosEnsayo();
  document.getElementById('modal-ensayo').classList.add('abierto');
}

function editarEnsayo(id) {
  const e = ENSAYOS_CALIDAD.find(x => String(x.id) === String(id));
  if (!e) return;
  document.getElementById('m-ensayo-id').value = e.id;
  document.getElementById('modal-ensayo-titulo').textContent = '✏️ Editar Ensayo de Calidad';
  document.getElementById('m-ensayo-numero').value = e.numero || '';
  document.getElementById('m-ensayo-fecha').value = e.fecha || '';
  poblarSelectDisenos('m-ensayo-diseno');
  poblarSelectOrdenesEnsayo();
  poblarSelectCilindros();
  document.getElementById('m-ensayo-cilindro').value = e.cilindroNo || '';
  document.getElementById('m-ensayo-diseno').value = e.disenoCodigo || '';
  if (e.ordenProduccion && !document.querySelector(`#m-ensayo-orden option[value="${e.ordenProduccion}"]`)) {
    const opt = document.createElement('option'); opt.value = e.ordenProduccion; opt.textContent = e.ordenProduccion; document.getElementById('m-ensayo-orden').appendChild(opt);
  }
  document.getElementById('m-ensayo-orden').value = e.ordenProduccion || '';
  document.getElementById('m-ensayo-elemento').value = e.elemento || '';
  document.getElementById('m-ensayo-probetas').value = e.numeroProbetas || '';
  document.getElementById('m-ensayo-objetivo').value = e.resistenciaObjetivo || '';
  document.getElementById('m-ensayo-responsable').value = e.responsable || '';
  document.getElementById('m-ensayo-obs').value = e.observaciones || '';
  _resultadosEnsayoActual = JSON.parse(JSON.stringify(e.resultados || []));
  renderResultadosEnsayo();
  document.getElementById('modal-ensayo').classList.add('abierto');
}

function guardarEnsayo() {
  const numero = document.getElementById('m-ensayo-numero').value.trim();
  const fecha = document.getElementById('m-ensayo-fecha').value;
  if (!numero || !fecha) { alert('Completa los campos obligatorios: N° Ensayo y Fecha.'); return; }
  const editId = document.getElementById('m-ensayo-id').value;
  const ensayo = {
    id: editId || String(Date.now()),
    numero, fecha,
    cilindroNo: document.getElementById('m-ensayo-cilindro').value,
    disenoCodigo: document.getElementById('m-ensayo-diseno').value,
    ordenProduccion: document.getElementById('m-ensayo-orden').value,
    elemento: document.getElementById('m-ensayo-elemento').value.trim(),
    numeroProbetas: parseInt(document.getElementById('m-ensayo-probetas').value) || 0,
    resistenciaObjetivo: parseFloat(document.getElementById('m-ensayo-objetivo').value) || 0,
    responsable: document.getElementById('m-ensayo-responsable').value.trim(),
    observaciones: document.getElementById('m-ensayo-obs').value.trim(),
    resultados: JSON.parse(JSON.stringify(_resultadosEnsayoActual)),
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
  sb.from('ensayos_calidad').delete().eq('id', e.id)
    .then(({ error }) => {
      if (error) { console.error('Error eliminando ensayo:', error.message); alert('Error al eliminar: ' + error.message); ENSAYOS_CALIDAD.push(e); renderEnsayosCalidad(); }
    });
}
