// ═══════════════════════════════
// COSTEO — COSTEO DE PRODUCTO
// ═══════════════════════════════
// Arma el costo por unidad de un producto terminado combinando lo que ya vive en las demás
// pantallas del módulo (no duplica nada de eso):
//   - Diseño de Mezcla (Calidad): la receta, por m³.
//   - Maquinaria y Equipos: costo por ciclo/día de cada máquina de la línea.
//   - Cuadrillas Productivas: costo/día de la mano de obra de la línea.
//   - Costos de Referencia: precio final (con IVA) de cada insumo/materia prima.
// Grounding real (Excel FICHAS NUEVAS + BD MEZCLA COLUMBIA, verificado 2026-08-02): el
// "rendimiento" de un producto (peso/unidad, ciclos/día, unidades/ciclo, unidades/estiba)
// es un dato propio del producto (depende del molde usado), no del Diseño de Mezcla — por
// eso vive aquí, no allá. "golpe"/"placa" se renombraron a "Ciclo" en toda la app
// (2026-08-02, a pedido del usuario — un golpe de la máquina = un ciclo de producción).
let COSTEO_PRODUCTOS = [];

const TIPOS_ESTRUCTURA_COSTEO = {
  vibrocompactado:      { label: '🧱 Vibrocompactado',      bg: '#E8F5E9', fg: '#2E7D32' },
  pretensado:            { label: '➰ Pretensado',            bg: '#E3F2FD', fg: '#1565C0' },
  pretensado_moldeado:   { label: '🏗️ Pretensado Moldeado',  bg: '#FFF3E0', fg: '#E65100' },
  reforzado:             { label: '🔩 Reforzado',             bg: '#F3E5F5', fg: '#6A1B9A' },
};

