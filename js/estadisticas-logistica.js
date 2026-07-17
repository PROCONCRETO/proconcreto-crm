// ═══════════════════════════════
// LOGÍSTICA — ESTADÍSTICAS (DASHBOARD)
// ═══════════════════════════════
// Se alimenta de VIAJES y del campo `cumplido` de cada entrega (ver logistica.js). Sigue el
// mismo lenguaje visual que Cotizaciones→Estadísticas y Calidad→Análisis Estadístico:
// tarjetas .stat-card con acento de color, selector de período en botones segmentados, y cada
// gráfica en un contenedor de alto fijo (maintainAspectRatio:false) para que el tamaño no
// dependa de cuántos datos haya. Colores de estado (hecha/reprogramada/cancelada/pendiente)
// usan la paleta de estado fija de la skill de dataviz — nunca se reusan para otra cosa. El
// resto de gráficas usa un solo color/eje por gráfica (nunca doble eje).

const _COLOR_CUMPLIDO = {
  hecha:        { color: '#0ca30c', icono: '✅', etiqueta: 'Hecha' },
  reprogramada: { color: '#fab219', icono: '🔁', etiqueta: 'Reprogramada' },
  cancelada:    { color: '#d03b3b', icono: '❌', etiqueta: 'Cancelada' },
  pendiente:    { color: '#b0aea6', icono: '⏳', etiqueta: 'Pendiente' },
};

// Cumplimiento a nivel de VIAJE (no de entrega individual): un viaje puede tener varias
// entregas con resultados distintos, así que se resume en 4 categorías con la misma lógica
// de colores de estado (verde=bien, ámbar=a medias, rojo=mal, gris=todavía sin resolver).
const _COLOR_CUMPLIDO_VIAJE = {
  completo:     { color: '#0ca30c', icono: '✅', etiqueta: 'Completo (100%)' },
  parcial:      { color: '#fab219', icono: '🔶', etiqueta: 'Parcial' },
  sin_cumplir:  { color: '#d03b3b', icono: '❌', etiqueta: 'Sin cumplir (0%)' },
  pendiente:    { color: '#b0aea6', icono: '⏳', etiqueta: 'Pendiente' },
};

// "¿Esta entrega se reprogramó alguna vez?" — es un hecho histórico, independiente del estado
// ACTUAL (una entrega se puede haber reprogramado y de todas formas terminar "hecha": reprogramar
// ya no bloquea la entrega, ver marcarCumplidoEntrega() en logistica.js). Cubre tres señales:
// `_countReprogramaciones(e)` (mecanismo nuevo, con historial y causa; no bloquea nada),
// `cumplido.estado === 'reprogramada'` (marcas de antes de este cambio, donde sí quedaba fija
// como estado final) y `fechaOriginal` distinta a la fecha actual del viaje (se arrastró en el
// calendario sin pasar por Cumplidos).
function _fueReprogramada(e, viajeFecha) {
  if (_countReprogramaciones(e)) return true;
  if (_cumplidoDeEntrega(e).estado === 'reprogramada') return true;
  const fechaOriginal = e.fechaOriginal || viajeFecha;
  return fechaOriginal !== viajeFecha;
}

function _categoriaCumplidoViaje(v) {
  const estados = _entregasDeViaje(v).map(e => _cumplidoDeEntrega(e).estado);
  if (!estados.length || estados.some(s => s === 'pendiente')) return 'pendiente';
  const hechas = estados.filter(s => s === 'hecha').length;
  if (hechas === estados.length) return 'completo';
  if (hechas > 0) return 'parcial';
  return 'sin_cumplir';
}

