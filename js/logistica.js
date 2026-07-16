// ═══════════════════════════════
// LOGÍSTICA — PROGRAMACIÓN DE VIAJES (CALENDARIO)
// ═══════════════════════════════
// Un viaje es una salida de camión de planta: un vehículo, una fecha, un destino general
// (ej. Manizales), con la capacidad del camión en peso. Dentro de un mismo viaje puede haber
// varias entregas — una entrega puede ser el viaje completo para un cliente, o una porción de
// él si el camión se completa con otra(s) entrega(s) para otro(s) cliente(s). Cada entrega
// puede llevar varios productos.
//
// Compatibilidad: los viajes guardados antes de este cambio tienen el arreglo de entregas en
// el campo `clientes` (nombre viejo). Al leer se usa `entregas || clientes`; al guardar
// siempre se escribe en `entregas`, así que un viaje viejo se migra solo la próxima vez que se edite.
let VIAJES = [];

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
const COLOR_VEHICULO_VIAJE = {
  'GTV044 / JORGE JAMES ALVAREZ': '#1565C0',
  'GTU668 / JOSE RAMIRO CIRO': '#00838F',
  'CAMION SENCILLO / TERCERIZADO': '#E65100',
  'TRACTO CAMION / TERCERIZADO': '#6A1B9A',
};
// Capacidad de carga por vehículo (toneladas), para poder avisar cuando un viaje la supera.
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
    const viajesDia = VIAJES.filter(v => v.fecha === fechaStr);

    let clases = 'log-cal-celda';
    if (festivoNombre) clases += ' log-cal-festivo';
    else if (dow === 0 || dow === 6) clases += ' log-cal-finde';
    if (esHoy) clases += ' log-cal-hoy';

    celdas += `
      <div class="${clases}" onclick="abrirModalViaje('${fechaStr}')">
        <div class="log-cal-dia-num">${dia}${esHoy ? ' <span class="log-cal-hoy-badge">HOY</span>' : ''}${viajesDia.length ? `<span onclick="event.stopPropagation();imprimirProgramacionDia('${fechaStr}')" title="Imprimir programación del día" style="float:right;cursor:pointer">🖨️</span>` : ''}</div>
        ${festivoNombre ? `<div class="log-cal-festivo-nombre" title="${festivoNombre}">🎉 ${festivoNombre}</div>` : ''}
        <div class="log-cal-viajes">
          ${viajesDia.map(v => {
            const nEntregas = (v.entregas || v.clientes || []).length;
            const peso = Number(v.pesoTotal) || 0;
            const tituloTip = `${v.destino || ''}${v.vehiculo ? ' — ' + v.vehiculo : ''} — ${nEntregas} entrega${nEntregas === 1 ? '' : 's'} — ${peso.toFixed(2)} ton${v.estado ? ' — ' + v.estado : ''}`;
            return `
            <div class="log-cal-viaje" style="background:${COLOR_VEHICULO_VIAJE[v.vehiculo] || '#607D8B'}${v.estado === 'Cancelada' ? ';opacity:.5;text-decoration:line-through' : ''}" onclick="event.stopPropagation();editarViaje('${v.id}')" title="${tituloTip}">
              ${v.destino || 'Viaje'} · ${nEntregas} ent · ${peso.toFixed(1)}t
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

// ── Modal de Viaje ──
// Cada entrega del viaje lleva su propia lista de productos; el peso de cada línea se
// calcula con el mismo catálogo de Productos (cantidad × peso por unidad), y el peso total
// del viaje es la suma de todas las líneas de todas las entregas. Reutiliza los mismos
// helpers de búsqueda de cliente/producto que Ajuste Diario de Mezcla.
let _entregasViajeActual = [];

function _lineaVaciaEntrega() { return { producto: '', cantidad: 0, peso: 0 }; }
function _entregaVaciaViaje() { return { cliente: '', destino: '', contactoObraNombre: '', contactoObraTelefono: '', productos: [_lineaVaciaEntrega()] }; }

