// ═══════════════════════════════
// PRODUCCIÓN — ESTADÍSTICAS (DASHBOARD) — v1 Vibrocompactados (2026-09-09)
// ═══════════════════════════════
// Se alimenta de PRODUCCIONES (fecha, producto, cantidad = unidades de PRIMERA, merma, segundas,
// consumoCemento — ver docs/modulos/produccion.md, sección "Merma y Segundas"). Sigue el mismo
// lenguaje visual que Logística→Estadísticas (js/estadisticas-logistica.js): selector de período
// en ventana rodante (7/30/90/Todo), tarjetas .stat-card con acento de color, cada gráfica en un
// contenedor de alto fijo (maintainAspectRatio:false). Reusa _tarjetaKPI()/_colorSemaforo()/
// _colorCapacidad(), ya globales desde ese archivo — no se reescriben acá.
//
// "Vibrocompactados" se define por el Costeo de Producto guardado (COSTEO_PRODUCTOS[].
// tipoEstructura === 'vibrocompactado'), NUNCA por el `grupo` del catálogo — el catálogo no trae
// esa clasificación, y el usuario pidió explícitamente basarse en los costeos ("los cuales sí
// están para vibrocompactados discriminados con mayor claridad"). No todo producto vibrocompactado
// tiene todavía un Costeo guardado — los registros de PRODUCCIONES que no se pueden clasificar así
// NO se adivinan por grupo: se excluyen de las tarjetas/gráficas y se cuentan aparte en una nota,
// para que el hueco de cobertura sea visible en vez de silencioso.

// Mapa {nombreProducto: tipoEstructura} — se arma una sola vez por render (no .find() repetido por
// cada registro de PRODUCCIONES). Usa CATALOGO (todos los productos, incluidos descontinuados) en
// vez de PRODUCTOS (solo activos) — igual que _cementoTeoricoPorUnidad() en costeo-producto.js —
// para que un registro histórico de un producto ya descontinuado se siga pudiendo clasificar.
function _mapaTipoEstructuraPorProducto() {
  const codigoPorNombre = {};
  (typeof CATALOGO !== 'undefined' ? CATALOGO : []).forEach(p => { codigoPorNombre[p.nombre] = p.codigo; });
  const tipoPorCodigo = {};
  (typeof COSTEO_PRODUCTOS !== 'undefined' ? COSTEO_PRODUCTOS : []).forEach(c => { tipoPorCodigo[c.productoCodigo] = c.tipoEstructura; });
  const mapa = {};
  Object.keys(codigoPorNombre).forEach(nombre => {
    const tipo = tipoPorCodigo[codigoPorNombre[nombre]];
    if (tipo) mapa[nombre] = tipo;
  });
  return mapa;
}

// Ventana rodante — mismo patrón que _periodoLogistica/setPeriodoLogistica() en
// estadisticas-logistica.js (7/30/90 días o todo, dias=0 = todo).
let _periodoProduccion = 30;
function setPeriodoProduccion(dias) {
  _periodoProduccion = dias;
  [7, 30, 90, 0].forEach(d => {
    const btn = document.getElementById(`est-prod-btn-${d}`);
    if (!btn) return;
    btn.style.background = d === dias ? 'var(--azul)' : 'white';
    btn.style.color = d === dias ? 'white' : 'var(--gris-medio)';
  });
  renderEstadisticasProduccion();
}

// Junta los registros de PRODUCCIONES del período y los separa en vibrocompactados / sin
// clasificar (ver comentario de cabecera). El filtro de fecha usa `fecha` del registro (una
// producción no se reprograma como una entrega de Logística, así que no hay equivalente a
// "fechaOriginal" que considerar acá).
function _datosEstadisticasProduccion(periodoDias) {
  const mapaTipo = _mapaTipoEstructuraPorProducto();
  const desde = periodoDias > 0 ? _fmtISO(_sumarDias(new Date(), -periodoDias)) : null;
  const enPeriodo = (typeof PRODUCCIONES !== 'undefined' ? PRODUCCIONES : []).filter(p => !desde || (p.fecha || '') >= desde);
  const vibrocompactados = enPeriodo.filter(p => mapaTipo[p.producto] === 'vibrocompactado');
  const sinClasificar = enPeriodo.filter(p => !mapaTipo[p.producto]);
  return { vibrocompactados, sinClasificar };
}

