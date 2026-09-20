// ═══════════════════════════════
// PRODUCCIÓN — ESTADÍSTICAS (DASHBOARD) — Pretensados (2026-09-21, primer borrador)
// ═══════════════════════════════
// Mismo dashboard que Vibrocompactados (js/estadisticas-produccion.js) — misma fuente de datos
// (PRODUCCIONES), mismo lenguaje visual, misma filosofía de "excluir 'excluido', contar
// 'pendiente_revision'" — adaptado a cómo se produce un Pretensado: no hay "ciclos de máquina",
// se produce por BANCO (una cama de tensionado que se vacía una sola vez y rinde varias piezas —
// ver _calcularCosteoPretensado() en costeo-producto.js). El equivalente real de "ciclos" acá es
// "bancos": la unidad de esfuerzo de LÍNEA comparable entre productos distintos, sin importar
// cuántos metros lineales rinda cada uno.
//
// Dato clave verificado antes de construir esto (no es un supuesto): los productos Pretensado
// reales (viguetas, prelosas) están en el catálogo con `unidad: 'ML'` (metro lineal) — así que
// `cantidad` en PRODUCCIONES para un registro Pretensado YA viene en metros lineales, no en
// piezas (Producción Diaria no distingue tipos, simplemente copia `unidad` del catálogo). No
// existe ningún campo que registre "bancos completados" directo — se infiere dividiendo esos
// metros lineales entre "Metros lineales/banco" del Costeo de ESE producto (mismo criterio que
// ya usa `_unidadesTeoricasDiaPorProducto()` en costeo-producto.js para el rendimiento teórico).
//
// Reutiliza tal cual (no se redefinen): _mapaTipoEstructuraPorProducto(), _desviacionEstandar(),
// _promedioDentro3Sigma(), _colorDeficiencia() (estadisticas-produccion.js) y _tarjetaKPI()
// (estadisticas-logistica.js) — todas ya genéricas, no específicas de Vibrocompactado.
//
// Fuera de alcance de este primer borrador, a propósito: la tabla "Estándar de bancos/día por
// producto" y el flujo de Días Atípicos siguen siendo exclusivos de Vibrocompactado por ahora
// (ver js/produccion-atipicos.js) — extenderlos es una vuelta aparte si se necesita.

// Mapa {nombreProducto: metrosLinealesBanco} — mismo cruce CATALOGO↔COSTEO_PRODUCTOS que
// _unidadesCicloPorProducto(), pero lee costeo.rendimiento.metrosLinealesBanco (tipoEstructura
// === 'pretensado'). Un producto Pretensado CON Costeo pero sin ese dato queda fuera de este
// mapa — no hay con qué convertir sus metros lineales a bancos, aunque sigue contando en ML.
function _metrosLinealesBancoPorProducto() {
  const codigoPorNombre = {};
  (typeof CATALOGO !== 'undefined' ? CATALOGO : []).forEach(p => { codigoPorNombre[p.nombre] = p.codigo; });
  const bancoPorCodigo = {};
  (typeof COSTEO_PRODUCTOS !== 'undefined' ? COSTEO_PRODUCTOS : []).forEach(c => {
    const mlb = c.rendimiento?.metrosLinealesBanco;
    if (c.tipoEstructura === 'pretensado' && mlb > 0) bancoPorCodigo[c.productoCodigo] = mlb;
  });
  const mapa = {};
  Object.keys(codigoPorNombre).forEach(nombre => {
    const mlb = bancoPorCodigo[codigoPorNombre[nombre]];
    if (mlb) mapa[nombre] = mlb;
  });
  return mapa;
}

let _periodoProduccionPretensado = 30;
let _ultimoProductoFiltroProduccionPretensado = '';
function setPeriodoProduccionPretensado(dias) {
  _periodoProduccionPretensado = dias;
  [7, 30, 90, 0].forEach(d => {
    const btn = document.getElementById(`est-preten-btn-${d}`);
    if (!btn) return;
    btn.style.background = d === dias ? 'var(--azul)' : 'white';
    btn.style.color = d === dias ? 'white' : 'var(--gris-medio)';
  });
  renderEstadisticasProduccionPretensado();
}

