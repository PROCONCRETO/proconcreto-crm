// ═══════════════════════════════
// COSTEO — AMORTIZACIÓN DE MAQUINARIA Y EQUIPOS
// ═══════════════════════════════
// Fórmula estándar de la industria (depreciación en línea recta + mantenimiento):
//   Depreciación por unidad = (Valor de compra − Valor de rescate) / Capacidad total de vida útil
//   Costo por unidad = Depreciación por unidad + Mantenimiento por unidad
// La "capacidad total de vida útil" se puede fijar de dos formas (una máquina elige una):
//   - "Por años": vida útil en años × unidades de uso por año (para máquinas cuyo desgaste
//     depende más del tiempo, ej. un montacargas por día).
//   - "Por usos totales": un número fijo de usos de vida (ciclos, m³...), sin pasar por
//     años — para máquinas cuyo desgaste depende del uso, no del calendario (ej. una
//     cortadora que dura 200.000 ciclos sin importar cuántos años tarde en llegar ahí).
// El "Mantenimiento por unidad" se calcula distinto según el modo (2026-07-31, corregido a
// pedido del usuario — la versión original repartía el % una sola vez sobre la depreciación
// total, lo que daba un mantenimiento anual irrealmente bajo para máquinas caras de vida
// larga; ver docs/modulos/costeo.md):
//   - "Por años": el % se cobra CADA AÑO sobre el valor de compra completo (no sobre la
//     depreciación) — Mantenimiento anual = Valor de compra × %; ese monto se reparte entre
//     la capacidad anual para sacar el costo por unidad. Así el total en toda la vida útil
//     es Valor de compra × % × años, un mantenimiento realista para equipo pesado.
//   - "Por usos totales": no hay una dimensión de años a la que anclar un cargo anual (por
//     diseño, es para máquinas cuyo desgaste no depende del calendario) — ahí el % se sigue
//     aplicando proporcional a la depreciación por uso, como antes.
let MAQUINARIA_EQUIPOS = [];
let _baseVidaUtilActualMaquina = 'anos';

// Unidades tomadas de la hoja MAQ-EQUPO del Excel original — desplegable cerrado
// (en vez de texto libre) para que no queden variantes tipo "ciclo"/"Ciclos"/"CICLO".
// "golpe" se renombró a "ciclo" (2026-08-02, a pedido del usuario, en toda la app).
const UNIDADES_USO_MAQUINA = { ciclo: 'Ciclo', dia: 'Día', m3: 'm³', m2: 'm²', banco: 'Banco' };
function _labelUnidadUso(v) { return UNIDADES_USO_MAQUINA[v] || v || ''; }

function calcularCostoMaquina(m) {
  const valorCompra = Number(m.valorCompra) || 0;
  const rescatePct = Number(m.rescatePct) || 0;
  const valorRescate = valorCompra * (rescatePct / 100);
  const valorADepreciar = valorCompra - valorRescate;
  const esPorAnos = m.baseVidaUtil !== 'usos';
  const capacidadTotal = esPorAnos
    ? (Number(m.vidaUtilAnos) || 0) * (Number(m.capacidadAnual) || 0)
    : (Number(m.usosTotal) || 0);
  const depreciacion = capacidadTotal > 0 ? valorADepreciar / capacidadTotal : 0;

  // El % de mantenimiento NO se reparte una sola vez sobre la depreciación total — eso
  // subestimaba mucho el costo real de mantener una máquina cara por muchos años (ej. 10%
  // de $1.500M en 15 años daba solo $10M/año de mantenimiento, muy bajo para una máquina de
  // ese valor). Corregido 2026-07-31, a pedido del usuario: para máquinas "por años" el %
  // se cobra CADA AÑO sobre el valor de compra completo (mantenimiento anual = valorCompra
  // × %), y ese monto anual se reparte entre la capacidad anual para sacar el costo por
  // unidad — así si se usa toda la vida útil, el total de mantenimiento sí da
  // valorCompra × % × vidaUtilAnos, no solo % de la depreciación una vez.
  // Para máquinas "por usos totales" no hay una dimensión de años a la cual anclar un
  // mantenimiento anual (por diseño: son máquinas cuyo desgaste depende del uso, no del
  // calendario) — ahí el % se sigue aplicando proporcional a la depreciación por uso, igual
  // que antes.
  let mantenimiento;
  if (esPorAnos) {
    const mantenimientoAnual = valorCompra * ((Number(m.mantenimientoPct) || 0) / 100);
    const capacidadAnual = Number(m.capacidadAnual) || 0;
    mantenimiento = capacidadAnual > 0 ? mantenimientoAnual / capacidadAnual : 0;
  } else {
    mantenimiento = depreciacion * ((Number(m.mantenimientoPct) || 0) / 100);
  }

  const costoUnidad = depreciacion + mantenimiento;
  return { valorRescate, valorADepreciar, capacidadTotal, depreciacion, mantenimiento, costoUnidad };
}

