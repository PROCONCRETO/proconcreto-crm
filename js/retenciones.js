// ═══════════════════════════════
// RETENCIONES TRIBUTARIAS EN LA COTIZACIÓN
// ═══════════════════════════════
// Botón "Aplicar retenciones" en Nueva Cotización: si el vendedor lo activa, la vista previa
// (y el PDF, que se genera a partir de esa misma vista previa) discrimina Retefuente de renta,
// ReteIVA y ReteICA, y muestra el neto que Proconcreto realmente recibiría.
//
// Quién retiene qué depende del cliente, no de Proconcreto (Proconcreto es persona jurídica,
// régimen ordinario, responsable de IVA — no autorretenedor de renta según su RUT vigente al
// momento de construir esto). El dato que sí tenemos del cliente es el campo "Régimen
// tributario" que ya se registra en su ficha (modal Nuevo/Editar Cliente, ver
// historico-clientes-stats.js) — normalmente leído directo del RUT que el cliente entrega.
// A partir de ese régimen se infiere, de mejor esfuerzo, si el cliente actúa como agente
// retenedor de renta y de IVA. El ReteICA NO se puede inferir de ahí (es una designación
// municipal aparte, no algo que aparezca en la casilla 53 del RUT) — por eso siempre queda en
// manual: casilla apagada por defecto, con un campo de tarifa "por mil" para cuando sí aplique.
//
// Tarifas y bases vigentes a julio de 2026 (UVT 2026 = $52.374), tomadas de la guía de
// referencia que trajo el usuario. Ojo: estas bases cambiaron 3 veces en poco más de un año
// por decreto/fallos judiciales — no son definitivas, por eso el documento siempre incluye una
// nota pidiendo confirmar con el contador antes de facturar en firme.
const UVT_2026 = 52374;
const RETENCION_CONCEPTOS = {
  bienes:    { label: 'Compra de bienes / materiales (ej. concreto)', tarifa: 0.025, baseMinima: Math.round(UVT_2026 * 10) },
  servicios: { label: 'Servicio general',                             tarifa: 0.04,  baseMinima: Math.round(UVT_2026 * 2) },
  obra:      { label: 'Contrato de obra / construcción de inmueble',  tarifa: 0.02,  baseMinima: 0 },
};
const RETEIVA_TARIFA = 0.15;

function _retencionesActivas() {
  return document.getElementById('ret-aplicar')?.checked || false;
}

function _clienteActualParaRetenciones() {
  const nombre = (document.getElementById('cliente-nombre')?.value || '').trim();
  if (!nombre) return null;
  return (typeof CLIENTES !== 'undefined' ? CLIENTES.find(c => c.nombre === nombre) : null) || null;
}

// Base option (Opción 1 del formulario) recalculada con la misma lógica que usan el resto de
// totales de la cotización (calcOpcion, en cotizador.js) — así no se duplica el cálculo de
// transporte/cargue/descargue/IVA.
function _opcionBaseParaRetenciones() {
  return calcOpcion({
    items: itemsActuales,
    destino: document.getElementById('destino-transporte').value,
    modoTransporte: document.getElementById('modo-transporte')?.value || 'peso',
    tarifaManual: parseFloat(document.getElementById('tarifa-manual')?.value) || 0,
    descTrans: parseFloat(document.getElementById('desc-transporte')?.value) || 0,
    cargue: document.getElementById('cargue-mano').value,
    descCargue: parseFloat(document.getElementById('desc-cargue')?.value) || 0,
    descargue: document.getElementById('descargue-mecanico').value,
    descDescargue: parseFloat(document.getElementById('desc-descargue')?.value) || 0,
  });
}

function _inferenciaRetencionPorRegimen(regimen) {
  if (!regimen) return { renta: false, iva: false };
  if (regimen.startsWith('13')) return { renta: true, iva: true };   // Gran contribuyente
  if (regimen.startsWith('05')) return { renta: true, iva: false };  // Régimen ordinario (persona jurídica)
  if (regimen.startsWith('47')) return { renta: false, iva: false }; // Régimen Simple: no actúa como agente retenedor
  return { renta: false, iva: false };
}

function _pintarInfoRegimen() {
  const el = document.getElementById('ret-regimen-info');
  if (!el) return;
  const cliente = _clienteActualParaRetenciones();
  if (!cliente || !cliente.regimen) {
    el.style.background = '#FFF6E0'; el.style.border = '1px solid var(--naranja)'; el.style.color = '#6b4a10';
    el.textContent = cliente
      ? `⚠️ ${cliente.nombre} no tiene régimen tributario definido en su ficha — no se puede inferir con certeza si retiene. Complétalo en Clientes (idealmente con el RUT) o ajusta las casillas de abajo a mano.`
      : `⚠️ Este cliente no está en la ficha de Clientes (o el nombre no coincide exactamente) — no se pudo leer su régimen tributario. Ajusta las casillas de abajo a mano.`;
    return;
  }
  el.style.background = 'var(--azul-suave)'; el.style.border = '1px solid #90CAF9'; el.style.color = 'var(--gris-oscuro)';
  el.textContent = `Régimen del cliente (según su ficha): ${cliente.regimen}`;
}