function _datosEstadisticasProduccionPretensado(periodoDias) {
  const mapaTipo = _mapaTipoEstructuraPorProducto();
  const desde = periodoDias > 0 ? _fmtISO(_sumarDias(new Date(), -periodoDias)) : null;
  const enPeriodo = (typeof PRODUCCIONES !== 'undefined' ? PRODUCCIONES : []).filter(p => !desde || (p.fecha || '') >= desde);
  const pretensados = enPeriodo.filter(p => mapaTipo[p.producto] === 'pretensado');
  const sinClasificar = enPeriodo.filter(p => !mapaTipo[p.producto]);
  return { pretensados, sinClasificar };
}

// Bancos totales por DÍA — mismo criterio que _ciclosPorDia() (estadisticas-produccion.js).
function _bancosPorDia(conBanco, mapaBanco) {
  const porDia = {};
  conBanco.forEach(p => {
    const bancos = (Number(p.cantidad) || 0) / mapaBanco[p.producto];
    porDia[p.fecha] = (porDia[p.fecha] || 0) + bancos;
  });
  return porDia;
}

function renderEstadisticasProduccionPretensado() {
  if (typeof Chart === 'undefined') return;
  const { pretensados: todosPreten, sinClasificar } = _datosEstadisticasProduccionPretensado(_periodoProduccionPretensado);

  const selProducto = document.getElementById('est-preten-filtro-producto');
  let productoFiltro = '';
  if (selProducto) {
    const prevValor = selProducto.value;
    const productos = [...new Set(todosPreten.map(p => p.producto))].sort();
    selProducto.innerHTML = '<option value="">Todos los productos (vista general)</option>' + productos.map(p => `<option value="${_esc(p)}">${_esc(p)}</option>`).join('');
    selProducto.value = productos.includes(prevValor) ? prevValor : '';
    productoFiltro = selProducto.value;
  }
  // Días atípicos — mismo criterio que Vibrocompactado: 'excluido' sale de todo este dashboard,
  // 'pendiente_revision' sigue contando (ver estadisticas-produccion.js para el porqué).
  const pretensados = (productoFiltro ? todosPreten.filter(p => p.producto === productoFiltro) : todosPreten)
    .filter(p => (p.estado || 'incluido') !== 'excluido');
  _ultimoProductoFiltroProduccionPretensado = productoFiltro;

  const mapaBanco = _metrosLinealesBancoPorProducto();
  const conBanco = pretensados.filter(p => mapaBanco[p.producto]);
  const sinBanco = pretensados.filter(p => !mapaBanco[p.producto]);
  const totalBancos = conBanco.reduce((s, p) => s + (Number(p.cantidad) || 0) / mapaBanco[p.producto], 0);
  const diasConBancos = new Set(conBanco.map(p => p.fecha)).size;
  const promedioBancosDia = diasConBancos > 0 ? totalBancos / diasConBancos : null;
  const bancosPorDiaArr = Object.values(_bancosPorDia(conBanco, mapaBanco));
  const desviacionBancosDia = _desviacionEstandar(bancosPorDiaArr);
  const promedioBancos3Sigma = promedioBancosDia !== null ? _promedioDentro3Sigma(bancosPorDiaArr, promedioBancosDia, desviacionBancosDia) : null;

  const totalPrimera = pretensados.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
  const totalMerma = pretensados.reduce((s, p) => s + (Number(p.merma) || 0), 0);
  const totalSegundas = pretensados.reduce((s, p) => s + (Number(p.segundas) || 0), 0);
  const totalIntentado = totalPrimera + totalMerma + totalSegundas;
  const pctDeficiencia = totalIntentado > 0 ? ((totalMerma + totalSegundas) / totalIntentado) * 100 : 0;
  const totalCemento = pretensados.reduce((s, p) => s + (Number(p.consumoCemento) || 0), 0);
  const cementoPorMl = totalPrimera > 0 && totalCemento > 0 ? totalCemento / totalPrimera : null;

  const tarjetas = document.getElementById('est-preten-tarjetas');
  if (tarjetas) {
    tarjetas.innerHTML = _tarjetaKPI(totalBancos > 0 ? Math.round(totalBancos).toLocaleString() : '—', 'Bancos de producción')
      + _tarjetaKPI(promedioBancosDia !== null ? promedioBancosDia.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—', 'Bancos promedio / día')
      + _tarjetaKPI(desviacionBancosDia !== null ? desviacionBancosDia.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—', 'Desv. estándar (bancos/día)')
      + _tarjetaKPI(promedioBancos3Sigma !== null ? promedioBancos3Sigma.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—', 'Promedio bancos/día (dentro de 3σ)')
      + _tarjetaKPI(totalPrimera.toLocaleString('es-CO', { maximumFractionDigits: 1 }), 'ML de primera')
      + _tarjetaKPI(totalMerma.toLocaleString('es-CO', { maximumFractionDigits: 1 }), 'Merma (ml)', totalMerma ? 'var(--rojo)' : null)
      + _tarjetaKPI(totalSegundas.toLocaleString('es-CO', { maximumFractionDigits: 1 }), 'Segundas (ml)', totalSegundas ? 'var(--naranja)' : null)
      + _tarjetaKPI(pctDeficiencia.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + '%', '% Deficiencia', totalIntentado ? _colorDeficiencia(pctDeficiencia) : null)
      + _tarjetaKPI(cementoPorMl !== null ? cementoPorMl.toLocaleString('es-CO', { maximumFractionDigits: 2 }) + ' kg' : '—', 'Cemento / ml (primera)');
  }

  const nota = document.getElementById('est-preten-nota-sin-clasificar');
  if (nota) {
    const notas = [];
    if (sinClasificar.length) notas.push(`⚠️ ${sinClasificar.length} registro${sinClasificar.length === 1 ? '' : 's'} sin Costeo de Producto guardado no se incluye${sinClasificar.length === 1 ? '' : 'n'} en estas estadísticas. Regístralo en Centro de Costos → Costeo de Producto, tipo "Pretensado".`);
    if (sinBanco.length) notas.push(`⚠️ ${sinBanco.length} registro${sinBanco.length === 1 ? '' : 's'} de producto${sinBanco.length === 1 ? '' : 's'} Pretensado con Costeo pero sin "Metros lineales/banco" registrado no cuenta${sinBanco.length === 1 ? '' : 'n'} en Bancos de producción (sí sigue contando en ML, merma, segundas y cemento). Completa ese dato en su Costeo → Rendimiento.`);
    nota.innerHTML = notas.map(t => `<div style="background:#FFF3E0;color:#E65100;border-radius:var(--radio);padding:8px 14px;font-size:12px;margin-bottom:8px">${t}</div>`).join('');
  }

  _chartTendenciaProduccionPretensado(pretensados, _periodoProduccionPretensado, mapaBanco);
  _chartTendenciaDeficienciaPretensado(pretensados, _periodoProduccionPretensado);
  _chartCementoPorMlPretensado(pretensados, _periodoProduccionPretensado);
  _tablaProduccionHoyPretensado(pretensados, mapaBanco);

  const cardsRanking = document.getElementById('est-preten-cards-ranking');
  const cardMlFiltro = document.getElementById('card-preten-ml-filtrado');
  if (productoFiltro) {
    if (cardsRanking) cardsRanking.style.display = 'none';
    if (cardMlFiltro) cardMlFiltro.style.display = '';
    _chartMlFiltradoPretensado(pretensados, _periodoProduccionPretensado);
  } else {
    if (cardsRanking) cardsRanking.style.display = '';
    if (cardMlFiltro) cardMlFiltro.style.display = 'none';
    _chartRankingVolumenPretensado(pretensados, mapaBanco);
    _chartRankingDeficienciaPretensado(pretensados);
  }
}

// ── Tendencia de producción (bancos) ──
let _chartTendenciaProduccionPretensadoInst = null;
function _chartTendenciaProduccionPretensado(pretensados, periodoDias, mapaBanco) {
  const ctx = document.getElementById('chart-preten-tendencia');
  if (!ctx) return;
  const hoy = new Date();
  let dias = periodoDias;
  if (!dias) {
    const fechas = pretensados.map(p => p.fecha).sort();
    dias = fechas.length ? Math.max(1, Math.round((hoy - new Date(fechas[0] + 'T12:00')) / 86400000) + 1) : 30;
  }
  const labels = [], bancosD = [], detalleD = [];
  for (let i = dias - 1; i >= 0; i--) {
    const f = _fmtISO(_sumarDias(hoy, -i));
    const delDia = pretensados.filter(p => p.fecha === f && mapaBanco[p.producto]);
    if (!delDia.length) continue;
    const porProducto = {};
    delDia.forEach(p => {
      if (!porProducto[p.producto]) porProducto[p.producto] = { bancos: 0, primera: 0 };
      porProducto[p.producto].bancos += (Number(p.cantidad) || 0) / mapaBanco[p.producto];
      porProducto[p.producto].primera += Number(p.cantidad) || 0;
    });
    const bancos = Object.values(porProducto).reduce((s, r) => s + r.bancos, 0);
    if (!bancos) continue;
    labels.push(new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
    bancosD.push(Math.round(bancos * 10) / 10);
    detalleD.push(Object.entries(porProducto).sort((a, b) => b[1].bancos - a[1].bancos));
  }
  if (_chartTendenciaProduccionPretensadoInst) _chartTendenciaProduccionPretensadoInst.destroy();
  _chartTendenciaProduccionPretensadoInst = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Bancos', data: bancosD, borderColor: '#0ca30c', backgroundColor: 'rgba(12,163,12,0.1)', fill: true, borderWidth: 2, pointRadius: labels.length > 31 ? 0 : 3, tension: 0.2 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0].label,
            label: (c) => (detalleD[c.dataIndex] || []).flatMap(([nombre, r]) => [
              `Producto: ${nombre}`,
              `Bancos: ${(Math.round(r.bancos * 10) / 10).toLocaleString()}`,
              `ML: ${r.primera.toLocaleString('es-CO', { maximumFractionDigits: 1 })}`,
            ]),
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#898781', maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781' } },
      },
    },
  });
}