function renderEntregasViaje() {
  const wrap = document.getElementById('viaje-entregas-wrap');
  if (!wrap) return;
  wrap.innerHTML = _entregasViajeActual.map((e, ei) => `
    <div class="card" style="padding:12px;margin-bottom:10px;background:#FAFBFC;box-shadow:none;border:1px solid var(--gris-borde)">
      <div class="form-grid" style="margin-bottom:8px">
        <div class="form-grupo"><label>Cliente</label><input type="text" value="${e.cliente || ''}" list="datalist-clientes-viaje" oninput="_entregasViajeActual[${ei}].cliente=this.value" placeholder="Busca un cliente existente..."></div>
        <div class="form-grupo"><label>Destino específico / Proyecto</label><input type="text" value="${e.destino || ''}" oninput="_entregasViajeActual[${ei}].destino=this.value" placeholder="Ej: Proyecto Villa 86"></div>
      </div>
      <div class="form-grid" style="margin-bottom:8px">
        <div class="form-grupo"><label>Contacto en obra <span style="font-weight:400;text-transform:none">(si es distinto al del cliente)</span></label><input type="text" value="${e.contactoObraNombre || ''}" oninput="_entregasViajeActual[${ei}].contactoObraNombre=this.value" placeholder="Nombre de quien recibe en obra"></div>
        <div class="form-grupo"><label>Teléfono contacto en obra</label><input type="text" value="${e.contactoObraTelefono || ''}" oninput="_entregasViajeActual[${ei}].contactoObraTelefono=this.value" placeholder="Ej: 3101234567"></div>
      </div>
      <div style="margin-bottom:6px">
        ${e.productos.map((p, pi) => `
          <div style="border:1px solid var(--gris-borde);border-radius:var(--radio);padding:8px;margin-bottom:6px;background:white">
            <div class="entrega-prod-buscador" style="position:relative;margin-bottom:6px">
              <input type="text" id="viaje-prod-input-${ei}-${pi}" value="${p.producto || ''}" title="${p.producto || ''}" oninput="filtrarProductosEntrega(${ei},${pi})" placeholder="Buscar por nombre o código..." style="width:100%;border:1px solid var(--gris-borde);border-radius:4px;padding:6px 8px;font-size:13px">
              <div id="viaje-prod-resultados-${ei}-${pi}" style="display:none;position:absolute;z-index:50;left:0;right:0;margin-top:2px;border:1.5px solid #93C5FD;border-radius:8px;background:#fff;max-height:220px;overflow-y:auto;box-shadow:var(--sombra-md)"></div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <input type="number" min="0" step="1" value="${p.cantidad || ''}" oninput="_actualizarProductoEntrega(${ei},${pi},'cantidad',this.value)" placeholder="Cantidad" style="width:100px;border:1px solid var(--gris-borde);border-radius:4px;padding:5px 7px;font-size:13px">
              <span id="viaje-peso-${ei}-${pi}" style="font-size:11px;color:var(--gris-medio);white-space:nowrap">${p.peso ? p.peso.toFixed(2) + ' ton' : '—'}</span>
              <div style="flex:1"></div>
              <button type="button" class="btn btn-rojo btn-xs" onclick="eliminarProductoEntrega(${ei},${pi})">✕</button>
            </div>
          </div>`).join('')}
      </div>
      <div class="flex-gap" style="justify-content:space-between">
        <button type="button" class="btn btn-secundario btn-xs" onclick="agregarProductoEntrega(${ei})">+ Agregar producto</button>
        <button type="button" class="btn btn-rojo btn-xs" onclick="eliminarEntregaViaje(${ei})">🗑️ Quitar entrega</button>
      </div>
    </div>`).join('');
  if (typeof poblarDatalistClientes === 'function') poblarDatalistClientes('datalist-clientes-viaje');
  actualizarPesoTotalViaje();
}

