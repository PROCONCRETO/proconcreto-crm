// ═══════════════════════════════
// CALIDAD — AJUSTE DIARIO DE MEZCLA (CORRECCIÓN DE HUMEDAD)
// ═══════════════════════════════
let AJUSTES_MEZCLA = [];

function siguienteCilindroNo() {
  const nums = AJUSTES_MEZCLA.map(a => parseInt(a.cilindroNo) || 0);
  return nums.length ? Math.max(...nums) + 1 : '';
}

function calcularHumedadAgregado(pesoRecipiente, pesoHumedo, pesoSeco) {
  const denom = pesoSeco - pesoRecipiente;
  if (!denom) return 0;
  return ((pesoHumedo - pesoSeco) / denom) * 100;
}

function renderAjustesMezcla() {
  const tbody = document.getElementById('ajustes-body');
  if (!tbody) return;
  const q = (document.getElementById('buscar-ajuste')?.value || '').toLowerCase();
  let data = [...AJUSTES_MEZCLA];
  if (q) data = data.filter(a => (String(a.cilindroNo) + ' ' + (a.clienteElemento || '') + ' ' + (a.disenoCodigo || '')).toLowerCase().includes(q));
  data.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (Number(b.cilindroNo) || 0) - (Number(a.cilindroNo) || 0));

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><div class="icono">🌡️</div><div>No hay ajustes diarios registrados.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(a => `
    <tr style="border-top:2px solid var(--azul-oscuro)">
      <td style="font-weight:700;color:var(--azul)">${a.cilindroNo}</td>
      <td>${a.fecha ? new Date(a.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${a.disenoCodigo ? `<span style="font-size:11px;background:var(--gris-borde);color:#333;padding:2px 6px;border-radius:3px;font-weight:600">${a.disenoCodigo}</span>` : '—'}</td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${a.clienteElemento || ''}">${a.clienteElemento || '—'}</td>
      <td style="text-align:center">${a.resistenciaDiseno || '—'} MPa</td>
      <td style="text-align:center">${a.humedadArena != null ? a.humedadArena.toFixed(1) + '%' : '—'}</td>
      <td style="text-align:center">${a.humedadTriturado != null ? a.humedadTriturado.toFixed(1) + '%' : '—'}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-primario btn-xs" onclick="editarAjusteMezcla('${a.id}')">✏️ Editar</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarAjusteMezcla('${a.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function cargarBaseDesdeDiseno() {
  const codigo = document.getElementById('m-ajuste-diseno').value;
  const d = DISENOS_MEZCLA.find(x => x.codigo === codigo);
  if (!d) return;
  document.getElementById('m-ajuste-resistencia').value = d.resistenciaDiseno || '';
  if (d.tamanoMaximo && !document.querySelector(`#m-ajuste-tamano option[value="${d.tamanoMaximo}"]`)) {
    const opt = document.createElement('option'); opt.value = d.tamanoMaximo; opt.textContent = d.tamanoMaximo; document.getElementById('m-ajuste-tamano').appendChild(opt);
  }
  document.getElementById('m-ajuste-tamano').value = d.tamanoMaximo || '';
  document.getElementById('m-ajuste-mat-agua').value = d.materiales?.agua || 0;
  document.getElementById('m-ajuste-mat-cemento').value = d.materiales?.cemento || 0;
  document.getElementById('m-ajuste-mat-adicion').value = d.materiales?.metacaolin || 0;
  document.getElementById('m-ajuste-mat-arena').value = d.materiales?.arena || 0;
  document.getElementById('m-ajuste-mat-triturado').value = d.materiales?.grava || 0;
  const aditivos = d.materiales?.aditivos || [];
  const sumaPorTipo = (tipo) => aditivos.filter(a => a.tipo === tipo).reduce((s, a) => s + (Number(a.dosis) || 0), 0);
  document.getElementById('m-ajuste-mat-plastificante').value = sumaPorTipo('Superplastificante');
  document.getElementById('m-ajuste-mat-acelerante').value = sumaPorTipo('Acelerante');
  recalcularAjusteMezcla();
}

