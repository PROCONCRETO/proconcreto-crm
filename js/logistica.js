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
//
// Cumplidos: cada entrega tiene un campo `cumplido` = { estado, nuevaFecha?, fechaConfirmacion,
// confirmadoPor }. `estado` es 'pendiente' (default, incluye entregas viejas sin este campo),
// 'hecha', 'reprogramada' o 'cancelada'. El cumplimiento de un viaje es proporcional a sus
// entregas marcadas 'hecha' sobre el total de entregas programadas (ver pctCumplidoViaje).
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
// Vehículos propios vs. tercerizados, para el dashboard de Estadísticas.
const VEHICULO_ES_PROPIO = {
  'GTV044 / JORGE JAMES ALVAREZ': true,
  'GTU668 / JOSE RAMIRO CIRO': true,
  'CAMION SENCILLO / TERCERIZADO': false,
  'TRACTO CAMION / TERCERIZADO': false,
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

// ── Entregas / cumplidos: helpers compartidos ──
function _entregasDeViaje(v) { return v.entregas || v.clientes || []; }

function _cumplidoDeEntrega(e) { return (e && e.cumplido) || { estado: 'pendiente' }; }

// Cualquier fecha antes de hoy queda bloqueada para edición estructural del viaje
// (fecha, destino, vehículo, entregas). Marcar cumplidos sigue permitido sobre esas fechas.
function esFechaBloqueada(fechaStr) { return fechaStr < _fmtISO(new Date()); }

// Cumplimiento de un viaje = entregas marcadas "hecha" / total de entregas programadas.
// null si el viaje no tiene entregas (no debería pasar, pero por seguridad).
function pctCumplidoViaje(v) {
  const entregas = _entregasDeViaje(v);
  if (!entregas.length) return null;
  const hechas = entregas.filter(e => _cumplidoDeEntrega(e).estado === 'hecha').length;
  return Math.round((hechas / entregas.length) * 100);
}

// ── Orden/prioridad de los viajes dentro de un mismo día ──
// Por defecto los viajes de un día se ven en el orden en que se crearon (más viejo primero),
// no necesariamente el orden de prioridad real de despacho. `orden` es opcional: si no está
// definido, se usa el id (que es un timestamp) como respaldo. Las flechas ▲▼ del calendario
// intercambian el valor de `orden` con el vecino inmediato para subir/bajar prioridad.
function _claveOrdenViaje(v) { return (v.orden !== undefined && v.orden !== null) ? v.orden : Number(v.id); }

function moverViajeOrden(id, direccion) {
  const v = VIAJES.find(x => String(x.id) === String(id));
  if (!v) return;
  const viajesDia = VIAJES.filter(x => x.fecha === v.fecha).sort((a, b) => _claveOrdenViaje(a) - _claveOrdenViaje(b));
  const idx = viajesDia.findIndex(x => String(x.id) === String(id));
  const vecino = viajesDia[idx + direccion];
  if (!vecino) return;
  const ordenV = _claveOrdenViaje(v), ordenVecino = _claveOrdenViaje(vecino);
  v.orden = ordenVecino;
  vecino.orden = ordenV;
  [v, vecino].forEach(x => {
    sb.from('entregas_programadas').upsert({ id: x.id, datos: x, modificado: new Date().toISOString() }, { onConflict: 'id' })
      .then(({ error }) => { if (error) console.error('Error guardando orden de viaje:', error.message); });
  });
  renderCalendarioLogistica();
}

// ── Arrastrar un viaje a otro día (drag & drop nativo, sin librerías) ──
// Solo los viajes en fecha no bloqueada se pueden arrastrar (ver esFechaBloqueada) — un viaje
// que ya pasó se reprograma desde "✅ Cumplidos", no arrastrándolo. El día destino tampoco
// puede estar bloqueado. Al soltar, el viaje queda al final de la lista del día destino.
let _viajeArrastradoId = null;

function iniciarArrastreViaje(event, id) {
  _viajeArrastradoId = id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', id);
  event.currentTarget.classList.add('log-cal-viaje-arrastrando');
}

function terminarArrastreViaje(event) {
  event.currentTarget.classList.remove('log-cal-viaje-arrastrando');
  _viajeArrastradoId = null;
}

function permitirSoltarViaje(event) {
  if (!_viajeArrastradoId) return;
  event.preventDefault();
  event.currentTarget.classList.add('log-cal-dragover');
}

function quitarResaltadoSoltar(event) {
  event.currentTarget.classList.remove('log-cal-dragover');
}

// Mueve un viaje completo a otra fecha (usado tanto al soltar sobre una celda vacía del día
// como al soltar sobre otro viaje de un día distinto). Devuelve una Promise de guardado.
//
// Es una mutación simple — nunca duplica el viaje — a propósito: mientras un viaje sigue
// siendo "plan" (hoy o futuro, no bloqueado), moverlo debe ser reversible sin dejar rastros
// fantasma. Las Estadísticas no se calculan mirando la fecha actual del viaje, sino
// `entrega.fechaOriginal` (ver _datosEstadisticasLogistica y _categoriaCumplidoViaje en
// estadisticas-logistica.js): si quedó en una fecha distinta a la original cuenta como
// "reprogramada" en vivo, y si se arrastra de vuelta a su fecha original, el indicador se
// corrige solo — no hay una marca fija que haya que "deshacer" a mano.
function _moverViajeADia(v, fechaDestino) {
  _entregasDeViaje(v).forEach(e => { if (!e.fechaOriginal) e.fechaOriginal = v.fecha; });
  v.fecha = fechaDestino;
  v.orden = Date.now();
  return sb.from('entregas_programadas').upsert({ id: v.id, datos: v, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) console.error('Error moviendo viaje de fecha:', error.message); });
}