// Junta viajes + entregas del periodo seleccionado. El filtro de fecha usa `fechaOriginal` (el
// compromiso original de la entrega), no la fecha actual del viaje — así una entrega que se
// movió de hoy hacia adelante se sigue evaluando dentro de la ventana de hoy en vez de
// desaparecer de las estadísticas, y de paso queda contada como reprogramada ahí (ver
// _fueReprogramada arriba) aunque termine "hecha" en su fecha nueva.
function _datosEstadisticasLogistica(periodoDias) {
  const hoy = _fmtISO(new Date());
  const desde = periodoDias > 0 ? _fmtISO(_sumarDias(new Date(), -periodoDias)) : null;
  const entregas = [];
  const viajesEnPeriodo = [];
  const viajesVistos = new Set();
  const causasReprogramacion = [];
  const causasCancelacion = [];
  VIAJES.forEach(v => {
    _entregasDeViaje(v).forEach(e => {
      const fechaOriginal = e.fechaOriginal || v.fecha;
      if (fechaOriginal > hoy) return; // el compromiso original todavía no vence
      if (desde && fechaOriginal < desde) return;
      const pesoEntrega = (e.productos || []).reduce((s, p) => s + (Number(p.peso) || 0), 0);
      // La ciudad de destino es la del viaje (Ciudad de Destino), no el "Destino específico /
      // Proyecto" de la entrega — ese es el sitio puntual dentro de la ciudad, no la ciudad.
      // `viajeId` se guarda para poder agrupar por viaje real (no por entrega) en los cálculos
      // de desempeño por vehículo — un viaje con 2 entregas cuenta como 1 viaje, no como 2.
      entregas.push({
        viajeId: v.id, vehiculo: v.vehiculo, fecha: v.fecha, fechaOriginal,
        destino: (v.destino || '').trim() || 'Sin destino',
        cumplido: _cumplidoDeEntrega(e).estado,
        reprogramada: _fueReprogramada(e, v.fecha),
        pesoEntrega,
      });
      // Causas: un registro por CADA VEZ que se reprogramó (una entrega puede reprogramarse más
      // de una vez, con causas distintas cada vez), y uno por cada cancelación con causa.
      (e.reprogramaciones || []).forEach(r => { if (r.causa) causasReprogramacion.push(r.causa); });
      const c = _cumplidoDeEntrega(e);
      if (c.estado === 'cancelada' && c.causa) causasCancelacion.push(c.causa);
      if (!viajesVistos.has(v.id)) { viajesVistos.add(v.id); viajesEnPeriodo.push(v); }
    });
  });
  return { viajesEnPeriodo, entregas, causasReprogramacion, causasCancelacion };
}

// ── Tarjetas KPI (.stat-card, mismo componente que Cotizaciones→Estadísticas) ──
function _tarjetaKPI(valor, etiqueta, color) {
  return `<div class="stat-card"${color ? ` style="border-color:${color}"` : ''}>
    <div class="valor"${color ? ` style="color:${color}"` : ''}>${valor}</div>
    <div class="etiqueta">${etiqueta}</div>
  </div>`;
}

// Semáforo genérico: verde si ya alcanzó la meta, ámbar a medias, rojo si va mal.
function _colorSemaforo(pct, buenoDesde = 80, regularDesde = 50) {
  if (pct >= buenoDesde) return 'var(--verde)';
  if (pct >= regularDesde) return 'var(--naranja)';
  return 'var(--rojo)';
}

// La capacidad es distinta: pasarse de 100% es sobrecarga (rojo), no una meta superada.
function _colorCapacidad(pct) {
  if (pct > 100) return 'var(--rojo)';
  if (pct >= 70) return 'var(--verde)';
  return 'var(--naranja)';
}

// ── Selector de período (botones segmentados, igual patrón que setPeriodo() en Cotizaciones) ──
let _periodoLogistica = 30;

function setPeriodoLogistica(dias) {
  _periodoLogistica = dias;
  [7, 30, 90, 0].forEach(d => {
    const btn = document.getElementById(`est-log-btn-${d}`);
    if (!btn) return;
    btn.style.background = d === dias ? 'var(--azul)' : 'white';
    btn.style.color = d === dias ? 'white' : 'var(--gris-medio)';
  });
  renderEstadisticasLogistica();
}