// Buscador de producto estilo "Nueva Cotización": nombre en negrita + código en gris debajo,
// en vez del <datalist> nativo del navegador (que no se puede rediseñar y por eso el nombre
// largo quedaba ilegible). Cada línea de producto tiene su propio buscador independiente.
function filtrarProductosEntrega(ei, pi) {
  const inputEl = document.getElementById(`viaje-prod-input-${ei}-${pi}`);
  const div = document.getElementById(`viaje-prod-resultados-${ei}-${pi}`);
  if (!inputEl || !div) return;
  inputEl.title = inputEl.value;
  _actualizarProductoEntrega(ei, pi, 'producto', inputEl.value);
  const q = inputEl.value.toLowerCase().trim();
  if (q.length < 2) { div.style.display = 'none'; return; }
  const res = (typeof PRODUCTOS !== 'undefined' ? PRODUCTOS : []).filter(p => (p.nombre + ' ' + p.codigo).toLowerCase().includes(q)).slice(0, 18);
  div.innerHTML = res.length
    ? res.map(p => `
      <div onclick="elegirProductoEntrega(${ei},${pi},'${p.codigo}')" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9" onmouseover="this.style.background='#EFF6FF'" onmouseout="this.style.background=''">
        <div style="font-weight:600;font-size:13px;color:#1e293b">${p.nombre}</div>
        <div style="font-size:11px;color:#64748b">${p.codigo}</div>
      </div>`).join('')
    : '<div style="padding:10px 14px;color:#888;font-size:12px">Sin resultados para esta búsqueda.</div>';
  div.style.display = 'block';
}

function elegirProductoEntrega(ei, pi, codigo) {
  const prod = (typeof PRODUCTOS !== 'undefined' ? PRODUCTOS : []).find(p => p.codigo === codigo);
  if (!prod || typeof _textoProducto !== 'function') return;
  const texto = _textoProducto(prod);
  const inputEl = document.getElementById(`viaje-prod-input-${ei}-${pi}`);
  if (inputEl) { inputEl.value = texto; inputEl.title = texto; }
  _actualizarProductoEntrega(ei, pi, 'producto', texto);
  const div = document.getElementById(`viaje-prod-resultados-${ei}-${pi}`);
  if (div) div.style.display = 'none';
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.entrega-prod-buscador')) {
    document.querySelectorAll('[id^="viaje-prod-resultados-"]').forEach(d => { d.style.display = 'none'; });
  }
});

function agregarEntregaViaje() {
  _entregasViajeActual.push(_entregaVaciaViaje());
  renderEntregasViaje();
}

function eliminarEntregaViaje(ei) {
  _entregasViajeActual.splice(ei, 1);
  if (!_entregasViajeActual.length) _entregasViajeActual.push(_entregaVaciaViaje());
  renderEntregasViaje();
}

function agregarProductoEntrega(ei) {
  _entregasViajeActual[ei].productos.push(_lineaVaciaEntrega());
  renderEntregasViaje();
}

function eliminarProductoEntrega(ei, pi) {
  const productos = _entregasViajeActual[ei].productos;
  productos.splice(pi, 1);
  if (!productos.length) productos.push(_lineaVaciaEntrega());
  renderEntregasViaje();
}

// Recalcula solo la celda de peso de esa línea y el total — no vuelve a pintar todo el
// formulario, para no perder el foco mientras se está escribiendo.
function _actualizarProductoEntrega(ei, pi, campo, valor) {
  const p = _entregasViajeActual[ei].productos[pi];
  if (campo === 'cantidad') p.cantidad = parseFloat(valor) || 0;
  else p.producto = valor;
  const prodCat = typeof _productoDesdeTextoAjuste === 'function' ? _productoDesdeTextoAjuste(p.producto) : null;
  const pesoUnitario = prodCat ? (Number(prodCat.peso) || 0) : 0;
  p.peso = (p.cantidad * pesoUnitario) / 1000;
  const celda = document.getElementById(`viaje-peso-${ei}-${pi}`);
  if (celda) celda.textContent = p.peso ? p.peso.toFixed(2) + ' ton' : (p.cantidad ? 'sin catálogo' : '—');
  actualizarPesoTotalViaje();
}