// Mueve UNA entrega de un viaje a otra fecha (usado por "Reprogramar" en Cumplidos, que actúa
// sobre una entrega puntual, no sobre el viaje completo). Si es la única entrega del viaje, es
// exactamente lo mismo que mover el viaje entero (_moverViajeADia, mutación simple). Si el viaje
// tiene otras entregas que se quedan donde estaban, se separa solo esta en un viaje nuevo en la
// fecha destino y se saca del viaje original — las demás entregas del viaje original no se tocan.
function _moverEntregaADia(v, entregaIndex, fechaDestino) {
  const entregas = v.entregas || _entregasDeViaje(v);
  if (entregas.length <= 1) return _moverViajeADia(v, fechaDestino);

  const [e] = entregas.splice(entregaIndex, 1);
  v.pesoTotal = entregas.reduce((s, e2) => s + (e2.productos || []).reduce((s2, p) => s2 + (Number(p.peso) || 0), 0), 0);
  const pesoMovido = (e.productos || []).reduce((s, p) => s + (Number(p.peso) || 0), 0);
  const viajeNuevo = {
    id: String(Date.now()) + '-r',
    fecha: fechaDestino,
    destino: e.destino || v.destino,
    vehiculo: v.vehiculo,
    estado: 'Programada',
    observaciones: `Separado del viaje del ${v.fecha}.`,
    entregas: [e],
    pesoTotal: pesoMovido,
    creadoPor: USUARIO_ACTUAL?.email,
    creadoEn: new Date().toISOString(),
  };
  VIAJES.unshift(viajeNuevo);
  return Promise.all([
    sb.from('entregas_programadas').upsert({ id: v.id, datos: v, modificado: new Date().toISOString() }, { onConflict: 'id' }),
    sb.from('entregas_programadas').upsert({ id: viajeNuevo.id, datos: viajeNuevo, modificado: new Date().toISOString() }, { onConflict: 'id' }),
  ]).then(resultados => resultados.forEach(({ error }) => { if (error) console.error('Error moviendo entrega:', error.message); }));
}

function soltarViajeEnDia(event, fechaDestino) {
  event.preventDefault();
  event.currentTarget.classList.remove('log-cal-dragover');
  const id = _viajeArrastradoId;
  _viajeArrastradoId = null;
  if (!id) return;
  const v = VIAJES.find(x => String(x.id) === String(id));
  if (!v || v.fecha === fechaDestino) return; // mismo día: no se mueve nada (se reordena soltando sobre otro viaje)
  if (esFechaBloqueada(fechaDestino)) { alert('No se puede mover un viaje a una fecha que ya pasó.'); return; }
  Promise.resolve(_moverViajeADia(v, fechaDestino)).then(() => renderCalendarioLogistica());
}

