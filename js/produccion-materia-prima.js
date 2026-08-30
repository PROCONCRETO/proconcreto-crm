// ═══════════════════════════════
// PRODUCCIÓN — MATERIA PRIMA
// ═══════════════════════════════
// Vivía en Calidad (js/calidad-materia-prima.js) — movida a Producción (2026-08-19, a pedido
// del usuario), sin cambios de lógica más allá de los pedidos en el mismo cambio (Bodega,
// Proveedor de cemento como desplegable, Lote opcional — ver más abajo).
let MATERIA_PRIMA = [];

// Bodegas reales de cemento en planta — Silo 1 alimenta Pretensados, Silo 2 alimenta
// Vibrocompactados, y el cemento en bolsa es la tercera bodega (sin silo). Mismas 3 opciones
// para la entrada (aquí, Materia Prima) y la salida (Producción Diaria, ver
// js/produccion-diaria.js) — así el Inventario de Cemento por bodega puede sumar entradas y
// salidas del mismo lado (2026-08-19, a pedido del usuario).
const _BODEGAS_CEMENTO = {
  silo1: 'Silo 1 — Pretensados',
  silo2: 'Silo 2 — Vibrocompactados',
  bolsa: 'Cemento en bolsa',
};

// Proveedores reales de cemento que maneja la planta (2026-08-19, a pedido del usuario) — solo
// aplica cuando Tipo = Cemento; el resto de tipos (Arena, Grava, Aditivo...) siguen con
// Proveedor de texto libre, porque no hay una lista fija confirmada para ellos.
const _PROVEEDORES_CEMENTO = ['ALION', 'ARGOS'];

