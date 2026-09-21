// ═══════════════════════════════
// PRODUCCIÓN — ESTADÍSTICAS (DASHBOARD) — Reforzado y Elemento Simple, por VOLUMEN (m³) (2026-09-21)
// ═══════════════════════════════
// Reforzado y Elemento Simple son calculation-twins (Elemento Simple = Reforzado sin la sección
// de Refuerzo, ver costeo-producto.js) — mismo rendimiento directo "Unidades/día" (sin "ciclos"
// de máquina como Vibrocompactado, ni "bancos" de tensionado como Pretensado). Comparar unidades
// crudas entre productos de referencias distintas tiene el mismo problema que ya resolvieron los
// otros dos dashboards (una cimentación pequeña y una grande no son la misma "unidad de
// esfuerzo") — acá la magnitud físicamente comparable es el VOLUMEN DE CONCRETO (m³) de cada
// pieza, que ambos tipos ya tienen como dato directo del Costeo (`rendimiento.volumenUnidadM3`).
// A diferencia de Vibrocompactado (÷ unidadesCiclo) y Pretensado (÷ metrosLinealesBanco), acá la
// conversión es una MULTIPLICACIÓN: m³ = cantidad (unidades de primera) × volumenUnidadM3 — un
// volumen por pieza típicamente menor a 1 m³, no un divisor grande.
//
// UN SOLO módulo parametrizado por `tipo` ('reforzado' | 'elemento_simple') en vez de duplicar
// el archivo dos veces — cada tipo tiene su propio HTML (ids con sufijo `-reforzado`/
// `-elemento-simple`, ver cotizaciones.html) pero llama las MISMAS funciones acá, pasando su
// `tipo` como primer argumento. Reutiliza tal cual (no se redefinen): _mapaTipoEstructuraPorProducto(),
// _desviacionEstandar(), _promedioDentro3Sigma(), _colorDeficiencia(), _tarjetaKPI().

const _LABEL_VOL_TIPO = { reforzado: 'Reforzado', elemento_simple: 'Elemento Simple' };
// Los ids en el HTML usan guion (más legible/estándar en HTML) donde `tipo` usa guion bajo.
function _idVol(tipo) { return tipo.replace(/_/g, '-'); }

// "Unidades/día" digitado en el Costeo de ESE producto — el estándar contra el que se compara el
// promedio real cuando hay un producto filtrado (2026-09-21, mismo criterio que
// _ciclosDiaEstandarPorProducto()/_bancosDiaEstandarPorProducto() en Vibrocompactado/Pretensado).
function _unidadesDiaEstandarPorProducto(tipo, nombreProducto) {
  const prod = (typeof CATALOGO !== 'undefined' ? CATALOGO : []).find(p => p.nombre === nombreProducto);
  if (!prod) return null;
  const costeo = (typeof COSTEO_PRODUCTOS !== 'undefined' ? COSTEO_PRODUCTOS : []).find(c => c.productoCodigo === prod.codigo && c.tipoEstructura === tipo);
  const v = costeo?.rendimiento?.unidadesDia;
  return v > 0 ? v : null;
}

function _volumenUnidadM3PorProducto(tipo) {
  const codigoPorNombre = {};
  (typeof CATALOGO !== 'undefined' ? CATALOGO : []).forEach(p => { codigoPorNombre[p.nombre] = p.codigo; });
  const volPorCodigo = {};
  (typeof COSTEO_PRODUCTOS !== 'undefined' ? COSTEO_PRODUCTOS : []).forEach(c => {
    const v = c.rendimiento?.volumenUnidadM3;
    if (c.tipoEstructura === tipo && v > 0) volPorCodigo[c.productoCodigo] = v;
  });
  const mapa = {};
  Object.keys(codigoPorNombre).forEach(nombre => {
    const v = volPorCodigo[codigoPorNombre[nombre]];
    if (v) mapa[nombre] = v;
  });
  return mapa;
}

let _periodoProduccionVolumen = { reforzado: 30, elemento_simple: 30 };
let _ultimoProductoFiltroVolumen = { reforzado: '', elemento_simple: '' };
// Instancias de Chart.js, una por tipo y por gráfica — a diferencia de Vibrocompactado/Pretensado
// (una sola vista cada uno, una variable de módulo basta), acá el MISMO canvas-id-base se repite
// dos veces (una por tipo, con sufijo distinto), así que hace falta una instancia por tipo.
const _chartsVolumen = {
  reforzado: { tendencia: null, deficiencia: null, rankingVolumen: null, rankingDeficiencia: null, cemento: null },
  elemento_simple: { tendencia: null, deficiencia: null, rankingVolumen: null, rankingDeficiencia: null, cemento: null },
};

