// ═══════════════════════════════
// LOGÍSTICA — PROGRAMACIÓN DE ENTREGAS (CALENDARIO)
// ═══════════════════════════════
let ENTREGAS_PROGRAMADAS = [];

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
const COLOR_VEHICULO_ENTREGA = { 'Camión 1': '#1565C0', 'Camión 2': '#00838F', 'Tercero': '#E65100', 'Tractomula': '#6A1B9A' };

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
    const entregasDia = ENTREGAS_PROGRAMADAS.filter(e => e.fecha === fechaStr).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

    let clases = 'log-cal-celda';
    if (festivoNombre) clases += ' log-cal-festivo';
    else if (dow === 0 || dow === 6) clases += ' log-cal-finde';
    if (esHoy) clases += ' log-cal-hoy';

    celdas += `
      <div class="${clases}" onclick="abrirModalEntrega('${fechaStr}')">
        <div class="log-cal-dia-num">${dia}${esHoy ? ' <span class="log-cal-hoy-badge">HOY</span>' : ''}</div>
        ${festivoNombre ? `<div class="log-cal-festivo-nombre" title="${festivoNombre}">🎉 ${festivoNombre}</div>` : ''}
        <div class="log-cal-entregas">
          ${entregasDia.map(e => `
            <div class="log-cal-entrega" style="background:${COLOR_VEHICULO_ENTREGA[e.vehiculo] || '#607D8B'}${e.estado === 'Cancelada' ? ';opacity:.5;text-decoration:line-through' : ''}" onclick="event.stopPropagation();editarEntrega('${e.id}')" title="${e.destino || ''}${e.vehiculo ? ' — ' + e.vehiculo : ''}${e.estado ? ' — ' + e.estado : ''}">
              ${e.hora ? e.hora + ' · ' : ''}${e.cliente || e.destino || 'Entrega'}
            </div>`).join('')}
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

// ── Modal de Entrega ──
function abrirModalEntrega(fecha) {
  document.getElementById('m-entrega-id').value = '';
  document.getElementById('modal-entrega-titulo').textContent = '🚛 Nueva Entrega';
  document.getElementById('m-entrega-fecha').value = fecha || _fmtISO(new Date());
  document.getElementById('m-entrega-hora').value = '';
  document.getElementById('m-entrega-cliente').value = '';
  document.getElementById('m-entrega-destino').value = '';
  document.getElementById('m-entrega-producto').value = '';
  document.getElementById('m-entrega-peso').value = '';
  document.getElementById('m-entrega-vehiculo').value = 'Camión 1';
  document.getElementById('m-entrega-estado').value = 'Programada';
  document.getElementById('m-entrega-obs').value = '';
  document.getElementById('btn-eliminar-entrega').style.display = 'none';
  if (typeof poblarDatalistClientes === 'function') poblarDatalistClientes('datalist-clientes-entrega');
  document.getElementById('modal-entrega').classList.add('abierto');
}

function editarEntrega(id) {
  const e = ENTREGAS_PROGRAMADAS.find(x => String(x.id) === String(id));
  if (!e) return;
  document.getElementById('m-entrega-id').value = e.id;
  document.getElementById('modal-entrega-titulo').textContent = '✏️ Editar Entrega';
  document.getElementById('m-entrega-fecha').value = e.fecha || '';
  document.getElementById('m-entrega-hora').value = e.hora || '';
  document.getElementById('m-entrega-cliente').value = e.cliente || '';
  document.getElementById('m-entrega-destino').value = e.destino || '';
  document.getElementById('m-entrega-producto').value = e.producto || '';
  document.getElementById('m-entrega-peso').value = e.peso || '';
  document.getElementById('m-entrega-vehiculo').value = e.vehiculo || 'Camión 1';
  document.getElementById('m-entrega-estado').value = e.estado || 'Programada';
  document.getElementById('m-entrega-obs').value = e.observaciones || '';
  document.getElementById('btn-eliminar-entrega').style.display = 'inline-flex';
  if (typeof poblarDatalistClientes === 'function') poblarDatalistClientes('datalist-clientes-entrega');
  document.getElementById('modal-entrega').classList.add('abierto');
}

function guardarEntrega() {
  const fecha = document.getElementById('m-entrega-fecha').value;
  const destino = document.getElementById('m-entrega-destino').value.trim();
  if (!fecha || !destino) { alert('Completa los campos obligatorios: Fecha y Destino / Proyecto.'); return; }
  const editId = document.getElementById('m-entrega-id').value;
  const previa = editId ? ENTREGAS_PROGRAMADAS.find(x => String(x.id) === String(editId)) : null;
  const entrega = {
    id: editId || String(Date.now()),
    fecha,
    hora: document.getElementById('m-entrega-hora').value,
    cliente: document.getElementById('m-entrega-cliente').value.trim(),
    destino,
    producto: document.getElementById('m-entrega-producto').value.trim(),
    peso: parseFloat(document.getElementById('m-entrega-peso').value) || 0,
    vehiculo: document.getElementById('m-entrega-vehiculo').value,
    estado: document.getElementById('m-entrega-estado').value,
    observaciones: document.getElementById('m-entrega-obs').value.trim(),
    creadoPor: previa ? previa.creadoPor : USUARIO_ACTUAL?.email,
    creadoEn: previa ? (previa.creadoEn || new Date().toISOString()) : new Date().toISOString(),
  };
  const idx = ENTREGAS_PROGRAMADAS.findIndex(x => String(x.id) === String(entrega.id));
  if (idx >= 0) ENTREGAS_PROGRAMADAS[idx] = entrega; else ENTREGAS_PROGRAMADAS.unshift(entrega);
  sb.from('entregas_programadas').upsert({ id: entrega.id, datos: entrega, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) console.error('Error guardando entrega:', error.message); });
  cerrarModal('modal-entrega');
  renderCalendarioLogistica();
}

function eliminarEntrega() {
  const id = document.getElementById('m-entrega-id').value;
  const e = ENTREGAS_PROGRAMADAS.find(x => String(x.id) === String(id));
  if (!e || !confirm(`¿Eliminar la entrega del ${e.fecha}${e.destino ? ' — ' + e.destino : ''}?`)) return;
  ENTREGAS_PROGRAMADAS = ENTREGAS_PROGRAMADAS.filter(x => String(x.id) !== String(id));
  cerrarModal('modal-entrega');
  renderCalendarioLogistica();
  sb.from('entregas_programadas').delete().eq('id', id)
    .then(({ error }) => {
      if (error) { console.error('Error eliminando entrega:', error.message); alert('Error al eliminar: ' + error.message); ENTREGAS_PROGRAMADAS.push(e); renderCalendarioLogistica(); }
    });
}