function recalcularAjusteMezcla() {
  const g = id => parseFloat(document.getElementById(id).value) || 0;

  const humArena = calcularHumedadAgregado(g('m-ajuste-arena-recipiente'), g('m-ajuste-arena-humedo'), g('m-ajuste-arena-seco'));
  const humTriturado = calcularHumedadAgregado(g('m-ajuste-triturado-recipiente'), g('m-ajuste-triturado-humedo'), g('m-ajuste-triturado-seco'));
  document.getElementById('m-ajuste-arena-humedad-display').textContent = humArena.toFixed(1) + '%';
  document.getElementById('m-ajuste-triturado-humedad-display').textContent = humTriturado.toFixed(1) + '%';

  const absArena = g('m-ajuste-arena-absorcion');
  const absTriturado = g('m-ajuste-triturado-absorcion');
  const disenoAgua = g('m-ajuste-mat-agua');
  const disenoArena = g('m-ajuste-mat-arena');
  const disenoTriturado = g('m-ajuste-mat-triturado');

  const aporteArena = disenoArena * (humArena - absArena) / 100;
  const aporteTriturado = disenoTriturado * (humTriturado - absTriturado) / 100;

  const aguaAjustada = disenoAgua - aporteArena - aporteTriturado;
  const arenaAjustada = disenoArena * (1 + humArena / 100);
  const trituradoAjustada = disenoTriturado * (1 + humTriturado / 100);

  document.getElementById('m-ajuste-ajustada-agua').textContent = aguaAjustada.toFixed(1) + ' L';
  document.getElementById('m-ajuste-ajustada-arena').textContent = arenaAjustada.toFixed(1) + ' kg';
  document.getElementById('m-ajuste-ajustada-triturado').textContent = trituradoAjustada.toFixed(1) + ' kg';
  document.getElementById('m-ajuste-ajustada-cemento').textContent = g('m-ajuste-mat-cemento').toFixed(1) + ' kg';
  document.getElementById('m-ajuste-ajustada-adicion').textContent = g('m-ajuste-mat-adicion').toFixed(1) + ' kg';
  document.getElementById('m-ajuste-ajustada-plastificante').textContent = g('m-ajuste-mat-plastificante').toFixed(1) + ' g';
  document.getElementById('m-ajuste-ajustada-acelerante').textContent = g('m-ajuste-mat-acelerante').toFixed(1) + ' g';
}

function abrirModalAjusteMezcla() {
  document.getElementById('m-ajuste-id').value = '';
  document.getElementById('modal-ajuste-titulo').textContent = '🌡️ Nuevo Ajuste Diario de Mezcla';
  document.getElementById('m-ajuste-cilindro').value = siguienteCilindroNo();
  document.getElementById('m-ajuste-fecha').value = new Date().toISOString().split('T')[0];
  poblarSelectDisenos('m-ajuste-diseno');
  document.getElementById('m-ajuste-diseno').value = '';
  ['m-ajuste-resistencia', 'm-ajuste-cliente-elemento', 'm-ajuste-tamano',
    'm-ajuste-arena-recipiente', 'm-ajuste-arena-humedo', 'm-ajuste-arena-seco', 'm-ajuste-arena-absorcion',
    'm-ajuste-triturado-recipiente', 'm-ajuste-triturado-humedo', 'm-ajuste-triturado-seco', 'm-ajuste-triturado-absorcion',
    'm-ajuste-mat-agua', 'm-ajuste-mat-cemento', 'm-ajuste-mat-adicion', 'm-ajuste-mat-plastificante',
    'm-ajuste-mat-arena', 'm-ajuste-mat-triturado', 'm-ajuste-mat-acelerante', 'm-ajuste-obs'
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = id.includes('obs') || id.includes('cliente') || id.includes('tamano') ? '' : 0; });
  recalcularAjusteMezcla();
  document.getElementById('modal-ajuste-mezcla').classList.add('abierto');
}