function renderEstadisticasLogistica() {
  if (typeof Chart === 'undefined') return; // Chart.js aún no cargó (pantalla no visible todavía)
  const periodo = _periodoLogistica;
  const { viajesEnPeriodo, entregas, causasReprogramacion, causasCancelacion } = _datosEstadisticasLogistica(periodo);

  // "Peso transportado" y desempeño por vehículo son sobre lo que REALMENTE se cumplió, no
  // sobre lo programado — así que se agrupan las entregas "hecha" por viaje real (un viaje con
  // 2 entregas hechas sigue siendo 1 viaje, no 2, y una entrega todavía pendiente no cuenta
  // como peso ya transportado).
  const entregasHechas = entregas.filter(e => e.cumplido === 'hecha');
  const viajesPorId = {};
  entregasHechas.forEach(e => {
    if (!viajesPorId[e.viajeId]) viajesPorId[e.viajeId] = { vehiculo: e.vehiculo, pesoHecho: 0 };
    viajesPorId[e.viajeId].pesoHecho += e.pesoEntrega;
  });
  const viajesCumplidos = Object.values(viajesPorId);

  const totalViajes = viajesEnPeriodo.length;
  const pesoTransportado = entregasHechas.reduce((s, e) => s + e.pesoEntrega, 0);
  const pctCumplimiento = entregas.length ? Math.round((entregasHechas.length / entregas.length) * 100) : 0;
  const viajesCumplidosConCapacidad = viajesCumplidos.filter(vv => CAPACIDAD_VEHICULO[vv.vehiculo]);
  const pctCapacidadProm = viajesCumplidosConCapacidad.length
    ? Math.round(viajesCumplidosConCapacidad.reduce((s, vv) => s + vv.pesoHecho / CAPACIDAD_VEHICULO[vv.vehiculo], 0) / viajesCumplidosConCapacidad.length * 100)
    : 0;
  // Cuenta el hecho histórico de haberse reprogramado (ver _fueReprogramada), no un bucket de
  // estado actual — una entrega puede estar aquí Y en el conteo de "Hecha" a la vez, porque
  // reprogramar ya no es un resultado final.
  const entregasReprogramadas = entregas.filter(e => e.reprogramada).length;

  const tarjetas = document.getElementById('est-log-tarjetas');
  if (tarjetas) {
    tarjetas.innerHTML = _tarjetaKPI(totalViajes, 'Viajes en el periodo')
      + _tarjetaKPI(entregas.length, 'Entregas programadas')
      + _tarjetaKPI(entregasReprogramadas, 'Entregas reprogramadas', entregasReprogramadas ? 'var(--naranja)' : null)
      + _tarjetaKPI(pesoTransportado.toFixed(1) + ' ton', 'Peso transportado')
      + _tarjetaKPI(pctCumplimiento + '%', '% Cumplimiento', entregas.length ? _colorSemaforo(pctCumplimiento) : null)
      + _tarjetaKPI(pctCapacidadProm + '%', '% Capacidad promedio', viajesCumplidosConCapacidad.length ? _colorCapacidad(pctCapacidadProm) : null);
  }

  _chartCumplimiento(entregas);
  _chartCumplimientoViajes(viajesEnPeriodo);
  _chartVehiculos(viajesCumplidos);
  _chartTendencia(viajesEnPeriodo, periodo);
  _chartDestinos(entregas);
  _chartCausas('chart-log-causas-reprogramacion', causasReprogramacion, '#fab219');
  _chartCausas('chart-log-causas-cancelacion', causasCancelacion, '#d03b3b');
  _tablaCausas(causasReprogramacion, causasCancelacion);
}