function _fmtCosteoProd(n) {
  return '$' + (n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Buscador de producto — desplegable propio en vez de <input>+<datalist> nativo. El
// datalist del navegador recorta/trunca los nombres largos en la lista de sugerencias y su
// ancho no se puede controlar por CSS (2026-08-04, a pedido del usuario: "permite que se vea
// el nombre completo del producto en el desplegable que va filtrando").
function _textoProductoCosteo(p) { return `${p.codigo} — ${p.nombre}`; }
function _productoDesdeTextoCosteo(texto) {
  const t = (texto || '').trim();
  if (!t) return null;
  return PRODUCTOS.find(p => _textoProductoCosteo(p) === t) || null;
}

let _sugerenciasProductoCosteo = [];
let _indiceSugerenciaCosteo = -1;
let _sugerenciasOcultasPorCosteo = false;

// El desplegable solo ofrece productos que TODAVÍA no tienen un Costeo de Producto guardado,
// para no volver a costear el mismo producto dos veces (2026-08-04, a pedido del usuario). El
// producto que se está editando en este momento (`m-costeo-producto-codigo-anterior`) es la
// única excepción — sigue apareciendo aunque ya tenga costeo, porque es el suyo.
function _filtrarProductosCosteo() {
  const input = document.getElementById('m-costeo-producto');
  if (!input) return;
  const q = input.value.trim().toLowerCase();
  const codigoEnEdicion = document.getElementById('m-costeo-producto-codigo-anterior')?.value || '';
  const disponibles = PRODUCTOS.filter(p =>
    p.codigo === codigoEnEdicion || !COSTEO_PRODUCTOS.some(c => c.productoCodigo === p.codigo));
  const _matchTexto = p => (p.codigo + ' ' + p.nombre + ' ' + (p.medidas || '')).toLowerCase().includes(q);
  _sugerenciasProductoCosteo = (q ? disponibles.filter(_matchTexto) : disponibles)
    .sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nombre.localeCompare(b.nombre)).slice(0, 60);
  // Si no hay sugerencias pero SÍ hay un producto real que matchea (solo que ya tiene costeo),
  // el mensaje de "sin resultados" lo aclara en vez de sugerir que el producto no existe.
  _sugerenciasOcultasPorCosteo = !_sugerenciasProductoCosteo.length && q && PRODUCTOS.some(_matchTexto);
  _indiceSugerenciaCosteo = -1;
  _pintarSugerenciasProductoCosteo();
  cargarProductoCosteo();
}

function _pintarSugerenciasProductoCosteo() {
  const box = document.getElementById('costeo-producto-sugerencias');
  if (!box) return;
  if (!_sugerenciasProductoCosteo.length) {
    box.innerHTML = `<div style="padding:10px 12px;color:var(--gris-medio);font-size:12px">${_sugerenciasOcultasPorCosteo ? 'Ese producto ya tiene un Costeo de Producto guardado.' : 'Sin resultados.'}</div>`;
    box.style.display = 'block';
    return;
  }
  box.innerHTML = _sugerenciasProductoCosteo.map((p, i) => `
    <div onmousedown="_elegirProductoCosteo(${i})" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--gris-borde);${i === _indiceSugerenciaCosteo ? 'background:var(--azul-suave)' : 'background:white'}">
      <div style="font-weight:600;font-size:13px">${p.nombre}</div>
      <div style="font-size:11px;color:var(--gris-medio)">${p.codigo} · ${p.grupo}${p.medidas ? ' · ' + p.medidas : ''}</div>
    </div>`).join('');
  box.style.display = 'block';
}

function _elegirProductoCosteo(i) {
  const p = _sugerenciasProductoCosteo[i];
  if (!p) return;
  document.getElementById('m-costeo-producto').value = _textoProductoCosteo(p);
  document.getElementById('costeo-producto-sugerencias').style.display = 'none';
  cargarProductoCosteo();
}

// Delay para que el onmousedown de una sugerencia alcance a dispararse antes de que el blur
// del input la oculte.
function _cerrarSugerenciasProductoCosteoDiferido() {
  setTimeout(() => {
    const box = document.getElementById('costeo-producto-sugerencias');
    if (box) box.style.display = 'none';
  }, 150);
}

function _teclaSugerenciasProductoCosteo(ev) {
  const box = document.getElementById('costeo-producto-sugerencias');
  if (!box || box.style.display === 'none' || !_sugerenciasProductoCosteo.length) return;
  if (ev.key === 'ArrowDown') {
    ev.preventDefault();
    _indiceSugerenciaCosteo = Math.min(_indiceSugerenciaCosteo + 1, _sugerenciasProductoCosteo.length - 1);
    _pintarSugerenciasProductoCosteo();
  } else if (ev.key === 'ArrowUp') {
    ev.preventDefault();
    _indiceSugerenciaCosteo = Math.max(_indiceSugerenciaCosteo - 1, 0);
    _pintarSugerenciasProductoCosteo();
  } else if (ev.key === 'Enter') {
    if (_indiceSugerenciaCosteo >= 0) { ev.preventDefault(); _elegirProductoCosteo(_indiceSugerenciaCosteo); }
  } else if (ev.key === 'Escape') {
    box.style.display = 'none';
  }
}

// Al elegir/cambiar el producto, si tiene un Diseño de Mezcla asignado en el catálogo
// (ventana de Productos) se preselecciona — el usuario lo puede cambiar igual.
function cargarProductoCosteo() {
  const producto = _productoDesdeTextoCosteo(document.getElementById('m-costeo-producto').value);
  if (producto && producto.disenoMezcla) {
    agregarOpcionSiNoExiste('m-costeo-diseno', producto.disenoMezcla);
    document.getElementById('m-costeo-diseno').value = producto.disenoMezcla;
  }
  _actualizarResumenCosteo();
}

// Máquinas por defecto de la línea Vibrocompactada (Máquina Columbia completa + montacargas/
// minicargador) — se precargan solo cuando el costeo todavía no tiene ninguna máquina (un
// costeo nuevo, o uno guardado sin máquinas); si ya hay máquinas cargadas — porque se está
// editando un costeo guardado con las suyas, o porque el usuario ya las tocó — no se
// sobreescriben (2026-08-02, a pedido del usuario, con la lista real que él mismo armó).
const _MAQUINAS_DEFECTO_VIBROCOMPACTADO = [
  'Columbia 16', 'Mezcladora Columbia', 'Anaqueles Columbia', 'Moldes Columbia 16',
  'Placas Columbia 16', 'Banda transportadora Columbia 16', 'Minicargador', 'Montacargas 3 TON',
];

// Mismo criterio que las máquinas por defecto: insumos de empaque/consumos/recargos que se
// repiten igual en todo costeo de Vibrocompactado (2026-08-04, a pedido del usuario, con la
// lista real que él mismo armó) — solo se precargan si la lista de insumos está vacía.
const _INSUMOS_DEFECTO_VIBROCOMPACTADO = [
  { nombre: 'Zuncho PET 16mm', cantidad: 9, reparto: 'estiba' },
  { nombre: 'Grapa para zuncho 16mm', cantidad: 2, reparto: 'estiba' },
  { nombre: 'Estiba de madera', cantidad: 1, reparto: 'estiba' },
  { nombre: 'Combustible ACPM', cantidad: 16, reparto: 'dia' },
  { nombre: 'Agua', cantidad: 5, reparto: 'dia' },
  { nombre: 'Energía', cantidad: 200, reparto: 'dia' },
  { nombre: 'Ensayo a compresión de bloques', cantidad: 2, reparto: 'dia' },
  { nombre: 'Ensayo de absorción', cantidad: 2, reparto: 'dia' },
];

// La estructura completa del cuestionario (Diseño de Mezcla, Rendimiento, Máquinas...) depende
// del tipo elegido aquí — un Vibrocompactado se arma distinto a un Pretensado (ver BD MEZCLA
// VIBROCOMPACTADOS del Excel, la fuente real de esa estructura) — por eso las secciones 2-8
// quedan ocultas hasta que se elige un tipo (2026-08-02, a pedido del usuario). Hoy solo
// Vibrocompactado tiene su cuestionario construido; los demás muestran un aviso.
function _elegirTipoEstructuraCosteo(tipo) {
  document.getElementById('m-costeo-tipo').value = tipo;
  document.querySelectorAll('#costeo-tipo-chips .tipo-chip').forEach(el => {
    el.classList.toggle('activo', el.dataset.tipo === tipo);
  });
  const disponible = tipo === 'vibrocompactado';
  const wrapper = document.getElementById('costeo-secciones-tipo');
  const placeholder = document.getElementById('costeo-tipo-placeholder');
  if (wrapper) wrapper.style.display = disponible ? '' : 'none';
  if (placeholder) {
    placeholder.style.display = disponible ? 'none' : '';
    if (!disponible) {
      placeholder.innerHTML = tipo
        ? `El cuestionario de <b>${(TIPOS_ESTRUCTURA_COSTEO[tipo] || {}).label || tipo}</b> todavía no está construido — por ahora solo está disponible Vibrocompactado.`
        : 'Elige un tipo de estructura arriba para continuar — cada tipo tiene su propio cuestionario (la receta y las máquinas de un Vibrocompactado no son las de un Pretensado).';
    }
  }
  if (disponible) {
    if (!_maquinasCosteoActual.length) {
      _maquinasCosteoActual = _MAQUINAS_DEFECTO_VIBROCOMPACTADO.map(nombre => ({ nombre }));
      renderMaquinasCosteo();
    }
    if (!_insumosCosteoActual.length) {
      _insumosCosteoActual = JSON.parse(JSON.stringify(_INSUMOS_DEFECTO_VIBROCOMPACTADO));
      renderInsumosCosteo();
    }
    _actualizarResumenCosteo();
  }
}

// ── Preview de la receta del Diseño de Mezcla elegido ──
// Cemento/Agua son un solo material por diseño (peso, kg/m³). Arena/Triturado Grueso viven en
// `materiales.agregados[]` y las Adiciones cementantes (Metacaolín/Puzolana/Escoria...) en
// `materiales.adiciones[]` — ambas pueden tener más de una fila (2026-08-02). Los agregados se
// costean por VOLUMEN (m³/m³, no peso), porque se compran por volumen en la región; las
// adiciones, como el cemento, se costean por PESO (se compran por peso).
const _MATERIALES_COSTEO_PESO = ['cemento', 'agua'];
const _LABEL_MAT_COSTEO = { cemento: 'Cemento', agua: 'Agua' };
// Unidad real que usa la receta para cada material — solo Agua tiene una unidad de compra
// habitual (m³, acueducto) distinta de su unidad de receta (L); Cemento se compra y se dosifica
// igual en kg, no necesita conversión. Ver _precioInsumoPorNombre().
const _UNIDAD_RECETA_MATERIAL = { agua: 'L' };
const _LABEL_ROL_AGREGADO_COSTEO = { arena: 'Arena', grava: 'Triturado Grueso' };

// Regla tributaria real (2026-08-02, a pedido del usuario): si el producto final GENERA IVA,
// el IVA que se paga por sus insumos es descontable (se recupera vía la declaración de IVA)
// — no es un costo real, así que se asume el precio SIN IVA del insumo. Si el producto es
// EXCLUIDO de IVA, ese IVA no es descontable — sí es un costo real, así que se asume el
// precio CON IVA. `productoGeneraIva` viene del campo `iva` ('SI'/'NO') del catálogo.
//
// Conversión de unidad (2026-08-03, a pedido del usuario): el Agua del Diseño de Mezcla
// siempre está en LITROS (mismo criterio que Ajuste Diario/Formato de Producción), pero el
// acueducto factura por m³ — si en Costos de Referencia el ítem quedó cargado en m³ (precio
// real de la factura, sin tener que hacer la cuenta a mano), aquí se convierte el precio a
// $/L antes de costear. Es una conversión física EXACTA (1 m³ = 1000 L), a diferencia de
// kg↔m³ que necesitaría una densidad supuesta — por eso solo se automatiza para volumen.
// `unidadReceta` es la unidad que de verdad usa la receta para ese material (ej. 'L' para
// agua); si no se pasa, o si el insumo ya está en esa unidad, no se convierte nada.
const _CONVERSION_UNIDAD_VOLUMEN = { 'm3->L': 1000, 'L->m3': 0.001 };
function _precioInsumoPorNombre(nombre, productoGeneraIva, unidadReceta) {
  const i = INSUMOS_COSTOS.find(x => x.nombre === nombre);
  if (!i) return 0;
  const costo = calcularCostoInsumo(i);
  let precio = productoGeneraIva ? costo.costoSinIva : costo.valorFinal;
  if (unidadReceta && i.unidad && i.unidad !== unidadReceta) {
    const factor = _CONVERSION_UNIDAD_VOLUMEN[`${i.unidad}->${unidadReceta}`];
    if (factor) precio = precio / factor;
  }
  return precio;
}

// Peso total de la mezcla (kg/m³, aprox — agua en L se trata como kg) — se usa para sacar
// cuánto pesa una cochada, y de ahí cuántas unidades rinde (ver calcularCosteoProducto()).
function _pesoTotalMezclaM3(diseno) {
  if (!diseno) return 0;
  const m = diseno.materiales || {};
  let peso = (m.cemento || 0) + (m.agua || 0);
  (m.agregados || []).forEach(a => { peso += Number(a.cantidad) || 0; });
  (m.adiciones || []).forEach(a => { peso += Number(a.cantidad) || 0; });
  (m.aditivos || []).forEach(a => { peso += Number(a.dosis) || 0; });
  return peso;
}

function _actualizarPreviewDiseno() {
  const div = document.getElementById('costeo-diseno-preview');
  if (!div) return;
  const codigo = document.getElementById('m-costeo-diseno').value;
  const diseno = DISENOS_MEZCLA.find(d => d.codigo === codigo);
  if (!diseno) { div.innerHTML = '<div style="color:var(--gris-medio)">Selecciona un Diseño de Mezcla para ver su receta.</div>'; return; }
  const m = diseno.materiales || {};
  const filas = [];
  _MATERIALES_COSTEO_PESO.forEach(k => {
    if ((m[k] || 0) > 0) filas.push(`<div class="fila"><span>${_LABEL_MAT_COSTEO[k]}</span><span>${m[k]} kg/m³</span></div>`);
  });
  (m.agregados || []).forEach(a => {
    if ((Number(a.volumen) || 0) > 0) filas.push(`<div class="fila"><span>${a.producto || _LABEL_ROL_AGREGADO_COSTEO[a.rolBase] || a.rolBase}</span><span>${a.volumen} m³/m³</span></div>`);
  });
  (m.adiciones || []).forEach(a => {
    if ((Number(a.cantidad) || 0) > 0) filas.push(`<div class="fila"><span>${a.producto || 'Adición'}</span><span>${a.cantidad} kg/m³</span></div>`);
  });
  (m.aditivos || []).forEach(a => {
    if ((Number(a.dosis) || 0) > 0) filas.push(`<div class="fila"><span>${a.producto || a.tipo}</span><span>${a.dosis} kg/m³</span></div>`);
  });
  filas.push(`<div class="fila" style="border-top:1px solid #BFDBFE;margin-top:4px;padding-top:5px;font-weight:700"><span>Peso total de la mezcla</span><span>≈ ${_pesoTotalMezclaM3(diseno).toLocaleString('es-CO')} kg/m³</span></div>`);
  div.innerHTML = filas.join('');
}

// ── Máquinas involucradas (filas dinámicas) ──
let _maquinasCosteoActual = [];
function renderMaquinasCosteo() {
  const tbody = document.getElementById('costeo-maquinas-body');
  if (!tbody) return;
  if (!_maquinasCosteoActual.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:10px;color:var(--gris-medio);font-size:12px">Agrega las máquinas de la línea de producción</td></tr>`;
    return;
  }
  tbody.innerHTML = _maquinasCosteoActual.map((row, i) => {
    const m = MAQUINARIA_EQUIPOS.find(x => x.nombre === row.nombre);
    const info = m ? `${_fmtMaq(calcularCostoMaquina(m).costoUnidad)}/${_labelUnidadUso(m.unidadUso)}` : '—';
    return `<tr>
      <td><select onchange="_maquinasCosteoActual[${i}].nombre=this.value;_actualizarResumenCosteo()">${_opcionesMaquinariaCosteo(row.nombre)}</select></td>
      <td style="color:var(--gris-medio)">${info}</td>
      <td><button class="btn btn-rojo btn-xs" onclick="_maquinasCosteoActual.splice(${i},1);renderMaquinasCosteo();_actualizarResumenCosteo()">✕</button></td>
    </tr>`;
  }).join('');
}
function _opcionesMaquinariaCosteo(seleccionado) {
  if (!MAQUINARIA_EQUIPOS.length) return '<option value="">Sin máquinas registradas</option>';
  return '<option value="">— Selecciona —</option>' + MAQUINARIA_EQUIPOS.map(m => `<option value="${_escAttr(m.nombre)}" ${m.nombre === seleccionado ? 'selected' : ''}>${m.nombre}</option>`).join('');
}
function agregarMaquinaCosteo() { _maquinasCosteoActual.push({ nombre: '' }); renderMaquinasCosteo(); }

// ── Mano de obra involucrada (filas dinámicas) ──
let _manoObraCosteoActual = [];
function renderManoObraCosteo() {
  const tbody = document.getElementById('costeo-mano-obra-body');
  if (!tbody) return;
  if (!_manoObraCosteoActual.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:10px;color:var(--gris-medio);font-size:12px">Agrega las cuadrillas de la línea de producción</td></tr>`;
    return;
  }
  tbody.innerHTML = _manoObraCosteoActual.map((row, i) => {
    const cu = CUADRILLAS_PRODUCTIVAS.find(x => x.nombre === row.nombre);
    const info = cu ? `${_fmt(_totalCuadrilla(cu).diario)}/día` : '—';
    return `<tr>
      <td><select onchange="_manoObraCosteoActual[${i}].nombre=this.value;_actualizarResumenCosteo()">${_opcionesCuadrillaCosteo(row.nombre)}</select></td>
      <td style="color:var(--gris-medio)">${info}</td>
      <td><button class="btn btn-rojo btn-xs" onclick="_manoObraCosteoActual.splice(${i},1);renderManoObraCosteo();_actualizarResumenCosteo()">✕</button></td>
    </tr>`;
  }).join('');
}
function _opcionesCuadrillaCosteo(seleccionado) {
  if (!CUADRILLAS_PRODUCTIVAS.length) return '<option value="">Sin cuadrillas registradas</option>';
  return '<option value="">— Selecciona —</option>' + CUADRILLAS_PRODUCTIVAS.map(c => `<option value="${_escAttr(c.nombre)}" ${c.nombre === seleccionado ? 'selected' : ''}>${c.nombre}</option>`).join('');
}
function agregarManoObraCosteo() { _manoObraCosteoActual.push({ nombre: '' }); renderManoObraCosteo(); }

// ── Insumos y consumos (empaque + energía/agua/combustible en una sola tabla) ──
// Cada fila se reparte de una de dos formas: "Por estiba" (÷ Unidades/estiba — para empaque:
// estiba, zuncho, grapa...) o "Por día" (÷ Unidades/día — para consumos: kVA, m³ agua,
// galones ACPM...). El resumen final igual separa Empaque de Consumos usando este campo.
let _insumosCosteoActual = [];
function renderInsumosCosteo() {
  const tbody = document.getElementById('costeo-insumos-body');
  if (!tbody) return;
  if (!_insumosCosteoActual.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:10px;color:var(--gris-medio);font-size:12px">Agrega insumos de empaque (estiba, zuncho...) o consumos (energía, agua, ACPM...)</td></tr>`;
    return;
  }
  tbody.innerHTML = _insumosCosteoActual.map((row, i) => {
    const ins = INSUMOS_COSTOS.find(x => x.nombre === row.nombre);
    const precio = ins ? _fmtRef(calcularCostoInsumo(ins).valorFinal) + '/' + _labelUnidadInsumo(ins.unidad) : '—';
    return `<tr>
      <td><select onchange="_insumosCosteoActual[${i}].nombre=this.value;renderInsumosCosteo();_actualizarResumenCosteo()">${_opcionesInsumoCosteo(row.nombre)}</select></td>
      <td style="color:var(--gris-medio);white-space:nowrap">${precio}</td>
      <td><input type="number" value="${row.cantidad}" min="0" step="0.001" oninput="_insumosCosteoActual[${i}].cantidad=parseFloat(this.value)||0;_actualizarResumenCosteo()"></td>
      <td><select onchange="_insumosCosteoActual[${i}].reparto=this.value;_actualizarResumenCosteo()">
        <option value="estiba" ${row.reparto === 'estiba' ? 'selected' : ''}>Por estiba</option>
        <option value="dia" ${row.reparto === 'dia' ? 'selected' : ''}>Por día</option>
      </select></td>
      <td><button class="btn btn-rojo btn-xs" onclick="_insumosCosteoActual.splice(${i},1);renderInsumosCosteo();_actualizarResumenCosteo()">✕</button></td>
    </tr>`;
  }).join('');
}
function _opcionesInsumoCosteo(seleccionado) {
  if (!INSUMOS_COSTOS.length) return '<option value="">Sin insumos registrados</option>';
  return '<option value="">— Selecciona —</option>' + INSUMOS_COSTOS.map(i => `<option value="${_escAttr(i.nombre)}" ${i.nombre === seleccionado ? 'selected' : ''}>${i.nombre}</option>`).join('');
}
function agregarInsumoCosteo() { _insumosCosteoActual.push({ nombre: '', cantidad: 0, reparto: 'estiba' }); renderInsumosCosteo(); }

// ── Cálculo del costeo completo ──
function _leerFormularioCosteo() {
  // Se resuelve aquí también (no solo en guardarCosteoProducto()) para que el cálculo en vivo
  // (_actualizarResumenCosteo()) ya sepa si el producto genera IVA o no mientras se arma el
  // costeo, sin esperar a guardar (ver calcularCosteoProducto() → productoGeneraIva).
  const productoEnCurso = _productoDesdeTextoCosteo(document.getElementById('m-costeo-producto').value);
  return {
    productoCodigo: productoEnCurso ? productoEnCurso.codigo : '',
    productoNombre: productoEnCurso ? productoEnCurso.nombre : '',
    tipoEstructura: document.getElementById('m-costeo-tipo').value || 'vibrocompactado',
    disenoMezclaCodigo: document.getElementById('m-costeo-diseno').value,
    rendimiento: {
      pesoUnidadKg: parseFloat(document.getElementById('m-costeo-peso-unidad').value) || 0,
      ciclosDia: parseFloat(document.getElementById('m-costeo-ciclos-dia').value) || 0,
      unidadesCiclo: parseFloat(document.getElementById('m-costeo-unidades-ciclo').value) || 0,
      unidadesBache: parseFloat(document.getElementById('m-costeo-unidades-bache').value) || 0,
      unidadesEstiba: parseFloat(document.getElementById('m-costeo-unidades-estiba').value) || 0,
    },
    maquinas: JSON.parse(JSON.stringify(_maquinasCosteoActual)).filter(x => x.nombre),
    manoObra: JSON.parse(JSON.stringify(_manoObraCosteoActual)).filter(x => x.nombre),
    insumos: JSON.parse(JSON.stringify(_insumosCosteoActual)).filter(x => x.nombre),
    pctDesperdicio: parseFloat(document.getElementById('m-costeo-pct-desperdicio').value) || 0,
    pctHerramientaMenor: parseFloat(document.getElementById('m-costeo-pct-herramienta').value) || 0,
    margenLista: parseFloat(document.getElementById('m-costeo-margen-lista').value) || 0,
    margenMinimo: parseFloat(document.getElementById('m-costeo-margen-minimo').value) || 0,
  };
}

// Capacidad de cochada: se toma de la máquina mezcladora de la línea (la que tiene
// capacidadCochadaM3 > 0 en Maquinaria y Equipos) — no se vuelve a digitar aquí.
function _capacidadCochadaDeLinea(c) {
  for (const row of c.maquinas || []) {
    const m = MAQUINARIA_EQUIPOS.find(x => x.nombre === row.nombre);
    if (m && (Number(m.capacidadCochadaM3) || 0) > 0) return Number(m.capacidadCochadaM3);
  }
  return 0;
}

function calcularCosteoProducto(c) {
  const diseno = DISENOS_MEZCLA.find(d => d.codigo === c.disenoMezclaCodigo);
  const r = c.rendimiento || {};
  const capacidadCochadaM3 = _capacidadCochadaDeLinea(c);
  // Unidades/Bache: para Vibrocompactados, en la fábrica esto NO se calcula desde el peso — es
  // un dato real que ya se conoce (cuántas unidades rinde una mezclada completa de la
  // mezcladora, ej. 0,68 m³) y se digita directo (2026-08-03, a pedido del usuario, corrigiendo
  // el modelo anterior que lo derivaba de Peso/unidad × peso teórico de la mezcla — esa relación
  // no es como de verdad se dosifica en planta). `pesoUnidadKg` queda como dato informativo del
  // producto, ya no participa en este cálculo.
  const unidadesBache = r.unidadesBache || 0;
  const unidadesDia = (r.ciclosDia || 0) * (r.unidadesCiclo || 0);

  // Si el producto GENERA IVA, el IVA de sus insumos es descontable → se asume el precio SIN
  // IVA. Si es EXCLUIDO de IVA, ese IVA no es descontable → se asume el precio CON IVA (ver
  // _precioInsumoPorNombre()). El campo `iva` ('SI'/'NO') ya existe en el catálogo de
  // productos — se arrastra tal cual, no se vuelve a preguntar en el costeo.
  const productoCosteo = CATALOGO.find(p => p.codigo === c.productoCodigo);
  const productoGeneraIva = productoCosteo?.iva === 'SI';

  // Materia Prima — cantidad por unidad = (cantidad por m³ del Diseño × capacidad de la
  // mezcladora) ÷ Unidades/Bache. Cemento/agua/adiciones/aditivos se compran por PESO (se
  // toma su cantidad en kg/m³); arena/triturado se compran por VOLUMEN en la región (se toma
  // su `volumen`, m³/m³) — arena, triturado y adiciones viven en listas
  // (`materiales.agregados[]`/`adiciones[]`) porque puede haber más de uno de cada uno, se
  // suman todos. `materiaPrimaDetalle` guarda cada insumo por separado (cantidad/precio/costo)
  // para el consolidado de solo lectura (➕).
  let materiaPrima = 0;
  const materiaPrimaDetalle = [];
  const m = diseno?.materiales || {};
  if (unidadesBache > 0) {
    _MATERIALES_COSTEO_PESO.forEach(k => {
      if (!((m[k] || 0) > 0)) return;
      const cantidad = ((m[k] || 0) * capacidadCochadaM3) / unidadesBache;
      const precio = _precioInsumoPorNombre(m[`${k}Producto`], productoGeneraIva, _UNIDAD_RECETA_MATERIAL[k]);
      const costo = cantidad * precio;
      materiaPrima += costo;
      materiaPrimaDetalle.push({ nombre: m[`${k}Producto`] || _LABEL_MAT_COSTEO[k], unidad: k === 'agua' ? 'L' : 'kg', cantidad, precio, costo });
    });
    (m.agregados || []).forEach(a => {
      if (!((Number(a.volumen) || 0) > 0)) return;
      const cantidad = ((Number(a.volumen) || 0) * capacidadCochadaM3) / unidadesBache;
      const precio = _precioInsumoPorNombre(a.producto, productoGeneraIva);
      const costo = cantidad * precio;
      materiaPrima += costo;
      materiaPrimaDetalle.push({ nombre: a.producto || _LABEL_ROL_AGREGADO_COSTEO[a.rolBase] || a.rolBase, unidad: 'm³', cantidad, precio, costo });
    });
    (m.adiciones || []).forEach(a => {
      if (!((Number(a.cantidad) || 0) > 0)) return;
      const cantidad = ((Number(a.cantidad) || 0) * capacidadCochadaM3) / unidadesBache;
      const precio = _precioInsumoPorNombre(a.producto, productoGeneraIva);
      const costo = cantidad * precio;
      materiaPrima += costo;
      materiaPrimaDetalle.push({ nombre: a.producto || 'Adición', unidad: 'kg', cantidad, precio, costo });
    });
    (m.aditivos || []).forEach(a => {
      if (!((Number(a.dosis) || 0) > 0)) return;
      const cantidad = ((Number(a.dosis) || 0) * capacidadCochadaM3) / unidadesBache;
      const precio = _precioInsumoPorNombre(a.producto, productoGeneraIva);
      const costo = cantidad * precio;
      materiaPrima += costo;
      materiaPrimaDetalle.push({ nombre: a.producto || a.tipo, unidad: 'kg', cantidad, precio, costo });
    });
  }
  const desperdicio = materiaPrima * ((c.pctDesperdicio || 0) / 100);

  // Mano de Obra — costo/día de cada cuadrilla de la línea, repartido entre unidades/día.
  let manoObra = 0;
  const manoObraDetalle = [];
  (c.manoObra || []).forEach(row => {
    const cu = CUADRILLAS_PRODUCTIVAS.find(x => x.nombre === row.nombre);
    const costoDia = cu ? _totalCuadrilla(cu).diario : 0;
    const costo = (cu && unidadesDia > 0) ? costoDia / unidadesDia : 0;
    manoObra += costo;
    manoObraDetalle.push({ nombre: row.nombre, costoDia, costo, noEncontrado: !cu });
  });
  const herramientaMenor = manoObra * ((c.pctHerramientaMenor || 0) / 100);

  // Maquinaria — cada máquina se reparte según su PROPIA unidad de uso: "ciclo" ÷
  // unidades/ciclo (un ciclo produce esas unidades), "día" ÷ unidades/día.
  let maquinaria = 0;
  const maquinariaDetalle = [];
  (c.maquinas || []).forEach(row => {
    const maq = MAQUINARIA_EQUIPOS.find(x => x.nombre === row.nombre);
    if (!maq) { maquinariaDetalle.push({ nombre: row.nombre, unidadUso: '', costoUnidad: 0, costo: 0, noEncontrado: true }); return; }
    const costoUnidad = calcularCostoMaquina(maq).costoUnidad;
    let costo = 0;
    if (maq.unidadUso === 'ciclo' && r.unidadesCiclo > 0) costo = costoUnidad / r.unidadesCiclo;
    else if (maq.unidadUso === 'dia' && unidadesDia > 0) costo = costoUnidad / unidadesDia;
    maquinaria += costo;
    maquinariaDetalle.push({ nombre: row.nombre, unidadUso: _labelUnidadUso(maq.unidadUso), costoUnidad, costo });
  });

  // Insumos y consumos — "por estiba" (empaque) ÷ unidades/estiba, "por día" (consumos) ÷ unidades/día.
  // Misma regla de IVA descontable/no descontable que la Materia Prima (ver arriba).
  let empaque = 0, consumos = 0;
  const empaqueDetalle = [], consumosDetalle = [];
  (c.insumos || []).forEach(row => {
    const ins = INSUMOS_COSTOS.find(x => x.nombre === row.nombre);
    if (!ins) return;
    const costoIns = calcularCostoInsumo(ins);
    const precio = productoGeneraIva ? costoIns.costoSinIva : costoIns.valorFinal;
    if (row.reparto === 'dia') {
      if (unidadesDia > 0) { const costo = (row.cantidad * precio) / unidadesDia; consumos += costo; consumosDetalle.push({ nombre: row.nombre, cantidad: row.cantidad, precio, costo }); }
    } else {
      if (r.unidadesEstiba > 0) { const costo = (row.cantidad * precio) / r.unidadesEstiba; empaque += costo; empaqueDetalle.push({ nombre: row.nombre, cantidad: row.cantidad, precio, costo }); }
    }
  });

  const totalUnidad = materiaPrima + desperdicio + manoObra + herramientaMenor + maquinaria + empaque + consumos;

  // Precio de venta sugerido, configurable por producto (2026-08-02, a pedido del usuario)
  // — informativo hasta que se presione "Aplicar al catálogo"; nunca se escribe solo en
  // `productos` (ver _aplicarPreciosCatalogo()).
  // "% Margen" aquí es margen sobre el PRECIO DE VENTA (utilidad / precio), no recargo
  // sobre el costo — así se maneja históricamente en Pro Concreto (verificado contra
  // COSTEO Y LISTA DE PRECIOS.xlsx: costo $1.718 + margen 30% -> precio $2.450, y
  // (2450-1718)/2450 = 30% exacto; con recargo sobre costo hubiera dado 42,6%, no 30%).
  // Fórmula: precio = costo / (1 - margen/100). Corregido 2026-08-03 — antes se calculaba
  // como recargo sobre costo (costo * (1 + margen/100)), lo que entregaba un margen real
  // por debajo del % configurado.
  const _precioPorMargenSobreVenta = (costo, margenPct) => {
    const factor = 1 - (margenPct || 0) / 100;
    return factor > 0 ? costo / factor : costo;
  };
  const precioSugeridoLista = _precioPorMargenSobreVenta(totalUnidad, c.margenLista);
  const precioSugeridoMinimo = _precioPorMargenSobreVenta(totalUnidad, c.margenMinimo);

  return {
    capacidadCochadaM3, unidadesBache, unidadesDia,
    materiaPrima, desperdicio, manoObra, herramientaMenor, maquinaria, empaque, consumos, totalUnidad,
    precioSugeridoLista, precioSugeridoMinimo,
    materiaPrimaDetalle, manoObraDetalle, maquinariaDetalle, empaqueDetalle, consumosDetalle,
  };
}

function _actualizarResumenCosteo() {
  const div = document.getElementById('costeo-resumen');
  if (!div) return;
  _actualizarPreviewDiseno();
  const c = _leerFormularioCosteo();
  const k = calcularCosteoProducto(c);
  const producto = _productoDesdeTextoCosteo(document.getElementById('m-costeo-producto').value);
  document.getElementById('costeo-calculo-vivo').innerHTML = `
    <div class="fila"><span>Capacidad de bache (de la mezcladora de la línea)</span><span>${k.capacidadCochadaM3.toLocaleString('es-CO')} m³</span></div>
    <div class="fila"><span>Unidades / día (ciclos/día × unidades/ciclo)</span><span>${k.unidadesDia.toLocaleString('es-CO')} unidades</span></div>`;
  // El régimen de IVA del PRODUCTO (ya definido en el catálogo) decide si los insumos se
  // costean con o sin IVA — ver calcularCosteoProducto()/_precioInsumoPorNombre(). Se muestra
  // aquí explícito para que no sea una regla invisible.
  const notaIva = producto
    ? (producto.iva === 'SI'
      ? '🧾 Producto <b>genera IVA</b> → insumos y materias primas costeados <b>SIN IVA</b> (descontable)'
      : '🧾 Producto <b>excluido de IVA</b> → insumos y materias primas costeados <b>CON IVA</b> (no descontable)')
    : '🧾 Selecciona un producto para saber si sus insumos se costean con o sin IVA';
  div.innerHTML = `
    <div style="font-size:11px;color:var(--gris-medio);margin-bottom:8px">${notaIva}</div>
    <div class="fila"><span>🧱 Materia Prima</span><span>${_fmtCosteoProd(k.materiaPrima)}</span></div>
    <div class="fila sub"><span>+ Desperdicio (${c.pctDesperdicio}%)</span><span>${_fmtCosteoProd(k.desperdicio)}</span></div>
    <div class="fila"><span>👷 Mano de Obra</span><span>${_fmtCosteoProd(k.manoObra)}</span></div>
    <div class="fila sub"><span>+ Herramienta Menor (${c.pctHerramientaMenor}%)</span><span>${_fmtCosteoProd(k.herramientaMenor)}</span></div>
    <div class="fila"><span>🔧 Maquinaria</span><span>${_fmtCosteoProd(k.maquinaria)}</span></div>
    <div class="fila"><span>📦 Insumos de empaque</span><span>${_fmtCosteoProd(k.empaque)}</span></div>
    <div class="fila"><span>⚡ Consumos (energía/agua/combustible)</span><span>${_fmtCosteoProd(k.consumos)}</span></div>
    <div class="fila fila-total"><span>Costo total por unidad</span><span>${_fmtCosteoProd(k.totalUnidad)}</span></div>`;
  // Desglose línea-por-línea (cada material, cada máquina, cada cuadrilla, cada insumo) —
  // mismo bloque que el consolidado (➕), pero aquí en vivo mientras se arma el costeo, para
  // no tener que guardar y salir a revisar precios/cantidades (2026-08-03, a pedido del usuario).
  const divDetalle = document.getElementById('costeo-resumen-detalle');
  if (divDetalle) divDetalle.innerHTML = _seccionesDetalleCosteo(c, k);
  _pintarPrecioSugerido('costeo-precio-sugerido', c, k, producto);
}

// Precio sugerido (costo + margen) vs. precio actual del catálogo — mismo bloque se
// reutiliza en el modal de edición y en el consolidado de solo lectura.
function _pintarPrecioSugerido(divId, c, k, producto) {
  const div = document.getElementById(divId);
  if (!div) return;
  div.innerHTML = `
    <div class="fila"><span>Precio sugerido — Lista (margen ${c.margenLista}%)</span><span>${_fmt(k.precioSugeridoLista)}</span></div>
    <div class="fila sub"><span>Precio actual en catálogo — Lista</span><span>${producto ? _fmt(producto.lista) : '—'}</span></div>
    <div class="fila" style="border-top:1px dashed var(--gris-borde);margin-top:6px;padding-top:8px"><span>Precio sugerido — Mínimo (margen ${c.margenMinimo}%)</span><span>${_fmt(k.precioSugeridoMinimo)}</span></div>
    <div class="fila sub"><span>Precio actual en catálogo — Mínimo</span><span>${producto ? _fmt(producto.minimo) : '—'}</span></div>`;
}

// Único punto que escribe en el catálogo — siempre con confirmación explícita mostrando
// el antes/después (2026-08-02, a pedido del usuario: "sugerido + aplicar manual", nunca
// automático, porque esto cambia precios que ven los clientes en cotizaciones nuevas).
function _aplicarPreciosCatalogo(codigo, nuevoLista, nuevoMinimo) {
  const producto = CATALOGO.find(p => p.codigo === codigo);
  if (!producto) { alert('Producto no encontrado en el catálogo.'); return; }
  nuevoLista = Math.round(nuevoLista);
  nuevoMinimo = Math.round(nuevoMinimo);
  const ok = confirm(`¿Actualizar los precios de "${producto.nombre}" en el catálogo?\n\nPrecio Lista: ${_fmt(producto.lista)} → ${_fmt(nuevoLista)}\nPrecio Mínimo: ${_fmt(producto.minimo)} → ${_fmt(nuevoMinimo)}\n\nEsto afecta las cotizaciones nuevas de inmediato.`);
  if (!ok) return;
  actualizarPrecioProducto(codigo, 'lista', nuevoLista);
  actualizarPrecioProducto(codigo, 'minimo', nuevoMinimo);
  alert('Precios actualizados en el catálogo.');
}

function aplicarPreciosCatalogoCosteo() {
  const producto = _productoDesdeTextoCosteo(document.getElementById('m-costeo-producto').value);
  if (!producto) { alert('Selecciona un producto válido primero.'); return; }
  const c = _leerFormularioCosteo();
  const k = calcularCosteoProducto(c);
  _aplicarPreciosCatalogo(producto.codigo, k.precioSugeridoLista, k.precioSugeridoMinimo);
  _actualizarResumenCosteo();
}

function aplicarPreciosCatalogoDesdeDetalle(codigo) {
  const c = COSTEO_PRODUCTOS.find(x => x.productoCodigo === codigo);
  if (!c) return;
  const k = calcularCosteoProducto(c);
  _aplicarPreciosCatalogo(c.productoCodigo, k.precioSugeridoLista, k.precioSugeridoMinimo);
  abrirDetalleCosteoProducto(codigo);
}

// ── Impacto en el catálogo cuando cambia un insumo/máquina/cuadrilla/nivel salarial/diseño ──
// (2026-08-02, a pedido del usuario: el precio de venta SÍ debe seguir el costo real de
// inmediato en vez de quedar "atrasado" hasta que alguien entre producto por producto — pero
// mostrando antes una aprobación con el impacto real, porque un insumo compartido como el
// cemento puede mover el precio de decenas de productos a la vez. Las cotizaciones YA
// guardadas no se ven afectadas: cada ítem de una cotización copia el precio en el momento
// de agregarse al carrito (ver `precio: prod.lista` en cotizador.js) — esto solo cambia el
// precio de catálogo que verán las cotizaciones NUEVAS de aquí en adelante.
let _impactoPreciosActual = [];

function _costeosAfectadosPorCambio() {
  return COSTEO_PRODUCTOS.map(c => {
    const producto = CATALOGO.find(p => p.codigo === c.productoCodigo);
    if (!producto) return null;
    const k = calcularCosteoProducto(c);
    const listaNueva = Math.round(k.precioSugeridoLista);
    const minimoNueva = Math.round(k.precioSugeridoMinimo);
    if (listaNueva === (producto.lista || 0) && minimoNueva === (producto.minimo || 0)) return null;
    return { codigo: c.productoCodigo, nombre: c.productoNombre, listaActual: producto.lista || 0, listaNueva, minimoActual: producto.minimo || 0, minimoNueva };
  }).filter(Boolean);
}

// Se llama al final de cada guardarX() que pueda mover un costo (insumo, máquina, cuadrilla,
// nivel salarial, diseño de mezcla) — si ningún costeo cambió de precio no muestra nada.
function _revisarImpactoPrecios(origenLabel) {
  const afectados = _costeosAfectadosPorCambio();
  if (!afectados.length) return;
  _impactoPreciosActual = afectados;
  document.getElementById('impacto-precios-origen').textContent = origenLabel;
  document.getElementById('impacto-precios-count').textContent = afectados.length;
  document.getElementById('impacto-precios-body').innerHTML = afectados.map(a => `
    <tr>
      <td style="font-weight:600">${a.nombre}</td>
      <td style="text-align:right;white-space:nowrap">${_fmt(a.listaActual)} → <b style="color:var(--azul)">${_fmt(a.listaNueva)}</b></td>
      <td style="text-align:right;white-space:nowrap">${_fmt(a.minimoActual)} → <b style="color:var(--azul)">${_fmt(a.minimoNueva)}</b></td>
    </tr>`).join('');
  document.getElementById('modal-impacto-precios').classList.add('abierto');
}

function confirmarImpactoPrecios() {
  _impactoPreciosActual.forEach(a => {
    actualizarPrecioProducto(a.codigo, 'lista', a.listaNueva);
    actualizarPrecioProducto(a.codigo, 'minimo', a.minimoNueva);
  });
  const n = _impactoPreciosActual.length;
  _impactoPreciosActual = [];
  cerrarModal('modal-impacto-precios');
  alert(`Se actualizaron los precios de ${n} producto${n === 1 ? '' : 's'} en el catálogo. Las cotizaciones ya guardadas no cambian — solo las nuevas de aquí en adelante.`);
}

function cancelarImpactoPrecios() {
  _impactoPreciosActual = [];
  cerrarModal('modal-impacto-precios');
}

// ── Lista principal ──
function renderCosteoProductos() {
  const tbody = document.getElementById('costeo-producto-body');
  if (!tbody) return;
  const q = (document.getElementById('costeo-producto-buscador')?.value || '').toLowerCase();
  const fTipo = document.getElementById('costeo-producto-filtro-tipo')?.value || '';
  let data = [...COSTEO_PRODUCTOS];
  if (q) data = data.filter(c => (c.productoCodigo + ' ' + c.productoNombre).toLowerCase().includes(q));
  if (fTipo) data = data.filter(c => c.tipoEstructura === fTipo);
  data.sort((a, b) => a.productoNombre.localeCompare(b.productoNombre));
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="icono">🏗️</div><div>No hay costeos de producto registrados.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(c => {
    const k = calcularCosteoProducto(c);
    const tipo = TIPOS_ESTRUCTURA_COSTEO[c.tipoEstructura] || TIPOS_ESTRUCTURA_COSTEO.vibrocompactado;
    const nombreEsc = _escNombreOnclick(c.productoCodigo);
    return `<tr>
      <td style="font-weight:600">${c.productoNombre}</td>
      <td><span class="badge-tipo" style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:600;background:${tipo.bg};color:${tipo.fg}">${tipo.label}</span></td>
      <td style="text-align:right;font-weight:700;color:var(--azul)">${_fmtCosteoProd(k.totalUnidad)}</td>
      <td style="font-size:12px;color:var(--gris-medio)">${c.disenoMezclaCodigo || '—'}</td>
      <td style="font-size:12px;color:var(--gris-medio)">${c._modificado ? new Date(c._modificado).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-secundario btn-xs" onclick="abrirDetalleCosteoProducto('${nombreEsc}')" title="Ver consolidado">➕</button>
          <button class="btn btn-primario btn-xs" onclick="editarCosteoProducto('${nombreEsc}')">✏️</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarCosteoProducto('${nombreEsc}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function _filtrarCosteoProductos() { renderCosteoProductos(); }

function abrirModalCosteoProducto() {
  document.getElementById('m-costeo-producto-codigo-anterior').value = '';
  document.getElementById('modal-costeo-producto-titulo').textContent = '🏗️ Nuevo Costeo de Producto';
  document.getElementById('m-costeo-producto').value = '';
  poblarSelectDisenos('m-costeo-diseno');
  document.getElementById('m-costeo-peso-unidad').value = '';
  document.getElementById('m-costeo-ciclos-dia').value = '';
  document.getElementById('m-costeo-unidades-ciclo').value = '';
  document.getElementById('m-costeo-unidades-bache').value = '';
  document.getElementById('m-costeo-unidades-estiba').value = '';
  document.getElementById('m-costeo-pct-desperdicio').value = 4;
  document.getElementById('m-costeo-pct-herramienta').value = 2;
  document.getElementById('m-costeo-margen-lista').value = 30;
  document.getElementById('m-costeo-margen-minimo').value = 15;
  _maquinasCosteoActual = [];
  _manoObraCosteoActual = [];
  _insumosCosteoActual = [];
  renderMaquinasCosteo();
  renderManoObraCosteo();
  renderInsumosCosteo();
  document.getElementById('costeo-producto-sugerencias').style.display = 'none';
  _elegirTipoEstructuraCosteo(''); // sin tipo elegido todavía — oculta las secciones 2-8
  document.getElementById('modal-costeo-producto').classList.add('abierto');
}

function editarCosteoProducto(codigo) {
  const c = COSTEO_PRODUCTOS.find(x => x.productoCodigo === codigo);
  if (!c) return;
  document.getElementById('m-costeo-producto-codigo-anterior').value = c.productoCodigo;
  document.getElementById('modal-costeo-producto-titulo').textContent = `✏️ Editar Costeo — ${c.productoNombre}`;
  document.getElementById('costeo-producto-sugerencias').style.display = 'none';
  document.getElementById('m-costeo-producto').value = c.productoCodigo + ' — ' + c.productoNombre;
  poblarSelectDisenos('m-costeo-diseno');
  agregarOpcionSiNoExiste('m-costeo-diseno', c.disenoMezclaCodigo);
  document.getElementById('m-costeo-diseno').value = c.disenoMezclaCodigo || '';
  const r = c.rendimiento || {};
  document.getElementById('m-costeo-peso-unidad').value = r.pesoUnidadKg || '';
  document.getElementById('m-costeo-ciclos-dia').value = r.ciclosDia || '';
  document.getElementById('m-costeo-unidades-ciclo').value = r.unidadesCiclo || '';
  document.getElementById('m-costeo-unidades-bache').value = r.unidadesBache || '';
  document.getElementById('m-costeo-unidades-estiba').value = r.unidadesEstiba || '';
  document.getElementById('m-costeo-pct-desperdicio').value = c.pctDesperdicio || 0;
  document.getElementById('m-costeo-pct-herramienta').value = c.pctHerramientaMenor || 0;
  document.getElementById('m-costeo-margen-lista').value = c.margenLista ?? 30;
  document.getElementById('m-costeo-margen-minimo').value = c.margenMinimo ?? 15;
  _maquinasCosteoActual = JSON.parse(JSON.stringify(c.maquinas || []));
  _manoObraCosteoActual = JSON.parse(JSON.stringify(c.manoObra || []));
  _insumosCosteoActual = JSON.parse(JSON.stringify(c.insumos || []));
  renderMaquinasCosteo();
  renderManoObraCosteo();
  renderInsumosCosteo();
  _elegirTipoEstructuraCosteo(c.tipoEstructura || 'vibrocompactado');
  document.getElementById('modal-costeo-producto').classList.add('abierto');
}

function guardarCosteoProducto() {
  const producto = _productoDesdeTextoCosteo(document.getElementById('m-costeo-producto').value);
  if (!producto) { alert('Selecciona un producto válido del catálogo (busca por código o nombre).'); return; }
  if (document.getElementById('m-costeo-tipo').value !== 'vibrocompactado') { alert('Elige el tipo de estructura (por ahora solo Vibrocompactado está disponible).'); return; }
  if (!document.getElementById('m-costeo-diseno').value) { alert('Selecciona un Diseño de Mezcla.'); return; }
  const c = _leerFormularioCosteo();
  c.productoCodigo = producto.codigo;
  c.productoNombre = producto.nombre;
  const codigoAnterior = document.getElementById('m-costeo-producto-codigo-anterior').value;
  const guardarEnSupabase = () => {
    sb.from('costeo_productos').upsert({ producto_codigo: c.productoCodigo, datos: c, modificado: new Date().toISOString() }, { onConflict: 'producto_codigo' })
      .then(({ error }) => { if (error) console.error('Error guardando costeo de producto:', error.message); });
  };
  if (codigoAnterior && codigoAnterior !== c.productoCodigo) {
    // Cambió el producto: borrar el registro viejo e insertar el nuevo (mismo patrón que Maquinaria/Clases Salariales).
    const idx = COSTEO_PRODUCTOS.findIndex(x => x.productoCodigo === codigoAnterior);
    if (idx >= 0) COSTEO_PRODUCTOS[idx] = c; else COSTEO_PRODUCTOS.push(c);
    sb.from('costeo_productos').delete().eq('producto_codigo', codigoAnterior).then(guardarEnSupabase);
  } else {
    const idx = COSTEO_PRODUCTOS.findIndex(x => x.productoCodigo === c.productoCodigo);
    if (idx >= 0) COSTEO_PRODUCTOS[idx] = c; else COSTEO_PRODUCTOS.push(c);
    guardarEnSupabase();
  }
  cerrarModal('modal-costeo-producto');
  renderCosteoProductos();
}

function eliminarCosteoProducto(codigo) {
  const c = COSTEO_PRODUCTOS.find(x => x.productoCodigo === codigo);
  if (!c || !confirm(`¿Eliminar el costeo de "${c.productoNombre}"?`)) return;
  COSTEO_PRODUCTOS = COSTEO_PRODUCTOS.filter(x => x.productoCodigo !== codigo);
  sb.from('costeo_productos').delete().eq('producto_codigo', codigo).then(({ error }) => { if (error) console.error('Error eliminando costeo de producto:', error.message); });
  renderCosteoProductos();
}

// Fila de una tabla de detalle del consolidado: Nombre | Cantidad (con unidad) | Precio | Costo.
function _filaDetalleCosteo(nombre, cantidad, unidad, precio, costo, noEncontrado) {
  const nombreHtml = noEncontrado ? `${nombre} <span style="color:var(--rojo);font-size:11px">(ya no existe)</span>` : nombre;
  return `<tr>
    <td>${nombreHtml}</td>
    <td style="text-align:right;color:var(--gris-medio)">${cantidad != null ? cantidad.toLocaleString('es-CO', { maximumFractionDigits: 4 }) + (unidad ? ' ' + unidad : '') : '—'}</td>
    <td style="text-align:right;color:var(--gris-medio)">${precio != null ? _fmtCosteoProd(precio) : '—'}</td>
    <td style="text-align:right;font-weight:700">${_fmtCosteoProd(costo)}</td>
  </tr>`;
}

// Una sección con título + tabla de detalle (o un aviso si la lista viene vacía).
function _seccionDetalleCosteo(titulo, filasHtml, vacioTexto) {
  return `
    <div class="seccion-costeo">
      <div class="seccion-costeo-titulo">${titulo}</div>
      <table class="tabla-items" style="width:100%">
        <thead><tr><th>Insumo</th><th style="text-align:right;width:130px">Cantidad</th><th style="text-align:right;width:110px">Precio</th><th style="text-align:right;width:110px">Costo/unidad</th></tr></thead>
        <tbody>${filasHtml || `<tr><td colspan="4" style="text-align:center;color:var(--gris-medio);font-size:12px">${vacioTexto}</td></tr>`}</tbody>
      </table>
    </div>`;
}

// Arma las 5 secciones de detalle línea-por-línea (Materia Prima/Mano de Obra/Maquinaria/
// Empaque/Consumos) a partir de un costeo `c` y su cálculo `k` — se reutiliza tal cual en el
// consolidado de solo lectura (➕) y en el propio formulario de edición (2026-08-03, a pedido
// del usuario: "muéstrame también el resumen detallado... para no tener que salir de la
// ventana"), así ambos muestran exactamente el mismo desglose sin duplicar el HTML.
function _seccionesDetalleCosteo(c, k) {
  const productoDetalle = CATALOGO.find(p => p.codigo === c.productoCodigo);
  const notaIvaDetalle = productoDetalle
    ? (productoDetalle.iva === 'SI'
      ? '🧾 Producto <b>genera IVA</b> → insumos costeados <b>SIN IVA</b> (descontable)'
      : '🧾 Producto <b>excluido de IVA</b> → insumos costeados <b>CON IVA</b> (no descontable)')
    : '';
  const filasMP = k.materiaPrimaDetalle.map(f => _filaDetalleCosteo(f.nombre, f.cantidad, f.unidad, f.precio, f.costo)).join('')
    + `<tr style="border-top:1px solid var(--gris-borde)"><td colspan="3" style="text-align:right;color:var(--gris-medio)">+ Desperdicio (${c.pctDesperdicio}%)</td><td style="text-align:right;font-weight:700">${_fmtCosteoProd(k.desperdicio)}</td></tr>
       <tr style="font-weight:700"><td colspan="3" style="text-align:right">Subtotal Materia Prima</td><td style="text-align:right;color:var(--azul)">${_fmtCosteoProd(k.materiaPrima + k.desperdicio)}</td></tr>`;
  const seccionMP = `<div style="font-size:11px;color:var(--gris-medio);margin:14px 0 -8px">${notaIvaDetalle}</div>` + _seccionDetalleCosteo('🧱 Materia Prima <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(por unidad de producto)</span>', filasMP, 'Sin Diseño de Mezcla o sin materiales con cantidad.');

  const filasMO = k.manoObraDetalle.map(f => _filaDetalleCosteo(f.nombre, null, null, f.costoDia ? f.costoDia : null, f.costo, f.noEncontrado)).join('')
    + (k.manoObraDetalle.length ? `<tr style="border-top:1px solid var(--gris-borde)"><td colspan="3" style="text-align:right;color:var(--gris-medio)">+ Herramienta Menor (${c.pctHerramientaMenor}%)</td><td style="text-align:right;font-weight:700">${_fmtCosteoProd(k.herramientaMenor)}</td></tr>
       <tr style="font-weight:700"><td colspan="3" style="text-align:right">Subtotal Mano de Obra</td><td style="text-align:right;color:var(--azul)">${_fmtCosteoProd(k.manoObra + k.herramientaMenor)}</td></tr>` : '');
  const seccionMO = _seccionDetalleCosteo('👷 Mano de Obra <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(Precio = costo/día de la cuadrilla)</span>', filasMO, 'Sin cuadrillas agregadas.');

  const filasMaq = k.maquinariaDetalle.map(f => _filaDetalleCosteo(f.nombre, null, null, f.costoUnidad ? f.costoUnidad : null, f.costo, f.noEncontrado)).join('')
    + (k.maquinariaDetalle.length ? `<tr style="font-weight:700;border-top:1px solid var(--gris-borde)"><td colspan="3" style="text-align:right">Subtotal Maquinaria</td><td style="text-align:right;color:var(--azul)">${_fmtCosteoProd(k.maquinaria)}</td></tr>` : '');
  const seccionMaq = _seccionDetalleCosteo('🔧 Maquinaria <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(Precio = costo/ciclo o costo/día de la máquina)</span>', filasMaq, 'Sin máquinas agregadas.');

  const filasEmp = k.empaqueDetalle.map(f => _filaDetalleCosteo(f.nombre, f.cantidad, null, f.precio, f.costo)).join('')
    + (k.empaqueDetalle.length ? `<tr style="font-weight:700;border-top:1px solid var(--gris-borde)"><td colspan="3" style="text-align:right">Subtotal Empaque</td><td style="text-align:right;color:var(--azul)">${_fmtCosteoProd(k.empaque)}</td></tr>` : '');
  const seccionEmp = _seccionDetalleCosteo('📦 Insumos de empaque', filasEmp, 'Sin insumos de empaque.');

  const filasCons = k.consumosDetalle.map(f => _filaDetalleCosteo(f.nombre, f.cantidad, null, f.precio, f.costo)).join('')
    + (k.consumosDetalle.length ? `<tr style="font-weight:700;border-top:1px solid var(--gris-borde)"><td colspan="3" style="text-align:right">Subtotal Consumos</td><td style="text-align:right;color:var(--azul)">${_fmtCosteoProd(k.consumos)}</td></tr>` : '');
  const seccionCons = _seccionDetalleCosteo('⚡ Consumos <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(energía/agua/combustible)</span>', filasCons, 'Sin consumos agregados.');

  return seccionMP + seccionMO + seccionMaq + seccionEmp + seccionCons;
}

// Consolidado de solo lectura (➕) — muestra CADA input que compone el costo (cada material,
// cada máquina, cada cuadrilla, cada insumo), no solo el total por categoría (2026-08-02, a
// pedido del usuario: "está muy resumido, quiero ver cada input").
function abrirDetalleCosteoProducto(codigo) {
  const c = COSTEO_PRODUCTOS.find(x => x.productoCodigo === codigo);
  if (!c) return;
  const k = calcularCosteoProducto(c);
  const tipo = TIPOS_ESTRUCTURA_COSTEO[c.tipoEstructura] || TIPOS_ESTRUCTURA_COSTEO.vibrocompactado;
  const diseno = DISENOS_MEZCLA.find(d => d.codigo === c.disenoMezclaCodigo);
  const r = c.rendimiento || {};

  document.getElementById('modal-detalle-costeo-titulo').textContent = `Consolidado — ${c.productoNombre}`;
  document.getElementById('detalle-costeo-resumen').innerHTML = `
    <span>${tipo.label}</span>
    <span><strong>Diseño:</strong> ${diseno ? `${diseno.codigo} — ${diseno.nombre}` : (c.disenoMezclaCodigo || '—')}</span>
    <span><strong>Unidades/Bache:</strong> ${(r.unidadesBache || 0).toLocaleString('es-CO')}</span>
    <span><strong>Unidades/día:</strong> ${k.unidadesDia.toLocaleString('es-CO')}</span>`;

  const seccionRendimiento = `
    <div class="seccion-costeo">
      <div class="seccion-costeo-titulo">Rendimiento de producción</div>
      <div class="caja-costeo">
        <div class="fila"><span>Peso / unidad <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(informativo)</span></span><span>${(r.pesoUnidadKg || 0).toLocaleString('es-CO')} kg</span></div>
        <div class="fila"><span>Ciclos / día</span><span>${(r.ciclosDia || 0).toLocaleString('es-CO')}</span></div>
        <div class="fila"><span>Unidades / Ciclo</span><span>${(r.unidadesCiclo || 0).toLocaleString('es-CO')}</span></div>
        <div class="fila"><span>Unidades / Bache</span><span>${(r.unidadesBache || 0).toLocaleString('es-CO')}</span></div>
        <div class="fila"><span>Unidades / estiba</span><span>${(r.unidadesEstiba || 0).toLocaleString('es-CO')}</span></div>
      </div>
    </div>`;

  const seccionTotal = `
    <div class="seccion-costeo">
      <div class="seccion-costeo-titulo">Resumen — costo por unidad</div>
      <div class="caja-costeo caja-costeo-resumen">
        <div class="fila"><span>🧱 Materia Prima</span><span>${_fmtCosteoProd(k.materiaPrima)}</span></div>
        <div class="fila sub"><span>+ Desperdicio (${c.pctDesperdicio}%)</span><span>${_fmtCosteoProd(k.desperdicio)}</span></div>
        <div class="fila"><span>👷 Mano de Obra</span><span>${_fmtCosteoProd(k.manoObra)}</span></div>
        <div class="fila sub"><span>+ Herramienta Menor (${c.pctHerramientaMenor}%)</span><span>${_fmtCosteoProd(k.herramientaMenor)}</span></div>
        <div class="fila"><span>🔧 Maquinaria</span><span>${_fmtCosteoProd(k.maquinaria)}</span></div>
        <div class="fila"><span>📦 Insumos de empaque</span><span>${_fmtCosteoProd(k.empaque)}</span></div>
        <div class="fila"><span>⚡ Consumos</span><span>${_fmtCosteoProd(k.consumos)}</span></div>
        <div class="fila fila-total"><span>Costo total por unidad</span><span>${_fmtCosteoProd(k.totalUnidad)}</span></div>
      </div>
    </div>`;

  document.getElementById('detalle-costeo-contenido').innerHTML = seccionRendimiento + _seccionesDetalleCosteo(c, k) + seccionTotal;

  const producto = CATALOGO.find(p => p.codigo === c.productoCodigo);
  _pintarPrecioSugerido('detalle-costeo-precio', c, k, producto);
  document.getElementById('detalle-costeo-btn-aplicar').onclick = () => aplicarPreciosCatalogoDesdeDetalle(codigo);
  document.getElementById('modal-detalle-costeo').classList.add('abierto');
}