function editarAjusteMezcla(id) {
  const a = AJUSTES_MEZCLA.find(x => String(x.id) === String(id));
  if (!a) return;
  document.getElementById('m-ajuste-id').value = a.id;
  document.getElementById('modal-ajuste-titulo').textContent = '✏️ Editar Ajuste Diario de Mezcla';
  document.getElementById('m-ajuste-cilindro').value = a.cilindroNo || '';
  document.getElementById('m-ajuste-fecha').value = a.fecha || '';
  poblarSelectDisenos('m-ajuste-diseno');
  document.getElementById('m-ajuste-diseno').value = a.disenoCodigo || '';
  document.getElementById('m-ajuste-resistencia').value = a.resistenciaDiseno || 0;
  document.getElementById('m-ajuste-cliente-elemento').value = a.clienteElemento || '';
  if (a.tamanoMaximo && !document.querySelector(`#m-ajuste-tamano option[value="${a.tamanoMaximo}"]`)) {
    const opt = document.createElement('option'); opt.value = a.tamanoMaximo; opt.textContent = a.tamanoMaximo; document.getElementById('m-ajuste-tamano').appendChild(opt);
  }
  document.getElementById('m-ajuste-tamano').value = a.tamanoMaximo || '';
  document.getElementById('m-ajuste-arena-recipiente').value = a.arena?.pesoRecipiente || 0;
  document.getElementById('m-ajuste-arena-humedo').value = a.arena?.pesoHumedo || 0;
  document.getElementById('m-ajuste-arena-seco').value = a.arena?.pesoSeco || 0;
  document.getElementById('m-ajuste-arena-absorcion').value = a.arena?.absorcion || 0;
  document.getElementById('m-ajuste-triturado-recipiente').value = a.triturado?.pesoRecipiente || 0;
  document.getElementById('m-ajuste-triturado-humedo').value = a.triturado?.pesoHumedo || 0;
  document.getElementById('m-ajuste-triturado-seco').value = a.triturado?.pesoSeco || 0;
  document.getElementById('m-ajuste-triturado-absorcion').value = a.triturado?.absorcion || 0;
  document.getElementById('m-ajuste-mat-agua').value = a.materiales?.agua?.diseno || 0;
  document.getElementById('m-ajuste-mat-cemento').value = a.materiales?.cemento?.diseno || 0;
  document.getElementById('m-ajuste-mat-adicion').value = a.materiales?.adicion?.diseno || 0;
  document.getElementById('m-ajuste-mat-plastificante').value = a.materiales?.plastificante?.diseno || 0;
  document.getElementById('m-ajuste-mat-arena').value = a.materiales?.arena?.diseno || 0;
  document.getElementById('m-ajuste-mat-triturado').value = a.materiales?.triturado?.diseno || 0;
  document.getElementById('m-ajuste-mat-acelerante').value = a.materiales?.acelerante?.diseno || 0;
  document.getElementById('m-ajuste-obs').value = a.observaciones || '';
  recalcularAjusteMezcla();
  document.getElementById('modal-ajuste-mezcla').classList.add('abierto');
}

