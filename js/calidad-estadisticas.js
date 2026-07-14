// ═══════════════════════════════
// CALIDAD — ANÁLISIS ESTADÍSTICO (NTC 673 / NTC 2275)
// Reproduce el anexo estadístico de laboratorio: por tipo de mezcla, con
// filtros por proyecto y producto. Calcula promedio, desviación estándar
// (con factor de corrección ACI 214/NTC 2275), coeficiente de variación,
// clasificación del control y verificación NSR-10 C.5.6.3.3, más el gráfico
// de resistencia vs. muestras fundidas.
// ═══════════════════════════════

let _chartEstadistica = null;
const PSI_POR_MPA = 145.0377;

const _COLOR_NIVEL = {
  'Excelente': { bg: '#E8F5E9', fg: '#1B5E20' },
  'Muy buena': { bg: '#E8F5E9', fg: '#2E7D32' },
  'Buena':     { bg: '#F1F8E9', fg: '#558B2F' },
  'Regular':   { bg: '#FFF3E0', fg: '#E65100' },
  'Mala':      { bg: '#FFEBEE', fg: '#C62828' },
};

function _mpaApsi(v) { return Math.round(v * PSI_POR_MPA); }

// Devuelve, para un ensayo, el resultado más cercano a la edad objetivo (dentro de tolerancia).
function _resultadoAEdad(ensayo, edadObjetivo, tolerancia) {
  const rs = (ensayo.resultados || []).filter(r => Number(r.resistencia) > 0 && r.edad != null);
  if (!rs.length) return null;
  let mejor = null, mejorDif = Infinity;
  rs.forEach(r => {
    const dif = Math.abs(Number(r.edad) - edadObjetivo);
    if (dif < mejorDif) { mejorDif = dif; mejor = r; }
  });
  return (mejorDif <= tolerancia) ? mejor : null;
}

// Proyectos y productos asociados a un ensayo (vía su ajuste diario / cilindro).
function _contextoEnsayo(ensayo) {
  const a = AJUSTES_MEZCLA.find(x => String(x.cilindroNo) === String(ensayo.cilindroNo));
  const proyectos = new Set();
  const productos = new Set();
  if (a) {
    if (a.proyecto) proyectos.add(a.proyecto);
    (a.clientesAdicionales || []).forEach(c => { if (c.proyecto) proyectos.add(c.proyecto); });
    if (a.productoNombre) productos.add(a.productoNombre);
    (a.productosAdicionales || []).forEach(p => { if (p.nombre) productos.add(p.nombre); });
  }
  if (!productos.size && ensayo.elemento) productos.add(ensayo.elemento);
  return { proyectos: [...proyectos], productos: [...productos] };
}

// Factor de corrección de la desviación estándar por número de ensayos (ACI 214 / NTC 2275).
function _factorCorreccionDesv(n) {
  const tabla = [[15, 1.16], [20, 1.08], [25, 1.03], [30, 1.00]];
  if (n < 15) return 1.16;
  if (n >= 30) return 1.00;
  for (let i = 0; i < tabla.length - 1; i++) {
    const [n1, f1] = tabla[i], [n2, f2] = tabla[i + 1];
    if (n >= n1 && n <= n2) return f1 + (f2 - f1) * (n - n1) / (n2 - n1);
  }
  return 1.00;
}

function _bucketDesv(s) { if (s < 2.8) return 0; if (s < 3.4) return 1; if (s < 4.1) return 2; if (s < 4.8) return 3; return 4; }
function _bucketCV(c) { if (c < 7) return 0; if (c < 9) return 1; if (c < 11) return 2; if (c < 14) return 3; return 4; }

// Clasificación del control según NTC 2275 (Tabla 4.3).
// f'c ≤ 35 MPa → por desviación estándar; f'c > 35 MPa → por coeficiente de variación.
function _clasificacionControl(fc, desvCorregida, cv) {
  const niveles = ['Excelente', 'Muy buena', 'Buena', 'Regular', 'Mala'];
  if (fc <= 35) {
    const i = _bucketDesv(desvCorregida);
    return { nivel: niveles[i], criterio: 'Desviación estándar', metrica: 'σ' };
  } else {
    const i = _bucketCV(cv);
    return { nivel: niveles[i], criterio: 'Coeficiente de variación', metrica: 'CV' };
  }
}