// ── Cumplimiento de entregas (dona, colores de estado) ──
let _chartCumplimientoInst = null;
function _chartCumplimiento(entregas) {
  const ctx = document.getElementById('chart-log-cumplimiento');
  if (!ctx) return;
  const estados = ['hecha', 'reprogramada', 'cancelada', 'pendiente'];
  const counts = estados.map(es => entregas.filter(e => e.cumplido === es).length);
  const total = counts.reduce((a, b) => a + b, 0);
  if (_chartCumplimientoInst) _chartCumplimientoInst.destroy();
  _chartCumplimientoInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: estados.map(es => `${_COLOR_CUMPLIDO[es].icono} ${_COLOR_CUMPLIDO[es].etiqueta}`),
      datasets: [{
        data: counts,
        backgroundColor: estados.map(es => _COLOR_CUMPLIDO[es].color),
        borderColor: '#fcfcfb',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#52514e', boxWidth: 12, padding: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: (c) => { const pct = total ? Math.round(c.parsed / total * 100) : 0; return ` ${c.label}: ${c.parsed} (${pct}%)`; } } },
      },
    },
  });
}

// ── Cumplimiento de viajes (dona, mismos colores de estado a nivel de viaje completo) ──
let _chartCumplimientoViajesInst = null;
function _chartCumplimientoViajes(viajesEnPeriodo) {
  const ctx = document.getElementById('chart-log-cumplimiento-viajes');
  if (!ctx) return;
  const categorias = ['completo', 'parcial', 'sin_cumplir', 'pendiente'];
  const counts = categorias.map(c => viajesEnPeriodo.filter(v => _categoriaCumplidoViaje(v) === c).length);
  const total = counts.reduce((a, b) => a + b, 0);
  if (_chartCumplimientoViajesInst) _chartCumplimientoViajesInst.destroy();
  _chartCumplimientoViajesInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categorias.map(c => `${_COLOR_CUMPLIDO_VIAJE[c].icono} ${_COLOR_CUMPLIDO_VIAJE[c].etiqueta}`),
      datasets: [{
        data: counts,
        backgroundColor: categorias.map(c => _COLOR_CUMPLIDO_VIAJE[c].color),
        borderColor: '#fcfcfb',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#52514e', boxWidth: 12, padding: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: (c) => { const pct = total ? Math.round(c.parsed / total * 100) : 0; return ` ${c.label}: ${c.parsed} (${pct}%)`; } } },
      },
    },
  });
}

// ── Desempeño por vehículo (peso REALMENTE transportado — solo viajes con al menos una
// entrega marcada "Hecha"; un viaje con 2 entregas hechas cuenta como 1 viaje, no como 2, y
// una entrega todavía pendiente no suma peso ni viaje. Viajes y % capacidad van en la tabla de
// apoyo debajo, para no mezclar tres métricas de distinta escala en un solo eje.
// La etiqueta es la placa (vehículos propios) o el tipo de camión (tercerizados) — nunca el
// nombre del conductor, y así los dos tercerizados (camión sencillo vs. tractocamión) quedan
// diferenciados en vez de aparecer los dos como "TERCERIZADO". ──
let _chartVehiculosInst = null;
function _chartVehiculos(viajesCumplidos) {
  const ctx = document.getElementById('chart-log-vehiculos');
  if (!ctx) return;
  const vehiculos = Object.keys(CAPACIDAD_VEHICULO);
  const pesos = vehiculos.map(veh => viajesCumplidos.filter(vv => vv.vehiculo === veh).reduce((s, vv) => s + vv.pesoHecho, 0));
  const viajesCount = vehiculos.map(veh => viajesCumplidos.filter(vv => vv.vehiculo === veh).length);
  const etiquetas = vehiculos.map(v => (v.split(' / ')[0] || v).trim());

  if (_chartVehiculosInst) _chartVehiculosInst.destroy();
  _chartVehiculosInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [{ data: pesos, backgroundColor: vehiculos.map(v => COLOR_VEHICULO_VIAJE[v] || '#607D8B'), borderRadius: 4, maxBarThickness: 24 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.x.toFixed(1)} ton · ${viajesCount[c.dataIndex]} viaje${viajesCount[c.dataIndex] === 1 ? '' : 's'}` } },
      },
      scales: {
        x: { grid: { color: '#e1e0d9' }, ticks: { color: '#898781' }, title: { display: true, text: 'Toneladas transportadas', color: '#52514e', font: { size: 11 } } },
        y: { grid: { display: false }, ticks: { color: '#0b0b0b', font: { size: 11 } } },
      },
    },
  });

  const tabla = document.getElementById('tabla-log-vehiculos');
  if (tabla) {
    tabla.innerHTML = vehiculos.map((veh, i) => {
      const cap = CAPACIDAD_VEHICULO[veh];
      const esPropio = VEHICULO_ES_PROPIO[veh];
      const pctCap = viajesCount[i] ? Math.round((pesos[i] / (cap * viajesCount[i])) * 100) : 0;
      return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:7px 0;border-top:1px solid var(--gris-borde)" title="${veh}">
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${COLOR_VEHICULO_VIAJE[veh]};margin-right:6px"></span>${etiquetas[i]} <span style="color:var(--gris-medio)">(${esPropio ? 'propio' : 'tercerizado'})</span></span>
        <span style="color:var(--gris-medio)">${viajesCount[i]} viaje${viajesCount[i] === 1 ? '' : 's'} · ${pctCap}% de capacidad prom.</span>
      </div>`;
    }).join('');
  }
}