// Costos por unidad suelen ser valores chicos (ej. $40, $199,50) donde los centavos sí se
// notan — a diferencia de _fmt() (mano de obra) que redondea a entero porque ahí todo son
// cifras grandes (salarios). Los montos grandes (valor de compra, rescate) sí usan _fmt().
function _fmtMaq(n) {
  return '$' + (n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderCosteoMaquinaria() {
  const body = document.getElementById('maquinaria-body');
  if (!body) return;
  if (!MAQUINARIA_EQUIPOS.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty-state"><div class="icono">🔧</div><div>No hay máquinas ni equipos registrados.</div></td></tr>`;
    return;
  }
  body.innerHTML = MAQUINARIA_EQUIPOS.map(m => {
    const c = calcularCostoMaquina(m);
    const vidaTexto = m.baseVidaUtil === 'usos'
      ? `${(Number(m.usosTotal) || 0).toLocaleString('es-CO')} usos`
      : `${m.vidaUtilAnos || 0} años`;
    return `
    <tr>
      <td style="font-weight:600">${m.nombre}</td>
      <td><span style="display:inline-block;background:var(--gris-claro);color:var(--gris-medio);font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px">${_labelUnidadUso(m.unidadUso)}</span></td>
      <td style="font-size:12px;color:var(--gris-medio)">${vidaTexto}</td>
      <td style="text-align:right;font-weight:700;color:var(--azul)">${_fmtMaq(c.costoUnidad)}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-primario btn-xs" onclick="editarMaquina('${m.nombre.replace(/'/g, "\\'")}')">✏️</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarMaquina('${m.nombre.replace(/'/g, "\\'")}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function _elegirBaseVidaUtilMaquina(base) {
  _baseVidaUtilActualMaquina = base;
  const btnAnos = document.getElementById('btn-base-anos');
  const btnUsos = document.getElementById('btn-base-usos');
  const bloqueAnos = document.getElementById('bloque-vida-anos');
  const bloqueUsos = document.getElementById('bloque-vida-usos');
  if (base === 'usos') {
    btnAnos.style.background = 'white'; btnAnos.style.color = 'var(--gris-medio)';
    btnUsos.style.background = 'var(--azul)'; btnUsos.style.color = 'white';
    bloqueAnos.style.display = 'none';
    bloqueUsos.style.display = 'grid';
  } else {
    btnAnos.style.background = 'var(--azul)'; btnAnos.style.color = 'white';
    btnUsos.style.background = 'white'; btnUsos.style.color = 'var(--gris-medio)';
    bloqueAnos.style.display = 'grid';
    bloqueUsos.style.display = 'none';
  }
  _actualizarDesgloseMaquina();
}

function _leerFormularioMaquina() {
  return {
    valorCompra: parseFloat(document.getElementById('m-maquina-valor-compra').value) || 0,
    unidadUso: document.getElementById('m-maquina-unidad-uso').value.trim() || 'unidad',
    baseVidaUtil: _baseVidaUtilActualMaquina,
    vidaUtilAnos: parseFloat(document.getElementById('m-maquina-vida-anos').value) || 0,
    capacidadAnual: parseFloat(document.getElementById('m-maquina-capacidad-anual').value) || 0,
    usosTotal: parseFloat(document.getElementById('m-maquina-usos-total').value) || 0,
    rescatePct: parseFloat(document.getElementById('m-maquina-rescate-pct').value) || 0,
    mantenimientoPct: parseFloat(document.getElementById('m-maquina-mantenimiento-pct').value) || 0,
    // Volumen de una tanda de mezcla — solo aplica a mezcladoras; lo usa Costeo de Producto
    // para convertir un Diseño de Mezcla (por m³) a "por cochada". 0 para el resto de máquinas.
    capacidadCochadaM3: parseFloat(document.getElementById('m-maquina-capacidad-cochada').value) || 0,
  };
}

function _actualizarDesgloseMaquina() {
  const div = document.getElementById('maquina-desglose');
  if (!div) return;
  const m = _leerFormularioMaquina();
  const c = calcularCostoMaquina(m);

  const unidadLabel = _labelUnidadUso(m.unidadUso);
  const previewAnos = document.getElementById('m-maquina-capacidad-preview-anos');
  if (previewAnos) previewAnos.value = `${c.capacidadTotal.toLocaleString('es-CO')} ${unidadLabel}`;

  const esPorAnos = m.baseVidaUtil !== 'usos';
  const capacidadAnual = Number(m.capacidadAnual) || 0;
  const mantenimientoAnual = m.valorCompra * ((Number(m.mantenimientoPct) || 0) / 100);
  // "Por años": el mantenimiento se ve como un cargo anual (% del valor de compra) que se
  // reparte entre la capacidad anual — así queda visible que el total en toda la vida útil
  // es valorCompra × % × años, no solo % de la depreciación una sola vez.
  // "Por usos totales": no hay años a los que anclar un cargo anual, sigue proporcional a la
  // depreciación por uso (igual que siempre para este modo).
  const filaMantenimiento = esPorAnos
    ? `
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>Mantenimiento anual (${m.mantenimientoPct}% del valor de compra)</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${_fmt(mantenimientoAnual)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>÷ Capacidad anual</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${capacidadAnual.toLocaleString('es-CO')} ${unidadLabel}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>+ Mantenimiento por ${unidadLabel}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${_fmtMaq(c.mantenimiento)}</span></div>`
    : `
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>+ Mantenimiento (${m.mantenimientoPct}% de la depreciación)</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${_fmtMaq(c.mantenimiento)}</span></div>`;

  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>Valor de compra</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${_fmt(m.valorCompra)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0;color:var(--rojo)"><span>− Valor de rescate (${m.rescatePct}%)</span><span style="font-weight:600;font-variant-numeric:tabular-nums">− ${_fmt(c.valorRescate)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>= Valor a depreciar</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${_fmt(c.valorADepreciar)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>÷ Capacidad total de vida útil</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${c.capacidadTotal.toLocaleString('es-CO')} ${unidadLabel}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>Depreciación por ${unidadLabel}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${_fmtMaq(c.depreciacion)}</span></div>
    ${filaMantenimiento}
    <div style="display:flex;justify-content:space-between;padding-top:8px;margin-top:6px;border-top:2px solid var(--azul);font-weight:700;font-size:15px;color:var(--azul)"><span>Costo por ${unidadLabel}</span><span style="font-variant-numeric:tabular-nums">${_fmtMaq(c.costoUnidad)}</span></div>
  `;
}

function abrirModalMaquina() {
  document.getElementById('m-maquina-nombre-anterior').value = '';
  document.getElementById('modal-maquina-titulo').textContent = '🔧 Nueva Máquina';
  document.getElementById('m-maquina-nombre').value = '';
  document.getElementById('m-maquina-valor-compra').value = '';
  document.getElementById('m-maquina-unidad-uso').value = '';
  document.getElementById('m-maquina-vida-anos').value = '';
  document.getElementById('m-maquina-capacidad-anual').value = '';
  document.getElementById('m-maquina-usos-total').value = '';
  document.getElementById('m-maquina-rescate-pct').value = 0;
  document.getElementById('m-maquina-mantenimiento-pct').value = 0;
  document.getElementById('m-maquina-capacidad-cochada').value = 0;
  _elegirBaseVidaUtilMaquina('anos');
  document.getElementById('modal-maquina').classList.add('abierto');
}

function editarMaquina(nombre) {
  const m = MAQUINARIA_EQUIPOS.find(x => x.nombre === nombre);
  if (!m) return;
  document.getElementById('m-maquina-nombre-anterior').value = m.nombre;
  document.getElementById('modal-maquina-titulo').textContent = '✏️ Editar Máquina';
  document.getElementById('m-maquina-nombre').value = m.nombre;
  document.getElementById('m-maquina-valor-compra').value = m.valorCompra || 0;
  document.getElementById('m-maquina-unidad-uso').value = m.unidadUso || '';
  document.getElementById('m-maquina-vida-anos').value = m.vidaUtilAnos || '';
  document.getElementById('m-maquina-capacidad-anual').value = m.capacidadAnual || '';
  document.getElementById('m-maquina-usos-total').value = m.usosTotal || '';
  document.getElementById('m-maquina-rescate-pct').value = m.rescatePct || 0;
  document.getElementById('m-maquina-mantenimiento-pct').value = m.mantenimientoPct || 0;
  document.getElementById('m-maquina-capacidad-cochada').value = m.capacidadCochadaM3 || 0;
  _elegirBaseVidaUtilMaquina(m.baseVidaUtil === 'usos' ? 'usos' : 'anos');
  document.getElementById('modal-maquina').classList.add('abierto');
}

function guardarMaquina() {
  const nombre = document.getElementById('m-maquina-nombre').value.trim();
  if (!nombre) { alert('El nombre es requerido.'); return; }
  const m = _leerFormularioMaquina();
  if (!m.unidadUso) { alert('La unidad de uso es requerida (ej: ciclo, día, m³).'); return; }
  m.nombre = nombre;
  const nombreAnterior = document.getElementById('m-maquina-nombre-anterior').value;
  const guardarEnSupabase = () => {
    sb.from('maquinaria_equipos').upsert({ nombre, datos: m, modificado: new Date().toISOString() }, { onConflict: 'nombre' })
      .then(({ error }) => { if (error) console.error('Error guardando máquina:', error.message); });
  };
  if (nombreAnterior && nombreAnterior !== nombre) {
    // Cambió el nombre: borrar el registro viejo e insertar el nuevo (mismo patrón que Clases Salariales).
    const idx = MAQUINARIA_EQUIPOS.findIndex(x => x.nombre === nombreAnterior);
    if (idx >= 0) MAQUINARIA_EQUIPOS[idx] = m; else MAQUINARIA_EQUIPOS.push(m);
    sb.from('maquinaria_equipos').delete().eq('nombre', nombreAnterior).then(guardarEnSupabase);
  } else {
    const idx = MAQUINARIA_EQUIPOS.findIndex(x => x.nombre === nombre);
    if (idx >= 0) MAQUINARIA_EQUIPOS[idx] = m; else MAQUINARIA_EQUIPOS.push(m);
    guardarEnSupabase();
  }
  cerrarModal('modal-maquina');
  renderCosteoMaquinaria();
  _revisarImpactoPrecios(`Máquina "${nombre}" actualizada en Maquinaria y Equipos`);
}

function eliminarMaquina(nombre) {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return;
  MAQUINARIA_EQUIPOS = MAQUINARIA_EQUIPOS.filter(x => x.nombre !== nombre);
  sb.from('maquinaria_equipos').delete().eq('nombre', nombre).then(({ error }) => { if (error) console.error('Error eliminando máquina:', error.message); });
  renderCosteoMaquinaria();
}