// % Deficiencia (merma+segundas sobre lo intentado) — mismos umbrales ya documentados en
// docs/modulos/produccion.md para la tarjeta homónima de Producción Diaria: verde ≤5%, ámbar
// ≤10%, rojo por encima. A diferencia de _colorSemaforo() (donde MÁS es mejor), acá MENOS es
// mejor — no se reusa ese helper con argumentos invertidos porque leería raro en el llamado.
function _colorDeficiencia(pct) {
  if (pct <= 5) return 'var(--verde)';
  if (pct <= 10) return 'var(--naranja)';
  return 'var(--rojo)';
}

function renderEstadisticasProduccion() {
  if (typeof Chart === 'undefined') return; // Chart.js aún no cargó (pantalla no visible todavía)
  const { vibrocompactados, sinClasificar } = _datosEstadisticasProduccion(_periodoProduccion);

  const totalPrimera = vibrocompactados.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
  const totalMerma = vibrocompactados.reduce((s, p) => s + (Number(p.merma) || 0), 0);
  const totalSegundas = vibrocompactados.reduce((s, p) => s + (Number(p.segundas) || 0), 0);
  const totalIntentado = totalPrimera + totalMerma + totalSegundas;
  const pctDeficiencia = totalIntentado > 0 ? ((totalMerma + totalSegundas) / totalIntentado) * 100 : 0;
  const totalCemento = vibrocompactados.reduce((s, p) => s + (Number(p.consumoCemento) || 0), 0);
  const cementoPorUnidad = totalPrimera > 0 && totalCemento > 0 ? totalCemento / totalPrimera : null;

  const tarjetas = document.getElementById('est-prod-tarjetas');
  if (tarjetas) {
    tarjetas.innerHTML = _tarjetaKPI(totalPrimera.toLocaleString(), 'Unidades de primera')
      + _tarjetaKPI(totalMerma.toLocaleString(), 'Merma (ud)', totalMerma ? 'var(--rojo)' : null)
      + _tarjetaKPI(totalSegundas.toLocaleString(), 'Segundas (ud)', totalSegundas ? 'var(--naranja)' : null)
      + _tarjetaKPI(pctDeficiencia.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + '%', '% Deficiencia', totalIntentado ? _colorDeficiencia(pctDeficiencia) : null)
      + _tarjetaKPI(cementoPorUnidad !== null ? cementoPorUnidad.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' kg' : '—', 'Cemento / unidad (primera)');
  }

  const nota = document.getElementById('est-prod-nota-sin-clasificar');
  if (nota) {
    nota.innerHTML = sinClasificar.length
      ? `<div style="background:#FFF3E0;color:#E65100;border-radius:var(--radio);padding:8px 14px;font-size:12px;margin-bottom:16px">⚠️ ${sinClasificar.length} registro${sinClasificar.length === 1 ? '' : 's'} de producto${sinClasificar.length === 1 ? '' : 's'} sin Costeo de Producto guardado no se incluye${sinClasificar.length === 1 ? '' : 'n'} en estas estadísticas — regístrale su Costeo (Centro de Costos → Costeo de Producto, tipo "Vibrocompactado") para que empiece a contar aquí.</div>`
      : '';
  }

  _chartTendenciaProduccion(vibrocompactados, _periodoProduccion);
  _chartTendenciaDeficiencia(vibrocompactados, _periodoProduccion);
  _chartRankingVolumen(vibrocompactados);
  _chartRankingDeficiencia(vibrocompactados);
  _chartCementoPorUnidad(vibrocompactados, _periodoProduccion);
}

