// ═══════════════════════════════
// COSTEO — COSTOS DE REFERENCIA
// ═══════════════════════════════
// (Pantalla "costeo-referencia" — el nombre visible es "Costos de Referencia" desde
// 2026-07-30; el id interno, el archivo y el nombre de tabla/función no cambiaron, mismo
// criterio que el rótulo "Niveles Salariales" en costeo-mano-obra.js.)
// Reúne en un solo lugar TODOS los costos unitarios del módulo de Costeo:
//   - Mano de Obra: solo Cuadrillas Productivas (NO Niveles Salariales individuales — se
//     excluyen a propósito, 2026-07-30, porque lo que de verdad se usa para costear un
//     producto es el costo de la cuadrilla completa trabajando, no el de un nivel salarial
//     suelto) → solo lectura aquí, se editan en costeo-mo.
//   - Maquinaria y Equipos                             → solo lectura aquí, se editan en costeo-maquinaria
//   - Materias Primas / Insumos y Otros CIF             → se crean y editan directamente aquí
// (De la hoja LIST.REF del Excel original, que ya unificaba TIPO=MATERIA PRIMA/MANO DE
// OBRA/COSTOS INDIRECTOS en una sola lista — este módulo reproduce esa idea, pero pulling
// en vivo lo que ya vive en otras pantallas en lugar de duplicarlo.)
let INSUMOS_COSTOS = [];
let _filtroCategoriaReferencia = 'todos';
let _busquedaReferencia = '';

const CATEGORIAS_REFERENCIA = {
  mano_obra:     { label: '👷 Mano de Obra',    bg: '#E3F2FD', fg: '#1565C0', origen: 'costeo-mo',         origenLabel: 'Mano de Obra' },
  maquinaria:    { label: '🔧 Maquinaria',       bg: '#FFF3E0', fg: '#E65100', origen: 'costeo-maquinaria', origenLabel: 'Maquinaria' },
  materia_prima: { label: '🧱 Materia Prima',    bg: '#E8F5E9', fg: '#2E7D32' },
  insumo_cif:    { label: '📦 Insumo / CIF',     bg: '#F3E5F5', fg: '#6A1B9A' },
};
const _ORDEN_CATS_REFERENCIA = ['todos', 'mano_obra', 'maquinaria', 'materia_prima', 'insumo_cif'];

// Unidades tomadas de la hoja LIST.REF del Excel original, en símbolo internacional (SI)
// correcto donde aplica — ver docs/modulos/costeo.md para el detalle de por qué GAL y kWh
// se mantienen tal cual, en vez de forzar litros/otra unidad "más estándar".
const UNIDADES_INSUMO = { kg: 'kg', m: 'm', m2: 'm²', m3: 'm³', L: 'L', gal: 'gal', kWh: 'kWh', un: 'un', pct: '%' };
function _labelUnidadInsumo(v) { return UNIDADES_INSUMO[v] || v || ''; }