// ── Metros lineales producidos — SOLO cuando hay un producto filtrado (misma lógica que
// _chartUnidadesFiltrado() en estadisticas-produccion.js) ──
let _chartMlFiltradoPretensadoInst = null;
function _chartMlFiltradoPretensado(pretensados, periodoDias) {
  const ctx = document.getElementById('chart-preten-ml-filtrado');
  if (!ctx) return;
  const hoy = new Date();
  let dias = periodoDias;
  if (!dias) {
    const fechas = pretensados.map(p => p.fecha).sort();
    dias = fechas.length ? Math.max(1, Math.round((hoy - new Date(fechas[0] + 'T12:00')) / 86400000) + 1) : 30;
  }
  const labels = [], mlD = [];
  for (let i = dias - 1; i >= 0; i--) {
    const f = _fmtISO(_sumarDias(hoy, -i));
    const primera = pretensados.filter(p => p.fecha === f).reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
    if (!primera) continue;
    labels.push(new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
    mlD.push(Math.round(primera * 10) / 10);
  }
  if (_chartMlFiltradoPretensadoInst) _chartMlFiltradoPretensadoInst.destroy();
  _chartMlFiltradoPretensadoInst = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'ML', data: mlD, borderColor: '#2a78d6', backgroundColor: 'rgba(42,120,214,0.1)', fill: true, borderWidth: 2, pointRadius: labels.length > 31 ? 0 : 3, tension: 0.2 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.y.toLocaleString('es-CO', { maximumFractionDigits: 1 })} ml de primera` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#898781', maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781' } },
      },
    },
  });
}

// ── Tendencia de merma y segundas — misma lógica que _chartTendenciaDeficiencia() ──
let _chartTendenciaDeficienciaPretensadoInst = null;
function _chartTendenciaDeficienciaPretensado(pretensados, periodoDias) {
  const ctx = document.getElementById('chart-preten-tendencia-deficiencia');
  if (!ctx) return;
  const hoy = new Date();
  let dias = periodoDias;
  if (!dias) {
    const fechas = pretensados.map(p => p.fecha).sort();
    dias = fechas.length ? Math.max(1, Math.round((hoy - new Date(fechas[0] + 'T12:00')) / 86400000) + 1) : 30;
  }
  const labels = [], mermaPctD = [], segundasPctD = [], detalleD = [];
  for (let i = dias - 1; i >= 0; i--) {
    const f = _fmtISO(_sumarDias(hoy, -i));
    const delDia = pretensados.filter(p => p.fecha === f);
    const porProducto = {};
    delDia.forEach(p => {
      if (!porProducto[p.producto]) porProducto[p.producto] = { primera: 0, merma: 0, segundas: 0 };
      porProducto[p.producto].primera += Number(p.cantidad) || 0;
      porProducto[p.producto].merma += Number(p.merma) || 0;
      porProducto[p.producto].segundas += Number(p.segundas) || 0;
    });
    const primera = Object.values(porProducto).reduce((s, r) => s + r.primera, 0);
    const merma = Object.values(porProducto).reduce((s, r) => s + r.merma, 0);
    const segundas = Object.values(porProducto).reduce((s, r) => s + r.segundas, 0);
    if (!primera || (!merma && !segundas)) continue;
    labels.push(new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
    mermaPctD.push(Math.round((merma / primera) * 1000) / 10);
    segundasPctD.push(Math.round((segundas / primera) * 1000) / 10);
    detalleD.push(Object.entries(porProducto)
      .filter(([, r]) => r.primera > 0 && (r.merma || r.segundas))
      .map(([nombre, r]) => ({
        nombre,
        mermaPct: Math.round((r.merma / r.primera) * 1000) / 10,
        segundasPct: Math.round((r.segundas / r.primera) * 1000) / 10,
        primera: r.primera,
      }))
      .sort((a, b) => (b.mermaPct + b.segundasPct) - (a.mermaPct + a.segundasPct)));
  }
  if (_chartTendenciaDeficienciaPretensadoInst) _chartTendenciaDeficienciaPretensadoInst.destroy();
  _chartTendenciaDeficienciaPretensadoInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Merma', data: mermaPctD, borderColor: '#d03b3b', backgroundColor: 'rgba(208,59,59,0.1)', fill: true, borderWidth: 2, pointRadius: labels.length > 31 ? 0 : 3, tension: 0.2 },
        { label: 'Segundas', data: segundasPctD, borderColor: '#fab219', backgroundColor: 'rgba(250,178,25,0.1)', fill: true, borderWidth: 2, pointRadius: labels.length > 31 ? 0 : 3, tension: 0.2 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { color: '#52514e', boxWidth: 12, padding: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            title: (items) => items[0].label,
            label: (c) => {
              if (c.datasetIndex !== 0) return [];
              return (detalleD[c.dataIndex] || []).flatMap(r => [
                `Producto: ${r.nombre}`,
                `Merma: ${r.mermaPct}%`,
                `Segundas: ${r.segundasPct}%`,
                `ML: ${r.primera.toLocaleString('es-CO', { maximumFractionDigits: 1 })}`,
              ]);
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#898781', maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781', callback: (v) => v + '%' } },
      },
    },
  });
}

// ── Ranking de productos por volumen (top 10, en BANCOS) ──
let _chartRankingVolumenPretensadoInst = null;
function _chartRankingVolumenPretensado(pretensados, mapaBanco) {
  const ctx = document.getElementById('chart-preten-ranking-volumen');
  if (!ctx) return;
  const conteo = {};
  pretensados.forEach(p => {
    if (!mapaBanco[p.producto]) return;
    conteo[p.producto] = (conteo[p.producto] || 0) + (Number(p.cantidad) || 0) / mapaBanco[p.producto];
  });
  const top = Object.entries(conteo).map(([n, c]) => [n, Math.round(c * 10) / 10]).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (_chartRankingVolumenPretensadoInst) _chartRankingVolumenPretensadoInst.destroy();
  _chartRankingVolumenPretensadoInst = new Chart(ctx, {
    type: 'bar',
    data: { labels: top.map(([n]) => n), datasets: [{ data: top.map(([, n]) => n), backgroundColor: '#2a78d6', borderRadius: 4, maxBarThickness: 20 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.x.toLocaleString()} bancos` } },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781' } },
        y: { grid: { display: false }, ticks: { color: '#0b0b0b', font: { size: 11 } } },
      },
    },
  });
}