// Soltar un viaje sobre otro viaje: si son del mismo día, reordena (inserta el arrastrado justo
// antes del objetivo); si son de días distintos, se comporta igual que soltarlo sobre la celda
// del día (mover/reprogramar), permitiendo también cambiar de día soltando sobre un viaje.
function soltarViajeSobreViaje(event, targetId) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('log-cal-dragover');
  event.currentTarget.closest('.log-cal-celda')?.classList.remove('log-cal-dragover');
  const id = _viajeArrastradoId;
  _viajeArrastradoId = null;
  if (!id || id === targetId) return;
  const arrastrado = VIAJES.find(x => String(x.id) === String(id));
  const objetivo = VIAJES.find(x => String(x.id) === String(targetId));
  if (!arrastrado || !objetivo) return;

  if (arrastrado.fecha !== objetivo.fecha) {
    if (esFechaBloqueada(objetivo.fecha)) { alert('No se puede mover un viaje a una fecha que ya pasó.'); return; }
    Promise.resolve(_moverViajeADia(arrastrado, objetivo.fecha)).then(() => renderCalendarioLogistica());
    return;
  }

  const viajesDia = VIAJES.filter(x => x.fecha === arrastrado.fecha).sort((a, b) => _claveOrdenViaje(a) - _claveOrdenViaje(b));
  const sinArrastrado = viajesDia.filter(x => String(x.id) !== String(id));
  const idxObjetivo = sinArrastrado.findIndex(x => String(x.id) === String(targetId));
  sinArrastrado.splice(idxObjetivo, 0, arrastrado);
  const guardados = sinArrastrado.map((x, i) => {
    x.orden = i;
    return sb.from('entregas_programadas').upsert({ id: x.id, datos: x, modificado: new Date().toISOString() }, { onConflict: 'id' });
  });
  Promise.all(guardados).then(rs => rs.forEach(({ error }) => { if (error) console.error('Error reordenando viajes:', error.message); }));
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
    const viajesDia = VIAJES.filter(v => v.fecha === fechaStr).sort((a, b) => _claveOrdenViaje(a) - _claveOrdenViaje(b));
    const diaBloqueado = esFechaBloqueada(fechaStr);

    let clases = 'log-cal-celda';
    if (festivoNombre) clases += ' log-cal-festivo';
    else if (dow === 0 || dow === 6) clases += ' log-cal-finde';
    if (esHoy) clases += ' log-cal-hoy';

    celdas += `
      <div class="${clases}" onclick="abrirModalViaje('${fechaStr}')" ondragover="permitirSoltarViaje(event)" ondragleave="quitarResaltadoSoltar(event)" ondrop="soltarViajeEnDia(event,'${fechaStr}')">
        <div class="log-cal-dia-num">${dia}${esHoy ? ' <span class="log-cal-hoy-badge">HOY</span>' : ''}${viajesDia.length ? `<span onclick="event.stopPropagation();imprimirProgramacionDia('${fechaStr}')" title="Imprimir programación del día" style="float:right;cursor:pointer">🖨️</span>` : ''}</div>
        ${festivoNombre ? `<div class="log-cal-festivo-nombre" title="${festivoNombre}">🎉 ${festivoNombre}</div>` : ''}
        <div class="log-cal-viajes">
          ${viajesDia.map((v, idxViaje) => {
            const nEntregas = _entregasDeViaje(v).length;
            const peso = Number(v.pesoTotal) || 0;
            const pct = pctCumplidoViaje(v);
            const pctTxt = (fechaStr <= hoyStr && pct !== null) ? ` — ${pct}% cumplido` : '';
            const tituloTip = `${v.destino || ''}${v.vehiculo ? ' — ' + v.vehiculo : ''} — ${nEntregas} entrega${nEntregas === 1 ? '' : 's'} — ${peso.toFixed(2)} ton${v.estado ? ' — ' + v.estado : ''}${pctTxt}`;
            const flechas = viajesDia.length > 1 ? `
              <span class="log-cal-viaje-flechas">
                ${idxViaje > 0 ? `<span onclick="event.stopPropagation();moverViajeOrden('${v.id}',-1)" title="Subir prioridad">▲</span>` : ''}
                ${idxViaje < viajesDia.length - 1 ? `<span onclick="event.stopPropagation();moverViajeOrden('${v.id}',1)" title="Bajar prioridad">▼</span>` : ''}
              </span>` : '';
            return `
            <div class="log-cal-viaje" draggable="${!diaBloqueado}" ondragstart="iniciarArrastreViaje(event,'${v.id}')" ondragend="terminarArrastreViaje(event)" ondragover="permitirSoltarViaje(event)" ondrop="soltarViajeSobreViaje(event,'${v.id}')" style="background:${COLOR_VEHICULO_VIAJE[v.vehiculo] || '#607D8B'}${v.estado === 'Cancelada' ? ';opacity:.5;text-decoration:line-through' : ''}" onclick="event.stopPropagation();editarViaje('${v.id}')" title="${tituloTip}${diaBloqueado ? '' : ' — arrastra para mover o reordenar'}">
              <span class="log-cal-viaje-texto">${v.destino || 'Viaje'} · ${nEntregas} ent · ${peso.toFixed(1)}t${fechaStr <= hoyStr && pct !== null ? ` · ${pct}%` : ''}</span>${flechas}
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

  actualizarBadgeCumplidos();
}

// ── Modal de Viaje ──
// Cada entrega del viaje lleva su propia lista de productos; el peso de cada línea se
// calcula con el mismo catálogo de Productos (cantidad × peso por unidad), y el peso total
// del viaje es la suma de todas las líneas de todas las entregas. Reutiliza los mismos
// helpers de búsqueda de cliente/producto que Ajuste Diario de Mezcla.
let _entregasViajeActual = [];
let _viajeBloqueadoActual = false;