// ── Tendencia de viajes por día (una sola serie, un solo eje) ──
let _chartTendenciaInst = null;
function _chartTendencia(viajesEnPeriodo, periodoDias) {
  const ctx = document.getElementById('chart-log-tendencia');
  if (!ctx) return;
  const hoy = new Date();
  let dias = periodoDias;
  if (!dias) {
    const fechas = viajesEnPeriodo.map(v => v.fecha).sort();
    dias = fechas.length ? Math.max(1, Math.round((hoy - new Date(fechas[0] + 'T12:00')) / 86400000) + 1) : 30;
  }
  const labels = [], counts = [];
  for (let i = dias - 1; i >= 0; i--) {
    const f = _fmtISO(_sumarDias(hoy, -i));
    labels.push(new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
    counts.push(viajesEnPeriodo.filter(v => v.fecha === f).length);
  }
  if (_chartTendenciaInst) _chartTendenciaInst.destroy();
  _chartTendenciaInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: counts,
        borderColor: '#2a78d6',
        backgroundColor: 'rgba(42,120,214,0.1)',
        fill: true,
        borderWidth: 2,
        pointRadius: dias > 31 ? 0 : 4,
        pointBackgroundColor: '#2a78d6',
        pointBorderColor: '#fcfcfb',
        pointBorderWidth: 2,
        tension: 0.2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} viaje${c.parsed.y === 1 ? '' : 's'}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#898781', maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781', precision: 0 } },
      },
    },
  });
}