// ── Tendencia de producción (unidades de primera) ──
// Mismo mecanismo que _chartTendencia() en estadisticas-logistica.js: recorre día por día la
// ventana y OMITE los días sin producción de primera (no pinta un punto en cero), para que la
// línea no se aplaste en cada hueco.
let _chartTendenciaProduccionInst = null;
function _chartTendenciaProduccion(vibrocompactados, periodoDias) {
  const ctx = document.getElementById('chart-prod-tendencia');
  if (!ctx) return;
  const hoy = new Date();
  let dias = periodoDias;
  if (!dias) {
    const fechas = vibrocompactados.map(p => p.fecha).sort();
    dias = fechas.length ? Math.max(1, Math.round((hoy - new Date(fechas[0] + 'T12:00')) / 86400000) + 1) : 30;
  }
  const labels = [], primeraD = [];
  for (let i = dias - 1; i >= 0; i--) {
    const f = _fmtISO(_sumarDias(hoy, -i));
    const primera = vibrocompactados.filter(p => p.fecha === f).reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
    if (!primera) continue;
    labels.push(new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
    primeraD.push(primera);
  }
  if (_chartTendenciaProduccionInst) _chartTendenciaProduccionInst.destroy();
  _chartTendenciaProduccionInst = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Primera', data: primeraD, borderColor: '#0ca30c', backgroundColor: 'rgba(12,163,12,0.1)', fill: true, borderWidth: 2, pointRadius: labels.length > 31 ? 0 : 3, tension: 0.2 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.y.toLocaleString()} ud de primera` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#898781', maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781', precision: 0 } },
      },
    },
  });
}

// ── Tendencia de merma y segundas — gráfica APARTE con su propia escala (2026-09-09, a pedido
// del usuario) ──
// En la gráfica combinada original, Merma/Segundas quedaban pegadas al piso al compartir eje con
// Primera (números mucho más grandes) — separarlas en su propia gráfica, con su propio eje Y, deja
// ver su tendencia real en vez de una línea plana. Omite los días sin NINGUNA merma/segundas (a
// propósito un criterio propio, distinto al de la gráfica de Primera de arriba — puede haber días
// con producción de primera pero sin ninguna deficiencia, esos no deberían ensuciar esta gráfica).
let _chartTendenciaDeficienciaInst = null;
function _chartTendenciaDeficiencia(vibrocompactados, periodoDias) {
  const ctx = document.getElementById('chart-prod-tendencia-deficiencia');
  if (!ctx) return;
  const hoy = new Date();
  let dias = periodoDias;
  if (!dias) {
    const fechas = vibrocompactados.map(p => p.fecha).sort();
    dias = fechas.length ? Math.max(1, Math.round((hoy - new Date(fechas[0] + 'T12:00')) / 86400000) + 1) : 30;
  }
  const labels = [], mermaD = [], segundasD = [];
  for (let i = dias - 1; i >= 0; i--) {
    const f = _fmtISO(_sumarDias(hoy, -i));
    const delDia = vibrocompactados.filter(p => p.fecha === f);
    const merma = delDia.reduce((s, p) => s + (Number(p.merma) || 0), 0);
    const segundas = delDia.reduce((s, p) => s + (Number(p.segundas) || 0), 0);
    if (!merma && !segundas) continue;
    labels.push(new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
    mermaD.push(merma); segundasD.push(segundas);
  }
  if (_chartTendenciaDeficienciaInst) _chartTendenciaDeficienciaInst.destroy();
  _chartTendenciaDeficienciaInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Merma', data: mermaD, borderColor: '#d03b3b', backgroundColor: 'rgba(208,59,59,0.1)', fill: true, borderWidth: 2, pointRadius: labels.length > 31 ? 0 : 3, tension: 0.2 },
        { label: 'Segundas', data: segundasD, borderColor: '#fab219', backgroundColor: 'rgba(250,178,25,0.1)', fill: true, borderWidth: 2, pointRadius: labels.length > 31 ? 0 : 3, tension: 0.2 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#52514e', boxWidth: 12, padding: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y} ud` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#898781', maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781', precision: 0 } },
      },
    },
  });
}

