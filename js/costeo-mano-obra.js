// ═══════════════════════════════
// COSTEO — COSTO DE MANO DE OBRA + CUADRILLAS PRODUCTIVAS
// ═══════════════════════════════
// Reproduce el motor de costeo de mano de obra del Excel "COSTOS MAESTRO" (MOD + CAP.MO):
// un salario base (S.M.M.L.V. × múltiplo de "clase") se le suma prestaciones sociales,
// seguridad social, parafiscales y dotación para sacar el costo REAL mensual/día/año de esa
// clase de trabajador — y las "cuadrillas productivas" combinan varias personas de distintas
// clases (oficial + ayudantes + fracciones de supervisor/almacenista, etc.) en un solo costo.
let PARAMETROS_MO = null;
let CLASES_SALARIALES = [];
let CUADRILLAS_PRODUCTIVAS = [];
let _rolesCuadrillaActual = [];

function _defaultParametrosMO() {
  return {
    smmlv: 1751000,
    subsidioTransporte: 250000,
    divisorDia: 20,
    horasSemanales: 42,
    cesantiaDias: 30,
    interesesCesantiaPct: 12,
    vacacionesPct: 50,
    primaPct: 100,
    pensionPct: 12,
    saludPct: 8.5,
    arlPct: 6.96,
    aporteOrdinarioPct: 0,
    subsidioFamiliarPct: 4,
    dotacion: [
      { nombre: 'Protectores auditivos', valorUnitario: 1575, cantidadAnual: 24 },
      { nombre: 'Guantes hilaza (trabajo pesado)', valorUnitario: 6825, cantidadAnual: 24 },
      { nombre: 'Jean', valorUnitario: 36750, cantidadAnual: 3 },
      { nombre: 'Camiseta', valorUnitario: 31500, cantidadAnual: 6 },
      { nombre: 'Botas', valorUnitario: 58800, cantidadAnual: 3 },
      { nombre: 'Transporte especial para trabajadores', valorUnitario: 8000, cantidadAnual: 240 },
      { nombre: 'Examen ingreso y egreso', valorUnitario: 20000, cantidadAnual: 1 },
    ],
  };
}

function _dotacionTotalAnual(p) {
  return (p.dotacion || []).reduce((s, d) => s + (Number(d.valorUnitario) || 0) * (Number(d.cantidadAnual) || 0), 0);
}

// Reproduce exactamente las fórmulas de MOD: A=salario base, B=subsidio transporte,
// C=A+B, D=base anual para seguridad social/parafiscales (solo salario), E=base anual
// para cesantía (salario+subsidio). Verificado contra el Excel real, cuadra al peso.
function calcularCosteoClase(clase, p) {
  const mult = Number(clase.multiplicador) || 0;
  const aplicaSubsidio = clase.aplicaSubsidioTransporte !== false;
  const A_mensual = p.smmlv * mult;
  const A_anual = A_mensual * 12;
  const B_mensual = aplicaSubsidio ? p.subsidioTransporte : 0;
  const C_mensual = A_mensual + B_mensual;
  const C_anual = C_mensual * 12;
  const D_anual = A_anual;
  const E_anual = C_anual;

  const cesantia = E_anual * (p.cesantiaDias / 365);
  const interesesCesantia = cesantia * (p.interesesCesantiaPct / 100);
  const vacaciones = A_mensual * (p.vacacionesPct / 100);
  const prima = C_mensual * (p.primaPct / 100);
  const dotacionTotal = _dotacionTotalAnual(p);
  const pension = D_anual * (p.pensionPct / 100);
  const salud = D_anual * (p.saludPct / 100);
  const arl = D_anual * (p.arlPct / 100);
  const aporteOrdinario = D_anual * (p.aporteOrdinarioPct / 100);
  const subsidioFamiliar = D_anual * (p.subsidioFamiliarPct / 100);

  const valorRealAnual = C_anual + cesantia + interesesCesantia + vacaciones + prima + dotacionTotal
    + pension + salud + arl + aporteOrdinario + subsidioFamiliar;
  const valorRealMensual = valorRealAnual / 12;
  const valorRealDiario = valorRealMensual / (p.divisorDia || 20);
  // Semana = año/52; hora = semana / horas semanales legales (42 en Colombia desde jul-2026).
  const valorRealSemanal = valorRealAnual / 52;
  const valorRealHora = valorRealSemanal / (p.horasSemanales || 42);

  return {
    valorRealAnual, valorRealMensual, valorRealSemanal, valorRealDiario, valorRealHora,
    // Discriminado (para el detalle con %) — cada concepto en valor/año, como en el Excel original.
    salarioAnual: A_anual, subsidioTransporteAnual: B_mensual * 12, cesantia, interesesCesantia, vacaciones, prima,
    dotacionTotal, pension, salud, arl, aporteOrdinario, subsidioFamiliar,
  };
}