// ── Destinos más frecuentes (ranking, top 8) ──
let _chartDestinosInst = null;
function _chartDestinos(entregas) {
  const ctx = document.getElementById('chart-log-destinos');
  if (!ctx) return;
  const conteo = {};
  entregas.forEach(e => { conteo[e.destino] = (conteo[e.destino] || 0) + 1; });
  const top = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (_chartDestinosInst) _chartDestinosInst.destroy();
  _chartDestinosInst = new Chart(ctx, {
    type: 'bar',
    data: { labels: top.map(([d]) => d), datasets: [{ data: top.map(([, n]) => n), backgroundColor: '#2a78d6', borderRadius: 4, maxBarThickness: 20 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.x} entrega${c.parsed.x === 1 ? '' : 's'}` } },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781', precision: 0 } },
        y: { grid: { display: false }, ticks: { color: '#0b0b0b', font: { size: 11 } } },
      },
    },
  });
}

// ── Causas de reprogramación / cancelación más frecuentes (ranking, top 7) — mismo patrón que
// Destinos, pero coloreado con la paleta de estado (ámbar=reprogramación, rojo=cancelación) para
// mantener el mismo lenguaje visual del resto del dashboard. Las etiquetas del eje Y se truncan
// (la causa completa queda en el tooltip) porque el texto de las causas es largo y en 7 filas se
// encima si no se acorta.
const _chartCausasInst = {};
function _chartCausas(canvasId, causas, color) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const conteo = {};
  causas.forEach(c => { conteo[c] = (conteo[c] || 0) + 1; });
  const top = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 7);
  if (_chartCausasInst[canvasId]) _chartCausasInst[canvasId].destroy();
  _chartCausasInst[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels: top.map(([c]) => c), datasets: [{ data: top.map(([, n]) => n), backgroundColor: color, borderRadius: 4, maxBarThickness: 20 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${top[c.dataIndex][0]}: ${c.parsed.x} vez${c.parsed.x === 1 ? '' : 'es'}` } },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781', precision: 0 } },
        y: {
          grid: { display: false },
          ticks: { color: '#0b0b0b', font: { size: 10 }, autoSkip: false, callback: (val, idx) => { const t = top[idx] ? top[idx][0] : ''; return t.length > 34 ? t.slice(0, 32) + '…' : t; } },
        },
      },
    },
  });
}

// ── Motivos más frecuentes (tabla, no gráfica) — junta reprogramación y cancelación en un solo
// ranking por PORCENTAJE del total de incidencias, para leer de un vistazo cuál es la causa raíz
// más recurrente sin importar en cuál de las dos terminó, complementando las dos gráficas de
// arriba (que sí las separan por tipo). Cada fila es una barra de progreso simple en HTML, no
// Chart.js — es una tabla ordenada, no una gráfica nueva. ──
function _tablaCausas(causasReprogramacion, causasCancelacion) {
  const cont = document.getElementById('tabla-log-causas');
  if (!cont) return;

  const total = causasReprogramacion.length + causasCancelacion.length;
  if (!total) {
    cont.innerHTML = '<div class="empty-state"><div class="icono">📋</div><div>Todavía no hay causas registradas — aparecen acá cuando se reprograma o cancela una entrega con causa elegida en Cumplidos.</div></div>';
    return;
  }

  const conteoRepro = {};
  causasReprogramacion.forEach(c => { conteoRepro[c] = (conteoRepro[c] || 0) + 1; });
  const conteoCancel = {};
  causasCancelacion.forEach(c => { conteoCancel[c] = (conteoCancel[c] || 0) + 1; });

  const causas = new Set([...Object.keys(conteoRepro), ...Object.keys(conteoCancel)]);
  const filas = [...causas].map(causa => {
    const repro = conteoRepro[causa] || 0;
    const cancel = conteoCancel[causa] || 0;
    const casos = repro + cancel;
    return { causa, repro, cancel, casos, pct: Math.round((casos / total) * 100) };
  }).sort((a, b) => b.casos - a.casos);

  cont.innerHTML = filas.map(f => `
    <div style="padding:9px 0;border-top:1px solid var(--gris-borde)">
      <div style="display:flex;justify-content:space-between;gap:10px;font-size:12.5px;margin-bottom:5px">
        <span style="font-weight:600">${f.causa}</span>
        <span style="white-space:nowrap;color:var(--gris-medio)">${f.pct}% · ${f.casos} caso${f.casos === 1 ? '' : 's'}${f.repro ? ` · <span style="color:var(--naranja)">🔁 ${f.repro}</span>` : ''}${f.cancel ? ` · <span style="color:var(--rojo)">❌ ${f.cancel}</span>` : ''}</span>
      </div>
      <div style="background:#eee;border-radius:3px;height:6px;overflow:hidden">
        <div style="width:${f.pct}%;height:100%;background:var(--azul)"></div>
      </div>
    </div>`).join('');
}