function _fmtRef(n) { return '$' + (n || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 }); }
function _fmtFechaRef(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function calcularCostoInsumo(i) {
  const valorUnitario = Number(i.valorUnitario) || 0;
  const valorConIva = i.aplicaIva ? valorUnitario * 1.19 : valorUnitario;
  const transporteAdicional = i.transporteIncluido ? 0 : (Number(i.transporteAdicional) || 0);
  const costoSinIva = valorUnitario + transporteAdicional; // el IVA no aplica sobre el transporte adicional
  const valorFinal = valorConIva + transporteAdicional;
  return { valorConIva, transporteAdicional, costoSinIva, valorFinal };
}

// Combina Mano de Obra (solo Cuadrillas, valor/día) + Maquinaria (costo/unidad de uso) +
// Materias Primas/Insumos (valor final de referencia) en una sola lista plana.
function _listaUnificadaCostos() {
  const lista = [];
  (CUADRILLAS_PRODUCTIVAS || []).forEach(cu => {
    const t = _totalCuadrilla(cu);
    // Mano de obra no tiene concepto de IVA en este modelo — mismo valor en las dos columnas.
    lista.push({ categoria: 'mano_obra', nombre: cu.nombre, unidad: 'día', costoSinIva: t.diario, costoConIva: t.diario, soloLectura: true, modificado: cu._modificado });
  });
  (MAQUINARIA_EQUIPOS || []).forEach(m => {
    const c = calcularCostoMaquina(m);
    // Depreciación/mantenimiento tampoco llevan IVA — mismo valor en las dos columnas.
    lista.push({ categoria: 'maquinaria', nombre: m.nombre, unidad: _labelUnidadUso(m.unidadUso), costoSinIva: c.costoUnidad, costoConIva: c.costoUnidad, soloLectura: true, modificado: m._modificado });
  });
  (INSUMOS_COSTOS || []).forEach(i => {
    const c = calcularCostoInsumo(i);
    lista.push({ categoria: i.categoria, nombre: i.nombre, unidad: _labelUnidadInsumo(i.unidad), costoSinIva: c.costoSinIva, costoConIva: c.valorFinal, soloLectura: false, modificado: i._modificado });
  });
  return lista;
}

function renderCosteoReferencia() {
  const lista = _listaUnificadaCostos();
  const counts = { todos: lista.length, mano_obra: 0, maquinaria: 0, materia_prima: 0, insumo_cif: 0 };
  lista.forEach(x => { counts[x.categoria] = (counts[x.categoria] || 0) + 1; });
  _ORDEN_CATS_REFERENCIA.forEach(c => {
    const el = document.getElementById(`chip-count-${c}`);
    if (el) el.textContent = counts[c] || 0;
  });

  const q = _busquedaReferencia.trim().toLowerCase();
  const filtradas = lista.filter(x =>
    (_filtroCategoriaReferencia === 'todos' || x.categoria === _filtroCategoriaReferencia) &&
    (!q || x.nombre.toLowerCase().includes(q))
  );

  const body = document.getElementById('referencia-costos-body');
  if (!body) return;
  if (!filtradas.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty-state"><div class="icono">📑</div><div>No hay ítems para este filtro.</div></td></tr>`;
    return;
  }
  body.innerHTML = filtradas.map(x => {
    const cat = CATEGORIAS_REFERENCIA[x.categoria];
    // Items reales como 'Triturado Grueso 3/8"' tienen comilla doble en el nombre (la marca
    // de pulgada) — _escNombreOnclick() (js/costeo-mano-obra.js) escapa comilla simple Y
    // doble; sin el segundo escape el botón ✏️/🗑️ quedaba roto/sin funcionar (bug real
    // reportado 2026-08-03: "hay unos precios unitarios que no me deja editar").
    const nombreEsc = _escNombreOnclick(x.nombre);
    const acciones = x.soloLectura
      ? `<span style="font-size:11px;color:var(--gris-medio)">🔒 <b onclick="_irSubnavCosteo('${cat.origen}')" style="color:var(--azul-medio);font-weight:600;cursor:pointer">Ver en ${cat.origenLabel} →</b></span>`
      : `<div class="flex-gap">
          <button class="btn btn-primario btn-xs" onclick="editarInsumoCosto('${nombreEsc}')">✏️</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarInsumoCosto('${nombreEsc}')">🗑️</button>
        </div>`;
    return `
    <tr>
      <td><span style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap;background:${cat.bg};color:${cat.fg}">${cat.label}</span></td>
      <td style="font-weight:600">${_esc(x.nombre)}</td>
      <td><span style="display:inline-block;background:var(--gris-claro);color:var(--gris-medio);font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px">${_esc(x.unidad)}</span></td>
      <td style="text-align:right;color:var(--gris-medio)">${_fmtRef(x.costoSinIva)}</td>
      <td style="text-align:right;font-weight:700;color:var(--azul)">${_fmtRef(x.costoConIva)}</td>
      <td style="font-size:12px;color:var(--gris-medio)">${_fmtFechaRef(x.modificado)}</td>
      <td>${acciones}</td>
    </tr>`;
  }).join('');
}

function _filtrarCategoriaReferencia(cat) {
  _filtroCategoriaReferencia = cat;
  _ORDEN_CATS_REFERENCIA.forEach(c => {
    const btn = document.getElementById(`chip-${c}`);
    const badge = document.getElementById(`chip-count-${c}`);
    if (!btn) return;
    if (c === cat) {
      btn.style.background = 'var(--azul)'; btn.style.borderColor = 'var(--azul)'; btn.style.color = 'white';
      if (badge) { badge.style.background = 'rgba(255,255,255,0.25)'; badge.style.color = 'white'; }
    } else {
      btn.style.background = 'white'; btn.style.borderColor = 'var(--gris-borde)'; btn.style.color = 'var(--gris-medio)';
      if (badge) { badge.style.background = 'var(--gris-claro)'; badge.style.color = 'var(--gris-medio)'; }
    }
  });
  renderCosteoReferencia();
}

function _buscarReferencia(valor) {
  _busquedaReferencia = valor;
  renderCosteoReferencia();
}

// Navega a la pantalla origen de una fila de solo lectura simulando un clic real sobre su
// botón del subnav — así ir() recibe un event.currentTarget válido (un .nav-btn real) y
// activa/renderiza esa pantalla exactamente igual que si el usuario la hubiera clicado.
function _irSubnavCosteo(pantalla) {
  const btn = document.querySelector(`#subnav-costeo .nav-btn[onclick*="${pantalla}"]`);
  if (btn) btn.click();
}

function _toggleTransporteInsumo() {
  const incluido = document.getElementById('m-insumo-transporte-incluido').checked;
  document.getElementById('m-insumo-transporte-adicional').disabled = incluido;
  _actualizarDesgloseInsumo();
}

// El Triturado Grueso (rol "grava") es la única materia prima cuyo producto real cambia
// según una segunda dimensión (el tamaño máximo de agregado, 3/8"/1/2"/3/4"/1") — por eso es
// el único rol con un campo extra en este modal.
function _toggleTamanoAgregadoInsumo() {
  const esGrava = document.getElementById('m-insumo-rol-diseno').value === 'grava';
  document.getElementById('bloque-tamano-agregado-insumo').style.display = esGrava ? 'block' : 'none';
}

function _leerFormularioInsumo() {
  return {
    categoria: document.getElementById('m-insumo-categoria').value,
    rolDiseno: document.getElementById('m-insumo-rol-diseno').value,
    tamanoAgregado: document.getElementById('m-insumo-tamano-agregado').value,
    unidad: document.getElementById('m-insumo-unidad').value,
    valorUnitario: parseFloat(document.getElementById('m-insumo-valor').value) || 0,
    aplicaIva: document.getElementById('m-insumo-iva').checked,
    transporteIncluido: document.getElementById('m-insumo-transporte-incluido').checked,
    transporteAdicional: parseFloat(document.getElementById('m-insumo-transporte-adicional').value) || 0,
  };
}

function _actualizarDesgloseInsumo() {
  const div = document.getElementById('insumo-desglose');
  if (!div) return;
  const i = _leerFormularioInsumo();
  const c = calcularCostoInsumo(i);
  const unidadLabel = _labelUnidadInsumo(i.unidad);
  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>Valor unitario</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${_fmtRef(i.valorUnitario)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>+ Transporte adicional${i.transporteIncluido ? ' — incluido' : ''}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">+ ${_fmtRef(c.transporteAdicional)}</span></div>
    <div style="display:flex;justify-content:space-between;padding-top:6px;margin-top:4px;border-top:1px solid #90CAF9;font-weight:700"><span>= Costo sin IVA / ${unidadLabel}</span><span style="font-variant-numeric:tabular-nums">${_fmtRef(c.costoSinIva)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0;margin-top:4px"><span>+ IVA (19%)${i.aplicaIva ? '' : ' — no aplica'}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">+ ${_fmtRef(c.valorConIva - i.valorUnitario)}</span></div>
    <div style="display:flex;justify-content:space-between;padding-top:8px;margin-top:6px;border-top:2px solid var(--azul);font-weight:700;font-size:15px;color:var(--azul)"><span>Costo con IVA / ${unidadLabel}</span><span style="font-variant-numeric:tabular-nums">${_fmtRef(c.valorFinal)}</span></div>
  `;
}

function abrirModalInsumoCosto() {
  document.getElementById('m-insumo-nombre-anterior').value = '';
  document.getElementById('modal-insumo-titulo').textContent = '➕ Nuevo Ítem';
  document.getElementById('m-insumo-nombre').value = '';
  document.getElementById('m-insumo-categoria').value = 'materia_prima';
  document.getElementById('m-insumo-rol-diseno').value = '';
  document.getElementById('m-insumo-tamano-agregado').value = '';
  _toggleTamanoAgregadoInsumo();
  document.getElementById('m-insumo-unidad').value = 'kg';
  document.getElementById('m-insumo-valor').value = '';
  document.getElementById('m-insumo-iva').checked = true;
  document.getElementById('m-insumo-transporte-incluido').checked = true;
  document.getElementById('m-insumo-transporte-adicional').value = 0;
  document.getElementById('m-insumo-transporte-adicional').disabled = true;
  _actualizarDesgloseInsumo();
  document.getElementById('modal-insumo-costo').classList.add('abierto');
}

function editarInsumoCosto(nombre) {
  const i = INSUMOS_COSTOS.find(x => x.nombre === nombre);
  if (!i) return;
  document.getElementById('m-insumo-nombre-anterior').value = i.nombre;
  document.getElementById('modal-insumo-titulo').textContent = '✏️ Editar Ítem';
  document.getElementById('m-insumo-nombre').value = i.nombre;
  document.getElementById('m-insumo-categoria').value = i.categoria;
  document.getElementById('m-insumo-rol-diseno').value = i.rolDiseno || '';
  document.getElementById('m-insumo-tamano-agregado').value = i.tamanoAgregado || '';
  _toggleTamanoAgregadoInsumo();
  document.getElementById('m-insumo-unidad').value = i.unidad;
  document.getElementById('m-insumo-valor').value = i.valorUnitario || 0;
  document.getElementById('m-insumo-iva').checked = i.aplicaIva !== false;
  document.getElementById('m-insumo-transporte-incluido').checked = i.transporteIncluido !== false;
  document.getElementById('m-insumo-transporte-adicional').value = i.transporteAdicional || 0;
  document.getElementById('m-insumo-transporte-adicional').disabled = i.transporteIncluido !== false;
  _actualizarDesgloseInsumo();
  document.getElementById('modal-insumo-costo').classList.add('abierto');
}

function guardarInsumoCosto() {
  const nombre = document.getElementById('m-insumo-nombre').value.trim();
  if (!nombre) { alert('El nombre es requerido.'); return; }
  const i = _leerFormularioInsumo();
  if (i.rolDiseno === 'grava' && !i.tamanoAgregado) {
    alert('Selecciona el "Tamaño máximo de agregado" de este Triturado Grueso — el producto real cambia según el tamaño (3/8", 1/2", 3/4", 1"), así que es obligatorio para el rol "Triturado Grueso (grava)".');
    return;
  }
  i.nombre = nombre;
  const nombreAnterior = document.getElementById('m-insumo-nombre-anterior').value;
  const guardarEnSupabase = () => {
    sb.from('insumos_costos').upsert({ nombre, datos: i, modificado: new Date().toISOString() }, { onConflict: 'nombre' })
      .then(({ error }) => { if (error) console.error('Error guardando ítem:', error.message); });
  };
  if (nombreAnterior && nombreAnterior !== nombre) {
    // Cambió el nombre: borrar el registro viejo e insertar el nuevo (mismo patrón que Maquinaria/Niveles Salariales).
    const idx = INSUMOS_COSTOS.findIndex(x => x.nombre === nombreAnterior);
    if (idx >= 0) INSUMOS_COSTOS[idx] = i; else INSUMOS_COSTOS.push(i);
    sb.from('insumos_costos').delete().eq('nombre', nombreAnterior).then(guardarEnSupabase);
  } else {
    const idx = INSUMOS_COSTOS.findIndex(x => x.nombre === nombre);
    if (idx >= 0) INSUMOS_COSTOS[idx] = i; else INSUMOS_COSTOS.push(i);
    guardarEnSupabase();
  }
  cerrarModal('modal-insumo-costo');
  renderCosteoReferencia();
  _revisarImpactoPrecios(`Insumo "${nombre}" actualizado en Costos de Referencia`);
}

function eliminarInsumoCosto(nombre) {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return;
  INSUMOS_COSTOS = INSUMOS_COSTOS.filter(x => x.nombre !== nombre);
  sb.from('insumos_costos').delete().eq('nombre', nombre).then(({ error }) => { if (error) console.error('Error eliminando ítem:', error.message); });
  renderCosteoReferencia();
}