function renderMateriaPrima() {
  renderInventarioCemento();
  const tbody = document.getElementById('materia-prima-body');
  if (!tbody) return;
  const q = (document.getElementById('buscar-materia-prima')?.value || '').toLowerCase();
  const fTipo = document.getElementById('filtro-tipo-mp')?.value || '';
  const fDesde = document.getElementById('filtro-fecha-desde-mp')?.value || '';
  const fHasta = document.getElementById('filtro-fecha-hasta-mp')?.value || '';
  let data = [...MATERIA_PRIMA];
  if (fTipo) data = data.filter(m => m.tipo === fTipo);
  if (fDesde) data = data.filter(m => (m.fechaRecepcion || '') >= fDesde);
  if (fHasta) data = data.filter(m => (m.fechaRecepcion || '') <= fHasta);
  if (q) data = data.filter(m => ((m.proveedor || '') + ' ' + (m.lote || '')).toLowerCase().includes(q));
  data.sort((a, b) => (b.fechaRecepcion || '').localeCompare(a.fechaRecepcion || ''));
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state"><div class="icono">🧱</div><div>No hay materia prima registrada${fTipo||fDesde||fHasta||q ? ' para este filtro' : ''}.</div></td></tr>`;
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
      <td style="color:var(--gris-medio)">${m.bodegaCemento ? _esc(_BODEGAS_CEMENTO[m.bodegaCemento] || m.bodegaCemento) : '—'}</td>
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

// Campos que solo aplican a Tipo = Cemento: Bodega (Silo 1/Silo 2/Bolsa, alimenta el Inventario
// de Cemento por bodega más abajo), Proveedor como desplegable (ALION/ARGOS, en vez de texto
// libre) y Unidad fija a kg (deshabilitada, no oculta) — el inventario necesita sumar entradas
// en una sola unidad sin tener que adivinar cuántos kg trae un "bulto" o convertir toneladas a
// mano (2026-08-19, a pedido del usuario).
function _alCambiarTipoMateriaPrima() {
  const esCemento = document.getElementById('m-mp-tipo').value === 'Cemento';
  const bloqueBodega = document.getElementById('bloque-bodega-cemento-mp');
  if (bloqueBodega) bloqueBodega.style.display = esCemento ? '' : 'none';
  const selUnidad = document.getElementById('m-mp-unidad');
  if (selUnidad) {
    if (esCemento) selUnidad.value = 'kg';
    selUnidad.disabled = esCemento;
  }
  const selProveedorCemento = document.getElementById('m-mp-proveedor-cemento');
  const inputProveedor = document.getElementById('m-mp-proveedor');
  if (selProveedorCemento && inputProveedor) {
    selProveedorCemento.style.display = esCemento ? '' : 'none';
    inputProveedor.style.display = esCemento ? 'none' : '';
  }
}

function abrirModalMateriaPrima() {
  document.getElementById('m-mp-id').value = '';
  document.getElementById('modal-materia-prima-titulo').textContent = '🧱 Nuevo Registro de Materia Prima';
  document.getElementById('m-mp-tipo').value = 'Cemento';
  ['m-mp-proveedor', 'm-mp-lote', 'm-mp-cantidad', 'm-mp-obs'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('m-mp-proveedor-cemento').value = '';
  document.getElementById('m-mp-fecha-recepcion').value = new Date().toISOString().split('T')[0];
  document.getElementById('m-mp-fecha-vencimiento').value = '';
  document.getElementById('m-mp-unidad').value = 'kg';
  document.getElementById('m-mp-estado').value = 'Pendiente';
  document.getElementById('m-mp-bodega-cemento').value = '';
  _alCambiarTipoMateriaPrima();
  document.getElementById('modal-materia-prima').classList.add('abierto');
}

function editarMateriaPrima(id) {
  const m = MATERIA_PRIMA.find(x => String(x.id) === String(id));
  if (!m) return;
  document.getElementById('m-mp-id').value = m.id;
  document.getElementById('modal-materia-prima-titulo').textContent = '✏️ Editar Materia Prima';
  document.getElementById('m-mp-tipo').value = m.tipo || 'Cemento';
  document.getElementById('m-mp-proveedor').value = m.proveedor || '';
  document.getElementById('m-mp-proveedor-cemento').value = m.proveedor || '';
  document.getElementById('m-mp-lote').value = m.lote || '';
  document.getElementById('m-mp-fecha-recepcion').value = m.fechaRecepcion || '';
  document.getElementById('m-mp-fecha-vencimiento').value = m.fechaVencimiento || '';
  document.getElementById('m-mp-cantidad').value = m.cantidad || '';
  document.getElementById('m-mp-unidad').value = m.unidad || 'kg';
  document.getElementById('m-mp-estado').value = m.estado || 'Pendiente';
  document.getElementById('m-mp-obs').value = m.observaciones || '';
  document.getElementById('m-mp-bodega-cemento').value = m.bodegaCemento || '';
  _alCambiarTipoMateriaPrima();
  document.getElementById('modal-materia-prima').classList.add('abierto');
}

function guardarMateriaPrima() {
  const tipo = document.getElementById('m-mp-tipo').value;
  const esCemento = tipo === 'Cemento';
  const proveedor = (esCemento ? document.getElementById('m-mp-proveedor-cemento').value : document.getElementById('m-mp-proveedor').value).trim();
  const lote = document.getElementById('m-mp-lote').value.trim();
  if (!proveedor) { alert('Completa el campo obligatorio: Proveedor.'); return; }
  const editId = document.getElementById('m-mp-id').value;
  const mp = {
    id: editId || String(Date.now()),
    tipo,
    proveedor, lote,
    fechaRecepcion: document.getElementById('m-mp-fecha-recepcion').value,
    fechaVencimiento: document.getElementById('m-mp-fecha-vencimiento').value,
    cantidad: parseFloat(document.getElementById('m-mp-cantidad').value) || 0,
    unidad: document.getElementById('m-mp-unidad').value,
    estado: document.getElementById('m-mp-estado').value,
    observaciones: document.getElementById('m-mp-obs').value.trim(),
    bodegaCemento: esCemento ? (document.getElementById('m-mp-bodega-cemento').value || '') : '',
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
  if (!m || !confirm(`¿Eliminar el registro de ${m.tipo} — lote ${m.lote || '(sin lote)'}?`)) return;
  MATERIA_PRIMA = MATERIA_PRIMA.filter(x => String(x.id) !== String(id));
  renderMateriaPrima();
  sb.from('materia_prima').delete().eq('id', m.id)
    .then(({ error }) => {
      if (error) { console.error('Error eliminando materia prima:', error.message); alert('Error al eliminar: ' + error.message); MATERIA_PRIMA.push(m); renderMateriaPrima(); }
    });
}

// ═══════════════════════════════
// INVENTARIO DE CEMENTO POR BODEGA
// ═══════════════════════════════
// Entradas = recepciones de Materia Prima (tipo Cemento, no rechazadas) por bodega.
// Salidas = consumo registrado en Producción Diaria (PRODUCCIONES, ver js/produccion-diaria.js)
// por la misma bodega. Se recalcula en cada render de esta pantalla — no hace falta suscripción
// realtime aparte porque tanto `materia_prima` como `producciones` ya disparan
// rerenderPantallaActiva(), que vuelve a llamar renderMateriaPrima() sin importar cuál de las
// dos tablas cambió (ver js/datos-realtime.js). Objetivo del usuario (2026-08-19): saber cuándo
// pedir cemento — por eso el foco es stock actual + días de cobertura estimados, sin pedir un
// umbral configurable.
const _DIAS_VENTANA_CONSUMO_CEMENTO = 30;
// Escala de color por stock actual (kg), a pedido del usuario (2026-08-19) — más directa que
// los días de cobertura para detectar una bodega baja: una bodega con poco consumo reciente
// puede salir con muchos "días de cobertura" aunque el stock en kg ya sea crítico.
const _KG_STOCK_ROJO = 15000;
const _KG_STOCK_AMBAR = 30000;
function _colorStockCemento(stock) {
  // El rojo crítico usa un tono propio (no el `--rojo` #C62828 del resto de la app) más intenso
  // que el ámbar de abajo — a pedido del usuario, porque el #C62828 original se confundía de un
  // vistazo con el #E65100 del ámbar en este borde delgado de 3px (2026-08-30).
  if (stock <= _KG_STOCK_ROJO) return { bg: '#FFEBEE', fg: '#D50000' };
  if (stock <= _KG_STOCK_AMBAR) return { bg: '#FFF3E0', fg: '#E65100' };
  return { bg: '#E8F5E9', fg: '#2E7D32' };
}

function calcularInventarioCemento() {
  const inicioVentana = new Date();
  inicioVentana.setDate(inicioVentana.getDate() - _DIAS_VENTANA_CONSUMO_CEMENTO);
  const inicioVentanaStr = inicioVentana.toISOString().split('T')[0];
  const producciones = typeof PRODUCCIONES !== 'undefined' ? PRODUCCIONES : [];

  return Object.keys(_BODEGAS_CEMENTO).map(bodega => {
    const entradas = MATERIA_PRIMA
      .filter(m => m.tipo === 'Cemento' && m.bodegaCemento === bodega && m.estado !== 'Rechazado')
      .reduce((s, m) => s + (Number(m.cantidad) || 0), 0);
    const salidas = producciones
      .filter(p => p.bodegaCemento === bodega)
      .reduce((s, p) => s + (Number(p.consumoCemento) || 0), 0);
    const consumoVentana = producciones
      .filter(p => p.bodegaCemento === bodega && (p.fecha || '') >= inicioVentanaStr)
      .reduce((s, p) => s + (Number(p.consumoCemento) || 0), 0);
    const stock = entradas - salidas;
    const consumoPromedioDia = consumoVentana / _DIAS_VENTANA_CONSUMO_CEMENTO;
    const diasCobertura = consumoPromedioDia > 0 ? stock / consumoPromedioDia : null;
    return { bodega, label: _BODEGAS_CEMENTO[bodega], entradas, salidas, stock, consumoPromedioDia, diasCobertura };
  });
}

function renderInventarioCemento() {
  const div = document.getElementById('inventario-cemento-cards');
  if (!div) return;
  div.innerHTML = calcularInventarioCemento().map(r => {
    const { bg, fg } = _colorStockCemento(r.stock);
    return `
    <div style="background:${bg};border-radius:6px;padding:10px 14px;box-shadow:var(--sombra);border-top:3px solid ${fg};min-width:190px">
      <div style="font-size:11px;font-weight:700;color:${fg};text-transform:uppercase">${_esc(r.label)}</div>
      <div style="font-size:19px;font-weight:800;color:var(--gris-oscuro)">${r.stock.toLocaleString('es-CO', { maximumFractionDigits: 0 })} kg</div>
      <div style="font-size:11px;color:var(--gris-medio)">Consumo prom.: ${r.consumoPromedioDia.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg/día (últimos ${_DIAS_VENTANA_CONSUMO_CEMENTO}d)</div>
      <div style="font-size:11px;font-weight:700;color:${fg}">${r.diasCobertura === null ? 'Sin consumo reciente' : `≈ ${r.diasCobertura.toLocaleString('es-CO', { maximumFractionDigits: 1 })} días de cobertura`}</div>
    </div>`;
  }).join('');
}