// ── Ranking de productos por % de deficiencia (top 10) ──
const _MIN_INTENTADO_RANKING_DEFICIENCIA_PRETENSADO = 5;
let _chartRankingDeficienciaPretensadoInst = null;
function _chartRankingDeficienciaPretensado(pretensados) {
  const ctx = document.getElementById('chart-preten-ranking-deficiencia');
  if (!ctx) return;
  const porProducto = {};
  pretensados.forEach(p => {
    if (!porProducto[p.producto]) porProducto[p.producto] = { primera: 0, merma: 0, segundas: 0 };
    porProducto[p.producto].primera += Number(p.cantidad) || 0;
    porProducto[p.producto].merma += Number(p.merma) || 0;
    porProducto[p.producto].segundas += Number(p.segundas) || 0;
  });
  const conPct = Object.entries(porProducto).map(([nombre, r]) => {
    const intentado = r.primera + r.merma + r.segundas;
    const pct = intentado > 0 ? ((r.merma + r.segundas) / intentado) * 100 : 0;
    return { nombre, pct, intentado };
  }).filter(r => r.intentado >= _MIN_INTENTADO_RANKING_DEFICIENCIA_PRETENSADO);
  const top = conPct.sort((a, b) => b.pct - a.pct).slice(0, 10);
  if (_chartRankingDeficienciaPretensadoInst) _chartRankingDeficienciaPretensadoInst.destroy();
  _chartRankingDeficienciaPretensadoInst = new Chart(ctx, {
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
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.x}% deficiencia (${top[c.dataIndex].intentado.toLocaleString('es-CO', { maximumFractionDigits: 1 })} ml intentados)` } },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781', callback: (v) => v + '%' } },
        y: { grid: { display: false }, ticks: { color: '#0b0b0b', font: { size: 11 } } },
      },
    },
  });
}

// ── Consumo de cemento por metro lineal — tendencia ──
let _chartCementoPorMlPretensadoInst = null;
function _chartCementoPorMlPretensado(pretensados, periodoDias) {
  const ctx = document.getElementById('chart-preten-cemento-ml');
  if (!ctx) return;
  const hoy = new Date();
  let dias = periodoDias;
  if (!dias) {
    const fechas = pretensados.map(p => p.fecha).sort();
    dias = fechas.length ? Math.max(1, Math.round((hoy - new Date(fechas[0] + 'T12:00')) / 86400000) + 1) : 30;
  }
  const labels = [], valores = [];
  for (let i = dias - 1; i >= 0; i--) {
    const f = _fmtISO(_sumarDias(hoy, -i));
    const delDia = pretensados.filter(p => p.fecha === f);
    const primera = delDia.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
    const cemento = delDia.reduce((s, p) => s + (Number(p.consumoCemento) || 0), 0);
    if (!primera || !cemento) continue;
    labels.push(new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
    valores.push(Math.round((cemento / primera) * 100) / 100);
  }
  if (_chartCementoPorMlPretensadoInst) _chartCementoPorMlPretensadoInst.destroy();
  _chartCementoPorMlPretensadoInst = new Chart(ctx, {
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
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} kg/ml` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#898781', maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781' } },
      },
    },
  });
}