// Se llama solo al activar el botón o al cambiar de cliente con el panel abierto — nunca en
// cada tecla, para no pisarle a alguien un ajuste manual que ya hizo a propósito.
function _autodetectarRetencion() {
  const cliente = _clienteActualParaRetenciones();
  const inferido = _inferenciaRetencionPorRegimen(cliente?.regimen || '');
  document.getElementById('ret-renta').checked = inferido.renta;
  document.getElementById('ret-iva').checked = inferido.iva;
  document.getElementById('ret-ica').checked = false;
  document.getElementById('ret-ica-tarifa').value = '';
  document.getElementById('ret-ica-wrap').style.display = 'none';
  _pintarInfoRegimen();
}

// Refresco cuando cambia de cliente estando el panel ya abierto (ver ganchos en
// historico-clientes-stats.js: seleccionarClienteCot / usarCliente).
function _actualizarClienteRetenciones() {
  if (!_retencionesActivas()) return;
  _autodetectarRetencion();
  _renderResumenRetenciones();
}

// El botón grande es lo que el vendedor realmente pincha — la casilla real (id="ret-aplicar")
// queda oculta como único punto de verdad del estado, para no duplicar esa lógica en dos sitios.
function _clickAplicarRetenciones() {
  const chk = document.getElementById('ret-aplicar');
  chk.checked = !chk.checked;
  toggleAplicarRetenciones();
}

function _pintarBotonAplicar(activo) {
  const btn = document.getElementById('ret-aplicar-btn');
  const texto = document.getElementById('ret-toggle-texto');
  if (!btn) return;
  btn.classList.toggle('activo', activo);
  if (texto) texto.textContent = activo ? '✅ Retenciones aplicadas en el documento (clic para quitarlas)' : '🧾 ¿Quieres aplicar retenciones a esta cotización?';
}

function toggleAplicarRetenciones() {
  const activo = _retencionesActivas();
  document.getElementById('ret-detalle').style.display = activo ? 'block' : 'none';
  _pintarBotonAplicar(activo);
  if (activo) { _autodetectarRetencion(); _renderResumenRetenciones(); }
}

function _toggleIcaInput() {
  const marcado = document.getElementById('ret-ica').checked;
  document.getElementById('ret-ica-wrap').style.display = marcado ? 'block' : 'none';
  _renderResumenRetenciones();
}

function _calcularRetenciones() {
  if (!_retencionesActivas()) return null;
  const op = _opcionBaseParaRetenciones();
  const baseRenta = op.subtotal + op.transporte + op.logistica; // base sin IVA

  const concepto = document.getElementById('ret-concepto').value || 'bienes';
  const cfg = RETENCION_CONCEPTOS[concepto];
  const marcaRenta = document.getElementById('ret-renta').checked;
  const superaBase = baseRenta >= cfg.baseMinima;
  const valorRenta = (marcaRenta && superaBase) ? Math.round(baseRenta * cfg.tarifa) : 0;

  const marcaIva = document.getElementById('ret-iva').checked;
  const valorIva = (marcaIva && op.iva > 0) ? Math.round(op.iva * RETEIVA_TARIFA) : 0;

  const marcaIca = document.getElementById('ret-ica').checked;
  const tarifaIca = parseFloat(document.getElementById('ret-ica-tarifa')?.value) || 0;
  const valorIca = (marcaIca && tarifaIca > 0) ? Math.round(baseRenta * (tarifaIca / 1000)) : 0;

  const netoARecibir = op.total - valorRenta - valorIva - valorIca;

  return {
    concepto, baseRenta,
    renta: { aplica: marcaRenta, tarifa: cfg.tarifa, baseMinima: cfg.baseMinima, superaBase, valor: valorRenta },
    iva: { aplica: marcaIva, baseIva: op.iva, valor: valorIva },
    ica: { aplica: marcaIca, tarifaPorMil: tarifaIca, valor: valorIca },
    totalFactura: op.total,
    netoARecibir
  };
}