function poblarFiltrosEstadistica() {
  const selMezcla = document.getElementById('est-filtro-mezcla');
  const selProyecto = document.getElementById('est-filtro-proyecto');
  const selProducto = document.getElementById('est-filtro-producto');
  if (!selMezcla) return;

  const disenosConEnsayo = [...new Set(ENSAYOS_CALIDAD.map(e => e.disenoCodigo).filter(Boolean))];
  const disenosOrdenados = disenosConEnsayo
    .map(c => DISENOS_MEZCLA.find(d => d.codigo === c) || { codigo: c, nombre: '', resistenciaDiseno: '' })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const prevMezcla = selMezcla.value;
  selMezcla.innerHTML = '<option value="">— Selecciona un tipo de mezcla —</option>' +
    disenosOrdenados.map(d => `<option value="${d.codigo}">${d.codigo}${d.nombre ? ' — ' + d.nombre : ''}</option>`).join('');
  if (prevMezcla) selMezcla.value = prevMezcla;

  const proyectos = new Set(), productos = new Set();
  ENSAYOS_CALIDAD.forEach(e => {
    const ctx = _contextoEnsayo(e);
    ctx.proyectos.forEach(p => proyectos.add(p));
    ctx.productos.forEach(p => productos.add(p));
  });
  const prevProy = selProyecto.value, prevProd = selProducto.value;
  selProyecto.innerHTML = '<option value="">Todos los proyectos</option>' +
    [...proyectos].sort().map(p => `<option value="${p}">${p}</option>`).join('');
  selProducto.innerHTML = '<option value="">Todos los productos</option>' +
    [...productos].sort().map(p => `<option value="${p}">${p}</option>`).join('');
  if (prevProy) selProyecto.value = prevProy;
  if (prevProd) selProducto.value = prevProd;
}

function _cardStat(titulo, valor, sub, color) {
  return `<div style="background:white;border-radius:6px;padding:10px 14px;box-shadow:var(--sombra);border-top:3px solid ${color || 'var(--azul)'};min-width:140px;flex:1">
    <div style="font-size:10px;font-weight:700;color:${color || 'var(--azul)'};text-transform:uppercase;letter-spacing:0.03em">${titulo}</div>
    <div style="font-size:20px;font-weight:800;margin-top:2px">${valor}</div>
    ${sub ? `<div style="font-size:11px;color:var(--gris-medio)">${sub}</div>` : ''}
  </div>`;
}

function _tablaReferenciaNTC(fc, bucketAplicable) {
  const usarDesv = fc <= 35;
  const nivelesEncabezado = ['Excelente', 'Muy buena', 'Buena', 'Regular', 'Mala'];
  const filaDesv = ['< 2.8', '2.8 – 3.4', '3.4 – 4.1', '4.1 – 4.8', '> 4.8'];
  const filaCV = ['< 7.0', '7.0 – 9.0', '9.0 – 11.0', '11.0 – 14.0', '> 14.0'];
  const fila = usarDesv ? filaDesv : filaCV;
  const unidad = usarDesv ? 'Desviación estándar (MPa)' : 'Coeficiente de variación (%)';
  const th = nivelesEncabezado.map(nv => `<th style="padding:5px 8px;text-align:center;font-size:11px;background:${_COLOR_NIVEL[nv].bg};color:${_COLOR_NIVEL[nv].fg}">${nv}</th>`).join('');
  const td = fila.map((v, i) => `<td style="padding:5px 8px;text-align:center;font-size:12px;${i === bucketAplicable ? 'background:#FFF59D;font-weight:800;border:2px solid #F9A825' : ''}">${v}</td>`).join('');
  return `
    <div style="font-size:12px;font-weight:700;color:var(--gris-medio);margin:6px 0">Referencia NTC 2275 — Tabla 4.3 · ${usarDesv ? "f'c ≤ 35 MPa (por σ)" : "f'c > 35 MPa (por CV)"}</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;border:1px solid var(--gris-borde)">
      <thead><tr><th style="padding:5px 8px;text-align:left;font-size:11px;background:#ECEFF1">${unidad}</th>${th}</tr></thead>
      <tbody><tr><td style="padding:5px 8px;font-size:12px;background:#ECEFF1">Ensayos generales de construcción</td>${td}</tr></tbody>
    </table></div>`;
}

