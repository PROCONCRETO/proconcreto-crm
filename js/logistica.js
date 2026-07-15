// ═══════════════════════════════
// LOGÍSTICA — PROGRAMACIÓN DE DESPACHOS (CALENDARIO)
// ═══════════════════════════════
// Un despacho es un viaje: un vehículo, una fecha, un destino general (ej. Manizales).
// Dentro de un mismo despacho puede haber varios clientes (para aprovechar la capacidad
// del camión en un mismo viaje), y cada cliente puede llevar varios productos.
let DESPACHOS = [];

// ── Festivos de Colombia ──
// 18 festivos/año: fijos, ligados a Semana Santa (no se trasladan) y los que la
// Ley Emiliani (Ley 51 de 1983) traslada al lunes siguiente cuando no caen en lunes.
// Se calculan en vivo (no se hardcodean) porque cambian de fecha cada año.
function _pascuaColombia(anio) {
  // Algoritmo de Meeus/Jones/Butcher (Domingo de Pascua, calendario gregoriano)
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

function _sumarDias(fecha, dias) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

function _siguienteLunes(fecha) {
  const d = new Date(fecha);
  const diff = (8 - d.getDay()) % 7; // 0 si ya es lunes
  d.setDate(d.getDate() + diff);
  return d;
}

function _fmtISO(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

let _cacheFestivos = {};
function festivosColombia(anio) {
  if (_cacheFestivos[anio]) return _cacheFestivos[anio];
  const pascua = _pascuaColombia(anio);
  const festivos = [];
  const agregar = (fecha, nombre) => festivos.push({ fecha: _fmtISO(fecha), nombre });

  // Fijos — no se trasladan
  agregar(new Date(anio, 0, 1), 'Año Nuevo');
  agregar(new Date(anio, 4, 1), 'Día del Trabajo');
  agregar(new Date(anio, 6, 20), 'Día de la Independencia');
  agregar(new Date(anio, 7, 7), 'Batalla de Boyacá');
  agregar(new Date(anio, 11, 8), 'Inmaculada Concepción');
  agregar(new Date(anio, 11, 25), 'Navidad');

  // Semana Santa — ligados a Pascua, no se trasladan (siempre jueves/viernes)
  agregar(_sumarDias(pascua, -3), 'Jueves Santo');
  agregar(_sumarDias(pascua, -2), 'Viernes Santo');

  // Ley Emiliani — fecha fija, trasladada al lunes siguiente
  agregar(_siguienteLunes(new Date(anio, 0, 6)), 'Reyes Magos');
  agregar(_siguienteLunes(new Date(anio, 2, 19)), 'San José');
  agregar(_siguienteLunes(new Date(anio, 5, 29)), 'San Pedro y San Pablo');
  agregar(_siguienteLunes(new Date(anio, 7, 15)), 'Asunción de la Virgen');
  agregar(_siguienteLunes(new Date(anio, 9, 12)), 'Día de la Raza');
  agregar(_siguienteLunes(new Date(anio, 10, 1)), 'Todos los Santos');
  agregar(_siguienteLunes(new Date(anio, 10, 11)), 'Independencia de Cartagena');

  // Ley Emiliani — ligados a Pascua, trasladados al lunes siguiente
  agregar(_siguienteLunes(_sumarDias(pascua, 39)), 'Ascensión del Señor');
  agregar(_siguienteLunes(_sumarDias(pascua, 60)), 'Corpus Christi');
  agregar(_siguienteLunes(_sumarDias(pascua, 68)), 'Sagrado Corazón de Jesús');

  festivos.sort((x, y) => x.fecha.localeCompare(y.fecha));
  _cacheFestivos[anio] = festivos;
  return festivos;
}

// ── Calendario ──
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const COLOR_VEHICULO_ENTREGA = {
  'GTV044 / JORGE JAMES ALVAREZ': '#1565C0',
  'GTU668 / JOSE RAMIRO CIRO': '#00838F',
  'CAMION SENCILLO / TERCERIZADO': '#E65100',
  'TRACTO CAMION / TERCERIZADO': '#6A1B9A',
};
// Capacidad de carga por vehículo (toneladas), para poder avisar cuando un despacho la supera.
const CAPACIDAD_VEHICULO = {
  'GTV044 / JORGE JAMES ALVAREZ': 11,
  'GTU668 / JOSE RAMIRO CIRO': 11,
  'CAMION SENCILLO / TERCERIZADO': 11,
  'TRACTO CAMION / TERCERIZADO': 34,
};

const _hoyIni = new Date();
let _logAnio = _hoyIni.getFullYear();
let _logMes = _hoyIni.getMonth(); // 0-indexado

function cambiarMesLogistica(delta) {
  _logMes += delta;
  if (_logMes < 0) { _logMes = 11; _logAnio--; }
  if (_logMes > 11) { _logMes = 0; _logAnio++; }
  renderCalendarioLogistica();
}

function irHoyLogistica() {
  const hoy = new Date();
  _logAnio = hoy.getFullYear();
  _logMes = hoy.getMonth();
  renderCalendarioLogistica();
}

function renderCalendarioLogistica() {
  const cont = document.getElementById('log-calendario');
  if (!cont) return;
  const titulo = document.getElementById('log-mes-titulo');
  if (titulo) titulo.textContent = `${MESES_ES[_logMes]} ${_logAnio}`;

  const festivosMap = {};
  festivosColombia(_logAnio).forEach(f => { festivosMap[f.fecha] = f.nombre; });
  // Diciembre/enero cruzan de año — aseguramos que los festivos del año vecino también estén disponibles.
  if (_logMes === 0) festivosColombia(_logAnio - 1).forEach(f => { festivosMap[f.fecha] = f.nombre; });
  if (_logMes === 11) festivosColombia(_logAnio + 1).forEach(f => { festivosMap[f.fecha] = f.nombre; });

  const primerDia = new Date(_logAnio, _logMes, 1);
  const diasEnMes = new Date(_logAnio, _logMes + 1, 0).getDate();
  const inicioSemana = primerDia.getDay();
  const hoyStr = _fmtISO(new Date());

  let celdas = '';
  for (let i = 0; i < inicioSemana; i++) celdas += `<div class="log-cal-celda log-cal-vacia"></div>`;

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fechaObj = new Date(_logAnio, _logMes, dia);
    const fechaStr = _fmtISO(fechaObj);
    const dow = fechaObj.getDay();
    const festivoNombre = festivosMap[fechaStr];
    const esHoy = fechaStr === hoyStr;
    const despachosDia = DESPACHOS.filter(d => d.fecha === fechaStr);

    let clases = 'log-cal-celda';
    if (festivoNombre) clases += ' log-cal-festivo';
    else if (dow === 0 || dow === 6) clases += ' log-cal-finde';
    if (esHoy) clases += ' log-cal-hoy';

    celdas += `
      <div class="${clases}" onclick="abrirModalDespacho('${fechaStr}')">
        <div class="log-cal-dia-num">${dia}${esHoy ? ' <span class="log-cal-hoy-badge">HOY</span>' : ''}</div>
        ${festivoNombre ? `<div class="log-cal-festivo-nombre" title="${festivoNombre}">🎉 ${festivoNombre}</div>` : ''}
        <div class="log-cal-entregas">
          ${despachosDia.map(d => {
            const nClientes = (d.clientes || []).length;
            const peso = Number(d.pesoTotal) || 0;
            const tituloTip = `${d.destino || ''}${d.vehiculo ? ' — ' + d.vehiculo : ''} — ${nClientes} cliente${nClientes === 1 ? '' : 's'} — ${peso.toFixed(2)} ton${d.estado ? ' — ' + d.estado : ''}`;
            return `
            <div class="log-cal-entrega" style="background:${COLOR_VEHICULO_ENTREGA[d.vehiculo] || '#607D8B'}${d.estado === 'Cancelada' ? ';opacity:.5;text-decoration:line-through' : ''}" onclick="event.stopPropagation();editarDespacho('${d.id}')" title="${tituloTip}">
              ${d.destino || 'Despacho'} · ${nClientes} cli · ${peso.toFixed(1)}t
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  const totalCeldas = inicioSemana + diasEnMes;
  const restante = (7 - (totalCeldas % 7)) % 7;
  for (let i = 0; i < restante; i++) celdas += `<div class="log-cal-celda log-cal-vacia"></div>`;

  cont.innerHTML = `
    <div class="log-cal-grid">${DIAS_SEMANA_ES.map(d => `<div class="log-cal-dia-nombre">${d}</div>`).join('')}</div>
    <div class="log-cal-grid">${celdas}</div>`;
}

// ── Modal de Despacho ──
// Cada cliente del despacho lleva su propia lista de productos; el peso de cada línea se
// calcula con el mismo catálogo de Productos (cantidad × peso por unidad), y el peso total
// del despacho es la suma de todas las líneas de todos los clientes. Reutiliza los mismos
// helpers de búsqueda de cliente/producto que Ajuste Diario de Mezcla.
let _clientesDespachoActual = [];

function _lineaVaciaDespacho() { return { producto: '', cantidad: 0, peso: 0 }; }
function _clienteVacioDespacho() { return { cliente: '', destino: '', productos: [_lineaVaciaDespacho()] }; }

function renderClientesDespacho() {
  const wrap = document.getElementById('despacho-clientes-wrap');
  if (!wrap) return;
  wrap.innerHTML = _clientesDespachoActual.map((c, ci) => `
    <div class="card" style="padding:12px;margin-bottom:10px;background:#FAFBFC;box-shadow:none;border:1px solid var(--gris-borde)">
      <div class="form-grid" style="margin-bottom:8px">
        <div class="form-grupo"><label>Cliente</label><input type="text" value="${c.cliente || ''}" list="datalist-clientes-despacho" oninput="_clientesDespachoActual[${ci}].cliente=this.value" placeholder="Busca un cliente existente..."></div>
        <div class="form-grupo"><label>Destino específico / Proyecto</label><input type="text" value="${c.destino || ''}" oninput="_clientesDespachoActual[${ci}].destino=this.value" placeholder="Ej: Proyecto Villa 86"></div>
      </div>
      <table class="tabla-items" style="width:100%;margin-bottom:6px">
        <thead><tr><th>Producto</th><th style="width:90px">Cantidad</th><th style="width:110px">Peso</th><th style="width:32px"></th></tr></thead>
        <tbody>
          ${c.productos.map((p, pi) => `
            <tr>
              <td><input type="text" value="${p.producto || ''}" list="datalist-productos-despacho" oninput="_actualizarProductoDespacho(${ci},${pi},'producto',this.value)" placeholder="Busca por código o nombre..."></td>
              <td><input type="number" min="0" step="1" value="${p.cantidad || ''}" oninput="_actualizarProductoDespacho(${ci},${pi},'cantidad',this.value)"></td>
              <td id="despacho-peso-${ci}-${pi}" style="font-size:11px;color:var(--gris-medio);white-space:nowrap">${p.peso ? p.peso.toFixed(2) + ' ton' : '—'}</td>
              <td><button type="button" class="btn btn-rojo btn-xs" onclick="eliminarProductoDespacho(${ci},${pi})">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="flex-gap" style="justify-content:space-between">
        <button type="button" class="btn btn-secundario btn-xs" onclick="agregarProductoDespacho(${ci})">+ Agregar producto</button>
        <button type="button" class="btn btn-rojo btn-xs" onclick="eliminarClienteDespacho(${ci})">🗑️ Quitar cliente</button>
      </div>
    </div>`).join('');
  if (typeof poblarDatalistClientes === 'function') poblarDatalistClientes('datalist-clientes-despacho');
  if (typeof poblarDatalistProductos === 'function') poblarDatalistProductos('datalist-productos-despacho');
  actualizarPesoTotalDespacho();
}

function agregarClienteDespacho() {
  _clientesDespachoActual.push(_clienteVacioDespacho());
  renderClientesDespacho();
}

function eliminarClienteDespacho(ci) {
  _clientesDespachoActual.splice(ci, 1);
  if (!_clientesDespachoActual.length) _clientesDespachoActual.push(_clienteVacioDespacho());
  renderClientesDespacho();
}

function agregarProductoDespacho(ci) {
  _clientesDespachoActual[ci].productos.push(_lineaVaciaDespacho());
  renderClientesDespacho();
}

function eliminarProductoDespacho(ci, pi) {
  const productos = _clientesDespachoActual[ci].productos;
  productos.splice(pi, 1);
  if (!productos.length) productos.push(_lineaVaciaDespacho());
  renderClientesDespacho();
}

// Recalcula solo la celda de peso de esa línea y el total — no vuelve a pintar todo el
// formulario, para no perder el foco mientras se está escribiendo.
function _actualizarProductoDespacho(ci, pi, campo, valor) {
  const p = _clientesDespachoActual[ci].productos[pi];
  if (campo === 'cantidad') p.cantidad = parseFloat(valor) || 0;
  else p.producto = valor;
  const prodCat = typeof _productoDesdeTextoAjuste === 'function' ? _productoDesdeTextoAjuste(p.producto) : null;
  const pesoUnitario = prodCat ? (Number(prodCat.peso) || 0) : 0;
  p.peso = (p.cantidad * pesoUnitario) / 1000;
  const celda = document.getElementById(`despacho-peso-${ci}-${pi}`);
  if (celda) celda.textContent = p.peso ? p.peso.toFixed(2) + ' ton' : (p.cantidad ? 'sin catálogo' : '—');
  actualizarPesoTotalDespacho();
}

function actualizarPesoTotalDespacho() {
  const total = _clientesDespachoActual.reduce((s, c) => s + c.productos.reduce((s2, p) => s2 + (Number(p.peso) || 0), 0), 0);
  const el = document.getElementById('despacho-peso-total');
  if (el) {
    const capacidad = CAPACIDAD_VEHICULO[document.getElementById('m-despacho-vehiculo')?.value];
    const excedido = capacidad && total > capacidad;
    el.textContent = capacidad ? `${total.toFixed(2)} / ${capacidad} ton` : `${total.toFixed(2)} ton`;
    el.style.color = excedido ? '#C62828' : 'var(--azul)';
    el.title = excedido ? `Supera la capacidad del vehículo seleccionado (${capacidad} ton)` : '';
  }
  return total;
}

function abrirModalDespacho(fecha) {
  document.getElementById('m-despacho-id').value = '';
  document.getElementById('modal-despacho-titulo').textContent = '🚛 Nuevo Despacho';
  document.getElementById('m-despacho-fecha').value = fecha || _fmtISO(new Date());
  document.getElementById('m-despacho-destino').value = '';
  document.getElementById('m-despacho-vehiculo').value = 'GTV044 / JORGE JAMES ALVAREZ';
  document.getElementById('m-despacho-estado').value = 'Programada';
  document.getElementById('m-despacho-obs').value = '';
  document.getElementById('btn-eliminar-despacho').style.display = 'none';
  _clientesDespachoActual = [_clienteVacioDespacho()];
  renderClientesDespacho();
  document.getElementById('modal-despacho').classList.add('abierto');
}

function editarDespacho(id) {
  const d = DESPACHOS.find(x => String(x.id) === String(id));
  if (!d) return;
  document.getElementById('m-despacho-id').value = d.id;
  document.getElementById('modal-despacho-titulo').textContent = '✏️ Editar Despacho';
  document.getElementById('m-despacho-fecha').value = d.fecha || '';
  document.getElementById('m-despacho-destino').value = d.destino || '';
  document.getElementById('m-despacho-vehiculo').value = d.vehiculo || 'GTV044 / JORGE JAMES ALVAREZ';
  document.getElementById('m-despacho-estado').value = d.estado || 'Programada';
  document.getElementById('m-despacho-obs').value = d.observaciones || '';
  document.getElementById('btn-eliminar-despacho').style.display = 'inline-flex';
  // El peso de cada línea queda congelado con lo que se guardó en su momento — no se
  // recalcula en vivo contra el catálogo actual (mismo criterio que los Ajustes de Mezcla:
  // un despacho ya programado no debe cambiar solo porque un producto se actualizó después).
  _clientesDespachoActual = JSON.parse(JSON.stringify((d.clientes && d.clientes.length) ? d.clientes : [_clienteVacioDespacho()]));
  _clientesDespachoActual.forEach(c => { if (!c.productos || !c.productos.length) c.productos = [_lineaVaciaDespacho()]; });
  renderClientesDespacho();
  document.getElementById('modal-despacho').classList.add('abierto');
}

function guardarDespacho() {
  const fecha = document.getElementById('m-despacho-fecha').value;
  const destino = document.getElementById('m-despacho-destino').value.trim();
  if (!fecha || !destino) { alert('Completa los campos obligatorios: Fecha y Destino.'); return; }

  const clientesLimpios = _clientesDespachoActual
    .map(c => ({
      cliente: (c.cliente || '').trim(),
      destino: (c.destino || '').trim(),
      productos: (c.productos || [])
        .filter(p => (p.producto || '').trim())
        .map(p => ({ producto: p.producto.trim(), cantidad: Number(p.cantidad) || 0, peso: Number(p.peso) || 0 })),
    }))
    .filter(c => c.cliente || c.productos.length);

  if (!clientesLimpios.length) { alert('Agrega al menos un cliente con un producto.'); return; }
  for (const c of clientesLimpios) {
    if (c.cliente && typeof _clienteValidoAjuste === 'function' && !_clienteValidoAjuste(c.cliente)) {
      alert(`El cliente "${c.cliente}" no existe en la base de datos de Cotizaciones y Ventas.\nCréalo allá primero, o selecciona uno existente de la lista.`);
      return;
    }
  }

  const editId = document.getElementById('m-despacho-id').value;
  const previo = editId ? DESPACHOS.find(x => String(x.id) === String(editId)) : null;
  const pesoTotal = clientesLimpios.reduce((s, c) => s + c.productos.reduce((s2, p) => s2 + p.peso, 0), 0);
  const despacho = {
    id: editId || String(Date.now()),
    fecha,
    destino,
    vehiculo: document.getElementById('m-despacho-vehiculo').value,
    estado: document.getElementById('m-despacho-estado').value,
    observaciones: document.getElementById('m-despacho-obs').value.trim(),
    clientes: clientesLimpios,
    pesoTotal,
    creadoPor: previo ? previo.creadoPor : USUARIO_ACTUAL?.email,
    creadoEn: previo ? (previo.creadoEn || new Date().toISOString()) : new Date().toISOString(),
  };
  const idx = DESPACHOS.findIndex(x => String(x.id) === String(despacho.id));
  if (idx >= 0) DESPACHOS[idx] = despacho; else DESPACHOS.unshift(despacho);
  sb.from('entregas_programadas').upsert({ id: despacho.id, datos: despacho, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) console.error('Error guardando despacho:', error.message); });
  cerrarModal('modal-despacho');
  renderCalendarioLogistica();
}

function eliminarDespacho() {
  const id = document.getElementById('m-despacho-id').value;
  const d = DESPACHOS.find(x => String(x.id) === String(id));
  if (!d || !confirm(`¿Eliminar el despacho del ${d.fecha}${d.destino ? ' — ' + d.destino : ''}?`)) return;
  DESPACHOS = DESPACHOS.filter(x => String(x.id) !== String(id));
  cerrarModal('modal-despacho');
  renderCalendarioLogistica();
  sb.from('entregas_programadas').delete().eq('id', id)
    .then(({ error }) => {
      if (error) { console.error('Error eliminando despacho:', error.message); alert('Error al eliminar: ' + error.message); DESPACHOS.push(d); renderCalendarioLogistica(); }
    });
}