function setPeriodoProduccionVolumen(tipo, dias) {
  _periodoProduccionVolumen[tipo] = dias;
  [7, 30, 90, 0].forEach(d => {
    const btn = document.getElementById(`est-vol-${_idVol(tipo)}-btn-${d}`);
    if (!btn) return;
    btn.style.background = d === dias ? 'var(--azul)' : 'white';
    btn.style.color = d === dias ? 'white' : 'var(--gris-medio)';
  });
  renderEstadisticasProduccionVolumen(tipo);
}

function _datosEstadisticasProduccionVolumen(tipo, periodoDias) {
  const mapaTipo = _mapaTipoEstructuraPorProducto();
  const desde = periodoDias > 0 ? _fmtISO(_sumarDias(new Date(), -periodoDias)) : null;
  const enPeriodo = (typeof PRODUCCIONES !== 'undefined' ? PRODUCCIONES : []).filter(p => !desde || (p.fecha || '') >= desde);
  const delTipo = enPeriodo.filter(p => mapaTipo[p.producto] === tipo);
  const sinClasificar = enPeriodo.filter(p => !mapaTipo[p.producto]);
  return { delTipo, sinClasificar };
}

// m³ totales por DÍA — mismo criterio que _ciclosPorDia()/_bancosPorDia(), pero multiplicando en
// vez de dividir (ver comentario de cabecera).
function _m3PorDia(conVolumen, mapaVolumen) {
  const porDia = {};
  conVolumen.forEach(p => {
    const m3 = (Number(p.cantidad) || 0) * mapaVolumen[p.producto];
    porDia[p.fecha] = (porDia[p.fecha] || 0) + m3;
  });
  return porDia;
}