function renderAnalisisEstadistico() {
  poblarFiltrosEstadistica();
  const cont = document.getElementById('est-contenido');
  if (!cont) return;
  const codigo = document.getElementById('est-filtro-mezcla').value;
  const proyectoF = document.getElementById('est-filtro-proyecto').value;
  const productoF = document.getElementById('est-filtro-producto').value;
  const edad = parseInt(document.getElementById('est-filtro-edad').value) || 28;

  const _limpiarChart = () => { if (_chartEstadistica) { _chartEstadistica.destroy(); _chartEstadistica = null; } };

  const acciones = document.getElementById('est-acciones');

  if (!codigo) {
    _limpiarChart();
    cont.innerHTML = `<div class="card" style="padding:40px;text-align:center;color:var(--gris-medio)"><div style="font-size:40px;margin-bottom:8px">📊</div><div>Selecciona un <b>tipo de mezcla</b> para ver su análisis estadístico.</div></div>`;
    if (acciones) acciones.innerHTML = '';
    return;
  }

  const diseno = DISENOS_MEZCLA.find(d => d.codigo === codigo);
  const fc = Number(diseno?.resistenciaDiseno) || 0;

  let muestras = [];
  ENSAYOS_CALIDAD.filter(e => e.disenoCodigo === codigo).forEach(e => {
    const r = _resultadoAEdad(e, edad, 3);
    if (!r) return;
    const ctx = _contextoEnsayo(e);
    if (proyectoF && !ctx.proyectos.includes(proyectoF)) return;
    if (productoF && !ctx.productos.includes(productoF)) return;
    muestras.push({ fecha: r.fecha || e.fecha, fechaFundida: e.fecha, resistencia: Number(r.resistencia), numero: e.numero, edad: Number(r.edad) });
  });
  muestras.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

  const n = muestras.length;
  if (n === 0) {
    _limpiarChart();
    cont.innerHTML = `<div class="card" style="padding:40px;text-align:center;color:var(--gris-medio)"><div style="font-size:40px;margin-bottom:8px">🔍</div><div>No hay ensayos con resultado a <b>${edad} días</b> para el tipo de mezcla y filtros seleccionados.</div></div>`;
    if (acciones) acciones.innerHTML = '';
    return;
  }

  const valores = muestras.map(m => m.resistencia);
  const promedio = valores.reduce((s, v) => s + v, 0) / n;
  const desv = n >= 2 ? Math.sqrt(valores.reduce((s, v) => s + (v - promedio) ** 2, 0) / (n - 1)) : 0;
  const factor = _factorCorreccionDesv(n);
  const desvCorr = desv * factor;
  const cv = promedio ? (desv / promedio * 100) : 0;
  const cvCorr = promedio ? (desvCorr / promedio * 100) : 0;
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);

  let rangoProm = 0;
  if (n >= 2) {
    let sr = 0;
    for (let i = 1; i < n; i++) sr += Math.abs(valores[i] - valores[i - 1]);
    rangoProm = sr / (n - 1);
  }

  const movil3 = valores.map((_, i) => i >= 2 ? (valores[i] + valores[i - 1] + valores[i - 2]) / 3 : null);

  const limiteB = fc <= 35 ? fc - 3.5 : fc - 0.10 * fc;
  const cumpleA = n >= 3 ? movil3.filter(v => v != null).every(v => v >= fc) : null;
  const cumpleB = valores.every(v => v >= limiteB);

  const clasif = _clasificacionControl(fc, desvCorr, cv);
  const colorClasif = _COLOR_NIVEL[clasif.nivel];
  const bucketAplicable = fc <= 35 ? _bucketDesv(desvCorr) : _bucketCV(cv);

  const badge = (ok, txtOk, txtNo, txtNA) => {
    if (ok === null) return `<span class="badge" style="background:#ECEFF1;color:#607D8B">${txtNA}</span>`;
    return ok
      ? `<span class="badge" style="background:#E8F5E9;color:#2E7D32">✔ ${txtOk}</span>`
      : `<span class="badge" style="background:#FFEBEE;color:#C62828">✘ ${txtNo}</span>`;
  };

  // Un diseño de mezcla se revisa con el tiempo (materiales, resistencia, consumo de
  // cemento). Cada punto de la gráfica se colorea según qué versión de la receta estaba
  // vigente el día que se FUNDIÓ esa muestra (no el día que se rompió el cilindro), para
  // que un cambio de diseño quede evidente en el histórico — solo en pantalla, nunca en
  // el PDF imprimible (ver _generarImagenChartLimpia).
  const revisionesDiseno = (diseno?.revisiones || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  const PALETA_REVISION = ['#1565C0', '#8E24AA', '#00897B', '#D84315', '#5D4037'];
  const colorPorSegmento = idx => PALETA_REVISION[idx % PALETA_REVISION.length];
  const segmentos = muestras.map(m => _segmentoRevisionDiseno(codigo, m.fechaFundida || m.fecha));
  const pointColors = segmentos.map(s => colorPorSegmento(s));
  const fmtFecha = f => f ? new Date(f + 'T12:00').toLocaleDateString('es-CO') : '';

  let leyendaRevisionHTML = '';
  if (revisionesDiseno.length) {
    const fechas = revisionesDiseno.map(r => r.fecha);
    const rangos = [{ label: `Original (hasta ${fmtFecha(fechas[0])})`, color: colorPorSegmento(0) }];
    fechas.forEach((f, i) => {
      const hasta = fechas[i + 1] ? ` hasta ${fmtFecha(fechas[i + 1])}` : ' en adelante';
      rangos.push({ label: `Revisión ${i + 1} (desde ${fmtFecha(f)}${hasta})`, color: colorPorSegmento(i + 1) });
    });
    leyendaRevisionHTML = `
      <div id="est-leyenda-revision" style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;padding-top:8px;border-top:1px dashed var(--gris-borde);font-size:11px;color:var(--gris-medio)">
        ${rangos.map(r => `<span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${r.color};margin-right:4px"></span>${r.label}</span>`).join('')}
      </div>`;
  }

  cont.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:4px">
        <div style="font-size:15px;font-weight:700;color:var(--azul)">${codigo}${diseno?.nombre ? ' — ' + diseno.nombre : ''}</div>
        <div style="font-size:12px;color:var(--gris-medio)">Resistencia a ${edad} días${proyectoF ? ' · ' + proyectoF : ''}${productoF ? ' · ' + productoF : ''}</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${_cardStat("Resistencia de diseño f'c", fc ? `${fc} MPa` : '—', fc ? `${_mpaApsi(fc)} psi` : '', '#455A64')}
        ${_cardStat('N° de ensayos', n, `edad ≈ ${edad} días`, '#455A64')}
        ${_cardStat('Promedio', `${promedio.toFixed(1)} MPa`, `${_mpaApsi(promedio)} psi`, '#1565C0')}
        ${_cardStat('Desv. estándar', `${desv.toFixed(2)} MPa`, `corregida: ${desvCorr.toFixed(2)} MPa (f=${factor.toFixed(2)})`, '#6A1B9A')}
        ${_cardStat('Coef. de variación', `${cv.toFixed(1)} %`, `corregido: ${cvCorr.toFixed(1)} %`, '#00838F')}
        ${_cardStat('Rango prom. (móvil)', `${rangoProm.toFixed(1)} MPa`, `mín ${minimo.toFixed(1)} · máx ${maximo.toFixed(1)}`, '#455A64')}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card">
        <div style="font-size:13px;font-weight:700;color:var(--azul);margin-bottom:8px">Clasificación del control — NTC 2275</div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <div style="background:${colorClasif.bg};color:${colorClasif.fg};font-weight:800;font-size:18px;padding:8px 18px;border-radius:6px">${clasif.nivel}</div>
          <div style="font-size:12px;color:var(--gris-medio)">Según ${clasif.criterio}<br>(${fc <= 35 ? "f'c ≤ 35 MPa" : "f'c > 35 MPa"})</div>
        </div>
        ${_tablaReferenciaNTC(fc, bucketAplicable)}
      </div>
      <div class="card">
        <div style="font-size:13px;font-weight:700;color:var(--azul);margin-bottom:8px">Verificación NSR-10 · C.5.6.3.3</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="border-left:3px solid var(--gris-borde);padding-left:10px">
            <div style="font-size:12px;margin-bottom:4px"><b>(a)</b> Cada promedio de 3 ensayos consecutivos ≥ f'c</div>
            ${badge(cumpleA, 'Cumple', 'No cumple', 'Requiere ≥ 3 ensayos')}
          </div>
          <div style="border-left:3px solid var(--gris-borde);padding-left:10px">
            <div style="font-size:12px;margin-bottom:4px"><b>(b)</b> Ningún ensayo por debajo de ${limiteB.toFixed(1)} MPa <span style="color:var(--gris-medio)">(f'c ${fc <= 35 ? '− 3.5 MPa' : '− 0.10 f\'c'})</span></div>
            ${badge(cumpleB, 'Cumple', 'No cumple', '—')}
          </div>
        </div>
        <div style="font-size:10px;color:var(--gris-medio);margin-top:12px;line-height:1.5">Anexo estadístico descriptivo. No constituye evaluación de conformidad, liberación de obra ni autorización de desencofre.</div>
      </div>
    </div>

    <div class="card">
      <div style="font-size:13px;font-weight:700;color:var(--azul);margin-bottom:10px">Resistencia a ${edad} días vs. muestras fundidas</div>
      <div style="height:360px;position:relative"><canvas id="est-chart"></canvas></div>
      ${leyendaRevisionHTML}
    </div>`;

  const ctx2d = document.getElementById('est-chart').getContext('2d');
  _limpiarChart();
  _chartEstadistica = new Chart(ctx2d, {
    type: 'line',
    data: {
      labels: muestras.map((_, i) => i + 1),
      datasets: [
        { label: `Resistencia a ${edad} días`, data: valores, borderColor: '#1565C0', backgroundColor: '#1565C0', pointBackgroundColor: pointColors, pointBorderColor: pointColors, pointRadius: 3, borderWidth: 1.5, tension: 0.1 },
        { label: 'Promedio móvil 3 consecutivos', data: movil3, borderColor: '#E65100', backgroundColor: '#E65100', pointRadius: 0, borderWidth: 2, tension: 0.2, spanGaps: false },
        { label: `f'c = ${fc} MPa`, data: valores.map(() => fc), borderColor: '#2E7D32', pointRadius: 0, borderWidth: 2, borderDash: [6, 4] },
        { label: `f'c − ${(fc - limiteB).toFixed(1)} MPa = ${limiteB.toFixed(1)} MPa`, data: valores.map(() => limiteB), borderColor: '#C62828', pointRadius: 0, borderWidth: 1.5, borderDash: [3, 3] },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 14, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            afterLabel: (item) => {
              if (item.datasetIndex !== 0 || !revisionesDiseno.length) return '';
              const seg = segmentos[item.dataIndex];
              return seg === 0
                ? `⚠️ Diseño original — revisado después, el ${fmtFecha(revisionesDiseno[0].fecha)}`
                : `⚠️ Corresponde a la versión del diseño vigente desde ${fmtFecha(revisionesDiseno[seg - 1].fecha)}`;
            },
          },
        },
      },
      scales: {
        y: { title: { display: true, text: 'Resistencia (MPa)' } },
        x: { title: { display: true, text: 'Muestra (orden cronológico)' } },
      },
    },
  });

  _estadisticaActual = { codigo, nombreDiseno: diseno?.nombre || '', edad, proyectoF, productoF, fc, valores, movil3, limiteB };

  if (acciones) {
    acciones.innerHTML = `<button class="btn btn-verde" onclick="verAnalisisEstadisticoPDF()">🖨️ Imprimir Análisis</button>`;
  }
}

