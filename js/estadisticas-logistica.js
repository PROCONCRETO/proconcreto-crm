// ═══════════════════════════════
// LOGÍSTICA — ESTADÍSTICAS (DASHBOARD)
// ═══════════════════════════════
// Se alimenta de VIAJES y del campo `cumplido` de cada entrega (ver logistica.js).
// Colores de estado (hecha/reprogramada/cancelada/pendiente) usan la paleta de estado fija
// de la skill de dataviz — nunca se reusan para otra cosa. El resto de gráficas usa un solo
// color/eje por gráfica (nunca doble eje).

const _COLOR_CUMPLIDO = {
  hecha:        { color: '#0ca30c', icono: '✅', etiqueta: 'Hecha' },
  reprogramada: { color: '#fab219', icono: '🔁', etiqueta: 'Reprogramada' },
  cancelada:    { color: '#d03b3b', icono: '❌', etiqueta: 'Cancelada' },
  pendiente:    { color: '#b0aea6', icono: '⏳', etiqueta: 'Pendiente' },
};

// Junta viajes + entregas del periodo seleccionado (solo hoy y hacia atrás; el futuro no
// tiene cumplimiento que medir todavía).
function _datosEstadisticasLogistica(periodoDias) {
  const hoy = _fmtISO(new Date());
  const desde = periodoDias > 0 ? _fmtISO(_sumarDias(new Date(), -periodoDias)) : null;
  const entregas = [];
  const viajesEnPeriodo = [];
  VIAJES.forEach(v => {
    if (v.fecha > hoy) return;
    if (desde && v.fecha < desde) return;
    viajesEnPeriodo.push(v);
    _entregasDeViaje(v).forEach(e => {
      const pesoEntrega = (e.productos || []).reduce((s, p) => s + (Number(p.peso) || 0), 0);
      entregas.push({ fecha: v.fecha, vehiculo: v.vehiculo, destino: (e.destino || v.destino || '').trim() || 'Sin destino', cumplido: _cumplidoDeEntrega(e).estado, pesoEntrega });
    });
  });
  return { viajesEnPeriodo, entregas };
}

function _tarjetaKPI(label, valor) {
  return `<div class="card" style="padding:14px 16px;text-align:center;margin-bottom:0">
    <div style="font-size:11px;font-weight:600;color:var(--gris-medio);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${label}</div>
    <div style="font-size:26px;font-weight:700;color:var(--azul)">${valor}</div>
  </div>`;
}

function renderEstadisticasLogistica() {
  if (typeof Chart === 'undefined') return; // Chart.js aún no cargó (pantalla no visible todavía)
  const periodo = Number(document.getElementById('est-log-periodo')?.value || 30);
  const { viajesEnPeriodo, entregas } = _datosEstadisticasLogistica(periodo);

  const totalViajes = viajesEnPeriodo.length;
  const pesoTotal = viajesEnPeriodo.reduce((s, v) => s + (Number(v.pesoTotal) || 0), 0);
  const hechas = entregas.filter(e => e.cumplido === 'hecha').length;
  const pctCumplimiento = entregas.length ? Math.round((hechas / entregas.length) * 100) : 0;
  const viajesConCapacidad = viajesEnPeriodo.filter(v => CAPACIDAD_VEHICULO[v.vehiculo]);
  const pctCapacidadProm = viajesConCapacidad.length
    ? Math.round(viajesConCapacidad.reduce((s, v) => s + (Number(v.pesoTotal) || 0) / CAPACIDAD_VEHICULO[v.vehiculo], 0) / viajesConCapacidad.length * 100)
    : 0;

  const tarjetas = document.getElementById('est-log-tarjetas');
  if (tarjetas) {
    tarjetas.innerHTML = _tarjetaKPI('Viajes en el periodo', totalViajes)
      + _tarjetaKPI('Peso transportado', pesoTotal.toFixed(1) + ' ton')
      + _tarjetaKPI('% Cumplimiento', pctCumplimiento + '%')
      + _tarjetaKPI('% Capacidad promedio', pctCapacidadProm + '%');
  }

  _chartCumplimiento(entregas);
  _chartVehiculos(viajesEnPeriodo);
  _chartTendencia(viajesEnPeriodo, periodo);
  _chartDestinos(entregas);
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
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#52514e', boxWidth: 12, padding: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: (c) => { const pct = total ? Math.round(c.parsed / total * 100) : 0; return ` ${c.label}: ${c.parsed} (${pct}%)`; } } },
      },
    },
  });
}

// ── Desempeño por vehículo (peso transportado; viajes y % capacidad van en la tabla de
// apoyo debajo, para no mezclar tres métricas de distinta escala en un solo eje) ──
let _chartVehiculosInst = null;
function _chartVehiculos(viajesEnPeriodo) {
  const ctx = document.getElementById('chart-log-vehiculos');
  if (!ctx) return;
  const vehiculos = Object.keys(CAPACIDAD_VEHICULO);
  const pesos = vehiculos.map(veh => viajesEnPeriodo.filter(v => v.vehiculo === veh).reduce((s, v) => s + (Number(v.pesoTotal) || 0), 0));
  const viajesCount = vehiculos.map(veh => viajesEnPeriodo.filter(v => v.vehiculo === veh).length);

  if (_chartVehiculosInst) _chartVehiculosInst.destroy();
  _chartVehiculosInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: vehiculos.map(v => (v.split(' / ')[1] || v).trim()),
      datasets: [{ data: pesos, backgroundColor: vehiculos.map(v => COLOR_VEHICULO_VIAJE[v] || '#607D8B'), borderRadius: 4, maxBarThickness: 24 }],
    },
    options: {
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
      return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:7px 0;border-top:1px solid var(--gris-borde)">
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${COLOR_VEHICULO_VIAJE[veh]};margin-right:6px"></span>${veh} <span style="color:var(--gris-medio)">(${esPropio ? 'propio' : 'tercerizado'})</span></span>
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