// ── Tabla "Producción de hoy — por producto" ──
function _tablaProduccionHoyPretensado(pretensados, mapaBanco) {
  const tbody = document.getElementById('tabla-preten-hoy-body');
  if (!tbody) return;
  const hoy = _fmtISO(new Date());
  const deHoy = pretensados.filter(p => p.fecha === hoy);

  const porProducto = {};
  deHoy.forEach(p => {
    if (!porProducto[p.producto]) porProducto[p.producto] = { primera: 0 };
    porProducto[p.producto].primera += Number(p.cantidad) || 0;
  });
  const filas = Object.entries(porProducto).map(([nombre, r]) => ({
    nombre,
    bancos: mapaBanco[nombre] ? Math.round((r.primera / mapaBanco[nombre]) * 10) / 10 : null,
    primera: r.primera,
  })).sort((a, b) => (b.bancos ?? -1) - (a.bancos ?? -1));

  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state"><div class="icono">📅</div><div>Todavía no hay producción registrada hoy.</div></td></tr>`;
    return;
  }

  const filasHtml = filas.map(f => `
    <tr>
      <td style="font-weight:600">${_esc(f.nombre)}</td>
      <td style="text-align:right">${f.bancos !== null ? f.bancos.toLocaleString('es-CO') : '—'}</td>
      <td style="text-align:right">${f.primera.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
    </tr>`).join('');

  const totalHtml = filas.length > 1
    ? (() => {
        const totalBancos = filas.reduce((s, f) => s + (f.bancos || 0), 0);
        const totalPrimera = filas.reduce((s, f) => s + f.primera, 0);
        return `<tr style="border-top:2px solid var(--azul-oscuro);font-weight:700">
          <td>Total</td>
          <td style="text-align:right">${(Math.round(totalBancos * 10) / 10).toLocaleString('es-CO')}</td>
          <td style="text-align:right">${totalPrimera.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
        </tr>`;
      })()
    : '';

  tbody.innerHTML = filasHtml + totalHtml;
}