let _estadisticaActual = null;

// El PDF entregable al cliente nunca debe evidenciar las revisiones del diseño de mezcla
// (ni el color por punto ni la leyenda) — solo son una ayuda de análisis en pantalla. Por
// eso el PDF no reutiliza el canvas interactivo: renderiza una gráfica limpia aparte,
// con un único color, a partir de los mismos datos.
function _generarImagenChartLimpia(est) {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = 900; canvas.height = 400;
    canvas.style.position = 'fixed';
    canvas.style.left = '-9999px';
    document.body.appendChild(canvas);
    const chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: est.valores.map((_, i) => i + 1),
        datasets: [
          { label: `Resistencia a ${est.edad} días`, data: est.valores, borderColor: '#1565C0', backgroundColor: '#1565C0', pointRadius: 3, borderWidth: 1.5, tension: 0.1 },
          { label: 'Promedio móvil 3 consecutivos', data: est.movil3, borderColor: '#E65100', backgroundColor: '#E65100', pointRadius: 0, borderWidth: 2, tension: 0.2, spanGaps: false },
          { label: `f'c = ${est.fc} MPa`, data: est.valores.map(() => est.fc), borderColor: '#2E7D32', pointRadius: 0, borderWidth: 2, borderDash: [6, 4] },
          { label: `f'c − ${(est.fc - est.limiteB).toFixed(1)} MPa = ${est.limiteB.toFixed(1)} MPa`, data: est.valores.map(() => est.limiteB), borderColor: '#C62828', pointRadius: 0, borderWidth: 1.5, borderDash: [3, 3] },
        ],
      },
      options: {
        responsive: false,
        animation: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 14, font: { size: 11 } } } },
        scales: {
          y: { title: { display: true, text: 'Resistencia (MPa)' } },
          x: { title: { display: true, text: 'Muestra (orden cronológico)' } },
        },
      },
    });
    requestAnimationFrame(() => {
      const img = chart.toBase64Image();
      chart.destroy();
      document.body.removeChild(canvas);
      resolve(img);
    });
  });
}

