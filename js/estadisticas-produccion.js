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

// Mapa {nombreProducto: unidadesCiclo} — mismo cruce CATALOGO↔COSTEO_PRODUCTOS que el mapa de
// arriba, pero lee costeo.rendimiento.unidadesCiclo (`calcularCosteoProducto()`, costeo-producto.js
// — "Unidades/Ciclo" del cuestionario de Vibrocompactado: cuántas piezas terminadas salen de un
// solo ciclo de la máquina, un dato real de planta, distinto para cada producto). Un producto
// vibrocompactado CON Costeo guardado pero sin "Unidades/Ciclo" digitado (0 o vacío) queda fuera de
// este mapa — no hay con qué convertir sus unidades a ciclos, aunque sigue contando en unidades.
function _unidadesCicloPorProducto() {
  const codigoPorNombre = {};
  (typeof CATALOGO !== 'undefined' ? CATALOGO : []).forEach(p => { codigoPorNombre[p.nombre] = p.codigo; });
  const cicloPorCodigo = {};
  (typeof COSTEO_PRODUCTOS !== 'undefined' ? COSTEO_PRODUCTOS : []).forEach(c => {
    const uc = c.rendimiento?.unidadesCiclo;
    if (c.tipoEstructura === 'vibrocompactado' && uc > 0) cicloPorCodigo[c.productoCodigo] = uc;
  });
  const mapa = {};
  Object.keys(codigoPorNombre).forEach(nombre => {
    const uc = cicloPorCodigo[codigoPorNombre[nombre]];
    if (uc) mapa[nombre] = uc;
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
  const { vibrocompactados: todosVibro, sinClasificar } = _datosEstadisticasProduccion(_periodoProduccion);

  // Filtro de producto (2026-09-09, a pedido del usuario) — se puebla SIEMPRE desde el conjunto
  // SIN filtrar (todosVibro), preservando lo ya elegido, para no perder las demás opciones del
  // desplegable cuando ya hay un producto elegido.
  const selProducto = document.getElementById('est-prod-filtro-producto');
  let productoFiltro = '';
  if (selProducto) {
    const prevValor = selProducto.value;
    const productos = [...new Set(todosVibro.map(p => p.producto))].sort();
    selProducto.innerHTML = '<option value="">Todos los productos (vista general)</option>' + productos.map(p => `<option value="${_esc(p)}">${_esc(p)}</option>`).join('');
    selProducto.value = productos.includes(prevValor) ? prevValor : '';
    productoFiltro = selProducto.value;
  }
  const vibrocompactados = productoFiltro ? todosVibro.filter(p => p.producto === productoFiltro) : todosVibro;

  // Ciclos: "la producción de productos de diferentes referencias no es comparable... la máquina
  // no produce las mismas unidades por ciclo para cada producto" (2026-09-09, a pedido del
  // usuario) — un ciclo de la máquina es la unidad de esfuerzo real, comparable entre productos
  // distintos; las unidades terminadas no lo son (un ciclo puede dar 1 pieza grande o 40 chicas).
  const mapaCiclo = _unidadesCicloPorProducto();
  const conCiclo = vibrocompactados.filter(p => mapaCiclo[p.producto]);
  const sinCiclo = vibrocompactados.filter(p => !mapaCiclo[p.producto]);
  const totalCiclos = conCiclo.reduce((s, p) => s + (Number(p.cantidad) || 0) / mapaCiclo[p.producto], 0);
  // Promedio de ciclos por DÍA DE PRODUCCIÓN (2026-09-09, a pedido del usuario) — se divide entre
  // los días que de verdad tuvieron ciclos (mismo criterio de "solo días de producción" que ya
  // usan las gráficas de tendencia), no entre los días corridos de la ventana del período — un fin
  // de semana o un día sin producción no debería diluir el promedio.
  const diasConCiclos = new Set(conCiclo.map(p => p.fecha)).size;
  const promedioCiclosDia = diasConCiclos > 0 ? totalCiclos / diasConCiclos : null;

  const totalPrimera = vibrocompactados.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
  const totalMerma = vibrocompactados.reduce((s, p) => s + (Number(p.merma) || 0), 0);
  const totalSegundas = vibrocompactados.reduce((s, p) => s + (Number(p.segundas) || 0), 0);
  const totalIntentado = totalPrimera + totalMerma + totalSegundas;
  const pctDeficiencia = totalIntentado > 0 ? ((totalMerma + totalSegundas) / totalIntentado) * 100 : 0;
  const totalCemento = vibrocompactados.reduce((s, p) => s + (Number(p.consumoCemento) || 0), 0);
  const cementoPorUnidad = totalPrimera > 0 && totalCemento > 0 ? totalCemento / totalPrimera : null;

  const tarjetas = document.getElementById('est-prod-tarjetas');
  if (tarjetas) {
    tarjetas.innerHTML = _tarjetaKPI(totalCiclos > 0 ? Math.round(totalCiclos).toLocaleString() : '—', 'Ciclos de producción')
      + _tarjetaKPI(promedioCiclosDia !== null ? promedioCiclosDia.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—', 'Ciclos promedio / día')
      + _tarjetaKPI(totalPrimera.toLocaleString(), 'Unidades de primera')
      + _tarjetaKPI(totalMerma.toLocaleString(), 'Merma (ud)', totalMerma ? 'var(--rojo)' : null)
      + _tarjetaKPI(totalSegundas.toLocaleString(), 'Segundas (ud)', totalSegundas ? 'var(--naranja)' : null)
      + _tarjetaKPI(pctDeficiencia.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + '%', '% Deficiencia', totalIntentado ? _colorDeficiencia(pctDeficiencia) : null)
      + _tarjetaKPI(cementoPorUnidad !== null ? cementoPorUnidad.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' kg' : '—', 'Cemento / unidad (primera)');
  }

  const nota = document.getElementById('est-prod-nota-sin-clasificar');
  if (nota) {
    const notas = [];
    if (sinClasificar.length) notas.push(`⚠️ ${sinClasificar.length} registro${sinClasificar.length === 1 ? '' : 's'} sin Costeo de Producto guardado no se incluye${sinClasificar.length === 1 ? '' : 'n'} en estas estadísticas. Regístralo en Centro de Costos → Costeo de Producto, tipo "Vibrocompactado".`);
    if (sinCiclo.length) notas.push(`⚠️ ${sinCiclo.length} registro${sinCiclo.length === 1 ? '' : 's'} de producto${sinCiclo.length === 1 ? '' : 's'} vibrocompactado con Costeo pero sin "Unidades/Ciclo" registrado no cuenta${sinCiclo.length === 1 ? '' : 'n'} en Ciclos de producción (sí sigue contando en unidades, merma, segundas y cemento). Completa ese dato en su Costeo → Rendimiento.`);
    nota.innerHTML = notas.map(t => `<div style="background:#FFF3E0;color:#E65100;border-radius:var(--radio);padding:8px 14px;font-size:12px;margin-bottom:8px">${t}</div>`).join('');
  }

  _chartTendenciaProduccion(vibrocompactados, _periodoProduccion, mapaCiclo);
  _chartTendenciaDeficiencia(vibrocompactados, _periodoProduccion);
  _chartCementoPorUnidad(vibrocompactados, _periodoProduccion);

  // Un ranking de comparación entre productos no dice nada con un solo producto filtrado — se
  // oculta y en su lugar se muestra la tendencia de unidades de ESE producto (donde unidades y
  // ciclos sí son directamente comparables entre sí, a diferencia de la vista general).
  const cardsRanking = document.getElementById('est-prod-cards-ranking');
  const cardUnidadesFiltro = document.getElementById('card-prod-unidades-filtrado');
  if (productoFiltro) {
    if (cardsRanking) cardsRanking.style.display = 'none';
    if (cardUnidadesFiltro) cardUnidadesFiltro.style.display = '';
    _chartUnidadesFiltrado(vibrocompactados, _periodoProduccion);
  } else {
    if (cardsRanking) cardsRanking.style.display = '';
    if (cardUnidadesFiltro) cardUnidadesFiltro.style.display = 'none';
    _chartRankingVolumen(vibrocompactados, mapaCiclo);
    _chartRankingDeficiencia(vibrocompactados);
  }
}

// ── Tendencia de producción (ciclos) ──
// Se expresa en CICLOS, no en unidades de primera (2026-09-09, a pedido del usuario) — comparar
// unidades crudas entre productos con distinto "Unidades/Ciclo" (ver _unidadesCicloPorProducto())
// no refleja el esfuerzo real de máquina; un ciclo sí es comparable entre productos. Se mantiene
// así incluso cuando hay un producto filtrado, por consistencia — la gráfica de unidades del
// producto filtrado (_chartUnidadesFiltrado()) es la que aparece aparte en ese caso. ciclos del
// día = suma de (cantidad de primera / unidadesCiclo) de cada registro cuyo producto SÍ tiene ese
// dato — los que no lo tienen quedan fuera (ver nota "sin Unidades/Ciclo" en el render principal).
// Mismo mecanismo de "solo días con actividad" que el resto de gráficas de tendencia — un día sin
// ciclos no pinta un punto en cero.
let _chartTendenciaProduccionInst = null;
function _chartTendenciaProduccion(vibrocompactados, periodoDias, mapaCiclo) {
  const ctx = document.getElementById('chart-prod-tendencia');
  if (!ctx) return;
  const hoy = new Date();
  let dias = periodoDias;
  if (!dias) {
    const fechas = vibrocompactados.map(p => p.fecha).sort();
    dias = fechas.length ? Math.max(1, Math.round((hoy - new Date(fechas[0] + 'T12:00')) / 86400000) + 1) : 30;
  }
  // detalleD: por día, el desglose por producto (ciclos + unidades de primera de CADA producto
  // fabricado ese día) — para el tooltip (2026-09-09, a pedido del usuario: "cuando toquemos un
  // punto, incluyamos el producto que se fabricó y la cantidad de primera"), ya que un día de la
  // vista general puede sumar ciclos de varios productos distintos, y el número agregado solo no
  // dice cuál se fabricó ni cuánto.
  const labels = [], ciclosD = [], detalleD = [];
  for (let i = dias - 1; i >= 0; i--) {
    const f = _fmtISO(_sumarDias(hoy, -i));
    const delDia = vibrocompactados.filter(p => p.fecha === f && mapaCiclo[p.producto]);
    if (!delDia.length) continue;
    const porProducto = {};
    delDia.forEach(p => {
      if (!porProducto[p.producto]) porProducto[p.producto] = { ciclos: 0, primera: 0 };
      porProducto[p.producto].ciclos += (Number(p.cantidad) || 0) / mapaCiclo[p.producto];
      porProducto[p.producto].primera += Number(p.cantidad) || 0;
    });
    const ciclos = Object.values(porProducto).reduce((s, r) => s + r.ciclos, 0);
    if (!ciclos) continue;
    labels.push(new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
    ciclosD.push(Math.round(ciclos * 10) / 10);
    detalleD.push(Object.entries(porProducto).sort((a, b) => b[1].ciclos - a[1].ciclos));
  }
  if (_chartTendenciaProduccionInst) _chartTendenciaProduccionInst.destroy();
  _chartTendenciaProduccionInst = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Ciclos', data: ciclosD, borderColor: '#0ca30c', backgroundColor: 'rgba(12,163,12,0.1)', fill: true, borderWidth: 2, pointRadius: labels.length > 31 ? 0 : 3, tension: 0.2 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `${items[0].label} — ${items[0].parsed.y.toLocaleString()} ciclos`,
            label: (c) => (detalleD[c.dataIndex] || []).map(([nombre, r]) =>
              `${nombre}: ${(Math.round(r.ciclos * 10) / 10).toLocaleString()} ciclos (${r.primera.toLocaleString()} ud primera)`),
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

// ── Unidades producidas — SOLO cuando hay un producto filtrado (2026-09-09, a pedido del
// usuario: "si filtramos algún producto, sí podemos hacerlo por ciclos y por unidades para ver el
// desempeño de una referencia en particular") — dentro de UN mismo producto, unidades y ciclos son
// directamente proporcionales (ciclos × Unidades/Ciclo = unidades), así que mostrar unidades sí
// tiene sentido acá aunque no lo tenga en la vista general con varios productos mezclados. Gráfica
// aparte (no una segunda serie en la de Ciclos) para no forzar un eje doble — mismo criterio que
// Merma/Segundas.
let _chartUnidadesFiltradoInst = null;
function _chartUnidadesFiltrado(vibrocompactados, periodoDias) {
  const ctx = document.getElementById('chart-prod-unidades-filtrado');
  if (!ctx) return;
  const hoy = new Date();
  let dias = periodoDias;
  if (!dias) {
    const fechas = vibrocompactados.map(p => p.fecha).sort();
    dias = fechas.length ? Math.max(1, Math.round((hoy - new Date(fechas[0] + 'T12:00')) / 86400000) + 1) : 30;
  }
  const labels = [], unidadesD = [];
  for (let i = dias - 1; i >= 0; i--) {
    const f = _fmtISO(_sumarDias(hoy, -i));
    const primera = vibrocompactados.filter(p => p.fecha === f).reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
    if (!primera) continue;
    labels.push(new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
    unidadesD.push(primera);
  }
  if (_chartUnidadesFiltradoInst) _chartUnidadesFiltradoInst.destroy();
  _chartUnidadesFiltradoInst = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Unidades', data: unidadesD, borderColor: '#2a78d6', backgroundColor: 'rgba(42,120,214,0.1)', fill: true, borderWidth: 2, pointRadius: labels.length > 31 ? 0 : 3, tension: 0.2 }] },
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
  // En % frente a la producción de primera de ese día (2026-09-09, a pedido del usuario: "muéstralas
  // en términos porcentuales frente a la producción de primera") — mermaPct/segundasPct = merma o
  // segundas del día / PRIMERA del día × 100 (el divisor es solo primera, no lo intentado — distinto
  // de la tarjeta "% Deficiencia", que sí divide entre lo intentado; acá el usuario pidió puntualmente
  // "frente a la producción de primera"). Un día sin nada de primera no tiene con qué calcular el %,
  // se omite igual que un día sin ninguna merma/segundas.
  const labels = [], mermaPctD = [], segundasPctD = [];
  for (let i = dias - 1; i >= 0; i--) {
    const f = _fmtISO(_sumarDias(hoy, -i));
    const delDia = vibrocompactados.filter(p => p.fecha === f);
    const primera = delDia.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
    const merma = delDia.reduce((s, p) => s + (Number(p.merma) || 0), 0);
    const segundas = delDia.reduce((s, p) => s + (Number(p.segundas) || 0), 0);
    if (!primera || (!merma && !segundas)) continue;
    labels.push(new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
    mermaPctD.push(Math.round((merma / primera) * 1000) / 10);
    segundasPctD.push(Math.round((segundas / primera) * 1000) / 10);
  }
  if (_chartTendenciaDeficienciaInst) _chartTendenciaDeficienciaInst.destroy();
  _chartTendenciaDeficienciaInst = new Chart(ctx, {
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
      plugins: {
        legend: { position: 'bottom', labels: { color: '#52514e', boxWidth: 12, padding: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y}% de la producción de primera` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#898781', maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781', callback: (v) => v + '%' } },
      },
    },
  });
}

// ── Ranking de productos por volumen (top 10, en CICLOS) ──
// En ciclos, no en unidades (mismo motivo que la tendencia de arriba) — solo aparece en la vista
// general (sin producto filtrado; ver renderEstadisticasProduccion()), porque comparar un producto
// contra sí mismo no dice nada. Productos sin "Unidades/Ciclo" en su Costeo no entran acá.
let _chartRankingVolumenInst = null;
function _chartRankingVolumen(vibrocompactados, mapaCiclo) {
  const ctx = document.getElementById('chart-prod-ranking-volumen');
  if (!ctx) return;
  const conteo = {};
  vibrocompactados.forEach(p => {
    if (!mapaCiclo[p.producto]) return;
    conteo[p.producto] = (conteo[p.producto] || 0) + (Number(p.cantidad) || 0) / mapaCiclo[p.producto];
  });
  const top = Object.entries(conteo).map(([n, c]) => [n, Math.round(c * 10) / 10]).sort((a, b) => b[1] - a[1]).slice(0, 10);
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
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.x.toLocaleString()} ciclos` } },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781' } },
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