function _renderResumenRetenciones() {
  const el = document.getElementById('ret-resumen');
  if (!el) return;
  const r = _calcularRetenciones();
  if (!r) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="fila"><span>Valor de la factura (con IVA)</span><span>$${r.totalFactura.toLocaleString()}</span></div>
    ${r.renta.aplica ? `<div class="fila"><span>Retefuente renta (${(r.renta.tarifa * 100).toFixed(1)}%)${r.renta.superaBase ? '' : ' — no supera la base mínima, no aplica'}</span><span>${r.renta.superaBase ? '-$' + r.renta.valor.toLocaleString() : '$0'}</span></div>` : ''}
    ${r.iva.aplica ? `<div class="fila"><span>ReteIVA (15% de $${r.iva.baseIva.toLocaleString()} de IVA)</span><span>${r.iva.valor ? '-$' + r.iva.valor.toLocaleString() : '$0'}</span></div>` : ''}
    ${r.ica.aplica ? `<div class="fila"><span>ReteICA (${r.ica.tarifaPorMil || 0}‰)</span><span>${r.ica.valor ? '-$' + r.ica.valor.toLocaleString() : '$0'}</span></div>` : ''}
    <div class="fila fila-total"><span>NETO A RECIBIR</span><span>$${r.netoARecibir.toLocaleString()}</span></div>
  `;
}

// HTML insertado en el documento de la cotización (vista previa y, por extensión, el PDF que
// se genera a partir de esa misma vista previa — ver pdf.js, que captura .preview-content tal
// cual quedó en pantalla).
function _bloqueRetencionesHTML(multiOp) {
  if (!_retencionesActivas()) return '';
  const r = _calcularRetenciones();
  if (!r) return '';
  const conceptoLabel = RETENCION_CONCEPTOS[r.concepto].label;
  const filas = [`<tr><td>Valor de la factura (con IVA)</td><td style="text-align:right">$ ${r.totalFactura.toLocaleString()}</td></tr>`];
  if (r.renta.aplica) {
    filas.push(`<tr><td>Retefuente de renta — ${_esc(conceptoLabel)} (${(r.renta.tarifa * 100).toFixed(1)}%)${r.renta.superaBase ? '' : ' — no aplica, no supera la base mínima'}</td><td style="text-align:right">${r.renta.superaBase ? '-$ ' + r.renta.valor.toLocaleString() : '$ 0'}</td></tr>`);
  }
  if (r.iva.aplica) {
    filas.push(`<tr><td>ReteIVA (15% del IVA generado)</td><td style="text-align:right">${r.iva.valor ? '-$ ' + r.iva.valor.toLocaleString() : '$ 0'}</td></tr>`);
  }
  if (r.ica.aplica) {
    filas.push(`<tr><td>ReteICA (${r.ica.tarifaPorMil || 0}‰ según actividad y municipio)</td><td style="text-align:right">${r.ica.valor ? '-$ ' + r.ica.valor.toLocaleString() : '$ 0'}</td></tr>`);
  }
  return `<div class="preview-retenciones">
    <div class="preview-retenciones-titulo">RETENCIONES APLICABLES A ESTA VENTA</div>
    ${multiOp ? '<div class="preview-retenciones-nota-opcion">Calculado sobre el valor de la Opción 1 — verifica de nuevo si el cliente elige otra opción.</div>' : ''}
    <table class="preview-retenciones-tabla">${filas.join('')}
      <tr class="total"><td>NETO A RECIBIR</td><td style="text-align:right">$ ${r.netoARecibir.toLocaleString()}</td></tr>
    </table>
    <div class="preview-retenciones-aviso">Cálculo de referencia según normativa vigente a julio de 2026 (UVT = $52.374). Las bases y tarifas de retención cambian con frecuencia por decreto o fallos judiciales — confirma con el contador antes de facturar en firme, sobre todo el ReteICA (depende de si el municipio designó a este cliente como agente retenedor) y las facturas de valor alto.</div>
  </div>`;
}

function recogerRetenciones() {
  if (!_retencionesActivas()) return { aplica: false };
  const r = _calcularRetenciones();
  return { aplica: true, ...r };
}

function cargarRetenciones(r) {
  const chk = document.getElementById('ret-aplicar');
  if (!chk) return;
  chk.checked = !!(r && r.aplica);
  document.getElementById('ret-detalle').style.display = chk.checked ? 'block' : 'none';
  _pintarBotonAplicar(chk.checked);
  if (!chk.checked) return;
  document.getElementById('ret-concepto').value = r.concepto || 'bienes';
  document.getElementById('ret-renta').checked = !!r.renta?.aplica;
  document.getElementById('ret-iva').checked = !!r.iva?.aplica;
  document.getElementById('ret-ica').checked = !!r.ica?.aplica;
  document.getElementById('ret-ica-tarifa').value = r.ica?.tarifaPorMil || '';
  document.getElementById('ret-ica-wrap').style.display = r.ica?.aplica ? 'block' : 'none';
  _pintarInfoRegimen();
  _renderResumenRetenciones();
}