async function verAnalisisEstadisticoPDF() {
  if (!_estadisticaActual || !_chartEstadistica) { alert('No hay un análisis para imprimir.'); return; }
  const est = _estadisticaActual;
  const contOriginal = document.getElementById('est-contenido');
  if (!contOriginal) return;

  const chartImg = await _generarImagenChartLimpia(est);
  const clone = contOriginal.cloneNode(true);
  const canvasWrap = clone.querySelector('#est-chart')?.parentElement;
  if (canvasWrap) canvasWrap.innerHTML = `<img src="${chartImg}" style="width:100%;height:auto;display:block">`;
  clone.querySelector('#est-leyenda-revision')?.remove();

  const fechaHoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
  const filtrosTxt = [est.proyectoF ? `Proyecto: ${est.proyectoF}` : '', est.productoF ? `Producto: ${est.productoF}` : ''].filter(Boolean).join(' · ');

  const html = `
    <div class="no-print" style="background:#1C2333;color:white;padding:12px 24px;display:flex;align-items:center;gap:16px">
      <span style="font-weight:700">Análisis Estadístico — ${est.codigo}${est.nombreDiseno ? ' — ' + est.nombreDiseno : ''}</span>
      <div style="flex:1"></div>
      <button onclick="descargarAnalisisEstadisticoPDF()" style="background:#1976D2;color:white;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-weight:700">⬇️ Descargar PDF</button>
      <button onclick="document.getElementById('vista-previa').style.display='none';document.getElementById('pantalla-analisis-estadistico').classList.add('activa')" style="background:#555;color:white;border:none;padding:8px 14px;border-radius:5px;cursor:pointer">← Volver</button>
    </div>
    <div class="preview-doc" id="est-pdf-doc">
      <div class="preview-membrete-header">
        <img src="membrete-top.jpg" alt="">
      </div>
      <div class="preview-content" id="est-pdf-content" style="padding-top:6px">
        <div style="text-align:center;margin-bottom:10px">
          <div style="font-size:13px;font-weight:700;color:#003F7F;letter-spacing:0.03em">ANÁLISIS ESTADÍSTICO DE RESISTENCIAS</div>
          <div style="font-size:10.5px;color:#555;margin-top:2px">Diseño de mezcla ${est.codigo}${est.nombreDiseno ? ' — ' + est.nombreDiseno : ''}</div>
          <div style="font-size:10px;color:#777">${filtrosTxt ? filtrosTxt + ' · ' : ''}Generado el ${fechaHoy}</div>
        </div>
        ${clone.innerHTML}
      </div>
      <div class="preview-membrete-footer" id="est-pdf-footer">
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

async function descargarAnalisisEstadisticoPDF() {
  const est = _estadisticaActual;
  const btn = document.querySelector('.no-print button[onclick*="descargarAnalisisEstadisticoPDF"]');
  if (btn) { btn.textContent = '⏳ Generando...'; btn.disabled = true; }
  try {
    const { jsPDF } = window.jspdf;
    const pageW = 210, pageH = 297;
    const topImg = await cargarImagen('membrete-top.jpg');
    const headerH = pageW * (topImg.naturalHeight / topImg.naturalWidth);
    const contentEl = document.getElementById('est-pdf-content');
    const contentCanvas = await html2canvas(contentEl, { scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false });
    const pxToMm = pageW / contentCanvas.width;
    const contentH_px = _alturaContenidoReal(contentCanvas);
    const footerEl = document.getElementById('est-pdf-footer');
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
    pdf.save(`Analisis_Estadistico_${est?.codigo || 'mezcla'}.pdf`);
  } finally {
    if (btn) { btn.textContent = '⬇️ Descargar PDF'; btn.disabled = false; }
  }
}
