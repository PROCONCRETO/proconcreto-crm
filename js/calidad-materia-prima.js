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