function actualizarPesoTotalViaje() {
  const total = _entregasViajeActual.reduce((s, e) => s + e.productos.reduce((s2, p) => s2 + (Number(p.peso) || 0), 0), 0);
  const el = document.getElementById('viaje-peso-total');
  if (el) {
    const capacidad = CAPACIDAD_VEHICULO[document.getElementById('m-viaje-vehiculo')?.value];
    const excedido = capacidad && total > capacidad;
    el.textContent = capacidad ? `${total.toFixed(2)} / ${capacidad} ton` : `${total.toFixed(2)} ton`;
    el.style.color = excedido ? '#C62828' : 'var(--azul)';
    el.title = excedido ? `Supera la capacidad del vehículo seleccionado (${capacidad} ton)` : '';
  }
  return total;
}

function abrirModalViaje(fecha) {
  document.getElementById('m-viaje-id').value = '';
  document.getElementById('modal-viaje-titulo').textContent = '🚛 Nuevo Viaje';
  document.getElementById('m-viaje-fecha').value = fecha || _fmtISO(new Date());
  document.getElementById('m-viaje-destino').value = '';
  document.getElementById('m-viaje-vehiculo').value = 'GTV044 / JORGE JAMES ALVAREZ';
  document.getElementById('m-viaje-estado').value = 'Programada';
  document.getElementById('m-viaje-obs').value = '';
  document.getElementById('btn-eliminar-viaje').style.display = 'none';
  _entregasViajeActual = [_entregaVaciaViaje()];
  renderEntregasViaje();
  document.getElementById('modal-viaje').classList.add('abierto');
}

function editarViaje(id) {
  const v = VIAJES.find(x => String(x.id) === String(id));
  if (!v) return;
  document.getElementById('m-viaje-id').value = v.id;
  document.getElementById('modal-viaje-titulo').textContent = '✏️ Editar Viaje';
  document.getElementById('m-viaje-fecha').value = v.fecha || '';
  document.getElementById('m-viaje-destino').value = v.destino || '';
  document.getElementById('m-viaje-vehiculo').value = v.vehiculo || 'GTV044 / JORGE JAMES ALVAREZ';
  document.getElementById('m-viaje-estado').value = v.estado || 'Programada';
  document.getElementById('m-viaje-obs').value = v.observaciones || '';
  document.getElementById('btn-eliminar-viaje').style.display = 'inline-flex';
  // El peso de cada línea queda congelado con lo que se guardó en su momento — no se
  // recalcula en vivo contra el catálogo actual (mismo criterio que los Ajustes de Mezcla:
  // un viaje ya programado no debe cambiar solo porque un producto se actualizó después).
  // `entregas` es el campo nuevo; `clientes` es el nombre viejo (viajes guardados antes de este cambio).
  const entregasPrevias = (v.entregas && v.entregas.length) ? v.entregas : (v.clientes || []);
  _entregasViajeActual = JSON.parse(JSON.stringify(entregasPrevias.length ? entregasPrevias : [_entregaVaciaViaje()]));
  _entregasViajeActual.forEach(e => { if (!e.productos || !e.productos.length) e.productos = [_lineaVaciaEntrega()]; });
  renderEntregasViaje();
  document.getElementById('modal-viaje').classList.add('abierto');
}