// ── Exportar a Excel ──
function exportarEstadisticasProduccionPretensadoExcel() {
  if (typeof XLSX === 'undefined') { alert('La librería de Excel no cargó. Verifica tu conexión.'); return; }

  const { pretensados: todosPreten, sinClasificar } = _datosEstadisticasProduccionPretensado(_periodoProduccionPretensado);
  const productoFiltro = _ultimoProductoFiltroProduccionPretensado;
  const pretensados = productoFiltro ? todosPreten.filter(p => p.producto === productoFiltro) : todosPreten;

  if (!pretensados.length && !sinClasificar.length) {
    alert('No hay datos para exportar con los filtros actuales.');
    return;
  }

  const mapaBanco = _metrosLinealesBancoPorProducto();
  const etiquetaPeriodo = _periodoProduccionPretensado === 0 ? 'Todo' : `Últimos ${_periodoProduccionPretensado} días`;

  const filas = [...pretensados].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.producto || '').localeCompare(b.producto || ''));

  const rows = [
    ['Estadísticas de Producción — Pretensados'],
    ['Período:', etiquetaPeriodo],
    ['Producto filtrado:', productoFiltro || 'Todos los productos (vista general)'],
    ['Generado:', new Date().toLocaleString('es-CO')],
    ['Nota:', 'esta hoja incluye TODOS los registros (Incluido / Pendiente de revisión / Excluido). Las tarjetas y gráficas del dashboard solo cuentan Incluido y Pendiente de revisión.'],
    [],
    ['Fecha', 'Producto', 'Cantidad ML (primera)', 'Estado', 'Causa', 'Unidad', 'Merma', 'Segundas', '% Deficiencia', 'Consumo Cemento (kg)', 'Metros lineales/banco (Costeo)', 'Bancos'],
  ];
  filas.forEach(p => {
    const cantidad = Number(p.cantidad) || 0;
    const merma = Number(p.merma) || 0;
    const segundas = Number(p.segundas) || 0;
    const intentado = cantidad + merma + segundas;
    const pctDeficiencia = intentado > 0 ? Math.round(((merma + segundas) / intentado) * 1000) / 10 : 0;
    const metrosLinealesBanco = mapaBanco[p.producto] || '';
    const bancos = mapaBanco[p.producto] ? Math.round((cantidad / mapaBanco[p.producto]) * 100) / 100 : '';
    const estado = p.estado || 'incluido';
    const claveTextoEstado = estado === 'pendiente_revision' ? 'pendiente' : estado;
    const estadoTxt = (typeof TEXTOS_DIA_ATIPICO !== 'undefined' ? TEXTOS_DIA_ATIPICO.estados[claveTextoEstado] : null) || estado;
    const causaTxt = p.causa ? (p.causa === 'otro' ? (p.causaOtro || 'Otra razón') : ((typeof ETIQUETA_CAUSA !== 'undefined' ? ETIQUETA_CAUSA[p.causa] : null) || p.causa)) : '';
    rows.push([
      p.fecha || '',
      p.producto || '',
      cantidad,
      estadoTxt,
      causaTxt,
      p.unidad || 'ML',
      merma,
      segundas,
      pctDeficiencia,
      Number(p.consumoCemento) || 0,
      metrosLinealesBanco,
      bancos,
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Producción filtrada');

  if (sinClasificar.length) {
    const filasExcluidas = [...sinClasificar].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.producto || '').localeCompare(b.producto || ''));
    const rowsExcl = [
      ['Registros sin Costeo de Producto — excluidos de las estadísticas'],
      ['Período:', etiquetaPeriodo],
      [],
      ['Fecha', 'Producto', 'Cantidad', 'Unidad', 'Merma', 'Segundas', 'Consumo Cemento (kg)'],
    ];
    filasExcluidas.forEach(p => rowsExcl.push([p.fecha || '', p.producto || '', Number(p.cantidad) || 0, p.unidad || 'ML', Number(p.merma) || 0, Number(p.segundas) || 0, Number(p.consumoCemento) || 0]));
    const wsExcl = XLSX.utils.aoa_to_sheet(rowsExcl);
    XLSX.utils.book_append_sheet(wb, wsExcl, 'Sin clasificar');
  }

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Estadisticas_Produccion_Pretensados_${fecha}.xlsx`);
}