function guardarAjusteMezcla() {
  const cilindroNo = document.getElementById('m-ajuste-cilindro').value.trim();
  const fecha = document.getElementById('m-ajuste-fecha').value;
  if (!cilindroNo || !fecha) { alert('Completa los campos obligatorios: Cilindro N° y Fecha.'); return; }
  if (AJUSTES_MEZCLA.some(a => String(a.cilindroNo) === String(cilindroNo) && String(a.id) !== document.getElementById('m-ajuste-id').value)) {
    if (!confirm(`Ya existe un ajuste con el Cilindro N° ${cilindroNo}. ¿Deseas continuar de todas formas?`)) return;
  }
  const g = id => parseFloat(document.getElementById(id).value) || 0;

  const humArena = calcularHumedadAgregado(g('m-ajuste-arena-recipiente'), g('m-ajuste-arena-humedo'), g('m-ajuste-arena-seco'));
  const humTriturado = calcularHumedadAgregado(g('m-ajuste-triturado-recipiente'), g('m-ajuste-triturado-humedo'), g('m-ajuste-triturado-seco'));
  const absArena = g('m-ajuste-arena-absorcion');
  const absTriturado = g('m-ajuste-triturado-absorcion');
  const disenoAgua = g('m-ajuste-mat-agua');
  const disenoArena = g('m-ajuste-mat-arena');
  const disenoTriturado = g('m-ajuste-mat-triturado');
  const aporteArena = disenoArena * (humArena - absArena) / 100;
  const aporteTriturado = disenoTriturado * (humTriturado - absTriturado) / 100;
  const aguaAjustada = disenoAgua - aporteArena - aporteTriturado;
  const arenaAjustada = disenoArena * (1 + humArena / 100);
  const trituradoAjustada = disenoTriturado * (1 + humTriturado / 100);

  const editId = document.getElementById('m-ajuste-id').value;
  const ajuste = {
    id: editId || String(Date.now()),
    cilindroNo, fecha,
    disenoCodigo: document.getElementById('m-ajuste-diseno').value,
    resistenciaDiseno: g('m-ajuste-resistencia'),
    clienteElemento: document.getElementById('m-ajuste-cliente-elemento').value.trim(),
    tamanoMaximo: document.getElementById('m-ajuste-tamano').value.trim(),
    arena: { pesoRecipiente: g('m-ajuste-arena-recipiente'), pesoHumedo: g('m-ajuste-arena-humedo'), pesoSeco: g('m-ajuste-arena-seco'), absorcion: absArena },
    triturado: { pesoRecipiente: g('m-ajuste-triturado-recipiente'), pesoHumedo: g('m-ajuste-triturado-humedo'), pesoSeco: g('m-ajuste-triturado-seco'), absorcion: absTriturado },
    humedadArena: humArena,
    humedadTriturado: humTriturado,
    materiales: {
      agua: { diseno: disenoAgua, ajustada: aguaAjustada, unidad: 'L' },
      cemento: { diseno: g('m-ajuste-mat-cemento'), ajustada: g('m-ajuste-mat-cemento'), unidad: 'kg' },
      adicion: { diseno: g('m-ajuste-mat-adicion'), ajustada: g('m-ajuste-mat-adicion'), unidad: 'kg' },
      plastificante: { diseno: g('m-ajuste-mat-plastificante'), ajustada: g('m-ajuste-mat-plastificante'), unidad: 'g' },
      arena: { diseno: disenoArena, ajustada: arenaAjustada, unidad: 'kg' },
      triturado: { diseno: disenoTriturado, ajustada: trituradoAjustada, unidad: 'kg' },
      acelerante: { diseno: g('m-ajuste-mat-acelerante'), ajustada: g('m-ajuste-mat-acelerante'), unidad: 'g' },
    },
    observaciones: document.getElementById('m-ajuste-obs').value.trim(),
    creadoPor: USUARIO_ACTUAL?.email,
    creadoEn: editId ? (AJUSTES_MEZCLA.find(x => String(x.id) === String(editId))?.creadoEn || new Date().toISOString()) : new Date().toISOString(),
  };
  const idx = AJUSTES_MEZCLA.findIndex(x => String(x.id) === String(ajuste.id));
  if (idx >= 0) AJUSTES_MEZCLA[idx] = ajuste; else AJUSTES_MEZCLA.unshift(ajuste);
  sb.from('ajustes_mezcla').upsert({ id: ajuste.id, datos: ajuste, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) console.error('Error guardando ajuste de mezcla:', error.message); });
  cerrarModal('modal-ajuste-mezcla');
  renderAjustesMezcla();
}

function eliminarAjusteMezcla(id) {
  const a = AJUSTES_MEZCLA.find(x => String(x.id) === String(id));
  if (!a || !confirm(`¿Eliminar el ajuste del Cilindro N° ${a.cilindroNo}?`)) return;
  AJUSTES_MEZCLA = AJUSTES_MEZCLA.filter(x => String(x.id) !== String(id));
  renderAjustesMezcla();
  sb.from('ajustes_mezcla').delete().eq('id', a.id)
    .then(({ error }) => {
      if (error) { console.error('Error eliminando ajuste:', error.message); alert('Error al eliminar: ' + error.message); AJUSTES_MEZCLA.push(a); renderAjustesMezcla(); }
    });
}

// ── Integración con Control de Ensayos ──
function poblarSelectCilindros() {
  const sel = document.getElementById('m-ensayo-cilindro');
  if (!sel) return;
  const ordenados = [...AJUSTES_MEZCLA].sort((a, b) => (Number(b.cilindroNo) || 0) - (Number(a.cilindroNo) || 0));
  sel.innerHTML = '<option value="">— Sin ajuste diario asociado —</option>' + ordenados.map(a => `<option value="${a.cilindroNo}">Cilindro ${a.cilindroNo} — ${a.fecha ? new Date(a.fecha + 'T12:00').toLocaleDateString('es-CO') : ''} (${a.clienteElemento || ''})</option>`).join('');
}

function cargarDesdeAjusteMezcla() {
  const cilindroNo = document.getElementById('m-ensayo-cilindro').value;
  if (!cilindroNo) return;
  const a = AJUSTES_MEZCLA.find(x => String(x.cilindroNo) === String(cilindroNo));
  if (!a) return;
  document.getElementById('m-ensayo-diseno').value = a.disenoCodigo || '';
  actualizarObjetivoDesdeDiseno();
  if (a.resistenciaDiseno) document.getElementById('m-ensayo-objetivo').value = a.resistenciaDiseno;
  if (!document.getElementById('m-ensayo-elemento').value) document.getElementById('m-ensayo-elemento').value = a.clienteElemento || '';
}