function guardarViaje() {
  const fecha = document.getElementById('m-viaje-fecha').value;
  const destino = document.getElementById('m-viaje-destino').value.trim();
  if (!fecha || !destino) { alert('Completa los campos obligatorios: Fecha y Destino.'); return; }

  const entregasLimpias = _entregasViajeActual
    .map(e => ({
      cliente: (e.cliente || '').trim(),
      destino: (e.destino || '').trim(),
      contactoObraNombre: (e.contactoObraNombre || '').trim(),
      contactoObraTelefono: (e.contactoObraTelefono || '').trim(),
      productos: (e.productos || [])
        .filter(p => (p.producto || '').trim())
        .map(p => ({ producto: p.producto.trim(), cantidad: Number(p.cantidad) || 0, peso: Number(p.peso) || 0 })),
    }))
    .filter(e => e.cliente || e.productos.length);

  if (!entregasLimpias.length) { alert('Agrega al menos una entrega con un producto.'); return; }
  for (const e of entregasLimpias) {
    if (e.cliente && typeof _clienteValidoAjuste === 'function' && !_clienteValidoAjuste(e.cliente)) {
      alert(`El cliente "${e.cliente}" no existe en la base de datos de Cotizaciones y Ventas.\nCréalo allá primero, o selecciona uno existente de la lista.`);
      return;
    }
  }

  const editId = document.getElementById('m-viaje-id').value;
  const previo = editId ? VIAJES.find(x => String(x.id) === String(editId)) : null;
  const pesoTotal = entregasLimpias.reduce((s, e) => s + e.productos.reduce((s2, p) => s2 + p.peso, 0), 0);
  const viaje = {
    id: editId || String(Date.now()),
    fecha,
    destino,
    vehiculo: document.getElementById('m-viaje-vehiculo').value,
    estado: document.getElementById('m-viaje-estado').value,
    observaciones: document.getElementById('m-viaje-obs').value.trim(),
    entregas: entregasLimpias,
    pesoTotal,
    creadoPor: previo ? previo.creadoPor : USUARIO_ACTUAL?.email,
    creadoEn: previo ? (previo.creadoEn || new Date().toISOString()) : new Date().toISOString(),
  };
  const idx = VIAJES.findIndex(x => String(x.id) === String(viaje.id));
  if (idx >= 0) VIAJES[idx] = viaje; else VIAJES.unshift(viaje);
  sb.from('entregas_programadas').upsert({ id: viaje.id, datos: viaje, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) console.error('Error guardando viaje:', error.message); });
  cerrarModal('modal-viaje');
  renderCalendarioLogistica();
}

function eliminarViaje() {
  const id = document.getElementById('m-viaje-id').value;
  const v = VIAJES.find(x => String(x.id) === String(id));
  if (!v || !confirm(`¿Eliminar el viaje del ${v.fecha}${v.destino ? ' — ' + v.destino : ''}?`)) return;
  VIAJES = VIAJES.filter(x => String(x.id) !== String(id));
  cerrarModal('modal-viaje');
  renderCalendarioLogistica();
  sb.from('entregas_programadas').delete().eq('id', id)
    .then(({ error }) => {
      if (error) { console.error('Error eliminando viaje:', error.message); alert('Error al eliminar: ' + error.message); VIAJES.push(v); renderCalendarioLogistica(); }
    });
}

// ── Imprimible del día (para el área de logística, que no tiene acceso al aplicativo) ──
// Mismo membrete que el resto de documentos de la app. Se genera un documento por día,
// con el detalle de cada viaje: vehículo, destino, entregas, contacto en obra y
// productos — todo lo que necesita quien carga los camiones.
let _progDiaFechaActual = null;

