// ═══════════════════════════════
// BÚSQUEDA PRODUCTO
// ═══════════════════════════════
function poblarGrupos() {
  const sel = document.getElementById('filtro-grupo');
  if (!sel) return;
  const grupos = [...new Set(PRODUCTOS.map(p => p.grupo))].sort();
  grupos.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g; opt.textContent = g;
    sel.appendChild(opt);
  });
}

function filtrarProductos() {
  const div = document.getElementById('resultado-busqueda');
  if (!div) return;
  const grupo = (document.getElementById('filtro-grupo') || {}).value || '';
  const q = ((document.getElementById('buscar-producto') || {}).value || '').toLowerCase().trim();
  if (!grupo && q.length < 2) { div.style.display = 'none'; return; }
  const res = PRODUCTOS.filter(p => {
    const gOk = !grupo || p.grupo === grupo;
    const tOk = q.length < 2 || (p.nombre + ' ' + p.codigo + ' ' + (p.medidas||'')).toLowerCase().includes(q);
    return gOk && tOk;
  }).slice(0, 18);
  if (!res.length) {
    div.innerHTML = '<div style="padding:12px 14px;color:#888;font-size:13px">Sin resultados para esta búsqueda.</div>';
  } else {
    div.innerHTML = res.map(p =>
      `<div onclick="agregarItem('${p.codigo}')" style="padding:9px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;gap:8px" onmouseover="this.style.background='#EFF6FF'" onmouseout="this.style.background=''">
        <div>
          <div style="font-weight:600;font-size:13px;color:#1e293b">${p.nombre}</div>
          <div style="font-size:11px;color:#64748b">${p.codigo}${p.medidas ? ' · ' + p.medidas : ''} · ${p.unidad}</div>
        </div>
        <div style="text-align:right;white-space:nowrap">
          <div style="font-weight:700;font-size:13px;color:#1565C0">$${Number(p.lista).toLocaleString('es-CO')}</div>
          <div style="font-size:10px;color:${p.iva==='SI'?'#C62828':'#2E7D32'}">IVA ${p.iva}</div>
        </div>
      </div>`
    ).join('');
  }
  div.style.display = 'block';
}

function cerrarBuscador() {
  const div = document.getElementById('resultado-busqueda');
  if (div) div.style.display = 'none';
  const inp = document.getElementById('buscar-producto');
  if (inp) inp.value = '';
  const sel = document.getElementById('filtro-grupo');
  if (sel) sel.value = '';
}

function buscarProducto(q) { filtrarProductos(); }

document.addEventListener('click', e => {
  if (!e.target.closest('#buscador-wrap')) {
    const d = document.getElementById('resultado-busqueda');
    if (d) d.style.display = 'none';
  }
  // Cerrar resultados de búsqueda de opciones adicionales
  document.querySelectorAll('[id^="resultado-op-"]').forEach(div => {
    const idx = div.id.replace('resultado-op-', '');
    if (!e.target.closest('#buscador-op-' + idx)) div.style.display = 'none';
  });
  if (!e.target.closest('#lista-clientes-cot') && !e.target.closest('#buscar-cliente-cot')) {
    const d = document.getElementById('lista-clientes-cot');
    if (d) d.style.display = 'none';
  }
});

function agregarItem(codigo) {
  const prod = PRODUCTOS.find(p => p.codigo === codigo);
  if (!prod) return;

  // Si ya existe en la tabla, sumar 1 a la cantidad
  const existente = itemsActuales.find(it => it.codigo === codigo);
  if (existente) {
    existente.cantidad += 1;
    renderItems();
    cerrarBuscador();
    mostrarToast(`+1 unidad — ${prod.nombre}`);
    document.getElementById('buscar-producto').focus();
    return;
  }

  const item = {
    codigo: prod.codigo, nombre: prod.nombre, medidas: prod.medidas,
    unidad: prod.unidad, peso: prod.peso, iva: prod.iva,
    lista: prod.lista, minimo: prod.minimo,
    cantidad: 1, precio: prod.lista, descuento: 0
  };
  itemsActuales.push(item);
  renderItems();
  cerrarBuscador();
  mostrarToast(`✅ ${prod.nombre} agregado`);
  document.getElementById('buscar-producto').focus();
}

function mostrarToast(msg) {
  let t = document.getElementById('toast-msg');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast-msg';
    t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1C2333;color:white;padding:10px 22px;border-radius:20px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.25);transition:opacity .3s';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.style.opacity = '0', 2000);
}