function _fmt(n) { return '$' + Math.round(n || 0).toLocaleString('es-CO'); }

function renderCosteoManoObra() {
  if (!PARAMETROS_MO) PARAMETROS_MO = _defaultParametrosMO();
  document.getElementById('pmo-smmlv').value = PARAMETROS_MO.smmlv;
  document.getElementById('pmo-subsidio-transporte').value = PARAMETROS_MO.subsidioTransporte;
  document.getElementById('pmo-divisor-dia').value = PARAMETROS_MO.divisorDia;
  document.getElementById('pmo-horas-semanales').value = PARAMETROS_MO.horasSemanales;
  document.getElementById('pmo-cesantia-dias').value = PARAMETROS_MO.cesantiaDias;
  document.getElementById('pmo-intereses-cesantia').value = PARAMETROS_MO.interesesCesantiaPct;
  document.getElementById('pmo-vacaciones').value = PARAMETROS_MO.vacacionesPct;
  document.getElementById('pmo-prima').value = PARAMETROS_MO.primaPct;
  document.getElementById('pmo-pension').value = PARAMETROS_MO.pensionPct;
  document.getElementById('pmo-salud').value = PARAMETROS_MO.saludPct;
  document.getElementById('pmo-arl').value = PARAMETROS_MO.arlPct;
  document.getElementById('pmo-aporte-ordinario').value = PARAMETROS_MO.aporteOrdinarioPct;
  document.getElementById('pmo-subsidio-familiar').value = PARAMETROS_MO.subsidioFamiliarPct;
  renderDotacionMO();
  renderClasesSalariales();
  renderCuadrillas();
}

// ── Dotación (editable dentro de Parámetros generales) ──
function renderDotacionMO() {
  const body = document.getElementById('dotacion-mo-body');
  if (!body) return;
  const dotacion = PARAMETROS_MO.dotacion || [];
  body.innerHTML = dotacion.map((d, i) => `
    <tr>
      <td><input type="text" value="${d.nombre || ''}" oninput="PARAMETROS_MO.dotacion[${i}].nombre=this.value" style="width:100%;border:1px solid var(--gris-borde);border-radius:4px;padding:5px 7px;font-size:12px"></td>
      <td><input type="number" min="0" step="1" value="${d.valorUnitario || 0}" oninput="PARAMETROS_MO.dotacion[${i}].valorUnitario=parseFloat(this.value)||0;renderDotacionMO()" style="width:100%;border:1px solid var(--gris-borde);border-radius:4px;padding:5px 7px;font-size:12px"></td>
      <td><input type="number" min="0" step="1" value="${d.cantidadAnual || 0}" oninput="PARAMETROS_MO.dotacion[${i}].cantidadAnual=parseFloat(this.value)||0;renderDotacionMO()" style="width:100%;border:1px solid var(--gris-borde);border-radius:4px;padding:5px 7px;font-size:12px"></td>
      <td style="text-align:right;font-size:12px">${_fmt((d.valorUnitario || 0) * (d.cantidadAnual || 0))}</td>
      <td><button class="btn btn-rojo btn-xs" onclick="eliminarDotacionMO(${i})">✕</button></td>
    </tr>`).join('');
}

function agregarDotacionMO() {
  if (!PARAMETROS_MO.dotacion) PARAMETROS_MO.dotacion = [];
  PARAMETROS_MO.dotacion.push({ nombre: '', valorUnitario: 0, cantidadAnual: 1 });
  renderDotacionMO();
}

function eliminarDotacionMO(i) {
  PARAMETROS_MO.dotacion.splice(i, 1);
  renderDotacionMO();
}