// ── Ranking de productos por volumen (top 10, unidades de primera) ──
let _chartRankingVolumenInst = null;
function _chartRankingVolumen(vibrocompactados) {
  const ctx = document.getElementById('chart-prod-ranking-volumen');
  if (!ctx) return;
  const conteo = {};
  vibrocompactados.forEach(p => { conteo[p.producto] = (conteo[p.producto] || 0) + (Number(p.cantidad) || 0); });
  const top = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (_chartRankingVolumenInst) _chartRankingVolumenInst.destroy();
  _chartRankingVolumenInst = new Chart(ctx, {
    type: 'bar',
    data: { labels: top.map(([n]) => n), datasets: [{ data: top.map(([, n]) => n), backgroundColor: '#2a78d6', borderRadius: 4, maxBarThickness: 20 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.x.toLocaleString()} ud de primera` } },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781', precision: 0 } },
        y: { grid: { display: false }, ticks: { color: '#0b0b0b', font: { size: 11 } } },
      },
    },
  });
}

// ── Ranking de productos por % de deficiencia (top 10) ──
// Excluye productos con menos de _MIN_INTENTADO_RANKING unidades intentadas en el período, para
// que un producto con 1 sola unidad intentada y esa unidad de merma (100% de deficiencia) no
// desplace del ranking a productos con volumen real — un solo dato no es una tendencia.
const _MIN_INTENTADO_RANKING_DEFICIENCIA = 5;
let _chartRankingDeficienciaInst = null;
function _chartRankingDeficiencia(vibrocompactados) {
  const ctx = document.getElementById('chart-prod-ranking-deficiencia');
  if (!ctx) return;
  const porProducto = {};
  vibrocompactados.forEach(p => {
    if (!porProducto[p.producto]) porProducto[p.producto] = { primera: 0, merma: 0, segundas: 0 };
    porProducto[p.producto].primera += Number(p.cantidad) || 0;
    porProducto[p.producto].merma += Number(p.merma) || 0;
    porProducto[p.producto].segundas += Number(p.segundas) || 0;
  });
  const conPct = Object.entries(porProducto).map(([nombre, r]) => {
    const intentado = r.primera + r.merma + r.segundas;
    const pct = intentado > 0 ? ((r.merma + r.segundas) / intentado) * 100 : 0;
    return { nombre, pct, intentado };
  }).filter(r => r.intentado >= _MIN_INTENTADO_RANKING_DEFICIENCIA);
  const top = conPct.sort((a, b) => b.pct - a.pct).slice(0, 10);
  if (_chartRankingDeficienciaInst) _chartRankingDeficienciaInst.destroy();
  _chartRankingDeficienciaInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(r => r.nombre),
      datasets: [{
        data: top.map(r => Math.round(r.pct * 10) / 10),
        backgroundColor: top.map(r => r.pct <= 5 ? '#0ca30c' : (r.pct <= 10 ? '#fab219' : '#d03b3b')),
        borderRadius: 4,
        maxBarThickness: 20,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.x}% deficiencia (${top[c.dataIndex].intentado.toLocaleString()} ud intentadas)` } },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781', callback: (v) => v + '%' } },
        y: { grid: { display: false }, ticks: { color: '#0b0b0b', font: { size: 11 } } },
      },
    },
  });
}

// ── Consumo de cemento por unidad (de primera) — tendencia en el tiempo ──
// Mismo criterio ya establecido en Producción Diaria: el divisor de cada día es SOLO la cantidad
// de primera de ese día, nunca merma+segundas. Omite días sin cantidad de primera o sin consumo
// de cemento registrado (no hay nada que dividir).
let _chartCementoPorUnidadInst = null;
function _chartCementoPorUnidad(vibrocompactados, periodoDias) {
  const ctx = document.getElementById('chart-prod-cemento-unidad');
  if (!ctx) return;
  const hoy = new Date();
  let dias = periodoDias;
  if (!dias) {
    const fechas = vibrocompactados.map(p => p.fecha).sort();
    dias = fechas.length ? Math.max(1, Math.round((hoy - new Date(fechas[0] + 'T12:00')) / 86400000) + 1) : 30;
  }
  const labels = [], valores = [];
  for (let i = dias - 1; i >= 0; i--) {
    const f = _fmtISO(_sumarDias(hoy, -i));
    const delDia = vibrocompactados.filter(p => p.fecha === f);
    const primera = delDia.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
    const cemento = delDia.reduce((s, p) => s + (Number(p.consumoCemento) || 0), 0);
    if (!primera || !cemento) continue;
    labels.push(new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
    valores.push(Math.round((cemento / primera) * 100) / 100);
  }
  if (_chartCementoPorUnidadInst) _chartCementoPorUnidadInst.destroy();
  _chartCementoPorUnidadInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{ data: valores, borderColor: '#2a78d6', backgroundColor: 'rgba(42,120,214,0.1)', fill: true, borderWidth: 2, pointRadius: labels.length > 31 ? 0 : 4, pointBackgroundColor: '#2a78d6', pointBorderColor: '#fcfcfb', pointBorderWidth: 2, tension: 0.2 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} kg/ud` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#898781', maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781' } },
      },
    },
  });
}