// ═══════════════════════════════
// RENDER TABLA ÍTEMS
// ═══════════════════════════════
function renderItems() {
  const tbody = document.getElementById('items-body');
  tbody.innerHTML = itemsActuales.map((it, i) => {
    const adjUnit = Math.round(it.precio * (1 - it.descuento / 100));
    const total = Math.round(adjUnit * it.cantidad);
    const alerta = adjUnit < it.minimo ? `<span style="color:var(--rojo);font-size:10px;display:block">⚠️ Bajo mínimo ($${it.minimo.toLocaleString()})</span>` : '';
    return `<tr>
      <td><input type="number" min="0.1" step="0.1" value="${it.cantidad}" style="width:70px" onchange="actualizarItem(${i},'cantidad',this.value)"></td>
      <td><span style="background:var(--gris-claro);padding:3px 6px;border-radius:4px;font-size:11px;font-weight:700">${it.unidad}</span></td>
      <td>
        <div style="font-weight:600;font-size:13px">${it.nombre}</div>
        <div style="font-size:11px;color:var(--gris-medio)">${it.medidas}</div>
        <div style="font-size:10px;color:#90A4AE">${it.codigo}</div>
      </td>
      <td><span style="color:${it.iva==='SI'?'var(--rojo)':'var(--verde)'};font-weight:700;font-size:12px">${it.iva}</span></td>
      <td><input type="number" value="${it.precio}" style="width:90px" onchange="actualizarItem(${i},'precio',this.value)"></td>
      <td><input type="number" min="0" max="50" value="${it.descuento}" style="width:60px" onchange="actualizarItem(${i},'descuento',this.value)">%</td>
      <td style="font-weight:600;color:var(--azul)">$${adjUnit.toLocaleString()}${alerta}</td>
      <td style="font-weight:700">$${total.toLocaleString()}</td>
      <td><button class="btn btn-rojo btn-xs" onclick="eliminarItem(${i})">✕</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--gris-medio)">Busca y agrega productos arriba</td></tr>`;
  recalcular();
}

function actualizarItem(i, campo, val) {
  itemsActuales[i][campo] = parseFloat(val) || 0;
  renderItems();
}

function eliminarItem(i) {
  itemsActuales.splice(i, 1);
  renderItems();
}

// ═══════════════════════════════
// CÁLCULOS
// ═══════════════════════════════
function recalcular() {
  let subtotal = 0, iva = 0;
  let pesoTotal = 0;
  itemsActuales.forEach(it => {
    const adj = Math.round(it.precio * (1 - it.descuento / 100));
    const tot = adj * it.cantidad;
    if (it.iva === 'SI') { subtotal += tot; iva += Math.round(tot * 0.19); }
    else subtotal += tot;
    if (it.peso) pesoTotal += it.peso * it.cantidad;
  });

  document.getElementById('peso-transporte').value = Math.round(pesoTotal);

  const tieneIva = itemsActuales.some(it => it.iva === 'SI');
  const descTrans = parseFloat(document.getElementById('desc-transporte')?.value) || 0;
  const descCargue = parseFloat(document.getElementById('desc-cargue')?.value) || 0;
  const descDescargue = parseFloat(document.getElementById('desc-descargue')?.value) || 0;

  let transporte = 0; // base sin IVA
  const destino = document.getElementById('destino-transporte').value;
  const tarifaManual = parseFloat(document.getElementById('tarifa-manual')?.value) || 0;
  if (destino && pesoTotal > 0) {
    const tarifaBase = Math.round(pesoTotal * tarifaKgDe(destino, tarifaManual));
    transporte = Math.round(tarifaBase * (1 - descTrans / 100)); // base
    if (tieneIva) iva += Math.round(transporte * 0.19); // transporte grabado solo si el producto tiene IVA
  }

  let logistica = 0; // base sin IVA (cargue/descargue: servicios SIEMPRE grabados)
  if (document.getElementById('cargue-mano').value === 'si') {
    const base = Math.round(pesoTotal * 11 * (1 - descCargue / 100));
    logistica += base;
    iva += Math.round(base * 0.19);
  }
  if (document.getElementById('descargue-mecanico').value === 'si') {
    const base = Math.round(pesoTotal * 11 * (1 - descDescargue / 100));
    logistica += base;
    iva += Math.round(base * 0.19);
  }

  const total = subtotal + transporte + logistica + iva;
  document.getElementById('tot-subtotal').textContent = '$' + subtotal.toLocaleString();
  document.getElementById('tot-iva').textContent = '$' + iva.toLocaleString();
  document.getElementById('tot-transporte').textContent = '$' + transporte.toLocaleString();
  document.getElementById('tot-logistica').textContent = '$' + logistica.toLocaleString();
  document.getElementById('tot-total').textContent = '$' + total.toLocaleString();
}

function actualizarTransporte() { recalcular(); }
function aplicarTarifaTransporte() {
  const esOtro = document.getElementById('destino-transporte').value === 'Otro';
  document.getElementById('bloque-otro-transporte').style.display = esOtro ? 'block' : 'none';
  recalcular();
}
function actualizarCargue() {
  const tieneTransporte = !!document.getElementById('destino-transporte').value;
  const sel = document.getElementById('cargue-mano');
  if (tieneTransporte) {
    sel.value = 'no';
    sel.disabled = true;
    sel.style.opacity = '0.5';
    sel.title = 'No disponible cuando hay transporte incluido';
  } else {
    sel.disabled = false;
    sel.style.opacity = '';
    sel.title = '';
  }
  recalcular();
}

// Tarifa $/kg para un destino (soporta "Otro" con tarifa manual)
function tarifaKgDe(destino, tarifaManual) {
  if (destino === 'Otro') return parseFloat(tarifaManual) || 0;
  return TARIFAS_KG_TRANSPORTE[destino] || 0;
}
function nombreDestino(destino, destinoNombre) {
  return destino === 'Otro' ? (destinoNombre || 'destino remoto') : destino;
}

// ═══════════════════════════════
// OPCIONES ADICIONALES (alternativas en una misma cotización)
// ═══════════════════════════════
let opcionesExtra = [];

function optsProductosHTML() {
  const grupos = {};
  PRODUCTOS.forEach(p => { (grupos[p.grupo] = grupos[p.grupo] || []).push(p); });
  let h = '<option value="">— Selecciona producto —</option>';
  Object.keys(grupos).sort().forEach(g => {
    h += `<optgroup label="${g}">`;
    grupos[g].forEach(p => { h += `<option value="${p.codigo}">${p.nombre}</option>`; });
    h += '</optgroup>';
  });
  return h;
}

function calcOpcion(op) {
  let subtotal = 0, iva = 0, pesoTotal = 0;
  op.items.forEach(it => {
    const adj = Math.round(it.precio * (1 - (it.descuento || 0) / 100));
    const tot = adj * it.cantidad;
    if (it.iva === 'SI') { subtotal += tot; iva += Math.round(tot * 0.19); } else subtotal += tot;
    if (it.peso) pesoTotal += it.peso * it.cantidad;
  });
  const tieneIva = op.items.some(it => it.iva === 'SI');
  let transporte = 0; // base sin IVA
  if (op.destino && pesoTotal > 0) {
    transporte = Math.round(pesoTotal * tarifaKgDe(op.destino, op.tarifaManual) * (1 - (op.descTrans || 0) / 100));
    if (tieneIva) iva += Math.round(transporte * 0.19);
  }
  let logistica = 0; // base sin IVA (cargue/descargue: servicios SIEMPRE grabados)
  if (op.cargue === 'si') {
    const base = Math.round(pesoTotal * 11 * (1 - (op.descCargue || 0) / 100));
    logistica += base; iva += Math.round(base * 0.19);
  }
  if (op.descargue === 'si') {
    const base = Math.round(pesoTotal * 11 * (1 - (op.descDescargue || 0) / 100));
    logistica += base; iva += Math.round(base * 0.19);
  }
  return { subtotal, iva, transporte, logistica, pesoTotal, total: subtotal + transporte + logistica + iva };
}

function agregarOpcionExtra() {
  if (opcionesExtra.length >= 3) { alert('Máximo 4 opciones por cotización (Opción 1 + 3 adicionales).'); return; }
  opcionesExtra.push({ items: [], destino: '', tarifaManual: 0, destinoNombre: '', descTrans: 0, cargue: 'no', descCargue: 0, descargue: 'no', descDescargue: 0 });
  renderOpcionesExtra();
}

function eliminarOpcionExtra(idx) {
  if (!confirm(`¿Quitar la Opción ${idx + 2}?`)) return;
  opcionesExtra.splice(idx, 1);
  renderOpcionesExtra();
}

// Buscador de productos por opción (igual al de la Opción 1)
function filtrarProductosOpcion(idx) {
  const div = document.getElementById('resultado-op-' + idx);
  if (!div) return;
  const grupo = (document.getElementById('filtro-grupo-op-' + idx) || {}).value || '';
  const q = ((document.getElementById('buscar-op-' + idx) || {}).value || '').toLowerCase().trim();
  if (!grupo && q.length < 2) { div.style.display = 'none'; return; }
  const res = PRODUCTOS.filter(p => {
    const gOk = !grupo || p.grupo === grupo;
    const tOk = q.length < 2 || (p.nombre + ' ' + p.codigo + ' ' + (p.medidas || '')).toLowerCase().includes(q);
    return gOk && tOk;
  }).slice(0, 18);
  if (!res.length) {
    div.innerHTML = '<div style="padding:12px 14px;color:#888;font-size:13px">Sin resultados para esta búsqueda.</div>';
  } else {
    div.innerHTML = res.map(p =>
      `<div onclick="agregarItemOpcionCodigo(${idx},'${p.codigo}')" style="padding:9px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;gap:8px" onmouseover="this.style.background='#EFF6FF'" onmouseout="this.style.background=''">
        <div>
          <div style="font-weight:600;font-size:13px;color:#1e293b">${p.nombre}</div>
          <div style="font-size:11px;color:#64748b">${p.codigo}${p.medidas ? ' · ' + p.medidas : ''} · ${p.unidad}</div>
        </div>
        <div style="text-align:right;white-space:nowrap">
          <div style="font-weight:700;font-size:13px;color:#1565C0">$${Number(p.lista).toLocaleString('es-CO')}</div>
          <div style="font-size:10px;color:${p.iva === 'SI' ? '#C62828' : '#2E7D32'}">IVA ${p.iva}</div>
        </div>
      </div>`
    ).join('');
  }
  div.style.display = 'block';
}

function agregarItemOpcionCodigo(idx, codigo) {
  const prod = PRODUCTOS.find(p => p.codigo === codigo);
  if (!prod) return;
  const op = opcionesExtra[idx];
  const ex = op.items.find(it => it.codigo === codigo);
  if (ex) ex.cantidad += 1;
  else op.items.push({ codigo: prod.codigo, nombre: prod.nombre, medidas: prod.medidas, unidad: prod.unidad, peso: prod.peso, iva: prod.iva, lista: prod.lista, minimo: prod.minimo, cantidad: 1, precio: prod.lista, descuento: 0 });
  renderOpcionesExtra();
  mostrarToast(ex ? `+1 unidad — ${prod.nombre}` : `✅ ${prod.nombre} agregado a Opción ${idx + 2}`);
}

function actualizarItemOpcion(idx, i, campo, val) {
  opcionesExtra[idx].items[i][campo] = parseFloat(val) || 0;
  renderOpcionesExtra();
}

function eliminarItemOpcion(idx, i) {
  opcionesExtra[idx].items.splice(i, 1);
  renderOpcionesExtra();
}

function actualizarCampoOpcion(idx, campo, val) {
  const op = opcionesExtra[idx];
  if (campo === 'descTrans' || campo === 'descCargue' || campo === 'descDescargue' || campo === 'tarifaManual') op[campo] = parseFloat(val) || 0;
  else op[campo] = val;
  if (campo === 'destino' && val) op.cargue = 'no'; // sin cargue a mano cuando hay transporte
  renderOpcionesExtra();
}

function renderOpcionesExtra() {
  const cont = document.getElementById('opciones-extra-container');
  if (!cont) return;
  const gruposProd = [...new Set(PRODUCTOS.map(p => p.grupo))].sort();
  cont.innerHTML = opcionesExtra.map((op, idx) => {
    const n = idx + 2;
    const t = calcOpcion(op);
    const filas = op.items.map((it, i) => {
      const adj = Math.round(it.precio * (1 - (it.descuento || 0) / 100));
      const tot = Math.round(adj * it.cantidad);
      return `<tr>
        <td><input type="number" min="0.1" step="0.1" value="${it.cantidad}" style="width:64px" onchange="actualizarItemOpcion(${idx},${i},'cantidad',this.value)"></td>
        <td><span style="background:var(--gris-claro);padding:3px 6px;border-radius:4px;font-size:11px;font-weight:700">${it.unidad}</span></td>
        <td><div style="font-weight:600;font-size:13px">${it.nombre}</div><div style="font-size:11px;color:var(--gris-medio)">${it.medidas}</div></td>
        <td><span style="color:${it.iva === 'SI' ? 'var(--rojo)' : 'var(--verde)'};font-weight:700;font-size:12px">${it.iva}</span></td>
        <td><input type="number" value="${it.precio}" style="width:84px" onchange="actualizarItemOpcion(${idx},${i},'precio',this.value)"></td>
        <td><input type="number" min="0" max="50" value="${it.descuento}" style="width:54px" onchange="actualizarItemOpcion(${idx},${i},'descuento',this.value)">%</td>
        <td style="font-weight:600;color:var(--azul)">$${adj.toLocaleString()}</td>
        <td style="font-weight:700">$${tot.toLocaleString()}</td>
        <td><button class="btn btn-rojo btn-xs" onclick="eliminarItemOpcion(${idx},${i})">✕</button></td>
      </tr>`;
    }).join('') || `<tr><td colspan="9" style="text-align:center;padding:14px;color:var(--gris-medio)">Agrega productos a esta opción</td></tr>`;
    const cargueDisabled = op.destino ? 'disabled style="opacity:.5"' : '';
    return `
    <div class="card" style="border:2px solid #BFDBFE;margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div class="card-titulo" style="margin:0;color:var(--azul)">🔁 Opción ${n}</div>
        <button class="btn btn-rojo btn-sm" onclick="eliminarOpcionExtra(${idx})">🗑️ Quitar opción ${n}</button>
      </div>
      <div id="buscador-op-${idx}" style="margin-bottom:10px">
        <div style="display:flex;gap:8px">
          <select id="filtro-grupo-op-${idx}" onchange="filtrarProductosOpcion(${idx})" style="padding:9px 10px;border:1.5px solid #93C5FD;border-radius:8px;font-size:13px">
            <option value="">Todos los grupos</option>
            ${gruposProd.map(g => `<option value="${g}">${g}</option>`).join('')}
          </select>
          <input id="buscar-op-${idx}" type="text" placeholder="Buscar por nombre o código..." oninput="filtrarProductosOpcion(${idx})" style="flex:1;padding:9px 12px;border:1.5px solid #93C5FD;border-radius:8px;font-size:13px">
        </div>
        <div id="resultado-op-${idx}" style="display:none;margin-top:6px;border:1.5px solid #93C5FD;border-radius:8px;background:#fff;max-height:280px;overflow-y:auto"></div>
      </div>
      <div style="overflow-x:auto">
        <table class="tabla-items"><thead><tr>
          <th style="width:60px">CANT.</th><th style="width:55px">UNID.</th><th>PRODUCTO</th><th style="width:55px">IVA</th><th style="width:90px">V/UNIT</th><th style="width:70px">DESC. %</th><th style="width:100px">V/UNIT AJUST.</th><th style="width:100px">V/R TOTAL</th><th style="width:36px"></th>
        </tr></thead><tbody>${filas}</tbody></table>
      </div>
      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div style="background:#F8FBFF;border:1px solid #BFDBFE;border-radius:var(--radio);padding:10px">
          <div style="font-size:11px;font-weight:700;color:var(--azul);margin-bottom:6px">🚚 TRANSPORTE</div>
          <div class="form-grupo" style="margin-bottom:6px"><label>Destino</label>
            <select onchange="actualizarCampoOpcion(${idx},'destino',this.value)">
              <option value="">Seleccionar...</option>
              ${Object.keys(TARIFAS_TRANSPORTE).map(d => `<option value="${d}" ${op.destino === d ? 'selected' : ''}>${d}</option>`).join('')}
              <option value="Otro" ${op.destino === 'Otro' ? 'selected' : ''}>Otro (tarifa manual)</option>
            </select>
          </div>
          ${op.destino === 'Otro' ? `
          <div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:6px;padding:6px;margin-bottom:6px">
            <div class="form-grupo" style="margin-bottom:6px"><label>Nombre destino</label><input type="text" value="${op.destinoNombre || ''}" placeholder="Ej: Leticia" onchange="actualizarCampoOpcion(${idx},'destinoNombre',this.value)"></div>
            <div class="form-grupo"><label>Tarifa ($/kg)</label><input type="number" min="0" value="${op.tarifaManual || 0}" onchange="actualizarCampoOpcion(${idx},'tarifaManual',this.value)"></div>
          </div>` : ''}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <div class="form-grupo"><label>Peso (kg)</label><input type="number" value="${Math.round(t.pesoTotal)}" readonly style="background:#F7FAFC;font-weight:600;color:var(--azul)"></div>
            <div class="form-grupo"><label>Desc %</label><input type="number" value="${op.descTrans}" min="0" max="100" onchange="actualizarCampoOpcion(${idx},'descTrans',this.value)"></div>
          </div>
        </div>
        <div style="background:#F8FBFF;border:1px solid #BFDBFE;border-radius:var(--radio);padding:10px">
          <div style="font-size:11px;font-weight:700;color:var(--azul);margin-bottom:6px">⚙️ CARGUE / DESCARGUE</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
            <div class="form-grupo"><label>Cargue a mano</label>
              <select ${cargueDisabled} onchange="actualizarCampoOpcion(${idx},'cargue',this.value)">
                <option value="no" ${op.cargue === 'no' ? 'selected' : ''}>No</option>
                <option value="si" ${op.cargue === 'si' ? 'selected' : ''}>Sí ($11/kg)</option>
              </select>
            </div>
            <div class="form-grupo"><label>Desc %</label><input type="number" value="${op.descCargue}" min="0" max="100" onchange="actualizarCampoOpcion(${idx},'descCargue',this.value)"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <div class="form-grupo"><label>Descargue mec.</label>
              <select onchange="actualizarCampoOpcion(${idx},'descargue',this.value)">
                <option value="no" ${op.descargue === 'no' ? 'selected' : ''}>No</option>
                <option value="si" ${op.descargue === 'si' ? 'selected' : ''}>Sí ($11/kg)</option>
              </select>
            </div>
            <div class="form-grupo"><label>Desc %</label><input type="number" value="${op.descDescargue}" min="0" max="100" onchange="actualizarCampoOpcion(${idx},'descDescargue',this.value)"></div>
          </div>
        </div>
        <div class="totales-box" style="margin:0">
          <div class="fila"><span>Subtotal</span><span>$${t.subtotal.toLocaleString()}</span></div>
          <div class="fila"><span>IVA (19%)</span><span>$${t.iva.toLocaleString()}</span></div>
          <div class="fila"><span>Transporte</span><span>$${t.transporte.toLocaleString()}</span></div>
          <div class="fila"><span>Cargue/Descargue</span><span>$${t.logistica.toLocaleString()}</span></div>
          <div class="fila fila-total"><span>TOTAL OPCIÓN ${n}</span><span>$${t.total.toLocaleString()}</span></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function recogerOpcionesExtra() {
  return opcionesExtra.filter(op => op.items.length > 0).map((op, i) => {
    const t = calcOpcion(op);
    return {
      nombre: 'Opción ' + (i + 2),
      items: JSON.parse(JSON.stringify(op.items)),
      transporte: { destino: op.destino || '', pesoTotal: t.pesoTotal, grabado: op.items.some(it => it.iva === 'SI'), tarifaManual: op.destino === 'Otro' ? (op.tarifaManual || 0) : 0, destinoNombre: op.destino === 'Otro' ? (op.destinoNombre || '') : '' },
      cargue: op.cargue, descargue: op.descargue,
      descuentos: { transporte: op.descTrans || 0, cargue: op.descCargue || 0, descargue: op.descDescargue || 0 },
      totales: { subtotal: t.subtotal, iva: t.iva, transporte: t.transporte, logistica: t.logistica, total: t.total }
    };
  });
}

function cargarOpcionesExtraDesde(cot) {
  opcionesExtra = (cot.opcionesExtra || []).map(op => ({
    items: JSON.parse(JSON.stringify(op.items || [])),
    destino: op.transporte?.destino || '',
    tarifaManual: op.transporte?.tarifaManual || 0,
    destinoNombre: op.transporte?.destinoNombre || '',
    descTrans: op.descuentos?.transporte || 0,
    cargue: op.cargue || 'no',
    descCargue: op.descuentos?.cargue || 0,
    descargue: op.descargue || 'no',
    descDescargue: op.descuentos?.descargue || 0
  }));
  renderOpcionesExtra();
}

// Normaliza una cotización a lista uniforme de opciones (para PDF, histórico y estadísticas)
function obtenerOpcionesCot(cot) {
  const op1 = {
    nombre: 'Opción 1', items: cot.items || [],
    transporte: cot.transporte || { destino: '', pesoTotal: 0, grabado: false },
    cargue: cot.cargue || 'no', descargue: cot.descargue || 'no',
    descuentos: cot.descuentos || { transporte: 0, cargue: 0, descargue: 0 },
    totales: cot.totales || { total: 0 }
  };
  return [op1, ...((cot.opcionesExtra) || [])];
}
function valorMenorCot(cot) {
  const ops = obtenerOpcionesCot(cot);
  return Math.min(...ops.map(o => o.totales?.total || 0));
}
// Valor "real" para estadísticas: si está aceptada con opción elegida usa esa; si no, el menor cotizado
function valorRepresentativoCot(cot) {
  const ops = obtenerOpcionesCot(cot);
  if (cot.estado === 'Aceptada' && cot.opcionAceptada != null && ops[cot.opcionAceptada]) return ops[cot.opcionAceptada].totales?.total || 0;
  return valorMenorCot(cot);
}

// Construye la tabla HTML del PDF para un set de productos + logística (una opción)
function construirTablaCotizacion(items, destino, descTrans, cargueVal, descCargue, descargueVal, descDescargue, tarifaManual, destinoNombre) {
  let filasTabla = '', subtotal = 0, ivaTotal = 0, pesoTotal = 0;
  items.forEach(it => {
    const adj = Math.round(it.precio * (1 - it.descuento / 100));
    const tot = adj * it.cantidad;
    if (it.iva === 'SI') ivaTotal += Math.round(tot * 0.19);
    subtotal += tot;
    if (it.peso) pesoTotal += it.peso * it.cantidad;
    filasTabla += `<tr>
      <td style="width:55px">${it.cantidad}</td>
      <td style="width:40px">${it.unidad}</td>
      <td>${it.nombre}<br><span style="font-size:10px;color:#666">${it.medidas}</span>${it.peso ? `<br><span style="font-size:10px;color:#888">Peso unitario: ${it.peso} kg/${it.unidad}</span>` : ''}</td>
      <td style="width:40px;text-align:center">${it.iva}</td>
      <td style="width:80px;text-align:right">$ ${it.precio.toLocaleString()}</td>
      <td style="width:50px;text-align:center">${it.descuento}%</td>
      <td style="width:90px;text-align:right">$ ${adj.toLocaleString()}</td>
      <td style="width:90px;text-align:right">$ ${tot.toLocaleString()}</td>
    </tr>`;
  });
  const transIva = items.some(it => it.iva === 'SI');
  let transporte = 0; // base sin IVA
  if (destino && pesoTotal > 0) {
    const tarifaKg = tarifaKgDe(destino, tarifaManual);
    const destLabelNombre = nombreDestino(destino, destinoNombre);
    const tarifaBase = Math.round(pesoTotal * tarifaKg);
    transporte = Math.round(tarifaBase * (1 - descTrans / 100)); // base (el IVA se discrimina abajo)
    if (transIva) ivaTotal += Math.round(transporte * 0.19);
    const tarifaAjust = tarifaKg * (1 - descTrans / 100);
    const descLabel = descTrans > 0 ? ` (desc. ${descTrans}%)` : '';
    filasTabla += `<tr>
      <td>${Math.round(pesoTotal)}</td><td>kg</td>
      <td>Transporte${descLabel}:<br><span style="font-size:10px;color:#666">Chinchiná – ${destLabelNombre}</span></td>
      <td style="text-align:center">${transIva ? 'SI' : 'NO'}</td>
      <td style="text-align:right">$ ${tarifaKg.toLocaleString()}</td>
      <td style="text-align:center">${descTrans > 0 ? descTrans + '%' : '0%'}</td>
      <td style="text-align:right">$ ${Number(tarifaAjust.toFixed(2)).toLocaleString()}</td>
      <td style="text-align:right">$ ${transporte.toLocaleString()}</td>
    </tr>`;
  }
  let logistica = 0; // base sin IVA (cargue/descargue son servicios: SIEMPRE grabados)
  if (cargueVal === 'si') {
    const base = Math.round(pesoTotal * 11 * (1 - descCargue / 100));
    logistica += base;
    ivaTotal += Math.round(base * 0.19);
    const tarifaAjust = 11 * (1 - descCargue / 100);
    const descLabel = descCargue > 0 ? ` (desc. ${descCargue}%)` : '';
    filasTabla += `<tr><td>${Math.round(pesoTotal)}</td><td>kg</td><td>Cargue a mano${descLabel}</td><td style="text-align:center">SI</td><td style="text-align:right">$ 11</td><td style="text-align:center">${descCargue > 0 ? descCargue + '%' : '0%'}</td><td style="text-align:right">$ ${Number(tarifaAjust.toFixed(2)).toLocaleString()}</td><td style="text-align:right">$ ${base.toLocaleString()}</td></tr>`;
  }
  if (descargueVal === 'si') {
    const base = Math.round(pesoTotal * 11 * (1 - descDescargue / 100));
    logistica += base;
    ivaTotal += Math.round(base * 0.19);
    const tarifaAjust = 11 * (1 - descDescargue / 100);
    const descLabel = descDescargue > 0 ? ` (desc. ${descDescargue}%)` : '';
    filasTabla += `<tr><td>${Math.round(pesoTotal)}</td><td>kg</td><td>Descargue mecánico${descLabel}</td><td style="text-align:center">SI</td><td style="text-align:right">$ 11</td><td style="text-align:center">${descDescargue > 0 ? descDescargue + '%' : '0%'}</td><td style="text-align:right">$ ${Number(tarifaAjust.toFixed(2)).toLocaleString()}</td><td style="text-align:right">$ ${base.toLocaleString()}</td></tr>`;
  }
  const total = subtotal + transporte + logistica + ivaTotal;
  const html = `<table class="preview-tabla">
    <thead><tr>
      <th style="width:52px">CANT.</th><th style="width:44px">UNID.</th><th>PRODUCTO</th><th style="width:38px">IVA</th><th style="width:80px">V/UNIT</th><th style="width:50px">DESC.</th><th style="width:90px">V/UNIT AJUSTADO</th><th style="width:130px">V/R TOTAL</th>
    </tr></thead>
    <tbody>${filasTabla}</tbody>
    <tfoot>
      ${ivaTotal > 0 ? `<tr><td colspan="7" style="text-align:right;padding:7px 8px;font-size:12px">IVA (19%)</td><td style="text-align:right;padding:7px 8px;font-weight:600">$ ${ivaTotal.toLocaleString()}</td></tr>` : ''}
      <tr class="total-row"><td colspan="7" style="text-align:right;padding:8px">TOTAL</td><td style="text-align:right;padding:8px;white-space:nowrap">$ ${total.toLocaleString()}</td></tr>
    </tfoot>
  </table>`;
  return { html, total, transporte };
}

// ═══════════════════════════════
// GUARDAR / CARGAR COTIZACIÓN
// ═══════════════════════════════
function guardarCotizacion() {
  const num = document.getElementById('num-cot').value.trim().toUpperCase();
  if (!num) {
    alert('⚠️ Debes asignar un número de cotización antes de guardar.');
    document.getElementById('num-cot').focus();
    return;
  }
  if (!/^[A-Z]\d{4}$/.test(num)) {
    alert('⚠️ El número debe tener el formato C0085 (una letra seguida de 4 dígitos).');
    document.getElementById('num-cot').focus();
    return;
  }
  const duplicado = COTIZACIONES.find(c => c.numero === num && c.id !== (COTIZACIONES.find(x => x.numero === num)?.id));
  if (duplicado && !COTIZACIONES.find(c => c.numero === num && c.id === duplicado.id)) {
    if (!confirm(`Ya existe la cotización ${num}. ¿Deseas sobreescribirla?`)) return;
  }
  if (!document.getElementById('cliente-nombre').value.trim()) {
    alert('Por favor ingresa el nombre del cliente.');
    return;
  }
  if (!document.getElementById('cliente-proyecto').value.trim()) {
    alert('⚠️ Debes ingresar la ciudad / proyecto antes de guardar.');
    document.getElementById('cliente-proyecto').focus();
    return;
  }
  if (itemsActuales.length === 0) {
    alert('Agrega al menos un producto.');
    return;
  }
  let subtotal = 0, iva = 0, pesoTotal = 0;
  itemsActuales.forEach(it => {
    const adj = Math.round(it.precio * (1 - it.descuento / 100));
    const tot = adj * it.cantidad;
    if (it.iva === 'SI') { subtotal += tot; iva += Math.round(tot * 0.19); }
    else subtotal += tot;
    if (it.peso) pesoTotal += it.peso * it.cantidad;
  });
  const destino = document.getElementById('destino-transporte').value;
  const tieneIva = itemsActuales.some(it => it.iva === 'SI');
  const descTrans = parseFloat(document.getElementById('desc-transporte')?.value) || 0;
  const descCargue = parseFloat(document.getElementById('desc-cargue')?.value) || 0;
  const descDescargue = parseFloat(document.getElementById('desc-descargue')?.value) || 0;
  const tarifaManual = parseFloat(document.getElementById('tarifa-manual')?.value) || 0;
  const destinoNombre = document.getElementById('destino-otro-nombre')?.value || '';
  // Transporte y logística en BASE (sin IVA); el IVA se discrimina en 'iva'.
  const transporte = destino && pesoTotal > 0 ? Math.round(pesoTotal * tarifaKgDe(destino, tarifaManual) * (1 - descTrans / 100)) : 0;
  if (tieneIva && transporte > 0) iva += Math.round(transporte * 0.19); // transporte grabado solo si el producto tiene IVA
  let logistica = 0;
  if (document.getElementById('cargue-mano').value === 'si') {
    const base = Math.round(pesoTotal * 11 * (1 - descCargue / 100));
    logistica += base; iva += Math.round(base * 0.19); // servicio: siempre grabado
  }
  if (document.getElementById('descargue-mecanico').value === 'si') {
    const base = Math.round(pesoTotal * 11 * (1 - descDescargue / 100));
    logistica += base; iva += Math.round(base * 0.19); // servicio: siempre grabado
  }

  const version = document.getElementById('version-cot').value || 'V1';
  const existente = COTIZACIONES.find(c => c.numero === num && c.version === version);
  const cot = {
    id: existente ? existente.id : Date.now(),
    numero: num,
    version: version,
    fecha: document.getElementById('fecha-cot').value,
    cliente: {
      nombre: document.getElementById('cliente-nombre').value,
      contacto: document.getElementById('cliente-contacto').value,
      cel: document.getElementById('cliente-cel').value,
      proyecto: document.getElementById('cliente-proyecto').value,
    },
    items: JSON.parse(JSON.stringify(itemsActuales)),
    transporte: { destino, pesoTotal, grabado: tieneIva, tarifaManual: destino === 'Otro' ? tarifaManual : 0, destinoNombre: destino === 'Otro' ? destinoNombre : '' },
    cargue: document.getElementById('cargue-mano').value,
    descargue: document.getElementById('descargue-mecanico').value,
    descuentos: { transporte: descTrans, cargue: descCargue, descargue: descDescargue },
    condiciones: {
      pago: document.getElementById('forma-pago').value,
      entrega: document.getElementById('tiempo-entrega').value,
      validez: document.getElementById('validez').value,
    },
    vendedor: {
      nombre: document.getElementById('vendedor-nombre').value,
      cargo: document.getElementById('vendedor-cargo').value,
    },
    totales: { subtotal, iva, transporte, logistica, total: subtotal + iva + transporte + logistica },
    opcionesExtra: recogerOpcionesExtra(),
    opcionAceptada: existente ? existente.opcionAceptada : null,
    estado: existente ? existente.estado : 'Borrador',
    creado: existente ? existente.creado : new Date().toISOString()
  };

  const idx = COTIZACIONES.findIndex(c => c.numero === num && c.version === version);
  if (idx >= 0) COTIZACIONES[idx] = cot;
  else COTIZACIONES.push(cot);

  // Registrar o actualizar cliente en la tabla clientes
  if (!CLIENTES.find(c => c.nombre === cot.cliente.nombre)) {
    const nuevoCliente = { id: Date.now(), nombre: cot.cliente.nombre, contacto: cot.cliente.contacto || '', cel: cot.cliente.cel || '', email: '', ciudad: cot.cliente.proyecto || '', nit: '' };
    CLIENTES.push(nuevoCliente);
    sb.from('clientes').upsert({ nombre: nuevoCliente.nombre, datos: nuevoCliente }, { onConflict: 'nombre' })
      .then(({ error }) => { if (error) console.warn('Cliente no guardado:', error.message); });
  }

  // Guardar en Supabase
  sb.from('cotizaciones').upsert({
    numero: cot.numero,
    version: cot.version,
    estado: cot.estado,
    cliente: cot.cliente,
    items: cot.items,
    condiciones: cot.condiciones,
    datos: cot,
    modificado: new Date().toISOString()
  }, { onConflict: 'numero,version' }).then(({ error }) => {
    if (error) alert(`✅ Cotización ${num} ${cot.version} guardada.\n⚠️ Error al sincronizar: ${error.message}`);
    else alert(`✅ Cotización ${num} ${cot.version} guardada y sincronizada.`);
  });

  document.getElementById('num-cot').value = '';
  document.getElementById('display-num-cot').textContent = '—';
  document.getElementById('sugerencia-num').textContent = '— Último usado: ' + num;
}

function cargarCotizacion(id) {
  const cot = COTIZACIONES.find(c => c.id === id);
  if (!cot) return;
  const versiones = COTIZACIONES.filter(c => c.numero === cot.numero);
  const maxVer = versiones.reduce((max, c) => {
    const n = parseInt((c.version || 'V1').replace(/\D/g, '')) || 1;
    return Math.max(max, n);
  }, 1);
  const nuevaVersion = 'V' + (maxVer + 1);
  if (!confirm(`¿Editar la cotización ${cot.numero}?\n\nSe creará la versión ${nuevaVersion}. La ${cot.version || 'V1'} actual quedará guardada en el histórico.`)) return;
  document.getElementById('num-cot').value = cot.numero;
  document.getElementById('display-num-cot').textContent = cot.numero;
  document.getElementById('version-cot').value = nuevaVersion;
  document.getElementById('fecha-cot').value = new Date().toISOString().split('T')[0];
  document.getElementById('cliente-nombre').value = cot.cliente.nombre;
  document.getElementById('cliente-contacto').value = cot.cliente.contacto;
  document.getElementById('cliente-cel').value = cot.cliente.cel;
  document.getElementById('cliente-proyecto').value = cot.cliente.proyecto;
  document.getElementById('destino-transporte').value = cot.transporte.destino || '';
  document.getElementById('tarifa-manual').value = cot.transporte.tarifaManual || 0;
  document.getElementById('destino-otro-nombre').value = cot.transporte.destinoNombre || '';
  document.getElementById('bloque-otro-transporte').style.display = cot.transporte.destino === 'Otro' ? 'block' : 'none';
  document.getElementById('cargue-mano').value = cot.cargue || 'no';
  document.getElementById('descargue-mecanico').value = cot.descargue || 'no';
  document.getElementById('desc-transporte').value = cot.descuentos?.transporte || 0;
  document.getElementById('desc-cargue').value = cot.descuentos?.cargue || 0;
  document.getElementById('desc-descargue').value = cot.descuentos?.descargue || 0;
  document.getElementById('forma-pago').value = cot.condiciones.pago;
  document.getElementById('tiempo-entrega').value = cot.condiciones.entrega;
  document.getElementById('validez').value = cot.condiciones.validez;
  document.getElementById('vendedor-nombre').value = cot.vendedor.nombre;
  document.getElementById('vendedor-cargo').value = cot.vendedor.cargo;
  itemsActuales = JSON.parse(JSON.stringify(cot.items));
  renderItems();
  actualizarCargue();
  cargarOpcionesExtraDesde(cot);
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  document.getElementById('pantalla-nueva-cotizacion').classList.add('activa');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('activo'));
  document.querySelectorAll('.nav-btn')[0].classList.add('activo');
}

function limpiarFormulario() {
  if (!confirm('¿Limpiar el formulario actual?')) return;
  itemsActuales = [];
  document.getElementById('cliente-nombre').value = '';
  document.getElementById('cliente-contacto').value = '';
  document.getElementById('cliente-cel').value = '';
  document.getElementById('cliente-proyecto').value = '';
  document.getElementById('destino-transporte').value = '';
  document.getElementById('tarifa-manual').value = 0;
  document.getElementById('destino-otro-nombre').value = '';
  document.getElementById('bloque-otro-transporte').style.display = 'none';
  document.getElementById('desc-transporte').value = 0;
  document.getElementById('cargue-mano').value = 'no';
  document.getElementById('desc-cargue').value = 0;
  document.getElementById('descargue-mecanico').value = 'no';
  document.getElementById('desc-descargue').value = 0;
  opcionesExtra = [];
  renderOpcionesExtra();
  document.getElementById('num-cot').value = '';
  document.getElementById('display-num-cot').textContent = '—';
  document.getElementById('sugerencia-num').textContent = COTIZACIONES.length ? '— Último usado: ' + COTIZACIONES.reduce((a,b) => (parseInt(a.numero.replace(/\D/g,''))||0) > (parseInt(b.numero.replace(/\D/g,''))||0) ? a : b).numero : '';
  document.getElementById('fecha-cot').value = new Date().toISOString().split('T')[0];
  const perfil = USUARIOS_CRM[USUARIO_ACTUAL?.email];
  if (perfil) {
    document.getElementById('vendedor-nombre').value = perfil.nombre;
    document.getElementById('vendedor-cargo').value = perfil.cargo;
  }
  renderItems();
}

// ═══════════════════════════════
// PREVISUALIZACIÓN / PDF
// ═══════════════════════════════
function previsualizarCotizacionById(id) {
  const cot = COTIZACIONES.find(c => c.id === id);
  if (!cot) return;
  // Cargar en el formulario temporalmente solo para previsualizar
  document.getElementById('num-cot').value = cot.numero;
  document.getElementById('version-cot').value = cot.version || 'V1';
  document.getElementById('fecha-cot').value = cot.fecha;
  document.getElementById('cliente-nombre').value = cot.cliente.nombre;
  document.getElementById('cliente-contacto').value = cot.cliente.contacto;
  document.getElementById('cliente-cel').value = cot.cliente.cel;
  document.getElementById('cliente-proyecto').value = cot.cliente.proyecto;
  document.getElementById('destino-transporte').value = cot.transporte.destino || '';
  document.getElementById('tarifa-manual').value = cot.transporte.tarifaManual || 0;
  document.getElementById('destino-otro-nombre').value = cot.transporte.destinoNombre || '';
  document.getElementById('bloque-otro-transporte').style.display = cot.transporte.destino === 'Otro' ? 'block' : 'none';
  document.getElementById('cargue-mano').value = cot.cargue || 'no';
  document.getElementById('descargue-mecanico').value = cot.descargue || 'no';
  document.getElementById('desc-transporte').value = cot.descuentos?.transporte || 0;
  document.getElementById('desc-cargue').value = cot.descuentos?.cargue || 0;
  document.getElementById('desc-descargue').value = cot.descuentos?.descargue || 0;
  document.getElementById('forma-pago').value = cot.condiciones.pago;
  document.getElementById('tiempo-entrega').value = cot.condiciones.entrega;
  document.getElementById('validez').value = cot.condiciones.validez;
  document.getElementById('vendedor-nombre').value = cot.vendedor.nombre;
  document.getElementById('vendedor-cargo').value = cot.vendedor.cargo;
  itemsActuales = JSON.parse(JSON.stringify(cot.items));
  renderItems();
  cargarOpcionesExtraDesde(cot);
  previsualizarCotizacion();
}

function previsualizarCotizacion() {
  const num = document.getElementById('num-cot').value.trim().toUpperCase();
  if (!num) {
    alert('⚠️ Asigna un número de cotización antes de previsualizar.');
    document.getElementById('num-cot').focus();
    return;
  }
  if (!document.getElementById('cliente-proyecto').value.trim()) {
    alert('⚠️ Debes ingresar la ciudad / proyecto antes de previsualizar.');
    document.getElementById('cliente-proyecto').focus();
    return;
  }
  const fecha = new Date(document.getElementById('fecha-cot').value + 'T12:00:00');
  const fechaStr = fecha.toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });
  const cliente = {
    nombre: document.getElementById('cliente-nombre').value || '—',
    contacto: document.getElementById('cliente-contacto').value,
    cel: document.getElementById('cliente-cel').value,
    proyecto: document.getElementById('cliente-proyecto').value,
  };

  // Construir todas las opciones (Opción 1 desde el formulario + adicionales)
  const opcionesPDF = [
    {
      items: itemsActuales,
      destino: document.getElementById('destino-transporte').value,
      descTrans: parseFloat(document.getElementById('desc-transporte')?.value) || 0,
      cargue: document.getElementById('cargue-mano').value,
      descCargue: parseFloat(document.getElementById('desc-cargue')?.value) || 0,
      descargue: document.getElementById('descargue-mecanico').value,
      descDescargue: parseFloat(document.getElementById('desc-descargue')?.value) || 0,
      tarifaManual: parseFloat(document.getElementById('tarifa-manual')?.value) || 0,
      destinoNombre: document.getElementById('destino-otro-nombre')?.value || ''
    },
    ...opcionesExtra
  ];
  const multiOp = opcionesPDF.length > 1;
  let tablasHTML = '';
  let hayTransporte = false;
  const totalesOpciones = [];
  opcionesPDF.forEach((op, i) => {
    const r = construirTablaCotizacion(op.items, op.destino, op.descTrans, op.cargue, op.descCargue, op.descargue, op.descDescargue, op.tarifaManual, op.destinoNombre);
    if (r.transporte > 0) hayTransporte = true;
    totalesOpciones.push(r.total);
    if (multiOp) tablasHTML += `<div style="background:#003F7F;color:#fff;padding:7px 12px;font-weight:700;font-size:13px;border-radius:4px;margin:${i === 0 ? '4' : '20'}px 0 6px;display:flex;justify-content:space-between"><span>OPCIÓN ${i + 1}</span><span>TOTAL: $ ${r.total.toLocaleString()}</span></div>`;
    tablasHTML += r.html;
  });
  // Resumen comparativo cuando hay varias opciones
  let resumenOpciones = '';
  if (multiOp) {
    const menor = Math.min(...totalesOpciones);
    resumenOpciones = `<div style="border:1px solid #BFDBFE;background:#F8FBFF;border-radius:6px;padding:10px 12px;margin-bottom:10px;font-size:12px">
      <strong style="color:#003F7F">Esta propuesta incluye ${opcionesPDF.length} opciones para su evaluación:</strong>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px">
        ${totalesOpciones.map((t, i) => `<span>Opción ${i + 1}: <strong>$ ${t.toLocaleString()}</strong>${t === menor ? ' <span style="color:#2E7D32;font-weight:700">(menor valor)</span>' : ''}</span>`).join('')}
      </div>
    </div>`;
  }

  const html = `
    <div class="no-print" style="background:#1C2333;color:white;padding:12px 24px;display:flex;align-items:center;gap:16px">
      <span style="font-weight:700">Vista previa — Cotización ${num}</span>
      <div style="flex:1"></div>
      <button onclick="descargarPDF('${num}')" style="background:#1976D2;color:white;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-weight:700">⬇️ Descargar PDF</button>
      <button onclick="document.getElementById('vista-previa').style.display='none';document.getElementById('pantalla-nueva-cotizacion').classList.add('activa')" style="background:#555;color:white;border:none;padding:8px 14px;border-radius:5px;cursor:pointer">← Volver</button>
    </div>
    <div class="preview-doc" id="pdf-documento">
      <!-- Cabecera membrete -->
      <div class="preview-membrete-header">
        <img src="membrete-top.jpg" alt="">
      </div>

      <!-- Cuerpo del documento -->
      <div class="preview-content">
        <div class="preview-header">
          <div class="preview-cod">
            <div style="color:#003F7F;font-weight:700;font-size:15px">COTIZACIÓN N°${num}</div>
            <div style="color:#1565C0;font-weight:600;font-size:12px">VERSIÓN N°${document.getElementById('version-cot').value}</div>
            <div style="font-size:11px;color:#555;margin-top:2px">Chinchiná, ${fechaStr}</div>
          </div>
        </div>
        <div class="preview-cliente-box">
          <div style="font-size:12px;color:#555">Señores</div>
          <div style="font-weight:700;font-size:15px;color:#1a1a1a">${cliente.nombre}</div>
          ${cliente.contacto ? `<div style="font-size:12px">Atte. ${cliente.contacto}</div>` : ''}
          ${cliente.cel ? `<div style="font-size:12px">Cel: ${cliente.cel}</div>` : ''}
          ${cliente.ciudad ? `<div style="font-size:12px">${cliente.ciudad}</div>` : ''}
        </div>
        <div class="preview-intro">
          Cordial Saludo<br><br>
          Atendiendo su solicitud, a continuación, hacemos entrega de la cotización de suministro de prefabricados en concreto${cliente.proyecto ? `, requeridos para el proyecto <strong>${cliente.proyecto}</strong>` : ''}, así:
        </div>
        ${resumenOpciones}
        ${tablasHTML}
        <div class="preview-aclaraciones">
          <h4>ACLARACIONES IMPORTANTES SOBRE LA PROPUESTA</h4>
          <ul>
            <li><strong>FORMA DE PAGO:</strong> ${document.getElementById('forma-pago').value}</li>
            <li><strong>TIEMPO DE ENTREGA:</strong> ${document.getElementById('tiempo-entrega').value}</li>
            <li><strong>VALIDEZ DE LA OFERTA:</strong> ${document.getElementById('validez').value}</li>
            ${hayTransporte ? `
            <li>Esta propuesta incluye transporte hasta el sitio de la obra en camión tipo planchón de 10 TON de capacidad de carga. El valor del transporte no está considerado en el precio del producto, por lo que deberá ser calculado de acuerdo con el peso unitario y a la cantidad requerida. El material será entregado en obra en plataforma de camión hasta el sitio con acceso a criterio del conductor. <strong>NO INCLUYE DESCARGUE.</strong></li>
            <li>El tiempo estipulado para el recibo y la descarga del material es de 120 minutos; las demoras por hora o fracción serán facturadas a <strong>$50.000 más IVA</strong>.</li>
            <li>Se ofrece la opción de descargue mecánico con grúa, la cual está sujeta a disponibilidad de vehículo. El valor del descargue no está considerado en el precio del producto, por lo que deberá ser calculado de acuerdo al peso unitario y a la cantidad requerida. De aceptar esta opción, se requiere de un espacio <strong>SIN PENDIENTE</strong> y abierto en el sitio de recepción de 6m por 12m. Se requiere también de una persona de obra quien apoye la actividad de descargue enganchando la estiba en plataforma para el izaje y descargue.</li>
            <li>De no tomar la opción de transporte, el material será entregado en planta en plataforma de camión y solo se permite el cargue en camión tipo planchón sin carpa ni obstrucciones laterales para cargue con montacargas. De no tener esta opción de vehículo, se permite el ingreso de personal para el cargue de manera manual siempre y cuando el personal esté debidamente afiliado a la seguridad social correspondiente; de lo contrario, se ofrece el servicio de cargue manual en planta y será cobrado a <strong>$11.000 por tonelada</strong>.</li>
            <li>El material es entregado en estibas. De ser descargado en las mismas, es responsabilidad de la obra devolverlas en buen estado; de lo contrario, pasado 1 mes se procederá a su facturación (<strong>$20.000 más IVA por unidad</strong>).</li>
            ` : `
            <li>El material será entregado en planta en plataforma de camión y solo se permite el cargue en camión tipo planchón sin carpa ni obstrucciones laterales para cargue con montacargas. De no tener esta opción de vehículo, se permite el ingreso de personal para el cargue de manera manual siempre y cuando el personal esté debidamente afiliado a la seguridad social correspondiente; de lo contrario, se ofrece el servicio de cargue manual en planta y será cobrado a <strong>$11.000 por tonelada</strong>.</li>
            `}
            <li>Los productos fabricados son a la medida y requerimientos del cliente. Por tal razón, Proconcreto no recibe devoluciones de material de lo pedido por el cliente.</li>
            <li>La propuesta ofrecida por Proconcreto incluye la fabricación de lo especificado en la presente cotización. La fabricación estará determinada por las especificaciones dadas; si existiera alguna especificación adicional, esta se atenderá previo estudio por el Departamento de Ingeniería de Proconcreto y con el ajuste en precio y condiciones de entrega de los elementos que resulten afectados.</li>
            <li>Proconcreto se responsabiliza por el diseño y comportamiento de los elementos prefabricados ofrecidos en la presente cotización. El diseño, formaletería y comportamiento de la estructura que soporte estos elementos y lo que ella afecte es responsabilidad del cliente.</li>
          </ul>
        </div>
        <div style="font-size:12px;margin-bottom:16px">Agradecemos se nos haya tenido en cuenta para su proyecto. Cualquier inquietud con gusto será atendida por nuestro Departamento de Ingeniería.</div>
        <div style="font-size:12px">Cordialmente,</div>
        <div class="preview-firma">
          <div style="border-top:1px solid #333;width:260px;padding-top:6px;margin-top:32px">
            <div style="font-weight:700;font-size:13px">${document.getElementById('vendedor-nombre').value}</div>
            <div style="font-size:11px;color:#555">${document.getElementById('vendedor-cargo').value}</div>
            ${(()=>{ const p = USUARIOS_CRM[USUARIO_ACTUAL?.email]; return p ? `<div style="font-size:11px;color:#555">${p.cel}</div><div style="font-size:11px;color:#555">${USUARIO_ACTUAL.email}</div>` : ''; })()}
          </div>
        </div>
      </div>

      <!-- Pie membrete -->
      <div class="preview-membrete-footer">
        <div class="pf-arco"></div>
        <div class="pf-datos">
          <div class="pf-col"><span class="pf-icon">📞</span><span>+57 (6) 887 3839<br>+57 (6) 887 5246</span></div>
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