function guardarParametrosMO() {
  PARAMETROS_MO.smmlv = parseFloat(document.getElementById('pmo-smmlv').value) || 0;
  PARAMETROS_MO.subsidioTransporte = parseFloat(document.getElementById('pmo-subsidio-transporte').value) || 0;
  PARAMETROS_MO.divisorDia = parseFloat(document.getElementById('pmo-divisor-dia').value) || 20;
  PARAMETROS_MO.horasSemanales = parseFloat(document.getElementById('pmo-horas-semanales').value) || 42;
  PARAMETROS_MO.cesantiaDias = parseFloat(document.getElementById('pmo-cesantia-dias').value) || 0;
  PARAMETROS_MO.interesesCesantiaPct = parseFloat(document.getElementById('pmo-intereses-cesantia').value) || 0;
  PARAMETROS_MO.vacacionesPct = parseFloat(document.getElementById('pmo-vacaciones').value) || 0;
  PARAMETROS_MO.primaPct = parseFloat(document.getElementById('pmo-prima').value) || 0;
  PARAMETROS_MO.pensionPct = parseFloat(document.getElementById('pmo-pension').value) || 0;
  PARAMETROS_MO.saludPct = parseFloat(document.getElementById('pmo-salud').value) || 0;
  PARAMETROS_MO.arlPct = parseFloat(document.getElementById('pmo-arl').value) || 0;
  PARAMETROS_MO.aporteOrdinarioPct = parseFloat(document.getElementById('pmo-aporte-ordinario').value) || 0;
  PARAMETROS_MO.subsidioFamiliarPct = parseFloat(document.getElementById('pmo-subsidio-familiar').value) || 0;
  sb.from('parametros_mo').upsert({ id: 1, datos: PARAMETROS_MO, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => {
      if (error) { alert('⚠️ Error guardando parámetros: ' + error.message); return; }
      mostrarToast('✅ Parámetros guardados');
    });
  renderClasesSalariales();
  renderCuadrillas();
}

// ── Clases salariales ──
function renderClasesSalariales() {
  const body = document.getElementById('clases-salariales-body');
  if (!body) return;
  if (!CLASES_SALARIALES.length) {
    body.innerHTML = `<tr><td colspan="9" class="empty-state"><div class="icono">👷</div><div>No hay clases salariales registradas.</div></td></tr>`;
    return;
  }
  body.innerHTML = CLASES_SALARIALES.map(c => {
    const r = calcularCosteoClase(c, PARAMETROS_MO);
    return `
    <tr>
      <td style="font-weight:600">${c.nombre}</td>
      <td style="text-align:center">${Number(c.multiplicador).toFixed(2)}×</td>
      <td style="text-align:center">${c.aplicaSubsidioTransporte === false ? 'No' : 'Sí'}</td>
      <td style="text-align:right">${_fmt(r.valorRealHora)}</td>
      <td style="text-align:right">${_fmt(r.valorRealDiario)}</td>
      <td style="text-align:right">${_fmt(r.valorRealSemanal)}</td>
      <td style="text-align:right">${_fmt(r.valorRealMensual)}</td>
      <td style="text-align:right">${_fmt(r.valorRealAnual)}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-secundario btn-xs" onclick="abrirDetalleClase('${c.nombre.replace(/'/g, "\\'")}')" title="Ver discriminado del costo">➕</button>
          <button class="btn btn-primario btn-xs" onclick="editarClaseSalarial('${c.nombre.replace(/'/g, "\\'")}')">✏️</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarClaseSalarial('${c.nombre.replace(/'/g, "\\'")}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function _claseCalculada(nombre) {
  const c = CLASES_SALARIALES.find(x => x.nombre === nombre);
  if (!c) return null;
  return { ...c, ...calcularCosteoClase(c, PARAMETROS_MO) };
}

// Discriminado del costo de una clase — mismo desglose "BASE/FACTOR/VALOR/%" del Excel
// original (MOD), para que se pueda auditar de dónde sale el valor real de cada clase.
function abrirDetalleClase(nombre) {
  const c = _claseCalculada(nombre);
  if (!c) return;
  document.getElementById('modal-detalle-clase-titulo').textContent = `Discriminado de Costos — ${c.nombre}`;
  const conceptos = [
    { nombre: 'Salario (S.M.M.L.V. × múltiplo)', valor: c.salarioAnual },
    { nombre: 'Subsidio de transporte', valor: c.subsidioTransporteAnual },
    { nombre: 'Cesantía', valor: c.cesantia },
    { nombre: 'Intereses sobre cesantía', valor: c.interesesCesantia },
    { nombre: 'Vacaciones', valor: c.vacaciones },
    { nombre: 'Prima', valor: c.prima },
    { nombre: 'Dotación', valor: c.dotacionTotal },
    { nombre: 'Pensión', valor: c.pension },
    { nombre: 'Salud', valor: c.salud },
    { nombre: 'ARL', valor: c.arl },
    { nombre: 'SENA / Aporte ordinario', valor: c.aporteOrdinario },
    { nombre: 'Caja de compensación', valor: c.subsidioFamiliar },
  ];
  document.getElementById('detalle-clase-resumen').innerHTML = `
    <span><strong>Hora:</strong> ${_fmt(c.valorRealHora)}</span>
    <span><strong>Día:</strong> ${_fmt(c.valorRealDiario)}</span>
    <span><strong>Semana:</strong> ${_fmt(c.valorRealSemanal)}</span>
    <span><strong>Mes:</strong> ${_fmt(c.valorRealMensual)}</span>
    <span><strong>Año:</strong> ${_fmt(c.valorRealAnual)}</span>`;
  document.getElementById('detalle-clase-body').innerHTML = conceptos.map(x => `
    <tr>
      <td>${x.nombre}</td>
      <td style="text-align:right">${_fmt(x.valor)}</td>
      <td style="text-align:right">${c.valorRealAnual ? (x.valor / c.valorRealAnual * 100).toFixed(1) : '0.0'}%</td>
    </tr>`).join('') + `
    <tr style="font-weight:700;border-top:2px solid var(--gris-borde)">
      <td>TOTAL (valor real anual)</td>
      <td style="text-align:right">${_fmt(c.valorRealAnual)}</td>
      <td style="text-align:right">100.0%</td>
    </tr>`;
  document.getElementById('modal-detalle-clase').classList.add('abierto');
}

function abrirModalClaseSalarial() {
  document.getElementById('m-clase-nombre-anterior').value = '';
  document.getElementById('modal-clase-titulo').textContent = '➕ Nueva Clase Salarial';
  document.getElementById('m-clase-nombre').value = '';
  document.getElementById('m-clase-multiplicador').value = 1;
  document.getElementById('m-clase-subsidio').value = 'si';
  document.getElementById('modal-clase-salarial').classList.add('abierto');
}

function editarClaseSalarial(nombre) {
  const c = CLASES_SALARIALES.find(x => x.nombre === nombre);
  if (!c) return;
  document.getElementById('m-clase-nombre-anterior').value = c.nombre;
  document.getElementById('modal-clase-titulo').textContent = '✏️ Editar Clase Salarial';
  document.getElementById('m-clase-nombre').value = c.nombre;
  document.getElementById('m-clase-multiplicador').value = c.multiplicador;
  document.getElementById('m-clase-subsidio').value = c.aplicaSubsidioTransporte === false ? 'no' : 'si';
  document.getElementById('modal-clase-salarial').classList.add('abierto');
}

function guardarClaseSalarial() {
  const nombre = document.getElementById('m-clase-nombre').value.trim();
  if (!nombre) { alert('El nombre es requerido.'); return; }
  const nombreAnterior = document.getElementById('m-clase-nombre-anterior').value;
  const clase = {
    nombre,
    multiplicador: parseFloat(document.getElementById('m-clase-multiplicador').value) || 0,
    aplicaSubsidioTransporte: document.getElementById('m-clase-subsidio').value === 'si',
  };
  const guardarEnSupabase = () => {
    sb.from('clases_salariales').upsert({ nombre, datos: clase, modificado: new Date().toISOString() }, { onConflict: 'nombre' })
      .then(({ error }) => { if (error) console.error('Error guardando clase salarial:', error.message); });
  };
  if (nombreAnterior && nombreAnterior !== nombre) {
    // Cambió el nombre: borrar el registro viejo e insertar el nuevo (mismo patrón que Clientes).
    const idx = CLASES_SALARIALES.findIndex(c => c.nombre === nombreAnterior);
    if (idx >= 0) CLASES_SALARIALES[idx] = clase; else CLASES_SALARIALES.push(clase);
    sb.from('clases_salariales').delete().eq('nombre', nombreAnterior).then(guardarEnSupabase);
  } else {
    const idx = CLASES_SALARIALES.findIndex(c => c.nombre === nombre);
    if (idx >= 0) CLASES_SALARIALES[idx] = clase; else CLASES_SALARIALES.push(clase);
    guardarEnSupabase();
  }
  cerrarModal('modal-clase-salarial');
  renderClasesSalariales();
  renderCuadrillas();
}

function eliminarClaseSalarial(nombre) {
  const enUso = CUADRILLAS_PRODUCTIVAS.some(cu => (cu.roles || []).some(r => r.clase === nombre));
  if (enUso && !confirm(`Esta clase está usada en una o más cuadrillas — si la eliminas, esos roles quedarán sin costo. ¿Eliminar "${nombre}" de todas formas?`)) return;
  if (!enUso && !confirm(`¿Eliminar la clase salarial "${nombre}"?`)) return;
  CLASES_SALARIALES = CLASES_SALARIALES.filter(c => c.nombre !== nombre);
  sb.from('clases_salariales').delete().eq('nombre', nombre).then(({ error }) => { if (error) console.error('Error eliminando clase salarial:', error.message); });
  renderClasesSalariales();
  renderCuadrillas();
}

// ── Cuadrillas productivas ──
function renderCuadrillas() {
  const body = document.getElementById('cuadrillas-body');
  if (!body) return;
  if (!CUADRILLAS_PRODUCTIVAS.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty-state"><div class="icono">🧑‍🤝‍🧑</div><div>No hay cuadrillas registradas.</div></td></tr>`;
    return;
  }
  body.innerHTML = CUADRILLAS_PRODUCTIVAS.map(cu => {
    const { mensual, diario } = _totalCuadrilla(cu);
    const rolesTexto = (cu.roles || []).map(r => `${r.personas}× ${r.rol} (${r.clase})`).join(', ');
    return `
    <tr>
      <td style="font-weight:600">${cu.nombre}</td>
      <td style="color:var(--gris-medio);font-size:12px">${rolesTexto || '—'}</td>
      <td style="text-align:right">${_fmt(mensual)}</td>
      <td style="text-align:right">${_fmt(diario)}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-primario btn-xs" onclick="editarCuadrilla('${cu.nombre.replace(/'/g, "\\'")}')">✏️</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarCuadrilla('${cu.nombre.replace(/'/g, "\\'")}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function _totalCuadrilla(cu) {
  let mensual = 0;
  (cu.roles || []).forEach(r => {
    const clase = _claseCalculada(r.clase);
    if (clase) mensual += (Number(r.personas) || 0) * clase.valorRealMensual;
  });
  const diario = mensual / (PARAMETROS_MO.divisorDia || 20);
  return { mensual, diario };
}

function _selectClasesHTML(claseSeleccionada) {
  if (!CLASES_SALARIALES.length) return '<option value="">Sin clases registradas</option>';
  return CLASES_SALARIALES.map(c => `<option value="${c.nombre}" ${c.nombre === claseSeleccionada ? 'selected' : ''}>${c.nombre}</option>`).join('');
}

function renderRolesCuadrilla() {
  const body = document.getElementById('roles-cuadrilla-body');
  if (!body) return;
  body.innerHTML = _rolesCuadrillaActual.map((r, i) => `
    <tr>
      <td><input type="text" value="${r.rol || ''}" oninput="_rolesCuadrillaActual[${i}].rol=this.value" placeholder="Ej: Oficial" style="width:100%;border:1px solid var(--gris-borde);border-radius:4px;padding:5px 7px;font-size:12px"></td>
      <td><input type="number" min="0" step="0.01" value="${r.personas || 0}" oninput="_rolesCuadrillaActual[${i}].personas=parseFloat(this.value)||0;_actualizarPreviewCuadrilla()" style="width:100%;border:1px solid var(--gris-borde);border-radius:4px;padding:5px 7px;font-size:12px"></td>
      <td><select onchange="_rolesCuadrillaActual[${i}].clase=this.value;_actualizarPreviewCuadrilla()" style="width:100%;border:1px solid var(--gris-borde);border-radius:4px;padding:5px 7px;font-size:12px">${_selectClasesHTML(r.clase)}</select></td>
      <td style="text-align:right;font-size:12px">${_fmt((Number(r.personas) || 0) * (_claseCalculada(r.clase)?.valorRealMensual || 0))}</td>
      <td><button class="btn btn-rojo btn-xs" onclick="eliminarRolCuadrilla(${i})">✕</button></td>
    </tr>`).join('');
  _actualizarPreviewCuadrilla();
}

function agregarRolCuadrilla() {
  _rolesCuadrillaActual.push({ rol: '', personas: 1, clase: CLASES_SALARIALES[0]?.nombre || '' });
  renderRolesCuadrilla();
}

function eliminarRolCuadrilla(i) {
  _rolesCuadrillaActual.splice(i, 1);
  renderRolesCuadrilla();
}

function _actualizarPreviewCuadrilla() {
  const div = document.getElementById('cuadrilla-total-preview');
  if (!div) return;
  const { mensual, diario } = _totalCuadrilla({ roles: _rolesCuadrillaActual });
  div.textContent = `Total: ${_fmt(mensual)} / mes — ${_fmt(diario)} / día`;
}

function abrirModalCuadrilla() {
  if (!CLASES_SALARIALES.length) { alert('Primero registra al menos una clase salarial.'); return; }
  document.getElementById('m-cuadrilla-nombre-anterior').value = '';
  document.getElementById('modal-cuadrilla-titulo').textContent = '➕ Nueva Cuadrilla';
  document.getElementById('m-cuadrilla-nombre').value = '';
  _rolesCuadrillaActual = [];
  renderRolesCuadrilla();
  document.getElementById('modal-cuadrilla').classList.add('abierto');
}

function editarCuadrilla(nombre) {
  const cu = CUADRILLAS_PRODUCTIVAS.find(c => c.nombre === nombre);
  if (!cu) return;
  document.getElementById('m-cuadrilla-nombre-anterior').value = cu.nombre;
  document.getElementById('modal-cuadrilla-titulo').textContent = '✏️ Editar Cuadrilla';
  document.getElementById('m-cuadrilla-nombre').value = cu.nombre;
  _rolesCuadrillaActual = JSON.parse(JSON.stringify(cu.roles || []));
  renderRolesCuadrilla();
  document.getElementById('modal-cuadrilla').classList.add('abierto');
}

function guardarCuadrilla() {
  const nombre = document.getElementById('m-cuadrilla-nombre').value.trim();
  if (!nombre) { alert('El nombre es requerido.'); return; }
  const roles = _rolesCuadrillaActual.filter(r => (r.rol || '').trim() && r.clase);
  if (!roles.length) { alert('Agrega al menos un rol con su clase.'); return; }
  const nombreAnterior = document.getElementById('m-cuadrilla-nombre-anterior').value;
  const cuadrilla = { nombre, roles };
  const guardarEnSupabase = () => {
    sb.from('cuadrillas_productivas').upsert({ nombre, datos: cuadrilla, modificado: new Date().toISOString() }, { onConflict: 'nombre' })
      .then(({ error }) => { if (error) console.error('Error guardando cuadrilla:', error.message); });
  };
  if (nombreAnterior && nombreAnterior !== nombre) {
    const idx = CUADRILLAS_PRODUCTIVAS.findIndex(c => c.nombre === nombreAnterior);
    if (idx >= 0) CUADRILLAS_PRODUCTIVAS[idx] = cuadrilla; else CUADRILLAS_PRODUCTIVAS.push(cuadrilla);
    sb.from('cuadrillas_productivas').delete().eq('nombre', nombreAnterior).then(guardarEnSupabase);
  } else {
    const idx = CUADRILLAS_PRODUCTIVAS.findIndex(c => c.nombre === nombre);
    if (idx >= 0) CUADRILLAS_PRODUCTIVAS[idx] = cuadrilla; else CUADRILLAS_PRODUCTIVAS.push(cuadrilla);
    guardarEnSupabase();
  }
  cerrarModal('modal-cuadrilla');
  renderCuadrillas();
}

function eliminarCuadrilla(nombre) {
  if (!confirm(`¿Eliminar la cuadrilla "${nombre}"?`)) return;
  CUADRILLAS_PRODUCTIVAS = CUADRILLAS_PRODUCTIVAS.filter(c => c.nombre !== nombre);
  sb.from('cuadrillas_productivas').delete().eq('nombre', nombre).then(({ error }) => { if (error) console.error('Error eliminando cuadrilla:', error.message); });
  renderCuadrillas();
}
