// ═══════════════════════════════
// CALIDAD — AJUSTE DIARIO DE MEZCLA (CORRECCIÓN DE HUMEDAD)
// ═══════════════════════════════
let AJUSTES_MEZCLA = [];

// Agrega un <option> a un <select> si el valor aún no existe entre sus opciones.
// Compara por igualdad de valores en JS (no arma selectores CSS) para no romperse
// con valores que contienen comillas, como 3/4", 1/2", etc.
function agregarOpcionSiNoExiste(selectId, valor) {
  if (!valor) return;
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const yaExiste = [...sel.options].some(o => o.value === valor);
  if (!yaExiste) {
    const opt = document.createElement('option');
    opt.value = valor; opt.textContent = valor;
    sel.appendChild(opt);
  }
}

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
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state"><div class="icono">🌡️</div><div>No hay ajustes diarios registrados.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(a => `
    <tr style="border-top:2px solid var(--azul-oscuro)">
      <td style="font-weight:700;color:var(--azul)">${a.cilindroNo}</td>
      <td>${a.fecha ? new Date(a.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${a.disenoCodigo ? `<span style="font-size:11px;background:var(--gris-borde);color:#333;padding:2px 6px;border-radius:3px;font-weight:600">${a.disenoCodigo}</span>` : '—'}</td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${a.clienteElemento || ''}">${a.clienteElemento || '—'}</td>
      <td>${USUARIOS_CRM[a.creadoPor]?.nombre || a.creadoPor || '—'}</td>
      <td style="text-align:center">${a.resistenciaDiseno || '—'} MPa</td>
      <td style="text-align:center">${a.humedadArena != null ? a.humedadArena.toFixed(1) + '%' : '—'}</td>
      <td style="text-align:center">${a.humedadTriturado != null ? a.humedadTriturado.toFixed(1) + '%' : '—'}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-secundario btn-xs" onclick="verFormatoProduccionAjuste('${a.id}')">🖨️ Formato</button>
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
  agregarOpcionSiNoExiste('m-ajuste-tamano', d.tamanoMaximo);
  document.getElementById('m-ajuste-tamano').value = d.tamanoMaximo || '';
  document.getElementById('m-ajuste-mat-agua').value = d.materiales?.agua || 0;
  document.getElementById('m-ajuste-mat-cemento').value = d.materiales?.cemento || 0;
  document.getElementById('m-ajuste-mat-adicion').value = d.materiales?.metacaolin || 0;
  document.getElementById('m-ajuste-mat-arena').value = d.materiales?.arena || 0;
  document.getElementById('m-ajuste-mat-triturado').value = d.materiales?.grava || 0;
  document.getElementById('m-ajuste-arena-absorcion').value = d.materiales?.absorcionArena || 0;
  document.getElementById('m-ajuste-triturado-absorcion').value = d.materiales?.absorcionTriturado || 0;
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
  document.getElementById('m-ajuste-cliente-elemento').value = a.clienteElemento || '';
  document.getElementById('m-ajuste-arena-recipiente').value = a.arena?.pesoRecipiente || 0;
  document.getElementById('m-ajuste-arena-humedo').value = a.arena?.pesoHumedo || 0;
  document.getElementById('m-ajuste-arena-seco').value = a.arena?.pesoSeco || 0;
  document.getElementById('m-ajuste-triturado-recipiente').value = a.triturado?.pesoRecipiente || 0;
  document.getElementById('m-ajuste-triturado-humedo').value = a.triturado?.pesoHumedo || 0;
  document.getElementById('m-ajuste-triturado-seco').value = a.triturado?.pesoSeco || 0;
  document.getElementById('m-ajuste-obs').value = a.observaciones || '';

  // Las cantidades "Cantidad diseño", la resistencia/tamaño y la absorción SIEMPRE
  // se traen en vivo del Diseño de Mezcla base (nunca de lo que haya quedado guardado
  // en el ajuste), para que jamás queden desactualizadas o editadas manualmente por error.
  if (a.disenoCodigo && DISENOS_MEZCLA.find(x => x.codigo === a.disenoCodigo)) {
    cargarBaseDesdeDiseno();
  } else {
    // El diseño ya no existe: se usa lo que había quedado guardado, como respaldo.
    agregarOpcionSiNoExiste('m-ajuste-tamano', a.tamanoMaximo);
    document.getElementById('m-ajuste-tamano').value = a.tamanoMaximo || '';
    document.getElementById('m-ajuste-resistencia').value = a.resistenciaDiseno || 0;
    document.getElementById('m-ajuste-mat-agua').value = a.materiales?.agua?.diseno || 0;
    document.getElementById('m-ajuste-mat-cemento').value = a.materiales?.cemento?.diseno || 0;
    document.getElementById('m-ajuste-mat-adicion').value = a.materiales?.adicion?.diseno || 0;
    document.getElementById('m-ajuste-mat-plastificante').value = a.materiales?.plastificante?.diseno || 0;
    document.getElementById('m-ajuste-mat-arena').value = a.materiales?.arena?.diseno || 0;
    document.getElementById('m-ajuste-mat-triturado').value = a.materiales?.triturado?.diseno || 0;
    document.getElementById('m-ajuste-mat-acelerante').value = a.materiales?.acelerante?.diseno || 0;
    document.getElementById('m-ajuste-arena-absorcion').value = a.arena?.absorcion || 0;
    document.getElementById('m-ajuste-triturado-absorcion').value = a.triturado?.absorcion || 0;
  }

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
  // Al relacionar el cilindro, se arrastran automáticamente los datos que ya se conocen
  // desde el Ajuste Diario de Mezcla, en vez de pedirlos de nuevo en el ensayo.
  if (a.fecha) document.getElementById('m-ensayo-fecha').value = a.fecha;
  document.getElementById('m-ensayo-diseno').value = a.disenoCodigo || '';
  actualizarObjetivoDesdeDiseno();
  if (a.resistenciaDiseno) document.getElementById('m-ensayo-objetivo').value = a.resistenciaDiseno;
  document.getElementById('m-ensayo-elemento').value = a.clienteElemento || '';
}

// ── Formato de Producción (PDF para el operario de mezclado) ──
// Reproduce el formato físico de planta: para cada volumen de concreto a producir,
// el "Peso a cargar" de Arena y Triturado incluye una compensación por buggy (material
// que queda pegado en cada buggy al vaciarlo), porque esos dos insumos se cargan a mano
// en buggies de capacidad fija; los demás insumos se dosifican directo, sin ese ajuste.
const BUGGY_CAPACIDAD_KG = 150;
const BUGGY_COMPENSACION_KG = 17;
const VOLUMENES_FORMATO_PRODUCCION = [0.05, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70];

function _filaFormatoProduccion(nombre, cantidadAjustada, volumen, esAgregado, unidad) {
  const pesoTeorico = cantidadAjustada * volumen;
  if (!esAgregado) {
    return { nombre, pesoACargar: pesoTeorico, cantBuggies: 'N/A', pesoTeorico, pesoBuggies: 'N/A', unidad };
  }
  const cantBuggies = Math.ceil(pesoTeorico / BUGGY_CAPACIDAD_KG - 1e-9) || 0;
  const pesoBuggies = cantBuggies * BUGGY_COMPENSACION_KG;
  return { nombre, pesoACargar: pesoTeorico + pesoBuggies, cantBuggies, pesoTeorico, pesoBuggies, unidad };
}

function _tablaVolumenFormatoProduccion(a, volumen) {
  const m = a.materiales || {};
  const filas = [
    _filaFormatoProduccion('Agua', m.agua?.ajustada || 0, volumen, false, 'kg'),
    _filaFormatoProduccion('Cemento', m.cemento?.ajustada || 0, volumen, false, 'kg'),
    _filaFormatoProduccion('Adición', m.adicion?.ajustada || 0, volumen, false, 'kg'),
    _filaFormatoProduccion('Plastificante', m.plastificante?.ajustada || 0, volumen, false, 'g'),
    _filaFormatoProduccion('Arena', m.arena?.ajustada || 0, volumen, true, 'kg'),
    _filaFormatoProduccion('Triturado', m.triturado?.ajustada || 0, volumen, true, 'kg'),
  ];
  // El +1e-9 evita que un valor como 365*0.7=255.49999999999997 (imprecisión de punto
  // flotante) redondee hacia abajo cuando matemáticamente cae justo en 255.5 → 256.
  const fmt = (v, unidad) => v === 'N/A' ? 'N/A' : Math.round(v + 1e-9) + ' ' + unidad;
  return `
    <table style="width:100%;border-collapse:collapse;font-size:9.5px">
      <thead>
        <tr style="background:#FFC107">
          <th colspan="2" style="padding:2px 5px;text-align:left;font-weight:700">VOLUMEN DE CONCRETO ${volumen.toFixed(2).replace('.', ',')} m3</th>
          <th colspan="3" style="padding:2px 5px;text-align:left;font-weight:700">Cantidades</th>
        </tr>
        <tr style="background:#f0f0f0">
          <th style="padding:2px 5px;text-align:left">Material</th>
          <th style="padding:2px 5px;text-align:center">Peso a cargar</th>
          <th style="padding:2px 5px;text-align:center">Cant de Buggies</th>
          <th style="padding:2px 5px;text-align:center">Peso Teórico</th>
          <th style="padding:2px 5px;text-align:center">Peso buggies</th>
        </tr>
      </thead>
      <tbody>
        ${filas.map(f => `
          <tr>
            <td style="padding:1.5px 5px;border-bottom:1px solid #eee;font-weight:600">${f.nombre}</td>
            <td style="padding:1.5px 5px;border-bottom:1px solid #eee;text-align:center;font-weight:700">${fmt(f.pesoACargar, f.unidad)}</td>
            <td style="padding:1.5px 5px;border-bottom:1px solid #eee;text-align:center">${f.cantBuggies === 'N/A' ? 'N/A' : f.cantBuggies + ' buggies'}</td>
            <td style="padding:1.5px 5px;border-bottom:1px solid #eee;text-align:center;color:#888">${fmt(f.pesoTeorico, f.unidad)}</td>
            <td style="padding:1.5px 5px;border-bottom:1px solid #eee;text-align:center;color:#888">${fmt(f.pesoBuggies, f.unidad)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function verFormatoProduccionAjuste(id) {
  const a = AJUSTES_MEZCLA.find(x => String(x.id) === String(id));
  if (!a) return;
  const diseno = DISENOS_MEZCLA.find(d => d.codigo === a.disenoCodigo);
  const pares = [];
  for (let i = 0; i < VOLUMENES_FORMATO_PRODUCCION.length / 2; i++) {
    pares.push([VOLUMENES_FORMATO_PRODUCCION[i], VOLUMENES_FORMATO_PRODUCCION[i + VOLUMENES_FORMATO_PRODUCCION.length / 2]]);
  }
  const html = `
    <div class="no-print" style="background:#1C2333;color:white;padding:12px 24px;display:flex;align-items:center;gap:16px">
      <span style="font-weight:700">Formato de Producción — Cilindro N° ${a.cilindroNo || ''}</span>
      <div style="flex:1"></div>
      <button onclick="descargarFormatoProduccionAjuste('${a.id}')" style="background:#1976D2;color:white;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-weight:700">⬇️ Descargar PDF</button>
      <button onclick="document.getElementById('vista-previa').style.display='none';document.getElementById('pantalla-ajuste-mezcla').classList.add('activa')" style="background:#555;color:white;border:none;padding:8px 14px;border-radius:5px;cursor:pointer">← Volver</button>
    </div>
    <div class="preview-doc" id="formato-produccion-doc">
      <div class="preview-membrete-header">
        <img src="membrete-top.jpg" alt="">
      </div>
      <div class="preview-content" id="formato-produccion-content" style="padding-top:6px">
        <div style="text-align:center;font-size:12px;font-weight:700;color:#003F7F;letter-spacing:0.03em;margin-bottom:8px">FORMATO DE PRODUCCIÓN — MEZCLA AJUSTADA POR HUMEDAD</div>
        <div style="padding-bottom:6px;border-bottom:1px solid #eee;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div style="font-size:14px;font-weight:700;color:#003F7F">CILINDRO No. ${a.cilindroNo || '—'}</div>
            <div style="font-size:11px;color:#555">${a.fecha ? new Date(a.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</div>
          </div>
          <div style="font-size:12px;font-weight:600;margin-top:2px">${a.clienteElemento || '—'}</div>
          <div style="font-size:10.5px;margin-top:6px"><b>DISEÑO DE MEZCLA:</b> ${diseno ? `${diseno.codigo} — ${diseno.nombre}` : (a.disenoCodigo || '—')}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-top:4px;font-size:10.5px">
            <div><b>RESISTENCIA DE DISEÑO:</b> ${a.resistenciaDiseno || '—'} MPa</div>
            <div><b>HUMEDAD AGREGADO FINO:</b> ${a.humedadArena != null ? a.humedadArena.toFixed(1) + '%' : '—'}</div>
            <div><b>TAMAÑO MÁXIMO DE AGREGADO:</b> ${a.tamanoMaximo || '—'}</div>
            <div><b>TRITURADO AGREGADO GRUESO:</b> ${a.humedadTriturado != null ? a.humedadTriturado.toFixed(1) + '%' : '—'}</div>
          </div>
        </div>
        ${pares.map(([izq, der]) => `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">
            <div style="border:1px solid #ddd;border-radius:4px;overflow:hidden">${_tablaVolumenFormatoProduccion(a, izq)}</div>
            <div style="border:1px solid #ddd;border-radius:4px;overflow:hidden">${_tablaVolumenFormatoProduccion(a, der)}</div>
          </div>`).join('')}
        <div style="margin-top:6px;font-size:10.5px;color:#555">
          <b>Elaborado por:</b> ${USUARIOS_CRM[a.creadoPor]?.nombre || a.creadoPor || '—'}
        </div>
      </div>
      <div class="preview-membrete-footer" id="formato-produccion-footer">
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

// Genera el PDF con el mismo membrete (cabecera repetida + pie con arco/datos de contacto)
// que se usa en las cotizaciones, para unificar la presentación de todos los documentos.
async function descargarFormatoProduccionAjuste(id) {
  const a = AJUSTES_MEZCLA.find(x => String(x.id) === String(id));
  if (!a) return;
  const btn = document.querySelector('button[onclick*="descargarFormatoProduccionAjuste"]');
  if (btn) { btn.textContent = '⏳ Generando...'; btn.disabled = true; }
  try {
    const { jsPDF } = window.jspdf;
    const pageW = 210, pageH = 297;

    const topImg = await cargarImagen('membrete-top.jpg');
    const headerH = pageW * (topImg.naturalHeight / topImg.naturalWidth);

    const contentEl = document.getElementById('formato-produccion-content');
    const contentCanvas = await html2canvas(contentEl, { scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false });
    const pxToMm = pageW / contentCanvas.width;
    const contentH_px = _alturaContenidoReal(contentCanvas);

    const footerEl = document.getElementById('formato-produccion-footer');
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
    pdf.save(`Formato_Produccion_Cilindro_${a.cilindroNo || a.id}.pdf`);
  } finally {
    if (btn) { btn.textContent = '⬇️ Descargar PDF'; btn.disabled = false; }
  }
}
