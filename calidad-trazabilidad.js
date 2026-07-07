// ═══════════════════════════════
// CALIDAD — MATERIA PRIMA
// ═══════════════════════════════
let MATERIA_PRIMA = [];

function renderMateriaPrima() {
  const tbody = document.getElementById('materia-prima-body');
  if (!tbody) return;
  const q = (document.getElementById('buscar-materia-prima')?.value || '').toLowerCase();
  const fTipo = document.getElementById('filtro-tipo-mp')?.value || '';
  let data = [...MATERIA_PRIMA];
  if (fTipo) data = data.filter(m => m.tipo === fTipo);
  if (q) data = data.filter(m => ((m.proveedor || '') + ' ' + (m.lote || '')).toLowerCase().includes(q));
  data.sort((a, b) => (b.fechaRecepcion || '').localeCompare(a.fechaRecepcion || ''));
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><div class="icono">🧱</div><div>No hay materia prima registrada.</div></td></tr>`;
    return;
  }
  const colorEstado = { 'Aprobado': '#2E7D32', 'Rechazado': '#C62828', 'Pendiente': '#E65100' };
  const bgEstado = { 'Aprobado': '#E8F5E9', 'Rechazado': '#FFEBEE', 'Pendiente': '#FFF3E0' };
  tbody.innerHTML = data.map(m => `
    <tr style="border-top:2px solid var(--azul-oscuro)">
      <td style="font-weight:600;color:var(--azul)">${m.tipo}</td>
      <td>${m.proveedor || '—'}</td>
      <td style="font-family:monospace;font-size:12px">${m.lote || '—'}</td>
      <td>${m.fechaRecepcion ? new Date(m.fechaRecepcion + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${m.fechaVencimiento ? new Date(m.fechaVencimiento + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td style="text-align:right">${(m.cantidad || 0).toLocaleString()} ${m.unidad || ''}</td>
      <td><span class="badge" style="background:${bgEstado[m.estado] || '#eee'};color:${colorEstado[m.estado] || '#333'}">${m.estado || 'Pendiente'}</span></td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-primario btn-xs" onclick="editarMateriaPrima('${m.id}')">✏️ Editar</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarMateriaPrima('${m.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function abrirModalMateriaPrima() {
  document.getElementById('m-mp-id').value = '';
  document.getElementById('modal-materia-prima-titulo').textContent = '🧱 Nuevo Registro de Materia Prima';
  document.getElementById('m-mp-tipo').value = 'Cemento';
  ['m-mp-proveedor', 'm-mp-lote', 'm-mp-cantidad', 'm-mp-obs'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('m-mp-fecha-recepcion').value = new Date().toISOString().split('T')[0];
  document.getElementById('m-mp-fecha-vencimiento').value = '';
  document.getElementById('m-mp-unidad').value = 'kg';
  document.getElementById('m-mp-estado').value = 'Pendiente';
  document.getElementById('modal-materia-prima').classList.add('abierto');
}

function editarMateriaPrima(id) {
  const m = MATERIA_PRIMA.find(x => String(x.id) === String(id));
  if (!m) return;
  document.getElementById('m-mp-id').value = m.id;
  document.getElementById('modal-materia-prima-titulo').textContent = '✏️ Editar Materia Prima';
  document.getElementById('m-mp-tipo').value = m.tipo || 'Cemento';
  document.getElementById('m-mp-proveedor').value = m.proveedor || '';
  document.getElementById('m-mp-lote').value = m.lote || '';
  document.getElementById('m-mp-fecha-recepcion').value = m.fechaRecepcion || '';
  document.getElementById('m-mp-fecha-vencimiento').value = m.fechaVencimiento || '';
  document.getElementById('m-mp-cantidad').value = m.cantidad || '';
  document.getElementById('m-mp-unidad').value = m.unidad || 'kg';
  document.getElementById('m-mp-estado').value = m.estado || 'Pendiente';
  document.getElementById('m-mp-obs').value = m.observaciones || '';
  document.getElementById('modal-materia-prima').classList.add('abierto');
}

function guardarMateriaPrima() {
  const proveedor = document.getElementById('m-mp-proveedor').value.trim();
  const lote = document.getElementById('m-mp-lote').value.trim();
  if (!proveedor || !lote) { alert('Completa los campos obligatorios: Proveedor y Lote.'); return; }
  const editId = document.getElementById('m-mp-id').value;
  const mp = {
    id: editId || String(Date.now()),
    tipo: document.getElementById('m-mp-tipo').value,
    proveedor, lote,
    fechaRecepcion: document.getElementById('m-mp-fecha-recepcion').value,
    fechaVencimiento: document.getElementById('m-mp-fecha-vencimiento').value,
    cantidad: parseFloat(document.getElementById('m-mp-cantidad').value) || 0,
    unidad: document.getElementById('m-mp-unidad').value,
    estado: document.getElementById('m-mp-estado').value,
    observaciones: document.getElementById('m-mp-obs').value.trim(),
    creadoPor: USUARIO_ACTUAL?.email,
    creadoEn: editId ? (MATERIA_PRIMA.find(x => String(x.id) === String(editId))?.creadoEn || new Date().toISOString()) : new Date().toISOString(),
  };
  const idx = MATERIA_PRIMA.findIndex(x => String(x.id) === String(mp.id));
  if (idx >= 0) MATERIA_PRIMA[idx] = mp; else MATERIA_PRIMA.unshift(mp);
  sb.from('materia_prima').upsert({ id: mp.id, datos: mp, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) console.error('Error guardando materia prima:', error.message); });
  cerrarModal('modal-materia-prima');
  renderMateriaPrima();
}

function eliminarMateriaPrima(id) {
  const m = MATERIA_PRIMA.find(x => String(x.id) === String(id));
  if (!m || !confirm(`¿Eliminar el registro de ${m.tipo} — lote ${m.lote}?`)) return;
  MATERIA_PRIMA = MATERIA_PRIMA.filter(x => String(x.id) !== String(id));
  renderMateriaPrima();
  sb.from('materia_prima').delete().eq('id', m.id)
    .then(({ error }) => {
      if (error) { console.error('Error eliminando materia prima:', error.message); alert('Error al eliminar: ' + error.message); MATERIA_PRIMA.push(m); renderMateriaPrima(); }
    });
}

// ═══════════════════════════════
// CALIDAD — NO CONFORMIDADES
// ═══════════════════════════════
let NO_CONFORMIDADES = [];

function siguienteNumeroNC() {
  const nums = NO_CONFORMIDADES.map(n => parseInt((n.numero || '').replace(/\D/g, '')) || 0);
  const max = nums.length ? Math.max(...nums) : 0;
  return 'NC-' + String(max + 1).padStart(4, '0');
}

function renderNoConformidades() {
  const tbody = document.getElementById('no-conformidades-body');
  const resumen = document.getElementById('nc-resumen');
  if (!tbody) return;
  const q = (document.getElementById('buscar-nc')?.value || '').toLowerCase();
  const fEstado = document.getElementById('filtro-estado-nc')?.value || '';
  let data = [...NO_CONFORMIDADES];
  if (fEstado) data = data.filter(n => n.estado === fEstado);
  if (q) data = data.filter(n => (n.numero + ' ' + (n.descripcion || '') + ' ' + (n.referencia || '')).toLowerCase().includes(q));
  data.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  if (resumen) {
    const abiertas = NO_CONFORMIDADES.filter(n => n.estado === 'Abierta').length;
    const cerradas = NO_CONFORMIDADES.filter(n => n.estado === 'Cerrada').length;
    resumen.innerHTML = `
      <div style="background:white;border-radius:6px;padding:8px 14px;box-shadow:var(--sombra);border-top:3px solid #C62828;min-width:130px"><div style="font-size:10px;font-weight:700;color:#C62828;text-transform:uppercase">Abiertas</div><div style="font-size:18px;font-weight:800">${abiertas}</div></div>
      <div style="background:white;border-radius:6px;padding:8px 14px;box-shadow:var(--sombra);border-top:3px solid var(--verde);min-width:130px"><div style="font-size:10px;font-weight:700;color:var(--verde);text-transform:uppercase">Cerradas</div><div style="font-size:18px;font-weight:800">${cerradas}</div></div>`;
  }

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><div class="icono">⚠️</div><div>No hay no conformidades registradas.</div></td></tr>`;
    return;
  }
  const colorDisp = { 'Retenido': '#E65100', 'Liberado con concesión': '#1565C0', 'Rechazado': '#C62828', 'Reprocesado': '#6A1B9A' };
  tbody.innerHTML = data.map(n => `
    <tr style="border-top:2px solid var(--azul-oscuro)">
      <td style="font-weight:700;color:var(--azul)">${n.numero}</td>
      <td>${n.fecha ? new Date(n.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${n.tipo || '—'}</td>
      <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${n.descripcion || ''}">${n.descripcion || '—'}</td>
      <td style="font-size:11px;color:${colorDisp[n.disposicion] || '#333'};font-weight:600">${n.disposicion || '—'}</td>
      <td>${n.responsable || '—'}</td>
      <td><span class="badge" style="background:${n.estado === 'Abierta' ? '#FFEBEE' : '#E8F5E9'};color:${n.estado === 'Abierta' ? '#C62828' : '#2E7D32'}">${n.estado || 'Abierta'}</span></td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-primario btn-xs" onclick="editarNC('${n.id}')">✏️ Editar</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarNC('${n.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function abrirModalNC() {
  document.getElementById('m-nc-id').value = '';
  document.getElementById('modal-nc-titulo').textContent = '⚠️ Nueva No Conformidad';
  document.getElementById('m-nc-numero').value = siguienteNumeroNC();
  document.getElementById('m-nc-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('m-nc-tipo').value = 'Ensayo fallido';
  ['m-nc-referencia', 'm-nc-descripcion', 'm-nc-accion', 'm-nc-responsable'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('m-nc-disposicion').value = 'Retenido';
  document.getElementById('m-nc-estado').value = 'Abierta';
  document.getElementById('m-nc-fecha-cierre').value = '';
  document.getElementById('modal-nc').classList.add('abierto');
}

function editarNC(id) {
  const n = NO_CONFORMIDADES.find(x => String(x.id) === String(id));
  if (!n) return;
  document.getElementById('m-nc-id').value = n.id;
  document.getElementById('modal-nc-titulo').textContent = '✏️ Editar No Conformidad';
  document.getElementById('m-nc-numero').value = n.numero || '';
  document.getElementById('m-nc-fecha').value = n.fecha || '';
  document.getElementById('m-nc-tipo').value = n.tipo || 'Ensayo fallido';
  document.getElementById('m-nc-referencia').value = n.referencia || '';
  document.getElementById('m-nc-descripcion').value = n.descripcion || '';
  document.getElementById('m-nc-accion').value = n.accionCorrectiva || '';
  document.getElementById('m-nc-responsable').value = n.responsable || '';
  document.getElementById('m-nc-disposicion').value = n.disposicion || 'Retenido';
  document.getElementById('m-nc-estado').value = n.estado || 'Abierta';
  document.getElementById('m-nc-fecha-cierre').value = n.fechaCierre || '';
  document.getElementById('modal-nc').classList.add('abierto');
}

function guardarNC() {
  const numero = document.getElementById('m-nc-numero').value.trim();
  const descripcion = document.getElementById('m-nc-descripcion').value.trim();
  if (!numero || !descripcion) { alert('Completa los campos obligatorios: N° y Descripción.'); return; }
  const editId = document.getElementById('m-nc-id').value;
  const nc = {
    id: editId || String(Date.now()),
    numero,
    fecha: document.getElementById('m-nc-fecha').value,
    tipo: document.getElementById('m-nc-tipo').value,
    referencia: document.getElementById('m-nc-referencia').value.trim(),
    descripcion,
    accionCorrectiva: document.getElementById('m-nc-accion').value.trim(),
    responsable: document.getElementById('m-nc-responsable').value.trim(),
    disposicion: document.getElementById('m-nc-disposicion').value,
    estado: document.getElementById('m-nc-estado').value,
    fechaCierre: document.getElementById('m-nc-fecha-cierre').value,
    creadoPor: USUARIO_ACTUAL?.email,
    creadoEn: editId ? (NO_CONFORMIDADES.find(x => String(x.id) === String(editId))?.creadoEn || new Date().toISOString()) : new Date().toISOString(),
  };
  const idx = NO_CONFORMIDADES.findIndex(x => String(x.id) === String(nc.id));
  if (idx >= 0) NO_CONFORMIDADES[idx] = nc; else NO_CONFORMIDADES.unshift(nc);
  sb.from('no_conformidades').upsert({ id: nc.id, datos: nc, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) console.error('Error guardando no conformidad:', error.message); });
  cerrarModal('modal-nc');
  renderNoConformidades();
}

function eliminarNC(id) {
  const n = NO_CONFORMIDADES.find(x => String(x.id) === String(id));
  if (!n || !confirm(`¿Eliminar la no conformidad ${n.numero}?`)) return;
  NO_CONFORMIDADES = NO_CONFORMIDADES.filter(x => String(x.id) !== String(id));
  renderNoConformidades();
  sb.from('no_conformidades').delete().eq('id', n.id)
    .then(({ error }) => {
      if (error) { console.error('Error eliminando NC:', error.message); alert('Error al eliminar: ' + error.message); NO_CONFORMIDADES.push(n); renderNoConformidades(); }
    });
}

// ═══════════════════════════════
// CALIDAD — TRAZABILIDAD
// ═══════════════════════════════
function buscarTrazabilidad() {
  const q = (document.getElementById('buscar-trazabilidad')?.value || '').trim().toLowerCase();
  const cont = document.getElementById('trazabilidad-resultado');
  if (!cont) return;
  if (!q) { cont.innerHTML = `<div class="empty-state"><div class="icono">🔗</div><div>Busca por N° de Orden de Producción, N° de Ensayo o Código de Diseño.</div></div>`; return; }

  const ensayos = ENSAYOS_CALIDAD.filter(e =>
    (e.numero || '').toLowerCase().includes(q) ||
    (e.ordenProduccion || '').toLowerCase().includes(q) ||
    (e.disenoCodigo || '').toLowerCase().includes(q)
  );

  if (!ensayos.length) { cont.innerHTML = `<div class="empty-state"><div class="icono">🔍</div><div>Sin resultados para "${q}".</div></div>`; return; }

  cont.innerHTML = ensayos.map(e => {
    const diseno = DISENOS_MEZCLA.find(d => d.codigo === e.disenoCodigo);
    const orden = ORDENES.find(o => o.numero === e.ordenProduccion);
    const estado = calcularEstadoEnsayo(e);
    const colorEstado = { 'En curado': '#1565C0', 'Cumple': '#2E7D32', 'No cumple': '#C62828' }[estado];
    const bgEstado = { 'En curado': '#E3F2FD', 'Cumple': '#E8F5E9', 'No cumple': '#FFEBEE' }[estado];
    return `
    <div class="card" style="margin-bottom:14px;border-left:4px solid ${colorEstado}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-weight:700;color:var(--azul);font-size:15px">${e.numero}</div>
        <span class="badge" style="background:${bgEstado};color:${colorEstado}">${estado}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:10px">
        <div><div style="font-size:10px;color:#888">Fecha fundida</div><div style="font-size:13px;font-weight:600">${e.fecha ? new Date(e.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</div></div>
        <div><div style="font-size:10px;color:#888">Elemento</div><div style="font-size:13px;font-weight:600">${e.elemento || '—'}</div></div>
        <div><div style="font-size:10px;color:#888">Orden de producción</div><div style="font-size:13px;font-weight:600">${orden ? orden.numero + ' — ' + orden.cliente : (e.ordenProduccion || '—')}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:10px;padding-top:10px;border-top:1px dashed var(--gris-borde)">
        <div><div style="font-size:10px;color:#888">Diseño de mezcla</div><div style="font-size:13px;font-weight:600">${diseno ? diseno.codigo + ' — ' + diseno.nombre : (e.disenoCodigo || '—')}</div></div>
        <div><div style="font-size:10px;color:#888">Resistencia diseño</div><div style="font-size:13px;font-weight:600">${e.resistenciaObjetivo || '—'} MPa</div></div>
        <div><div style="font-size:10px;color:#888">N° probetas</div><div style="font-size:13px;font-weight:600">${e.numeroProbetas || '—'}</div></div>
      </div>
      <div style="padding-top:10px;border-top:1px dashed var(--gris-borde)">
        <div style="font-size:10px;color:#888;margin-bottom:6px">RESULTADOS DE RESISTENCIA</div>
        ${(e.resultados || []).length ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${e.resultados.map(r => `<span style="background:#F2F4F7;padding:4px 10px;border-radius:4px;font-size:12px"><strong>${r.edad}d:</strong> ${r.resistencia} MPa</span>`).join('')}</div>` : '<div style="font-size:12px;color:var(--gris-medio)">Sin resultados registrados aún.</div>'}
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════
// CALIDAD — CERTIFICADOS
// ═══════════════════════════════
function renderCertificadosCalidad() {
  const tbody = document.getElementById('certificados-body');
  if (!tbody) return;
  const q = (document.getElementById('buscar-certificado')?.value || '').toLowerCase();
  let data = ENSAYOS_CALIDAD.map(e => ({ ...e, _estado: calcularEstadoEnsayo(e) })).filter(e => e._estado !== 'En curado');
  if (q) data = data.filter(e => (e.numero + ' ' + (e.elemento || '')).toLowerCase().includes(q));
  data.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="icono">📜</div><div>No hay ensayos con resultados finales para certificar aún.</div></td></tr>`;
    return;
  }
  const colorEstado = { 'Cumple': '#2E7D32', 'No cumple': '#C62828' };
  const bgEstado = { 'Cumple': '#E8F5E9', 'No cumple': '#FFEBEE' };
  tbody.innerHTML = data.map(e => `
    <tr style="border-top:2px solid var(--azul-oscuro)">
      <td style="font-weight:700;color:var(--azul)">${e.numero}</td>
      <td>${e.fecha ? new Date(e.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${e.elemento || '—'}</td>
      <td style="text-align:center">${e.resistenciaObjetivo || '—'} MPa</td>
      <td><span class="badge" style="background:${bgEstado[e._estado]};color:${colorEstado[e._estado]}">${e._estado}</span></td>
      <td><button class="btn btn-secundario btn-xs" onclick="verCertificadoCalidad('${e.id}')">📄 Ver certificado</button></td>
    </tr>`).join('');
}

function verCertificadoCalidad(id) {
  const e = ENSAYOS_CALIDAD.find(x => String(x.id) === String(id));
  if (!e) return;
  const diseno = DISENOS_MEZCLA.find(d => d.codigo === e.disenoCodigo);
  const orden = ORDENES.find(o => o.numero === e.ordenProduccion);
  const estado = calcularEstadoEnsayo(e);
  const colorEstado = estado === 'Cumple' ? '#1B5E20' : '#B71C1C';
  const bgEstado = estado === 'Cumple' ? '#E8F5E9' : '#FFEBEE';

  const filasResultados = (e.resultados || []).map(r => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;font-size:12px">${r.edad} días</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;font-size:12px">${r.fecha ? new Date(r.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;font-size:12px;font-weight:600">${r.resistencia} MPa</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;font-size:12px">${Number(r.resistencia) >= Number(e.resistenciaObjetivo || 0) ? '✅ Cumple' : '❌ No cumple'}</td>
    </tr>`).join('');

  const html = `
  <div id="cert-preview-doc" style="font-family:Arial,sans-serif;max-width:780px;margin:0 auto;padding:0;color:#222">
    <div style="background:#001F3F;color:white;padding:18px 24px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:17px;font-weight:700">Proconcreto Prefabricados</div>
        <div style="font-size:11px;opacity:0.6;margin-top:2px">CERTIFICADO DE CALIDAD — RESISTENCIA DEL CONCRETO</div>
      </div>
      <div style="background:${estado === 'Cumple' ? '#1D9E75' : '#C62828'};padding:8px 16px;border-radius:6px;text-align:right">
        <div style="font-size:20px;font-weight:700">${e.numero}</div>
        <div style="font-size:10px;opacity:0.8">Fecha emisión: ${new Date().toLocaleDateString('es-CO')}</div>
      </div>
    </div>
    <div style="background:${bgEstado};border-left:4px solid ${colorEstado};padding:8px 16px;font-size:13px;color:${colorEstado};font-weight:700">
      RESULTADO: ${estado === 'Cumple' ? 'CUMPLE CON LA RESISTENCIA DE DISEÑO' : 'NO CUMPLE CON LA RESISTENCIA DE DISEÑO'}
    </div>
    <div style="padding:14px 16px;border-bottom:1px solid #eee">
      <div style="font-size:10px;font-weight:700;color:#888;letter-spacing:0.08em;margin-bottom:8px">INFORMACIÓN DEL ELEMENTO</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div><div style="font-size:10px;color:#888">Elemento / Descripción</div><div style="font-size:13px;font-weight:600;margin-top:2px">${e.elemento || '—'}</div></div>
        <div><div style="font-size:10px;color:#888">Fecha de fundida</div><div style="font-size:12px;margin-top:2px">${e.fecha ? new Date(e.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</div></div>
        <div><div style="font-size:10px;color:#888">Cliente / Orden</div><div style="font-size:12px;margin-top:2px">${orden ? orden.cliente + ' (' + orden.numero + ')' : (e.ordenProduccion || '—')}</div></div>
      </div>
    </div>
    <div style="padding:14px 16px;border-bottom:1px solid #eee">
      <div style="font-size:10px;font-weight:700;color:#888;letter-spacing:0.08em;margin-bottom:8px">DISEÑO DE MEZCLA UTILIZADO</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div><div style="font-size:10px;color:#888">Código</div><div style="font-size:13px;font-weight:600;margin-top:2px">${diseno?.codigo || e.disenoCodigo || '—'}</div></div>
        <div><div style="font-size:10px;color:#888">Nombre</div><div style="font-size:12px;margin-top:2px">${diseno?.nombre || '—'}</div></div>
        <div><div style="font-size:10px;color:#888">Resistencia de diseño (f'c)</div><div style="font-size:13px;font-weight:700;margin-top:2px">${e.resistenciaObjetivo || '—'} MPa</div></div>
      </div>
    </div>
    <div style="padding:14px 16px;border-bottom:1px solid #eee">
      <div style="font-size:10px;font-weight:700;color:#888;letter-spacing:0.08em;margin-bottom:8px">RESULTADOS DE RESISTENCIA A LA COMPRESIÓN</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f5f5f5">
          <th style="padding:6px 8px;text-align:center;font-size:11px;color:#555;font-weight:600">Edad</th>
          <th style="padding:6px 8px;text-align:center;font-size:11px;color:#555;font-weight:600">Fecha ensayo</th>
          <th style="padding:6px 8px;text-align:center;font-size:11px;color:#555;font-weight:600">Resistencia obtenida</th>
          <th style="padding:6px 8px;text-align:center;font-size:11px;color:#555;font-weight:600">Cumplimiento</th>
        </tr></thead>
        <tbody>${filasResultados || `<tr><td colspan="4" style="text-align:center;padding:10px;color:#888;font-size:12px">Sin resultados registrados</td></tr>`}</tbody>
      </table>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #eee">
      <div style="padding:16px;border-right:1px solid #eee">
        <div style="border-top:1px solid #333;margin-top:36px;padding-top:6px;text-align:center">
          <div style="font-size:11px;color:#888">Elaborado por</div>
          <div style="font-size:12px;font-weight:600;margin-top:2px">${e.responsable || '—'}</div>
          <div style="font-size:11px;color:#888">Control de Calidad</div>
        </div>
      </div>
      <div style="padding:16px">
        <div style="border-top:1px solid #333;margin-top:36px;padding-top:6px;text-align:center">
          <div style="font-size:11px;color:#888">Aprobado por</div>
          <div style="font-size:12px;font-weight:600;margin-top:2px">Ana María Mazuera</div>
          <div style="font-size:11px;color:#888">Coordinadora Técnica</div>
        </div>
      </div>
    </div>
    <div style="background:#f5f5f5;padding:8px 16px;text-align:center;font-size:10px;color:#999">
      Proconcreto Prefabricados · Autopista del Café Km2, Vía Chinchiná – Santa Rosa · www.proconcreto.com.co
    </div>
  </div>`;

  const vistaPrevia = document.getElementById('vista-previa');
  document.getElementById('contenido-preview').innerHTML = `
    <div class="no-print" style="background:#1C2333;color:white;padding:12px 24px;display:flex;align-items:center;gap:16px">
      <span style="font-weight:700">Certificado de Calidad — ${e.numero}</span>
      <div style="flex:1"></div>
      <button onclick="descargarCertificadoCalidad('${e.id}')" style="background:#1D9E75;color:white;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-weight:700" id="btn-pdf-cert">⬇️ Descargar PDF</button>
      <button onclick="document.getElementById('vista-previa').style.display='none';document.getElementById('pantalla-certificados-calidad').classList.add('activa')" style="background:#555;color:white;border:none;padding:8px 14px;border-radius:5px;cursor:pointer">← Volver</button>
    </div>
    <div class="preview-doc" id="cert-preview-container" style="padding:0">${html}</div>`;
  vistaPrevia.style.display = 'block';
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  window.scrollTo(0, 0);
}

async function descargarCertificadoCalidad(id) {
  const e = ENSAYOS_CALIDAD.find(x => String(x.id) === String(id));
  if (!e) return;
  const btn = document.getElementById('btn-pdf-cert');
  if (btn) { btn.textContent = '⏳ Generando...'; btn.disabled = true; }
  try {
    const { jsPDF } = window.jspdf;
    const el = document.getElementById('cert-preview-doc');
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
    pdf.save(`Certificado_${e.numero}.pdf`);
  } finally {
    if (btn) { btn.textContent = '⬇️ Descargar PDF'; btn.disabled = false; }
  }
}