function renderEstadisticasProduccionVolumen(tipo) {
  if (typeof Chart === 'undefined') return;
  const id = _idVol(tipo);
  const { delTipo: todos, sinClasificar } = _datosEstadisticasProduccionVolumen(tipo, _periodoProduccionVolumen[tipo]);

  const selProducto = document.getElementById(`est-vol-${id}-filtro-producto`);
  let productoFiltro = '';
  if (selProducto) {
    const prevValor = selProducto.value;
    const productos = [...new Set(todos.map(p => p.producto))].sort();
    selProducto.innerHTML = '<option value="">Todos los productos (vista general)</option>' + productos.map(p => `<option value="${_esc(p)}">${_esc(p)}</option>`).join('');
    selProducto.value = productos.includes(prevValor) ? prevValor : '';
    productoFiltro = selProducto.value;
  }
  const registros = (productoFiltro ? todos.filter(p => p.producto === productoFiltro) : todos)
    .filter(p => (p.estado || 'incluido') !== 'excluido');
  _ultimoProductoFiltroVolumen[tipo] = productoFiltro;

  const mapaVolumen = _volumenUnidadM3PorProducto(tipo);
  const conVolumen = registros.filter(p => mapaVolumen[p.producto]);
  const sinVolumen = registros.filter(p => !mapaVolumen[p.producto]);
  const totalM3 = conVolumen.reduce((s, p) => s + (Number(p.cantidad) || 0) * mapaVolumen[p.producto], 0);
  const diasConM3 = new Set(conVolumen.map(p => p.fecha)).size;
  const promedioM3Dia = diasConM3 > 0 ? totalM3 / diasConM3 : null;
  const m3PorDiaArr = Object.values(_m3PorDia(conVolumen, mapaVolumen));
  const desviacionM3Dia = _desviacionEstandar(m3PorDiaArr);
  const promedioM3_3Sigma = promedioM3Dia !== null ? _promedioDentro3Sigma(m3PorDiaArr, promedioM3Dia, desviacionM3Dia) : null;

  const totalPrimera = registros.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
  const totalMerma = registros.reduce((s, p) => s + (Number(p.merma) || 0), 0);
  const totalSegundas = registros.reduce((s, p) => s + (Number(p.segundas) || 0), 0);
  const totalIntentado = totalPrimera + totalMerma + totalSegundas;
  const pctDeficiencia = totalIntentado > 0 ? ((totalMerma + totalSegundas) / totalIntentado) * 100 : 0;
  const totalCemento = registros.reduce((s, p) => s + (Number(p.consumoCemento) || 0), 0);
  const cementoPorUnidad = totalPrimera > 0 && totalCemento > 0 ? totalCemento / totalPrimera : null;

  // Con un producto filtrado, m³ y unidades son directamente proporcionales entre sí (m³ =
  // unidades × Volumen/unidad, una constante para ESE producto) — mostrar unidades es más
  // directo, y ya no hace falta convertir a m³ para comparar contra otras referencias, porque no
  // hay ninguna otra en pantalla (2026-09-21, a pedido del usuario: "cuando se filtra un producto
  // en particular, muestra los indicadores en función de unidades fabricadas, no de m³... cuando
  // se muestran todos los productos, sí déjalo por m³ pues no son comparables las unidades con
  // los volúmenes para las múltiples referencias"). Sin filtro, se queda en m³ como siempre.
  // Consumo de cemento — el estándar es el teórico que ya deriva el Costeo de su Diseño de
  // Mezcla × volumen (2026-09-21, a pedido del usuario, mismo criterio que Vibrocompactado/
  // Pretensado). Menos que el estándar es lo bueno (`masEsMejor=false`).
  const cementoEstandar = productoFiltro ? _cementoTeoricoPorUnidad(productoFiltro) : null;
  const subCementoPromedio = productoFiltro ? _tarjetaSubVsEstandar(cementoPorUnidad, cementoEstandar, 'kg', false) : '';

  const tarjetas = document.getElementById(`est-vol-${id}-tarjetas`);
  if (tarjetas) {
    if (productoFiltro) {
      const diasConProduccion = new Set(registros.map(p => p.fecha)).size;
      const promedioUnidadesDia = diasConProduccion > 0 ? totalPrimera / diasConProduccion : null;
      const unidadesPorDiaArr = Object.values(_unidadesPorDia(registros));
      const desviacionUnidadesDia = _desviacionEstandar(unidadesPorDiaArr);
      const promedioUnidades3Sigma = promedioUnidadesDia !== null ? _promedioDentro3Sigma(unidadesPorDiaArr, promedioUnidadesDia, desviacionUnidadesDia) : null;
      const unidadesDiaEstandar = _unidadesDiaEstandarPorProducto(tipo, productoFiltro);
      const subUnidadesPromedio = _tarjetaSubVsEstandar(promedioUnidadesDia, unidadesDiaEstandar, 'unidades');
      tarjetas.innerHTML = _tarjetaKPI(totalPrimera > 0 ? totalPrimera.toLocaleString() : '—', 'Unidades de producción')
        + _tarjetaKPI(promedioUnidadesDia !== null ? promedioUnidadesDia.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—', 'Unidades promedio / día', null, subUnidadesPromedio)
        + _tarjetaKPI(desviacionUnidadesDia !== null ? desviacionUnidadesDia.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—', 'Desv. estándar (unidades/día)')
        + _tarjetaKPI(promedioUnidades3Sigma !== null ? promedioUnidades3Sigma.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—', 'Promedio unidades/día (dentro de 3σ)')
        + _tarjetaKPI(totalMerma.toLocaleString(), 'Merma (ud)', totalMerma ? 'var(--rojo)' : null)
        + _tarjetaKPI(totalSegundas.toLocaleString(), 'Segundas (ud)', totalSegundas ? 'var(--naranja)' : null)
        + _tarjetaKPI(pctDeficiencia.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + '%', '% Deficiencia', totalIntentado ? _colorDeficiencia(pctDeficiencia) : null)
        + _tarjetaKPI(cementoPorUnidad !== null ? cementoPorUnidad.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' kg' : '—', 'Cemento / unidad (primera)', null, subCementoPromedio);
    } else {
      tarjetas.innerHTML = _tarjetaKPI(totalM3 > 0 ? totalM3.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—', 'm³ de producción')
        + _tarjetaKPI(promedioM3Dia !== null ? promedioM3Dia.toLocaleString('es-CO', { maximumFractionDigits: 2 }) : '—', 'm³ promedio / día')
        + _tarjetaKPI(desviacionM3Dia !== null ? desviacionM3Dia.toLocaleString('es-CO', { maximumFractionDigits: 2 }) : '—', 'Desv. estándar (m³/día)')
        + _tarjetaKPI(promedioM3_3Sigma !== null ? promedioM3_3Sigma.toLocaleString('es-CO', { maximumFractionDigits: 2 }) : '—', 'Promedio m³/día (dentro de 3σ)')
        + _tarjetaKPI(totalPrimera.toLocaleString(), 'Unidades de primera')
        + _tarjetaKPI(totalMerma.toLocaleString(), 'Merma (ud)', totalMerma ? 'var(--rojo)' : null)
        + _tarjetaKPI(totalSegundas.toLocaleString(), 'Segundas (ud)', totalSegundas ? 'var(--naranja)' : null)
        + _tarjetaKPI(pctDeficiencia.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + '%', '% Deficiencia', totalIntentado ? _colorDeficiencia(pctDeficiencia) : null)
        + _tarjetaKPI(cementoPorUnidad !== null ? cementoPorUnidad.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' kg' : '—', 'Cemento / unidad (primera)');
    }
  }

  const nota = document.getElementById(`est-vol-${id}-nota-sin-clasificar`);
  if (nota) {
    const notas = [];
    if (sinClasificar.length) notas.push(`⚠️ ${sinClasificar.length} registro${sinClasificar.length === 1 ? '' : 's'} sin Costeo de Producto guardado no se incluye${sinClasificar.length === 1 ? '' : 'n'} en estas estadísticas. Regístralo en Centro de Costos → Costeo de Producto, tipo "${_LABEL_VOL_TIPO[tipo]}".`);
    // Con un producto filtrado, las tarjetas ya no usan m³ para nada (ver arriba) — este aviso
    // dejaría de tener sentido ahí, así que solo se muestra en la vista general.
    if (!productoFiltro && sinVolumen.length) notas.push(`⚠️ ${sinVolumen.length} registro${sinVolumen.length === 1 ? '' : 's'} de producto${sinVolumen.length === 1 ? '' : 's'} ${_LABEL_VOL_TIPO[tipo]} con Costeo pero sin "Volumen de concreto/unidad" registrado no cuenta${sinVolumen.length === 1 ? '' : 'n'} en m³ de producción (sí sigue contando en unidades, merma, segundas y cemento). Completa ese dato en su Costeo → Rendimiento.`);
    nota.innerHTML = notas.map(t => `<div style="background:#FFF3E0;color:#E65100;border-radius:var(--radio);padding:8px 14px;font-size:12px;margin-bottom:8px">${t}</div>`).join('');
  }

  _chartTendenciaProduccionVolumen(tipo, registros, _periodoProduccionVolumen[tipo], mapaVolumen, productoFiltro);
  _chartTendenciaDeficienciaVolumen(tipo, registros, _periodoProduccionVolumen[tipo]);
  _chartCementoPorUnidadVolumen(tipo, registros, _periodoProduccionVolumen[tipo]);
  _tablaProduccionHoyVolumen(tipo, registros, mapaVolumen);

  const cardsRanking = document.getElementById(`est-vol-${id}-cards-ranking`);
  if (productoFiltro) {
    if (cardsRanking) cardsRanking.style.display = 'none';
  } else {
    if (cardsRanking) cardsRanking.style.display = '';
    _chartRankingVolumenM3(tipo, registros, mapaVolumen);
    _chartRankingDeficienciaVolumen(tipo, registros);
  }
}

// m³/unidades totales por DÍA — mismo criterio que _m3PorDia(), sin multiplicar por el volumen
// (para el modo "producto filtrado", donde el indicador ya es en unidades directas).
function _unidadesPorDia(registros) {
  const porDia = {};
  registros.forEach(p => {
    porDia[p.fecha] = (porDia[p.fecha] || 0) + (Number(p.cantidad) || 0);
  });
  return porDia;
}

// ── Tendencia de producción — m³ en vista general, unidades con un producto filtrado (ver
// renderEstadisticasProduccionVolumen() para el porqué) ──
function _chartTendenciaProduccionVolumen(tipo, registros, periodoDias, mapaVolumen, productoFiltro) {
  const id = _idVol(tipo);
  const ctx = document.getElementById(`chart-vol-${id}-tendencia`);
  if (!ctx) return;
  const tituloDiv = document.getElementById(`titulo-chart-vol-${id}-tendencia`);
  const hoy = new Date();
  let dias = periodoDias;
  if (!dias) {
    const fechas = registros.map(p => p.fecha).sort();
    dias = fechas.length ? Math.max(1, Math.round((hoy - new Date(fechas[0] + 'T12:00')) / 86400000) + 1) : 30;
  }
  const inst = _chartsVolumen[tipo];
  if (inst.tendencia) inst.tendencia.destroy();

  if (productoFiltro) {
    if (tituloDiv) tituloDiv.textContent = 'Tendencia de producción (unidades)';
    const labels = [], unidadesD = [];
    for (let i = dias - 1; i >= 0; i--) {
      const f = _fmtISO(_sumarDias(hoy, -i));
      const primera = registros.filter(p => p.fecha === f).reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
      if (!primera) continue;
      labels.push(new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
      unidadesD.push(primera);
    }
    inst.tendencia = new Chart(ctx, {
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
    return;
  }

  if (tituloDiv) tituloDiv.textContent = 'Tendencia de producción (m³)';
  const labels = [], m3D = [], detalleD = [];
  for (let i = dias - 1; i >= 0; i--) {
    const f = _fmtISO(_sumarDias(hoy, -i));
    const delDia = registros.filter(p => p.fecha === f && mapaVolumen[p.producto]);
    if (!delDia.length) continue;
    const porProducto = {};
    delDia.forEach(p => {
      if (!porProducto[p.producto]) porProducto[p.producto] = { m3: 0, primera: 0 };
      porProducto[p.producto].m3 += (Number(p.cantidad) || 0) * mapaVolumen[p.producto];
      porProducto[p.producto].primera += Number(p.cantidad) || 0;
    });
    const m3 = Object.values(porProducto).reduce((s, r) => s + r.m3, 0);
    if (!m3) continue;
    labels.push(new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
    m3D.push(Math.round(m3 * 100) / 100);
    detalleD.push(Object.entries(porProducto).sort((a, b) => b[1].m3 - a[1].m3));
  }
  inst.tendencia = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'm³', data: m3D, borderColor: '#0ca30c', backgroundColor: 'rgba(12,163,12,0.1)', fill: true, borderWidth: 2, pointRadius: labels.length > 31 ? 0 : 3, tension: 0.2 }] },
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
              `m³: ${(Math.round(r.m3 * 100) / 100).toLocaleString()}`,
              `Unidades: ${r.primera.toLocaleString()}`,
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

// ── Tendencia de merma y segundas (% de primera) ──
function _chartTendenciaDeficienciaVolumen(tipo, registros, periodoDias) {
  const ctx = document.getElementById(`chart-vol-${_idVol(tipo)}-tendencia-deficiencia`);
  if (!ctx) return;
  const hoy = new Date();
  let dias = periodoDias;
  if (!dias) {
    const fechas = registros.map(p => p.fecha).sort();
    dias = fechas.length ? Math.max(1, Math.round((hoy - new Date(fechas[0] + 'T12:00')) / 86400000) + 1) : 30;
  }
  const labels = [], mermaPctD = [], segundasPctD = [], detalleD = [];
  for (let i = dias - 1; i >= 0; i--) {
    const f = _fmtISO(_sumarDias(hoy, -i));
    const delDia = registros.filter(p => p.fecha === f);
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
  const inst = _chartsVolumen[tipo];
  if (inst.deficiencia) inst.deficiencia.destroy();
  inst.deficiencia = new Chart(ctx, {
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
                `Unidades: ${r.primera.toLocaleString()}`,
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

// ── Ranking de productos por volumen (top 10, en m³) ──
function _chartRankingVolumenM3(tipo, registros, mapaVolumen) {
  const ctx = document.getElementById(`chart-vol-${_idVol(tipo)}-ranking-volumen`);
  if (!ctx) return;
  const conteo = {};
  registros.forEach(p => {
    if (!mapaVolumen[p.producto]) return;
    conteo[p.producto] = (conteo[p.producto] || 0) + (Number(p.cantidad) || 0) * mapaVolumen[p.producto];
  });
  const top = Object.entries(conteo).map(([n, c]) => [n, Math.round(c * 100) / 100]).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const inst = _chartsVolumen[tipo];
  if (inst.rankingVolumen) inst.rankingVolumen.destroy();
  inst.rankingVolumen = new Chart(ctx, {
    type: 'bar',
    data: { labels: top.map(([n]) => n), datasets: [{ data: top.map(([, n]) => n), backgroundColor: '#2a78d6', borderRadius: 4, maxBarThickness: 20 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.x.toLocaleString()} m³` } },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#898781' } },
        y: { grid: { display: false }, ticks: { color: '#0b0b0b', font: { size: 11 } } },
      },
    },
  });
}

// ── Ranking de productos por % de deficiencia (top 10) ──
const _MIN_INTENTADO_RANKING_DEFICIENCIA_VOLUMEN = 5;
function _chartRankingDeficienciaVolumen(tipo, registros) {
  const ctx = document.getElementById(`chart-vol-${_idVol(tipo)}-ranking-deficiencia`);
  if (!ctx) return;
  const porProducto = {};
  registros.forEach(p => {
    if (!porProducto[p.producto]) porProducto[p.producto] = { primera: 0, merma: 0, segundas: 0 };
    porProducto[p.producto].primera += Number(p.cantidad) || 0;
    porProducto[p.producto].merma += Number(p.merma) || 0;
    porProducto[p.producto].segundas += Number(p.segundas) || 0;
  });
  const conPct = Object.entries(porProducto).map(([nombre, r]) => {
    const intentado = r.primera + r.merma + r.segundas;
    const pct = intentado > 0 ? ((r.merma + r.segundas) / intentado) * 100 : 0;
    return { nombre, pct, intentado };
  }).filter(r => r.intentado >= _MIN_INTENTADO_RANKING_DEFICIENCIA_VOLUMEN);
  const top = conPct.sort((a, b) => b.pct - a.pct).slice(0, 10);
  const inst = _chartsVolumen[tipo];
  if (inst.rankingDeficiencia) inst.rankingDeficiencia.destroy();
  inst.rankingDeficiencia = new Chart(ctx, {
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

// ── Consumo de cemento por unidad (de primera) — tendencia ──
function _chartCementoPorUnidadVolumen(tipo, registros, periodoDias) {
  const ctx = document.getElementById(`chart-vol-${_idVol(tipo)}-cemento-unidad`);
  if (!ctx) return;
  const hoy = new Date();
  let dias = periodoDias;
  if (!dias) {
    const fechas = registros.map(p => p.fecha).sort();
    dias = fechas.length ? Math.max(1, Math.round((hoy - new Date(fechas[0] + 'T12:00')) / 86400000) + 1) : 30;
  }
  const labels = [], valores = [];
  for (let i = dias - 1; i >= 0; i--) {
    const f = _fmtISO(_sumarDias(hoy, -i));
    const delDia = registros.filter(p => p.fecha === f);
    const primera = delDia.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
    const cemento = delDia.reduce((s, p) => s + (Number(p.consumoCemento) || 0), 0);
    if (!primera || !cemento) continue;
    labels.push(new Date(f + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }));
    valores.push(Math.round((cemento / primera) * 100) / 100);
  }
  const inst = _chartsVolumen[tipo];
  if (inst.cemento) inst.cemento.destroy();
  inst.cemento = new Chart(ctx, {
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

// ── Tabla "Producción de hoy — por producto" ──
function _tablaProduccionHoyVolumen(tipo, registros, mapaVolumen) {
  const tbody = document.getElementById(`tabla-vol-${_idVol(tipo)}-hoy-body`);
  if (!tbody) return;
  const hoy = _fmtISO(new Date());
  const deHoy = registros.filter(p => p.fecha === hoy);

  const porProducto = {};
  deHoy.forEach(p => {
    if (!porProducto[p.producto]) porProducto[p.producto] = { primera: 0 };
    porProducto[p.producto].primera += Number(p.cantidad) || 0;
  });
  const filas = Object.entries(porProducto).map(([nombre, r]) => ({
    nombre,
    m3: mapaVolumen[nombre] ? Math.round(r.primera * mapaVolumen[nombre] * 100) / 100 : null,
    primera: r.primera,
  })).sort((a, b) => (b.m3 ?? -1) - (a.m3 ?? -1));

  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state"><div class="icono">📅</div><div>Todavía no hay producción registrada hoy.</div></td></tr>`;
    return;
  }

  const filasHtml = filas.map(f => `
    <tr>
      <td style="font-weight:600">${_esc(f.nombre)}</td>
      <td style="text-align:right">${f.m3 !== null ? f.m3.toLocaleString('es-CO') : '—'}</td>
      <td style="text-align:right">${f.primera.toLocaleString()}</td>
    </tr>`).join('');

  const totalHtml = filas.length > 1
    ? (() => {
        const totalM3 = filas.reduce((s, f) => s + (f.m3 || 0), 0);
        const totalPrimera = filas.reduce((s, f) => s + f.primera, 0);
        return `<tr style="border-top:2px solid var(--azul-oscuro);font-weight:700">
          <td>Total</td>
          <td style="text-align:right">${(Math.round(totalM3 * 100) / 100).toLocaleString('es-CO')}</td>
          <td style="text-align:right">${totalPrimera.toLocaleString()}</td>
        </tr>`;
      })()
    : '';

  tbody.innerHTML = filasHtml + totalHtml;
}

// ── Exportar a Excel ──
function exportarEstadisticasProduccionVolumenExcel(tipo) {
  if (typeof XLSX === 'undefined') { alert('La librería de Excel no cargó. Verifica tu conexión.'); return; }

  const { delTipo: todos, sinClasificar } = _datosEstadisticasProduccionVolumen(tipo, _periodoProduccionVolumen[tipo]);
  const productoFiltro = _ultimoProductoFiltroVolumen[tipo];
  const registros = productoFiltro ? todos.filter(p => p.producto === productoFiltro) : todos;

  if (!registros.length && !sinClasificar.length) {
    alert('No hay datos para exportar con los filtros actuales.');
    return;
  }

  const mapaVolumen = _volumenUnidadM3PorProducto(tipo);
  const etiquetaPeriodo = _periodoProduccionVolumen[tipo] === 0 ? 'Todo' : `Últimos ${_periodoProduccionVolumen[tipo]} días`;

  const filas = [...registros].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.producto || '').localeCompare(b.producto || ''));

  const rows = [
    [`Estadísticas de Producción — ${_LABEL_VOL_TIPO[tipo]}`],
    ['Período:', etiquetaPeriodo],
    ['Producto filtrado:', productoFiltro || 'Todos los productos (vista general)'],
    ['Generado:', new Date().toLocaleString('es-CO')],
    ['Nota:', 'esta hoja incluye TODOS los registros (Incluido / Pendiente de revisión / Excluido). Las tarjetas y gráficas del dashboard solo cuentan Incluido y Pendiente de revisión.'],
    [],
    ['Fecha', 'Producto', 'Cantidad (primera)', 'Estado', 'Causa', 'Unidad', 'Merma', 'Segundas', '% Deficiencia', 'Consumo Cemento (kg)', 'Volumen/unidad m³ (Costeo)', 'm³'],
  ];
  filas.forEach(p => {
    const cantidad = Number(p.cantidad) || 0;
    const merma = Number(p.merma) || 0;
    const segundas = Number(p.segundas) || 0;
    const intentado = cantidad + merma + segundas;
    const pctDeficiencia = intentado > 0 ? Math.round(((merma + segundas) / intentado) * 1000) / 10 : 0;
    const volumenUnidad = mapaVolumen[p.producto] || '';
    const m3 = mapaVolumen[p.producto] ? Math.round(cantidad * mapaVolumen[p.producto] * 100) / 100 : '';
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
      p.unidad || 'ud',
      merma,
      segundas,
      pctDeficiencia,
      Number(p.consumoCemento) || 0,
      volumenUnidad,
      m3,
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
    filasExcluidas.forEach(p => rowsExcl.push([p.fecha || '', p.producto || '', Number(p.cantidad) || 0, p.unidad || 'ud', Number(p.merma) || 0, Number(p.segundas) || 0, Number(p.consumoCemento) || 0]));
    const wsExcl = XLSX.utils.aoa_to_sheet(rowsExcl);
    XLSX.utils.book_append_sheet(wb, wsExcl, 'Sin clasificar');
  }

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Estadisticas_Produccion_${_LABEL_VOL_TIPO[tipo].replace(/\s+/g, '_')}_${fecha}.xlsx`);
}