function imprimirProgramacionDia(fechaStr) {
  const viajesDia = VIAJES.filter(v => v.fecha === fechaStr && v.estado !== 'Cancelada');
  if (!viajesDia.length) { alert('No hay viajes programados (sin contar cancelados) para esa fecha.'); return; }
  _progDiaFechaActual = fechaStr;

  const fechaLegible = new Date(fechaStr + 'T12:00').toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const fechaHoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
  viajesDia.sort((a, b) => (a.vehiculo || '').localeCompare(b.vehiculo || ''));

  const bloques = viajesDia.map(v => {
    const capacidad = CAPACIDAD_VEHICULO[v.vehiculo];
    const peso = Number(v.pesoTotal) || 0;
    const excedido = capacidad && peso > capacidad;
    const entregasHTML = (v.entregas || v.clientes || []).map(e => `
      <div style="margin:8px 0;padding:8px;border:1px solid #eee;border-radius:5px">
        <div style="font-size:12px;font-weight:700">${e.cliente || '—'}${e.destino ? ' — ' + e.destino : ''}</div>
        <div style="font-size:10.5px;color:#555;margin-bottom:4px">Contacto en obra: ${e.contactoObraNombre ? e.contactoObraNombre + (e.contactoObraTelefono ? ' — ' + e.contactoObraTelefono : '') : '—'}</div>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px">
          ${(e.productos || []).map(p => `<tr><td style="padding:2px 0">• ${p.producto || ''}</td><td style="padding:2px 0;text-align:center;width:70px">${p.cantidad || 0}</td><td style="padding:2px 0;text-align:right;width:80px">${(Number(p.peso) || 0).toFixed(2)} ton</td></tr>`).join('')}
        </table>
      </div>`).join('');
    return `
      <div style="margin-bottom:16px">
        <div style="background:#003F7F;color:white;padding:6px 10px;border-radius:5px 5px 0 0;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:12px;font-weight:700">
          <span>🚛 ${v.vehiculo || '—'}</span>
          <span>Destino: ${v.destino || '—'}</span>
          <span style="color:${excedido ? '#FFCDD2' : 'white'}">${peso.toFixed(2)}${capacidad ? ' / ' + capacidad : ''} ton${excedido ? ' ⚠' : ''}</span>
        </div>
        <div style="border:1px solid #ddd;border-top:none;padding:6px 10px 10px">
          ${entregasHTML}
          ${v.observaciones ? `<div style="font-size:10px;color:#777;margin-top:4px"><b>Obs:</b> ${v.observaciones}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  const html = `
    <div class="no-print" style="background:#1C2333;color:white;padding:12px 24px;display:flex;align-items:center;gap:16px">
      <span style="font-weight:700">Programación de Viajes — ${fechaStr}</span>
      <div style="flex:1"></div>
      <button onclick="descargarProgramacionDiaPDF()" style="background:#1976D2;color:white;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-weight:700">⬇️ Descargar PDF</button>
      <button onclick="document.getElementById('vista-previa').style.display='none';document.getElementById('pantalla-logistica').classList.add('activa')" style="background:#555;color:white;border:none;padding:8px 14px;border-radius:5px;cursor:pointer">← Volver</button>
    </div>
    <div class="preview-doc" id="prog-dia-doc">
      <div class="preview-membrete-header">
        <img src="membrete-top.jpg" alt="">
      </div>
      <div class="preview-content" id="prog-dia-content" style="padding-top:6px">
        <div style="text-align:center;margin-bottom:12px">
          <div style="font-size:13px;font-weight:700;color:#003F7F;letter-spacing:0.03em">PROGRAMACIÓN DE VIAJES</div>
          <div style="font-size:11.5px;color:#333;text-transform:capitalize">${fechaLegible}</div>
          <div style="font-size:10px;color:#777">${viajesDia.length} viaje${viajesDia.length === 1 ? '' : 's'} · Generado el ${fechaHoy}</div>
        </div>
        ${bloques}
      </div>
      <div class="preview-membrete-footer" id="prog-dia-footer">
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

async function descargarProgramacionDiaPDF() {
  const btn = document.querySelector('.no-print button[onclick*="descargarProgramacionDiaPDF"]');
  if (btn) { btn.textContent = '⏳ Generando...'; btn.disabled = true; }
  try {
    const { jsPDF } = window.jspdf;
    const pageW = 210, pageH = 297;
    const topImg = await cargarImagen('membrete-top.jpg');
    const headerH = pageW * (topImg.naturalHeight / topImg.naturalWidth);
    const contentEl = document.getElementById('prog-dia-content');
    const contentCanvas = await html2canvas(contentEl, { scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false });
    const pxToMm = pageW / contentCanvas.width;
    const contentH_px = _alturaContenidoReal(contentCanvas);
    const footerEl = document.getElementById('prog-dia-footer');
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
      sliceCanvas.getContext('2d').drawImage(contentCanvas, 0, Math.floor(cursorY), contentCanvas.width, Math.ceil(sliceH_px), 0, 0, contentCanvas.width, Math.ceil(sliceH_px));
      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, headerH + 2, pageW, sliceH_px * pxToMm);
      pdf.addImage(footerData, 'JPEG', 0, pageH - footerH, pageW, footerH);
      cursorY = bottom;
      pageIndex++;
    }
    pdf.save(`Programacion_Viajes_${_progDiaFechaActual || 'dia'}.pdf`);
  } finally {
    if (btn) { btn.textContent = '⬇️ Descargar PDF'; btn.disabled = false; }
  }
}