function _lineaVaciaEntrega() { return { producto: '', cantidad: 0, peso: 0 }; }
function _entregaVaciaViaje() { return { ordenId: '', ordenNumero: '', cliente: '', destino: '', contactoObraNombre: '', contactoObraTelefono: '', productos: [_lineaVaciaEntrega()], cumplido: { estado: 'pendiente' } }; }

const _ETIQUETA_CUMPLIDO = { pendiente: '⏳ Pendiente', hecha: '✅ Hecha', reprogramada: '🔁 Reprogramada', cancelada: '❌ Cancelada' };

// ── Encadenamiento con Órdenes de Producción ──
// Una orden puede traer un desglose por producto (`items[]`, cuando viene de una cotización
// aceptada) o solo una cantidad genérica (órdenes creadas a mano) — este helper unifica ambos
// casos en una sola lista de "renglones pedidos".
function _itemsDeOrden(orden) {
  if (orden.items && orden.items.length) return orden.items;
  if (orden.cantidad) return [{ nombre: orden.descripcion || 'Producto', cantidad: Number(orden.cantidad) || 0, unidad: '' }];
  return [];
}

// Texto de producto que identifica un renglón de la orden, en el mismo formato que usa el
// catálogo (`_textoProducto`, de calidad-ajuste-mezcla.js) — así una entrega que se autocompleta
// desde la orden queda con el peso calculado igual que cualquier otro producto del catálogo.
function _claveItemOrden(item) {
  return item.codigo && typeof _textoProducto === 'function' ? _textoProducto(item) : (item.nombre || '');
}

// Suma, por producto, lo ya entregado (entregas de cualquier viaje vinculadas a esta orden y
// marcadas "hecha" en Cumplidos) — es lo que alimenta el saldo pendiente de la orden y el
// valor por defecto al vincular una nueva entrega a la misma orden.
function _cantidadEntregadaPorProducto(ordenId) {
  const mapa = {};
  VIAJES.forEach(v => {
    _entregasDeViaje(v).forEach(e => {
      if (!ordenId || String(e.ordenId) !== String(ordenId)) return;
      if (_cumplidoDeEntrega(e).estado !== 'hecha') return;
      (e.productos || []).forEach(p => { mapa[p.producto] = (mapa[p.producto] || 0) + (Number(p.cantidad) || 0); });
    });
  });
  return mapa;
}

// Al vincular una entrega a una orden: trae cliente/destino/contacto de la orden, y arma las
// líneas de producto con el SALDO pendiente de cada una (pedido - ya entregado a la fecha), no
// la cantidad pedida completa — para que una entrega parcial parta de lo que de verdad falta.
function aplicarOrdenAEntrega(ei, ordenId) {
  const e = _entregasViajeActual[ei];
  if (!e) return;
  e.ordenId = ordenId || '';
  if (!ordenId) { e.ordenNumero = ''; renderEntregasViaje(); return; }

  const orden = (typeof ORDENES !== 'undefined' ? ORDENES : []).find(o => String(o.id) === String(ordenId));
  if (!orden) { renderEntregasViaje(); return; }

  e.ordenNumero = orden.numero || '';
  e.cliente = orden.cliente || orden.clienteData?.nombre || e.cliente;
  e.destino = orden.clienteData?.proyecto || e.destino;
  e.contactoObraNombre = orden.clienteData?.contacto || e.contactoObraNombre;
  e.contactoObraTelefono = orden.clienteData?.cel || e.contactoObraTelefono;

  const entregadoPorClave = _cantidadEntregadaPorProducto(ordenId);
  const items = _itemsDeOrden(orden);
  e.productos = items.length ? items.map(it => {
    const clave = _claveItemOrden(it);
    const saldo = Math.max(0, (Number(it.cantidad) || 0) - (entregadoPorClave[clave] || 0));
    const prodCat = it.codigo && typeof PRODUCTOS !== 'undefined' ? PRODUCTOS.find(p => p.codigo === it.codigo) : null;
    const pesoUnitario = prodCat ? (Number(prodCat.peso) || 0) : 0;
    return { producto: clave, cantidad: saldo, peso: (saldo * pesoUnitario) / 1000 };
  }) : [_lineaVaciaEntrega()];

  // La ciudad de destino del viaje se autocompleta solo si todavía está sin elegir — no se
  // sobreescribe si el viaje ya tenía una (puede tener varias entregas de órdenes distintas).
  const selDestino = document.getElementById('m-viaje-destino');
  if (selDestino && !selDestino.value) {
    const ciudad = orden.transporte?.destino === 'Otro' ? (orden.transporte?.destinoNombre || '') : (orden.transporte?.destino || '');
    if (ciudad) _fijarCiudadDestino(ciudad);
  }

  renderEntregasViaje();
}

