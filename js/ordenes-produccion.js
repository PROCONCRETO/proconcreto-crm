// ═══════════════════════════════
// ÓRDENES DE SERVICIO
// ═══════════════════════════════
let ORDENES = [];

async function cargarOrdenes() {
  const { data, error } = await sb.from('ordenes_servicio').select('datos').order('creado', { ascending: false });
  if (error) { console.error('Error cargando órdenes:', error.message); return; }
  ORDENES = (data || []).filter(r => r.datos).map(r => r.datos);
}

function renderOrdenes(lista) {
  const data = lista !== undefined ? lista : ORDENES;
  const tbody = document.getElementById('ordenes-body');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><div class="icono">📝</div><div>No hay órdenes de servicio registradas.</div></td></tr>`;
    return;
  }
  const colorOS = { 'Pendiente':'#E65100', 'En producción':'#1565C0', 'Listo':'#2E7D32', 'Despachado':'#00695C', 'Cancelado':'#C62828' };
  const bgOS =    { 'Pendiente':'#FFF3E0', 'En producción':'#E3F2FD', 'Listo':'#E8F5E9', 'Despachado':'#E0F2F1', 'Cancelado':'#FFEBEE' };
  tbody.innerHTML = data.map(o => `
    <tr style="border-top:2px solid var(--azul-oscuro)">
      <td>
        <div style="font-weight:700;color:var(--azul);display:flex;align-items:center;gap:6px">
          ${o.numero}
        </div>
      </td>
      <td>
        ${o.cotizacion ? `<span style="font-weight:600;color:var(--azul)">${o.cotizacion}</span> <span style="font-size:11px;background:var(--gris-borde);color:var(--gris-texto);padding:2px 6px;border-radius:3px;font-weight:600">${o.versionCotizacion||''}</span>` : '—'}
      </td>
      <td style="font-weight:600">${o.cliente}</td>
      <td style="color:var(--gris-medio);max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${o.descripcion}">${o.descripcion}</td>
      <td>${o.fechaEntrega ? new Date(o.fechaEntrega+'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>
        <button class="badge" onclick="abrirModalEstadoOS('${o.id}')"
          style="border:none;cursor:pointer;background:${bgOS[o.estado]||'#eee'};color:${colorOS[o.estado]||'#333'}">
          ${o.estado}
        </button>
      </td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-primario btn-xs" onclick="editarOrden('${o.id}')">✏️ Editar</button>
          <button class="btn btn-secundario btn-xs" onclick="verPDFOrden('${o.id}')">📄 PDF</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarOrden('${o.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function filtrarOrdenes(q) {
  const res = ORDENES.filter(o =>
    o.numero?.toLowerCase().includes(q.toLowerCase()) ||
    o.cliente?.toLowerCase().includes(q.toLowerCase()) ||
    o.descripcion?.toLowerCase().includes(q.toLowerCase())
  );
  renderOrdenes(res);
}

function abrirModalOrden() {
  document.getElementById('m-orden-id').value = '';
  document.getElementById('modal-orden-titulo').textContent = '📝 Nueva Orden de Producción';
  ['m-orden-num','m-orden-cot','m-orden-cliente','m-orden-descripcion','m-orden-cantidad','m-orden-obs'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('m-orden-fecha').value = '';
  document.getElementById('m-orden-estado').value = 'Pendiente';
  document.getElementById('orden-saldo-wrap').style.display = 'none';
  document.getElementById('modal-orden').classList.add('abierto');
}

// Pedido/entregado/saldo por producto de la orden, cruzando con las entregas de Logística
// vinculadas a ella (ver aplicarOrdenAEntrega() y _cantidadEntregadaPorProducto() en logistica.js).
function renderSaldoOrden(orden) {
  const wrap = document.getElementById('orden-saldo-wrap');
  const body = document.getElementById('orden-saldo-body');
  if (!wrap || !body) return;
  const items = typeof _itemsDeOrden === 'function' ? _itemsDeOrden(orden) : [];
  if (!items.length) { wrap.style.display = 'none'; return; }
  const entregadoPorClave = typeof _cantidadEntregadaPorProducto === 'function' ? _cantidadEntregadaPorProducto(orden.id) : {};
  body.innerHTML = items.map(it => {
    const clave = typeof _claveItemOrden === 'function' ? _claveItemOrden(it) : (it.nombre || '');
    const pedido = Number(it.cantidad) || 0;
    const entregado = entregadoPorClave[clave] || 0;
    const saldo = Math.max(0, pedido - entregado);
    return `<tr>
      <td>${it.nombre || ''}${it.unidad ? ' (' + it.unidad + ')' : ''}</td>
      <td style="text-align:right">${pedido}</td>
      <td style="text-align:right">${entregado}</td>
      <td style="text-align:right;font-weight:700;color:${saldo > 0 ? 'var(--naranja)' : 'var(--verde)'}">${saldo}</td>
    </tr>`;
  }).join('');
  wrap.style.display = 'block';
}

function editarOrden(id) {
  const o = ORDENES.find(x => String(x.id) === String(id));
  if (!o) return;
  document.getElementById('m-orden-id').value = o.id;
  document.getElementById('modal-orden-titulo').textContent = '✏️ Editar Orden de Producción';
  document.getElementById('m-orden-num').value = o.numero || '';
  document.getElementById('m-orden-cot').value = o.cotizacion || '';
  document.getElementById('m-orden-cliente').value = o.cliente || '';
  document.getElementById('m-orden-descripcion').value = o.descripcion || '';
  document.getElementById('m-orden-cantidad').value = o.cantidad || '';
  document.getElementById('m-orden-fecha').value = o.fechaEntrega || '';
  document.getElementById('m-orden-estado').value = o.estado || 'Pendiente';
  document.getElementById('m-orden-obs').value = o.observaciones || '';
  renderSaldoOrden(o);
  document.getElementById('modal-orden').classList.add('abierto');
}

function guardarOrden() {
  const numero = document.getElementById('m-orden-num').value.trim();
  const cliente = document.getElementById('m-orden-cliente').value.trim();
  const descripcion = document.getElementById('m-orden-descripcion').value.trim();
  if (!numero || !cliente || !descripcion) { alert('Completa los campos obligatorios (N° Orden, Cliente, Descripción).'); return; }
  const editId = document.getElementById('m-orden-id').value;
  const orden = {
    id: editId || String(Date.now()),
    numero, cliente, descripcion,
    cotizacion: document.getElementById('m-orden-cot').value.trim(),
    cantidad: document.getElementById('m-orden-cantidad').value,
    fechaEntrega: document.getElementById('m-orden-fecha').value,
    estado: document.getElementById('m-orden-estado').value,
    observaciones: document.getElementById('m-orden-obs').value,
    creadoPor: USUARIO_ACTUAL?.email,
  };
  const idx = ORDENES.findIndex(x => String(x.id) === String(orden.id));
  if (idx >= 0) ORDENES[idx] = orden; else ORDENES.unshift(orden);
  sb.from('ordenes_servicio').upsert({ numero: orden.numero, datos: orden, modificado: new Date().toISOString() }, { onConflict: 'numero' })
    .then(({ error }) => { if (error) console.error('Error guardando orden:', error.message); });
  cerrarModal('modal-orden');
  renderOrdenes();
}

function irAOrdenDeCotizacion(numeroCot) {
  const os = ORDENES.find(o => o.cotizacion === numeroCot);
  if (!os) { alert('No se encontró la Orden de Producción para esta cotización.'); return; }
  document.querySelectorAll('.nav-modulo').forEach(b => b.classList.remove('activo'));
  document.querySelector('[onclick="activarModulo(\'produccion\')"]')?.classList.add('activo');
  document.getElementById('subnav-cotizaciones').style.display = 'none';
  document.getElementById('subnav-produccion').style.display = 'flex';
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  document.getElementById('pantalla-ordenes-servicio').classList.add('activa');
  renderOrdenes();
}

function verPDFOrden(id) {
  const o = ORDENES.find(x => String(x.id) === String(id));
  if (!o) return;
  const items = (o.items || []);
  const filasItems = items.map(it => {
    const adj = Math.round(it.precio * (1 - (it.descuento||0) / 100));
    const tot = adj * it.cantidad;
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#555;font-size:11px">${it.codigo||''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px">${it.nombre}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;font-size:12px">${it.cantidad}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px">${it.unidad||''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-size:12px">$${adj.toLocaleString()}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-size:12px;font-weight:600">$${tot.toLocaleString()}</td>
    </tr>`;
  }).join('');

  const t = o.totales || {};
  const html = `
  <div id="os-preview-doc" style="font-family:Arial,sans-serif;max-width:780px;margin:0 auto;padding:0;color:#222">
    <!-- Cabecera -->
    <div style="background:#001F3F;color:white;padding:18px 24px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:17px;font-weight:700">Proconcreto Prefabricados</div>
        <div style="font-size:11px;opacity:0.6;margin-top:2px">ORDEN DE PRODUCCIÓN</div>
      </div>
      <div style="background:#1D9E75;padding:8px 16px;border-radius:6px;text-align:right">
        <div style="font-size:20px;font-weight:700">${o.numero}</div>
        <div style="font-size:10px;opacity:0.8">Fecha: ${new Date().toLocaleDateString('es-CO')}</div>
      </div>
    </div>
    <!-- Ref cotización -->
    <div style="background:#E8F5E9;border-left:4px solid #1D9E75;padding:8px 16px;font-size:12px;color:#1B5E20">
      Generada desde cotización <strong>${o.cotizacion||'—'} ${o.versionCotizacion||''}</strong> — Estado: Aceptada
    </div>
    <!-- Cliente -->
    <div style="padding:14px 16px;border-bottom:1px solid #eee">
      <div style="font-size:10px;font-weight:700;color:#888;letter-spacing:0.08em;margin-bottom:8px">INFORMACIÓN DEL CLIENTE</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div><div style="font-size:10px;color:#888">Razón social</div><div style="font-size:13px;font-weight:600;margin-top:2px">${o.clienteData?.nombre||o.cliente}</div></div>
        <div><div style="font-size:10px;color:#888">Contacto</div><div style="font-size:12px;margin-top:2px">${o.clienteData?.contacto||'—'}</div></div>
        <div><div style="font-size:10px;color:#888">Ciudad / Proyecto</div><div style="font-size:12px;margin-top:2px">${o.clienteData?.proyecto||'—'}</div></div>
      </div>
    </div>
    <!-- Productos -->
    <div style="padding:14px 16px;border-bottom:1px solid #eee">
      <div style="font-size:10px;font-weight:700;color:#888;letter-spacing:0.08em;margin-bottom:8px">PRODUCTOS</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f5f5f5">
          <th style="padding:6px 8px;text-align:left;font-size:11px;color:#555;font-weight:600">Código</th>
          <th style="padding:6px 8px;text-align:left;font-size:11px;color:#555;font-weight:600">Producto</th>
          <th style="padding:6px 8px;text-align:center;font-size:11px;color:#555;font-weight:600">Cant.</th>
          <th style="padding:6px 8px;text-align:left;font-size:11px;color:#555;font-weight:600">Unidad</th>
          <th style="padding:6px 8px;text-align:right;font-size:11px;color:#555;font-weight:600">V/Unit</th>
          <th style="padding:6px 8px;text-align:right;font-size:11px;color:#555;font-weight:600">Total</th>
        </tr></thead>
        <tbody>${filasItems}</tbody>
        <tfoot>
          ${t.subtotal ? `<tr style="background:#f9f9f9"><td colspan="4"></td><td style="padding:5px 8px;text-align:right;font-size:11px;color:#888">Subtotal</td><td style="padding:5px 8px;text-align:right;font-size:12px">$${t.subtotal.toLocaleString()}</td></tr>` : ''}
          ${t.iva ? `<tr style="background:#f9f9f9"><td colspan="4"></td><td style="padding:5px 8px;text-align:right;font-size:11px;color:#888">IVA 19%</td><td style="padding:5px 8px;text-align:right;font-size:12px">$${t.iva.toLocaleString()}</td></tr>` : ''}
          ${t.transporte ? `<tr style="background:#f9f9f9"><td colspan="4"></td><td style="padding:5px 8px;text-align:right;font-size:11px;color:#888">Transporte</td><td style="padding:5px 8px;text-align:right;font-size:12px">$${t.transporte.toLocaleString()}</td></tr>` : ''}
          ${t.logistica ? `<tr style="background:#f9f9f9"><td colspan="4"></td><td style="padding:5px 8px;text-align:right;font-size:11px;color:#888">Logística</td><td style="padding:5px 8px;text-align:right;font-size:12px">$${t.logistica.toLocaleString()}</td></tr>` : ''}
          <tr style="background:#E8F5E9"><td colspan="4"></td><td style="padding:7px 8px;text-align:right;font-size:12px;font-weight:700;color:#1B5E20">TOTAL</td><td style="padding:7px 8px;text-align:right;font-size:14px;font-weight:700;color:#1B5E20">$${(t.total||0).toLocaleString()}</td></tr>
        </tfoot>
      </table>
    </div>
    <!-- Logística y condiciones -->
    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #eee">
      <div style="padding:14px 16px;border-right:1px solid #eee">
        <div style="font-size:10px;font-weight:700;color:#888;letter-spacing:0.08em;margin-bottom:8px">LOGÍSTICA</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><div style="font-size:10px;color:#888">Destino</div><div style="font-size:12px;margin-top:2px">${o.transporte?.destino||'—'}</div></div>
          <div><div style="font-size:10px;color:#888">Cargue</div><div style="font-size:12px;margin-top:2px;text-transform:capitalize">${o.cargue||'No'}</div></div>
        </div>
      </div>
      <div style="padding:14px 16px">
        <div style="font-size:10px;font-weight:700;color:#888;letter-spacing:0.08em;margin-bottom:8px">CONDICIONES</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><div style="font-size:10px;color:#888">Forma de pago</div><div style="font-size:12px;margin-top:2px">${o.condiciones?.pago||'—'}</div></div>
          <div><div style="font-size:10px;color:#888">Tiempo entrega</div><div style="font-size:12px;margin-top:2px">${o.condiciones?.entrega||'—'}</div></div>
          <div><div style="font-size:10px;color:#888">Fecha estimada</div><div style="font-size:12px;font-weight:600;color:#1B5E20;margin-top:2px">${o.fechaEntrega ? new Date(o.fechaEntrega+'T12:00').toLocaleDateString('es-CO') : '—'}</div></div>
          <div><div style="font-size:10px;color:#888">Prioridad</div><div style="font-size:12px;margin-top:2px">${o.prioridad||'Normal'}</div></div>
        </div>
      </div>
    </div>
    <!-- Observaciones -->
    <div style="padding:12px 16px;border-bottom:1px solid #eee">
      <div style="font-size:10px;font-weight:700;color:#888;letter-spacing:0.08em;margin-bottom:6px">OBSERVACIONES DE PRODUCCIÓN</div>
      <div style="font-size:12px;color:#555;min-height:28px">${o.observaciones||'—'}</div>
    </div>
    <!-- Firmas -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-bottom:1px solid #eee">
      ${[
        { label: 'Aprobado por', persona: o.vendedor?.nombre||'—', cargo: o.vendedor?.cargo||'' },
        { label: 'Recibido en producción', persona: 'Jaime Eduardo Franco', cargo: 'Jefe de Producción' },
        { label: 'Recibido en logística', persona: 'Jennifer Lopez', cargo: 'Jefe de Logística' }
      ].map((f,i) => `<div style="padding:16px;${i<2?'border-right:1px solid #eee':''}">
        <div style="border-top:1px solid #333;margin-top:36px;padding-top:6px;text-align:center">
          <div style="font-size:11px;color:#888">${f.label}</div>
          <div style="font-size:12px;font-weight:600;margin-top:2px">${f.persona}</div>
          <div style="font-size:11px;color:#888">${f.cargo}</div>
        </div>
      </div>`).join('')}
    </div>
    <!-- Pie -->
    <div style="background:#f5f5f5;padding:8px 16px;text-align:center;font-size:10px;color:#999">
      Proconcreto Prefabricados · Autopista del Café Km2, Vía Chinchiná – Santa Rosa · www.proconcreto.com.co
    </div>
  </div>`;

  // Mostrar en vista previa con botón de descarga
  const vistaPrevia = document.getElementById('vista-previa');
  document.getElementById('contenido-preview').innerHTML = `
    <div class="no-print" style="background:#1C2333;color:white;padding:12px 24px;display:flex;align-items:center;gap:16px">
      <span style="font-weight:700">Orden de Producción — ${o.numero}</span>
      <div style="flex:1"></div>
      <button onclick="descargarPDFOrden('${o.id}')" style="background:#1D9E75;color:white;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-weight:700" id="btn-pdf-os">⬇️ Descargar PDF</button>
      <button onclick="document.getElementById('vista-previa').style.display='none';document.getElementById('pantalla-ordenes-servicio').classList.add('activa')" style="background:#555;color:white;border:none;padding:8px 14px;border-radius:5px;cursor:pointer">← Volver</button>
    </div>
    <div class="preview-doc" id="os-preview-container" style="padding:0">${html}</div>`;
  vistaPrevia.style.display = 'block';
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  window.scrollTo(0, 0);
}

async function descargarPDFOrden(id) {
  const o = ORDENES.find(x => String(x.id) === String(id));
  if (!o) return;
  const btn = document.getElementById('btn-pdf-os');
  if (btn) { btn.textContent = '⏳ Generando...'; btn.disabled = true; }
  try {
    const { jsPDF } = window.jspdf;
    const el = document.getElementById('os-preview-doc');
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
    const fecha = new Date().toISOString().split('T')[0].replace(/-/g,'_');
    const clienteNombre = (o.cliente||'').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g,'').trim().replace(/\s+/g,'_');
    pdf.save(`${o.numero}_${fecha}_${clienteNombre}.pdf`);
  } finally {
    if (btn) { btn.textContent = '⬇️ Descargar PDF'; btn.disabled = false; }
  }
}

function eliminarOrden(id) {
  const o = ORDENES.find(x => String(x.id) === String(id));
  if (!o || !confirm(`¿Eliminar la orden ${o.numero}?`)) return;
  ORDENES = ORDENES.filter(x => String(x.id) !== String(id));
  renderOrdenes();
  sb.from('ordenes_servicio').delete().eq('numero', o.numero)
    .then(({ error }) => {
      if (error) {
        console.error('Error eliminando orden:', error.message);
        alert('Error al eliminar la orden: ' + error.message);
        // Revertir si falló
        ORDENES.push(o);
        renderOrdenes();
      }
    });
}