function renderEntregasViaje() {
  const wrap = document.getElementById('viaje-entregas-wrap');
  if (!wrap) return;

  if (_viajeBloqueadoActual) {
    // Modo lectura: solo se muestra el resumen de cada entrega y su cumplido, sin poder editar nada.
    wrap.innerHTML = _entregasViajeActual.map(e => {
      const c = _cumplidoDeEntrega(e);
      return `
      <div class="card" style="padding:12px;margin-bottom:10px;background:#FAFBFC;box-shadow:none;border:1px solid var(--gris-borde)">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          <div style="font-size:13px;font-weight:700">${e.cliente || 'Sin cliente'}${e.destino ? ' — ' + e.destino : ''}</div>
          <div style="font-size:11px;font-weight:700">${_ETIQUETA_CUMPLIDO[c.estado] || _ETIQUETA_CUMPLIDO.pendiente}${c.estado === 'reprogramada' && c.nuevaFecha ? ` → ${c.nuevaFecha}` : ''}${e.vecesReprogramada ? ` <span style="color:var(--naranja)">🔁×${e.vecesReprogramada}</span>` : ''}</div>
        </div>
        <div style="font-size:11px;color:var(--gris-medio);margin-bottom:2px">Orden: ${e.ordenNumero || 'N/A — sin orden asociada'}</div>
        <div style="font-size:11px;color:var(--gris-medio);margin-bottom:6px">Contacto en obra: ${e.contactoObraNombre ? e.contactoObraNombre + (e.contactoObraTelefono ? ' — ' + e.contactoObraTelefono : '') : '—'}</div>
        ${(e.productos || []).map(p => `<div style="font-size:12px;padding:3px 0;border-top:1px solid #eee">• ${p.producto || ''} — ${p.cantidad || 0} (${(Number(p.peso) || 0).toFixed(2)} ton)</div>`).join('')}
      </div>`;
    }).join('');
    return;
  }

  const _opcionesOrdenes = (typeof ORDENES !== 'undefined' ? ORDENES : []).filter(o => o.estado !== 'Cancelado');
  wrap.innerHTML = _entregasViajeActual.map((e, ei) => `
    <div class="card" style="padding:12px;margin-bottom:10px;background:#FAFBFC;box-shadow:none;border:1px solid var(--gris-borde)">
      <div class="form-grupo" style="margin-bottom:8px">
        <label>Orden de Producción asociada</label>
        <select onchange="aplicarOrdenAEntrega(${ei},this.value)" style="width:100%;padding:8px;border:1px solid var(--gris-borde);border-radius:var(--radio);font-size:13px">
          <option value="">N/A — sin orden asociada</option>
          ${_opcionesOrdenes.map(o => `<option value="${o.id}" ${String(e.ordenId || '') === String(o.id) ? 'selected' : ''}>${o.numero} — ${o.cliente || ''} — ${(o.descripcion || '').slice(0, 40)}</option>`).join('')}
        </select>
      </div>
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

const _CAMPOS_VIAJE_BLOQUEABLES = ['m-viaje-fecha', 'm-viaje-destino', 'm-viaje-destino-otro', 'm-viaje-vehiculo', 'm-viaje-estado', 'm-viaje-obs'];

function _aplicarBloqueoModalViaje(bloqueado) {
  _CAMPOS_VIAJE_BLOQUEABLES.forEach(id => { const el = document.getElementById(id); if (el) el.disabled = bloqueado; });
  document.getElementById('viaje-bloqueado-banner').style.display = bloqueado ? 'block' : 'none';
  document.getElementById('btn-agregar-entrega').style.display = bloqueado ? 'none' : 'inline-flex';
  document.getElementById('btn-guardar-viaje').style.display = bloqueado ? 'none' : 'inline-flex';
}

// La ciudad de destino es un desplegable curado (Caldas/Risaralda/Quindío) con "Otros" para
// texto libre. Estos tres helpers son el único punto que lee/escribe ese campo, para que un
// destino viejo que no esté en la lista (dato histórico) no se pierda silenciosamente: si el
// valor guardado no coincide con ninguna opción, cae en "Otros" con el texto original intacto.
function toggleCiudadDestinoOtro() {
  const sel = document.getElementById('m-viaje-destino');
  const otro = document.getElementById('m-viaje-destino-otro');
  otro.style.display = sel.value === '__otro__' ? 'block' : 'none';
}

function _valorCiudadDestino() {
  const sel = document.getElementById('m-viaje-destino');
  if (sel.value === '__otro__') return (document.getElementById('m-viaje-destino-otro').value || '').trim();
  return sel.value;
}

function _fijarCiudadDestino(valor) {
  const sel = document.getElementById('m-viaje-destino');
  const otro = document.getElementById('m-viaje-destino-otro');
  if (!valor) { sel.value = ''; otro.style.display = 'none'; otro.value = ''; return; }
  const esConocida = Array.from(sel.options).some(o => o.value === valor);
  sel.value = esConocida ? valor : '__otro__';
  otro.style.display = esConocida ? 'none' : 'block';
  otro.value = esConocida ? '' : valor;
}

function abrirModalViaje(fecha) {
  const f = fecha || _fmtISO(new Date());
  if (esFechaBloqueada(f)) {
    alert('No se puede programar un viaje en una fecha que ya pasó.\nUsa el botón "✅ Cumplidos" para registrar qué pasó con la programación de días anteriores.');
    return;
  }
  _viajeBloqueadoActual = false;
  document.getElementById('m-viaje-id').value = '';
  document.getElementById('modal-viaje-titulo').textContent = '🚛 Nuevo Viaje';
  document.getElementById('m-viaje-fecha').value = f;
  _fijarCiudadDestino('');
  document.getElementById('m-viaje-vehiculo').value = 'GTV044 / JORGE JAMES ALVAREZ';
  document.getElementById('m-viaje-estado').value = 'Programada';
  document.getElementById('m-viaje-obs').value = '';
  document.getElementById('btn-eliminar-viaje').style.display = 'none';
  _aplicarBloqueoModalViaje(false);
  _entregasViajeActual = [_entregaVaciaViaje()];
  renderEntregasViaje();
  document.getElementById('modal-viaje').classList.add('abierto');
}

function editarViaje(id) {
  const v = VIAJES.find(x => String(x.id) === String(id));
  if (!v) return;
  _viajeBloqueadoActual = esFechaBloqueada(v.fecha);
  document.getElementById('m-viaje-id').value = v.id;
  document.getElementById('modal-viaje-titulo').textContent = _viajeBloqueadoActual ? '🔒 Viaje (solo lectura)' : '✏️ Editar Viaje';
  document.getElementById('m-viaje-fecha').value = v.fecha || '';
  _fijarCiudadDestino(v.destino || '');
  document.getElementById('m-viaje-vehiculo').value = v.vehiculo || 'GTV044 / JORGE JAMES ALVAREZ';
  document.getElementById('m-viaje-estado').value = v.estado || 'Programada';
  document.getElementById('m-viaje-obs').value = v.observaciones || '';
  document.getElementById('btn-eliminar-viaje').style.display = _viajeBloqueadoActual ? 'none' : 'inline-flex';
  _aplicarBloqueoModalViaje(_viajeBloqueadoActual);
  // El peso de cada línea queda congelado con lo que se guardó en su momento — no se
  // recalcula en vivo contra el catálogo actual (mismo criterio que los Ajustes de Mezcla:
  // un viaje ya programado no debe cambiar solo porque un producto se actualizó después).
  const entregasPrevias = _entregasDeViaje(v);
  _entregasViajeActual = JSON.parse(JSON.stringify(entregasPrevias.length ? entregasPrevias : [_entregaVaciaViaje()]));
  _entregasViajeActual.forEach(e => { if (!e.productos || !e.productos.length) e.productos = [_lineaVaciaEntrega()]; if (!e.cumplido) e.cumplido = { estado: 'pendiente' }; if (e.ordenId === undefined) e.ordenId = ''; if (e.ordenNumero === undefined) e.ordenNumero = ''; if (!e.fechaOriginal) e.fechaOriginal = v.fecha; });
  renderEntregasViaje();
  document.getElementById('modal-viaje').classList.add('abierto');
}

function guardarViaje() {
  const fecha = document.getElementById('m-viaje-fecha').value;
  const destino = _valorCiudadDestino();
  if (!fecha || !destino) { alert('Completa los campos obligatorios: Fecha y Ciudad de Destino.'); return; }

  const entregasLimpias = _entregasViajeActual
    .map(e => ({
      ordenId: e.ordenId || '',
      ordenNumero: e.ordenNumero || '',
      // Se fija la primera vez que la entrega se guarda y nunca vuelve a cambiar — es lo que
      // permite saber después si una entrega se reprogramó (fechaOriginal != fecha actual del
      // viaje) sin importar si el cambio de fecha vino de arrastrarla o de "Reprogramar" en
      // Cumplidos. Si se reprograma dentro del mismo día, fechaOriginal queda igual a la fecha
      // actual y no cuenta como reprogramación.
      fechaOriginal: e.fechaOriginal || fecha,
      cliente: (e.cliente || '').trim(),
      destino: (e.destino || '').trim(),
      contactoObraNombre: (e.contactoObraNombre || '').trim(),
      contactoObraTelefono: (e.contactoObraTelefono || '').trim(),
      productos: (e.productos || [])
        .filter(p => (p.producto || '').trim())
        .map(p => ({ producto: p.producto.trim(), cantidad: Number(p.cantidad) || 0, peso: Number(p.peso) || 0 })),
      cumplido: _cumplidoDeEntrega(e),
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

// ── Cumplidos: backlog acumulado de entregas sin confirmar ──
// Se acumulan TODAS las entregas de hoy o de cualquier día anterior que sigan en estado
// "pendiente" — no solo las del día inmediatamente anterior — hasta que alguien las marque.
function entregasPendientesAcumuladas() {
  const hoy = _fmtISO(new Date());
  const filas = [];
  VIAJES.forEach(v => {
    if (v.fecha > hoy) return;
    _entregasDeViaje(v).forEach((e, ei) => {
      if (_cumplidoDeEntrega(e).estado === 'pendiente') {
        filas.push({ viajeId: v.id, entregaIndex: ei, fecha: v.fecha, destinoViaje: v.destino, vehiculo: v.vehiculo, entrega: e });
      }
    });
  });
  filas.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return filas;
}

function actualizarBadgeCumplidos() {
  const n = entregasPendientesAcumuladas().length;
  const el = document.getElementById('btn-cumplidos-texto');
  if (el) el.textContent = n ? `✅ Cumplidos (${n})` : '✅ Cumplidos';
}

function abrirModalCumplidos() {
  _reprogramarAbiertoKey = null;
  renderListaCumplidos();
  document.getElementById('modal-cumplidos').classList.add('abierto');
}

let _reprogramarAbiertoKey = null; // `${viajeId}-${entregaIndex}` de la fila con el selector de nueva fecha abierto

function renderListaCumplidos() {
  const cont = document.getElementById('cumplidos-lista');
  if (!cont) return;
  const filas = entregasPendientesAcumuladas();
  if (!filas.length) {
    cont.innerHTML = '<div class="empty-state"><div class="icono">✅</div><div>No hay entregas pendientes de confirmar. ¡Al día!</div></div>';
    return;
  }
  cont.innerHTML = filas.map(f => {
    const key = `${f.viajeId}-${f.entregaIndex}`;
    const pesoEntrega = (f.entrega.productos || []).reduce((s, p) => s + (Number(p.peso) || 0), 0);
    const fechaLegible = new Date(f.fecha + 'T12:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' });
    return `
    <div class="card" style="padding:10px 12px;margin-bottom:8px;border:1px solid var(--gris-borde);box-shadow:none">
      <div style="margin-bottom:8px">
        <div style="font-size:12.5px;font-weight:700;text-transform:capitalize">${fechaLegible} — ${f.entrega.cliente || 'Sin cliente'}${f.entrega.vecesReprogramada ? ` <span style="color:var(--naranja);font-size:11px">🔁×${f.entrega.vecesReprogramada}</span>` : ''}</div>
        <div style="font-size:11px;color:var(--gris-medio)">${f.entrega.destino || f.destinoViaje || ''} · ${f.vehiculo || ''} · ${pesoEntrega.toFixed(2)} ton</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primario btn-xs" onclick="marcarCumplidoEntrega('${f.viajeId}',${f.entregaIndex},'hecha')">✅ Hecha</button>
        <button class="btn btn-secundario btn-xs" onclick="toggleReprogramarCumplido('${f.viajeId}',${f.entregaIndex})">🔁 Reprogramar</button>
        <button class="btn btn-rojo btn-xs" onclick="marcarCumplidoEntrega('${f.viajeId}',${f.entregaIndex},'cancelada')">❌ Cancelada</button>
        ${_reprogramarAbiertoKey === key ? `
          <input type="date" id="reprogramar-fecha-${key}" min="${_fmtISO(new Date())}" style="margin-left:4px;padding:5px 7px;border:1px solid var(--gris-borde);border-radius:4px;font-size:12px">
          <button class="btn btn-primario btn-xs" onclick="confirmarReprogramacion('${f.viajeId}',${f.entregaIndex})">Confirmar nueva fecha</button>
        ` : ''}
      </div>
    </div>`;
  }).join('');
}

function toggleReprogramarCumplido(viajeId, entregaIndex) {
  const key = `${viajeId}-${entregaIndex}`;
  _reprogramarAbiertoKey = _reprogramarAbiertoKey === key ? null : key;
  renderListaCumplidos();
}

function confirmarReprogramacion(viajeId, entregaIndex) {
  const key = `${viajeId}-${entregaIndex}`;
  const input = document.getElementById(`reprogramar-fecha-${key}`);
  const nuevaFecha = input ? input.value : '';
  if (!nuevaFecha) { alert('Elige la nueva fecha.'); return; }
  const v = VIAJES.find(x => String(x.id) === String(viajeId));
  if (v && nuevaFecha === v.fecha) {
    alert('Esa es la misma fecha del viaje actual — si la entrega se va a hacer más tarde el mismo día, no hace falta reprogramarla: déjala pendiente y márcala como "Hecha" cuando se complete.');
    return;
  }
  marcarCumplidoEntrega(viajeId, entregaIndex, 'reprogramada', nuevaFecha);
}

// Marca el resultado de una entrega. "Hecha" y "Cancelada" sí son resultados finales.
// "Reprogramada" YA NO bloquea la entrega: solo la mueve a la fecha nueva (igual mecanismo que
// arrastrarla en el calendario — ver _moverEntregaADia) y deja constancia de que se movió
// (`e.vecesReprogramada`), pero la entrega sigue "pendiente" y vuelve a aparecer en Cumplidos en
// su nueva fecha, totalmente accionable (se puede volver a marcar Hecha, reprogramar de nuevo o
// Cancelar). Esto evita el callejón sin salida de una entrega que se reprogramó y al final SÍ se
// cumplió, pero se quedaba sin forma de marcarse como hecha. Lo que sí queda registrado para las
// estadísticas es el hecho de que se reprogramó — ver _fueReprogramada() en
// estadisticas-logistica.js.
function marcarCumplidoEntrega(viajeId, entregaIndex, estado, nuevaFecha) {
  const v = VIAJES.find(x => String(x.id) === String(viajeId));
  if (!v) return;
  if (!v.entregas) v.entregas = _entregasDeViaje(v);
  const e = v.entregas[entregaIndex];
  if (!e) return;
  if (!e.fechaOriginal) e.fechaOriginal = v.fecha;

  if (estado === 'reprogramada') {
    e.vecesReprogramada = (e.vecesReprogramada || 0) + 1;
    e.cumplido = { estado: 'pendiente' };
    Promise.resolve(_moverEntregaADia(v, entregaIndex, nuevaFecha)).then(() => renderCalendarioLogistica());
    _reprogramarAbiertoKey = null;
    renderListaCumplidos();
    return;
  }

  e.cumplido = { estado, fechaConfirmacion: new Date().toISOString(), confirmadoPor: USUARIO_ACTUAL?.email };
  sb.from('entregas_programadas').upsert({ id: v.id, datos: v, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) console.error('Error guardando cumplido:', error.message); });

  _reprogramarAbiertoKey = null;
  renderListaCumplidos();
  renderCalendarioLogistica();
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
  // Mismo orden de prioridad que el calendario (viaje.orden, flechas ▲▼ o arrastre) — el
  // impreso es lo único que ve el área de despachos sin acceso al aplicativo, así que tiene
  // que reflejar el orden real de despacho, no un orden alfabético por vehículo.
  viajesDia.sort((a, b) => _claveOrdenViaje(a) - _claveOrdenViaje(b));

  const bloques = viajesDia.map((v, idxViaje) => {
    const capacidad = CAPACIDAD_VEHICULO[v.vehiculo];
    const peso = Number(v.pesoTotal) || 0;
    const excedido = capacidad && peso > capacidad;
    const entregasHTML = _entregasDeViaje(v).map(e => `
      <div style="margin:8px 0;padding:8px;border:1px solid #eee;border-radius:5px">
        <div style="font-size:12px;font-weight:700">${e.cliente || '—'}${e.destino ? ' — ' + e.destino : ''}</div>
        <div style="font-size:10.5px;color:#555;margin-bottom:4px">Contacto en obra: ${e.contactoObraNombre ? e.contactoObraNombre + (e.contactoObraTelefono ? ' — ' + e.contactoObraTelefono : '') : '—'}</div>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px">
          ${(e.productos || []).map(p => `<tr><td style="padding:2px 0">• ${p.producto || ''}</td><td style="padding:2px 0;text-align:center;width:70px">${p.cantidad || 0}</td><td style="padding:2px 0;text-align:right;width:80px">${(Number(p.peso) || 0).toFixed(2)} ton</td></tr>`).join('')}
        </table>
      </div>`).join('');
    return `
      <div style="margin-bottom:16px">
        <div style="background:#003F7F;color:white;padding:6px 10px;border-radius:5px 5px 0 0;display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:12px;font-weight:700">
          <span style="background:#1D9E75;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${idxViaje + 1}</span>
          <span>🚛 ${v.vehiculo || '—'}</span>
          <span>Destino: ${v.destino || '—'}</span>
          <span style="margin-left:auto;color:${excedido ? '#FFCDD2' : 'white'}">${peso.toFixed(2)}${capacidad ? ' / ' + capacidad : ''} ton${excedido ? ' ⚠' : ''}</span>
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

// ── Estadísticas de Logística ── (ver estadisticas-logistica.js)
