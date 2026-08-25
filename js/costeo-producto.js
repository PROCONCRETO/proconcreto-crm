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
      <div style="font-weight:600;font-size:13px">${_esc(p.nombre)}</div>
      <div style="font-size:11px;color:var(--gris-medio)">${_esc(p.codigo)} · ${_esc(p.grupo)}${p.medidas ? ' · ' + _esc(p.medidas) : ''}</div>
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
// del tipo elegido aquí — un Vibrocompactado se arma distinto a un Reforzado (ver BD MEZCLA
// VIBROCOMPACTADOS del Excel, la fuente real de esa estructura) — por eso las secciones 2-8
// quedan ocultas hasta que se elige un tipo (2026-08-02, a pedido del usuario). Hoy Vibrocompactado
// y Reforzado tienen su cuestionario construido; Pretensado y Pretensado Moldeado siguen pendientes.
function _elegirTipoEstructuraCosteo(tipo) {
  document.getElementById('m-costeo-tipo').value = tipo;
  document.querySelectorAll('#costeo-tipo-chips .tipo-chip').forEach(el => {
    el.classList.toggle('activo', el.dataset.tipo === tipo);
  });
  const disponible = tipo === 'vibrocompactado' || tipo === 'reforzado' || tipo === 'pretensado';
  const esReforzado = tipo === 'reforzado';
  const esPretensado = tipo === 'pretensado';
  const esVibrocompactado = tipo === 'vibrocompactado';
  const wrapper = document.getElementById('costeo-secciones-tipo');
  const placeholder = document.getElementById('costeo-tipo-placeholder');
  if (wrapper) wrapper.style.display = disponible ? '' : 'none';
  if (placeholder) {
    placeholder.style.display = disponible ? 'none' : '';
    if (!disponible) {
      placeholder.innerHTML = tipo
        ? `El cuestionario de <b>${(TIPOS_ESTRUCTURA_COSTEO[tipo] || {}).label || tipo}</b> todavía no está construido — por ahora solo están disponibles Vibrocompactado, Reforzado y Pretensado.`
        : 'Elige un tipo de estructura arriba para continuar — cada tipo tiene su propio cuestionario (la receta y las máquinas de un Vibrocompactado no son las de un Reforzado).';
    }
  }
  // Sección 3 (Rendimiento): qué campos se muestran depende del tipo — Vibrocompactado reparte
  // por Ciclos/Unidades-Ciclo/Unidades-Bache; Reforzado usa un rendimiento directo de cuadrilla
  // (Unidades/día) y trae su propio bloque de Refuerzo (Acero/Alambre); Pretensado usa el modelo
  // de Banco (metros lineales/banco, hilos/banco, longitud del hilo, bancos/día). "display:contents"
  // en los bloques de la fila superior para que sus campos sigan siendo celdas del mismo
  // form-grid-3, no un bloque aparte que rompa la cuadrícula.
  const camposVibro = document.getElementById('rendimiento-campos-vibrocompactado');
  const camposReforzado = document.getElementById('rendimiento-campos-reforzado');
  const camposPretensado = document.getElementById('rendimiento-campos-pretensado');
  const bacheVibro = document.getElementById('rendimiento-bache-vibrocompactado');
  const refuerzoReforzado = document.getElementById('rendimiento-refuerzo-reforzado');
  const hintRendimiento = document.getElementById('costeo-hint-rendimiento');
  if (camposVibro) camposVibro.style.display = esVibrocompactado ? 'contents' : 'none';
  if (camposReforzado) camposReforzado.style.display = esReforzado ? 'contents' : 'none';
  if (camposPretensado) camposPretensado.style.display = esPretensado ? 'contents' : 'none';
  if (bacheVibro) bacheVibro.style.display = esVibrocompactado ? '' : 'none';
  if (refuerzoReforzado) refuerzoReforzado.style.display = esReforzado ? '' : 'none';
  const bancoPretensado = document.getElementById('rendimiento-banco-pretensado');
  if (bancoPretensado) bancoPretensado.style.display = esPretensado ? '' : 'none';
  // Columnas "Bancos/día" (Máquinas y Mano de Obra) y "× hilo" (Máquinas) solo tienen sentido
  // para Pretensado — el resto de tipos reparte con un único "unidades/día" de línea, sin
  // rendimiento por fila.
  ['costeo-maq-th-banco', 'costeo-maq-th-hilo', 'costeo-mo-th-banco'].forEach(id => {
    const th = document.getElementById(id);
    if (th) th.style.display = esPretensado ? '' : 'none';
  });
  if (hintRendimiento) hintRendimiento.textContent = esPretensado
    ? 'Metros lineales/banco, Hilos/banco y Longitud bruta del hilo son datos reales de la colada — con ellos se calcula solo el Acero de Pretensionamiento. Bancos/día es el rendimiento por defecto de toda la línea; cada cuadrilla o máquina lo puede anular más abajo si tiene un ritmo real distinto.'
    : esReforzado
    ? 'El Volumen de concreto por unidad es un dato real de la pieza (viene de su diseño/geometría) — se digita directo. El peso equivalente se muestra abajo, derivado con una densidad de 2450 kg/m³, solo de referencia.'
    : 'Unidades / Bache es un dato real de planta (cuántas unidades rinde una mezclada completa de la mezcladora) — no se calcula desde el peso, se digita directo. La Materia Prima se reparte con este número, no con Peso/unidad.';
  // A diferencia de Vibrocompactado, ni Reforzado ni Pretensado traen máquinas/insumos por
  // defecto — no hay una lista real confirmada para ellos (los defaults de Vibrocompactado los
  // armó el usuario a mano en una sesión anterior); se elige de lo que ya esté registrado en
  // Maquinaria y Costos de Referencia.
  if (disponible) {
    if (esVibrocompactado && !_maquinasCosteoActual.length) {
      _maquinasCosteoActual = _MAQUINAS_DEFECTO_VIBROCOMPACTADO.map(nombre => ({ nombre }));
      renderMaquinasCosteo();
    }
    if (esVibrocompactado && !_insumosCosteoActual.length) {
      _insumosCosteoActual = JSON.parse(JSON.stringify(_INSUMOS_DEFECTO_VIBROCOMPACTADO));
      renderInsumosCosteo();
    }
    renderMaquinasCosteo();
    renderManoObraCosteo();
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
  const esPretensado = document.getElementById('m-costeo-tipo')?.value === 'pretensado';
  if (!_maquinasCosteoActual.length) {
    tbody.innerHTML = `<tr><td colspan="${esPretensado ? 5 : 3}" style="text-align:center;padding:10px;color:var(--gris-medio);font-size:12px">Agrega las máquinas de la línea de producción</td></tr>`;
    return;
  }
  tbody.innerHTML = _maquinasCosteoActual.map((row, i) => {
    const m = MAQUINARIA_EQUIPOS.find(x => x.nombre === row.nombre);
    const info = m ? `${_fmtMaq(calcularCostoMaquina(m).costoUnidad)}/${_labelUnidadUso(m.unidadUso)}` : '—';
    // "Bancos/día" y "× hilo" solo aplican a Pretensado — cada máquina puede tener su propio
    // rendimiento real (Bobcat, Montacargas, Puente Grúa) o marcarse "× hilo" cuando se usa una
    // vez por cada hilo tensionado, no una vez por banco (caso real: Gato de Tensionamiento).
    const celdasPretensado = esPretensado ? `
      <td><input type="number" min="0" step="0.01" value="${row.bancosDiaFila || ''}" placeholder="de línea" style="width:90px" oninput="_maquinasCosteoActual[${i}].bancosDiaFila=parseFloat(this.value)||0;_actualizarResumenCosteo()"></td>
      <td style="text-align:center"><input type="checkbox" ${row.porHilo ? 'checked' : ''} onchange="_maquinasCosteoActual[${i}].porHilo=this.checked;_actualizarResumenCosteo()"></td>` : '';
    return `<tr>
      <td><select onchange="_maquinasCosteoActual[${i}].nombre=this.value;_actualizarResumenCosteo()">${_opcionesMaquinariaCosteo(row.nombre)}</select></td>
      <td style="color:var(--gris-medio)">${info}</td>
      ${celdasPretensado}
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
  const esPretensado = document.getElementById('m-costeo-tipo')?.value === 'pretensado';
  if (!_manoObraCosteoActual.length) {
    tbody.innerHTML = `<tr><td colspan="${esPretensado ? 5 : 4}" style="text-align:center;padding:10px;color:var(--gris-medio);font-size:12px">Agrega las cuadrillas de la línea de producción</td></tr>`;
    return;
  }
  tbody.innerHTML = _manoObraCosteoActual.map((row, i) => {
    const cu = CUADRILLAS_PRODUCTIVAS.find(x => x.nombre === row.nombre);
    const info = cu ? `${_fmt(_totalCuadrilla(cu).diario)}/día` : '—';
    // "Bancos/día" solo aplica a Pretensado — cada cuadrilla real (Bobcat, Montacargas, Puente
    // Grúa, oficial+ayudantes) tiene su propio ritmo de producción; vacío = usa el de la línea.
    const celdaPretensado = esPretensado
      ? `<td><input type="number" min="0" step="0.01" value="${row.bancosDiaFila || ''}" placeholder="de línea" style="width:90px" oninput="_manoObraCosteoActual[${i}].bancosDiaFila=parseFloat(this.value)||0;_actualizarResumenCosteo()"></td>` : '';
    return `<tr>
      <td><select onchange="_manoObraCosteoActual[${i}].nombre=this.value;_actualizarResumenCosteo()">${_opcionesCuadrillaCosteo(row.nombre)}</select></td>
      <td style="color:var(--gris-medio)">${info}</td>
      <td><input type="text" value="${_escAttr(row.nota || '')}" placeholder="ej: armado de molde, vaciado..." style="width:100%" oninput="_manoObraCosteoActual[${i}].nota=this.value;_actualizarResumenCosteo()"></td>
      ${celdaPretensado}
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
      <td><select onchange="_insumosCosteoActual[${i}].reparto=this.value;_actualizarResumenCosteo()">${_opcionesRepartoInsumoCosteo(row.reparto)}</select></td>
      <td><button class="btn btn-rojo btn-xs" onclick="_insumosCosteoActual.splice(${i},1);renderInsumosCosteo();_actualizarResumenCosteo()">✕</button></td>
    </tr>`;
  }).join('');
}
function _opcionesInsumoCosteo(seleccionado) {
  if (!INSUMOS_COSTOS.length) return '<option value="">Sin insumos registrados</option>';
  return '<option value="">— Selecciona —</option>' + INSUMOS_COSTOS.map(i => `<option value="${_escAttr(i.nombre)}" ${i.nombre === seleccionado ? 'selected' : ''}>${i.nombre}</option>`).join('');
}
function agregarInsumoCosteo() { _insumosCosteoActual.push({ nombre: '', cantidad: 0, reparto: 'estiba' }); renderInsumosCosteo(); }
function _opcionesRepartoInsumoCosteo(seleccionado) {
  const opciones = [
    ['estiba', 'Por estiba'],
    ['dia', 'Por día'],
    ['directo', 'Directo (ya es cantidad/unidad)'],
  ];
  return opciones.map(([v, label]) => `<option value="${v}" ${v === seleccionado ? 'selected' : ''}>${label}</option>`).join('');
}

// ── Cálculo del costeo completo ──
function _leerFormularioCosteo() {
  // Se resuelve aquí también (no solo en guardarCosteoProducto()) para que el cálculo en vivo
  // (_actualizarResumenCosteo()) ya sepa si el producto genera IVA o no mientras se arma el
  // costeo, sin esperar a guardar (ver calcularCosteoProducto() → productoGeneraIva).
  const productoEnCurso = _productoDesdeTextoCosteo(document.getElementById('m-costeo-producto').value);
  const tipoEstructura = document.getElementById('m-costeo-tipo').value || 'vibrocompactado';
  return {
    productoCodigo: productoEnCurso ? productoEnCurso.codigo : '',
    productoNombre: productoEnCurso ? productoEnCurso.nombre : '',
    tipoEstructura,
    disenoMezclaCodigo: document.getElementById('m-costeo-diseno').value,
    rendimiento: {
      pesoUnidadKg: parseFloat(document.getElementById('m-costeo-peso-unidad').value) || 0,
      ciclosDia: parseFloat(document.getElementById('m-costeo-ciclos-dia').value) || 0,
      unidadesCiclo: parseFloat(document.getElementById('m-costeo-unidades-ciclo').value) || 0,
      unidadesBache: parseFloat(document.getElementById('m-costeo-unidades-bache').value) || 0,
      unidadesEstiba: parseFloat(document.getElementById('m-costeo-unidades-estiba').value) || 0,
      // Propios de Reforzado — inofensivos para Vibrocompactado (quedan en 0/sin uso ahí).
      // "Volumen de concreto/unidad" es el mismo concepto para Reforzado y Pretensado (volumen
      // real de la pieza), pero vive en dos <input> distintos porque solo uno está visible a la
      // vez — se lee del que corresponda al tipo elegido.
      volumenUnidadM3: parseFloat(document.getElementById(tipoEstructura === 'pretensado' ? 'm-costeo-volumen-unidad-pretensado' : 'm-costeo-volumen-unidad').value) || 0,
      unidadesDia: parseFloat(document.getElementById('m-costeo-unidades-dia-reforzado').value) || 0,
      aceroKgUnidad: parseFloat(document.getElementById('m-costeo-acero-kg').value) || 0,
      pctAlambre: document.getElementById('m-costeo-pct-alambre').value === '' ? 2 : (parseFloat(document.getElementById('m-costeo-pct-alambre').value) || 0),
      // Propios de Pretensado — inofensivos para los demás tipos (quedan en 0/sin uso ahí).
      metrosLinealesBanco: parseFloat(document.getElementById('m-costeo-metros-banco').value) || 0,
      hilosBanco: parseFloat(document.getElementById('m-costeo-hilos-banco').value) || 0,
      longitudBrutaHilo: parseFloat(document.getElementById('m-costeo-longitud-hilo').value) || 0,
      bancosDiaLinea: parseFloat(document.getElementById('m-costeo-bancos-dia').value) || 0,
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

// Precio de venta sugerido a partir del costo y un % de margen — reutilizado por Vibrocompactado
// y Reforzado. "% Margen" es margen sobre el PRECIO DE VENTA (utilidad / precio), no recargo
// sobre el costo — así se maneja históricamente en Pro Concreto (verificado contra COSTEO Y
// LISTA DE PRECIOS.xlsx: costo $1.718 + margen 30% -> precio $2.450, y (2450-1718)/2450 = 30%
// exacto; con recargo sobre costo hubiera dado 42,6%, no 30%). Fórmula: precio = costo / (1 -
// margen/100).
function _precioPorMargenSobreVenta(costo, margenPct) {
  const factor = 1 - (margenPct || 0) / 100;
  return factor > 0 ? costo / factor : costo;
}

function calcularCosteoProducto(c) {
  if (c.tipoEstructura === 'reforzado') return _calcularCosteoReforzado(c);
  if (c.tipoEstructura === 'pretensado') return _calcularCosteoPretensado(c);
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
      materiaPrimaDetalle.push({ nombre: m[`${k}Producto`] || _LABEL_MAT_COSTEO[k], unidad: k === 'agua' ? 'L' : 'kg', cantidad, precio, costo, esCemento: k === 'cemento' });
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
    manoObraDetalle.push({ nombre: row.nota ? `${row.nombre} — ${row.nota}` : row.nombre, costoDia, costo, noEncontrado: !cu });
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
  // `productos` (ver _aplicarPreciosCatalogo()). Ver _precioPorMargenSobreVenta() más arriba.
  const precioSugeridoLista = _precioPorMargenSobreVenta(totalUnidad, c.margenLista);
  const precioSugeridoMinimo = _precioPorMargenSobreVenta(totalUnidad, c.margenMinimo);

  return {
    capacidadCochadaM3, unidadesBache, unidadesDia,
    materiaPrima, desperdicio, manoObra, herramientaMenor, maquinaria, empaque, consumos, totalUnidad,
    precioSugeridoLista, precioSugeridoMinimo,
    materiaPrimaDetalle, manoObraDetalle, maquinariaDetalle, empaqueDetalle, consumosDetalle,
    // Refuerzo/Otros son propios de Reforzado — en 0/vacío aquí para que el resto de la
    // pantalla (resumen, detalle, consolidado) pueda leerlos sin distinguir el tipo.
    refuerzo: 0, refuerzoDetalle: [], otros: 0, otrosDetalle: [],
  };
}

// ── Reforzado ──
// Cimentaciones, prelosas y demás piezas reforzadas: no hay "ciclos de máquina" (una pieza no
// sale en golpes de una máquina vibrocompactadora) — el rendimiento de producción es directo,
// unidades/día de la cuadrilla asignada. El volumen de concreto de cada pieza se deriva del
// Peso/unidad asumiendo una densidad estándar (no se pide un campo aparte), y la Materia Prima
// sale directo de la receta del Diseño de Mezcla × ese volumen — más simple que Vibrocompactado
// porque no depende de la capacidad de la mezcladora ni de "unidades/bache" (cada pieza se
// dosifica según lo que necesita, no según cuántas caben en una mezclada completa).
// Grounding real: Excel de costeo de producto "C3" (cimentación reforzada) que aportó el
// usuario 2026-08-14, y las respuestas de esa misma conversación sobre cómo tratar Acero/
// Alambre/Desmoldante/maquinaria por m³ — ver docs/modulos/costeo.md.
const DENSIDAD_CONCRETO_KG_M3 = 2450;

function _calcularCosteoReforzado(c) {
  const diseno = DISENOS_MEZCLA.find(d => d.codigo === c.disenoMezclaCodigo);
  const r = c.rendimiento || {};
  // Volumen es el dato real que se conoce de la pieza (viene de su diseño/geometría) — se
  // digita directo. El peso es el derivado (solo de referencia, no participa en ningún
  // cálculo), asumiendo la densidad estándar del concreto.
  const volumenUnidadM3 = r.volumenUnidadM3 || 0;
  const pesoEstimadoKg = volumenUnidadM3 * DENSIDAD_CONCRETO_KG_M3;
  const unidadesDia = r.unidadesDia || 0;

  const productoCosteo = CATALOGO.find(p => p.codigo === c.productoCodigo);
  const productoGeneraIva = productoCosteo?.iva === 'SI';

  // Materia Prima — cantidad por unidad = cantidad por m³ del Diseño × volumen real de la pieza.
  let materiaPrima = 0;
  const materiaPrimaDetalle = [];
  const m = diseno?.materiales || {};
  if (volumenUnidadM3 > 0) {
    _MATERIALES_COSTEO_PESO.forEach(k => {
      if (!((m[k] || 0) > 0)) return;
      const cantidad = (m[k] || 0) * volumenUnidadM3;
      const precio = _precioInsumoPorNombre(m[`${k}Producto`], productoGeneraIva, _UNIDAD_RECETA_MATERIAL[k]);
      const costo = cantidad * precio;
      materiaPrima += costo;
      materiaPrimaDetalle.push({ nombre: m[`${k}Producto`] || _LABEL_MAT_COSTEO[k], unidad: k === 'agua' ? 'L' : 'kg', cantidad, precio, costo, esCemento: k === 'cemento' });
    });
    (m.agregados || []).forEach(a => {
      if (!((Number(a.volumen) || 0) > 0)) return;
      const cantidad = (Number(a.volumen) || 0) * volumenUnidadM3;
      const precio = _precioInsumoPorNombre(a.producto, productoGeneraIva);
      const costo = cantidad * precio;
      materiaPrima += costo;
      materiaPrimaDetalle.push({ nombre: a.producto || _LABEL_ROL_AGREGADO_COSTEO[a.rolBase] || a.rolBase, unidad: 'm³', cantidad, precio, costo });
    });
    (m.adiciones || []).forEach(a => {
      if (!((Number(a.cantidad) || 0) > 0)) return;
      const cantidad = (Number(a.cantidad) || 0) * volumenUnidadM3;
      const precio = _precioInsumoPorNombre(a.producto, productoGeneraIva);
      const costo = cantidad * precio;
      materiaPrima += costo;
      materiaPrimaDetalle.push({ nombre: a.producto || 'Adición', unidad: 'kg', cantidad, precio, costo });
    });
    (m.aditivos || []).forEach(a => {
      if (!((Number(a.dosis) || 0) > 0)) return;
      const cantidad = (Number(a.dosis) || 0) * volumenUnidadM3;
      const precio = _precioInsumoPorNombre(a.producto, productoGeneraIva);
      const costo = cantidad * precio;
      materiaPrima += costo;
      materiaPrimaDetalle.push({ nombre: a.producto || a.tipo, unidad: 'kg', cantidad, precio, costo });
    });
  }
  const desperdicio = materiaPrima * ((c.pctDesperdicio || 0) / 100);

  // Refuerzo — Acero Figurado es una cantidad manual (depende de la geometría/complejidad real
  // de cada pieza, no se puede derivar de una fórmula genérica). Alambre Dulce sí se deriva: un
  // % del peso del Acero (editable, 2% por defecto) — a pedido del usuario, 2026-08-14. Los
  // precios salen del mismo "Acero Figurado"/"Alambre Dulce" de Costos de Referencia que ya
  // alimenta las varillas de acero calculadas (js/costeo-referencia.js); si el ítem no existe
  // ahí, el precio sale en 0 (mismo comportamiento que _precioInsumoPorNombre en cualquier otro
  // insumo no encontrado, sin alerta nueva).
  const cantidadAcero = r.aceroKgUnidad || 0;
  const precioAcero = _precioInsumoPorNombre('Acero Figurado', productoGeneraIva);
  const costoAcero = cantidadAcero * precioAcero;
  const pctAlambre = r.pctAlambre ?? 2;
  const cantidadAlambre = cantidadAcero * (pctAlambre / 100);
  const precioAlambre = _precioInsumoPorNombre('Alambre Dulce', productoGeneraIva);
  const costoAlambre = cantidadAlambre * precioAlambre;
  const refuerzo = costoAcero + costoAlambre;
  const refuerzoDetalle = [
    { nombre: 'Acero Figurado', unidad: 'kg', cantidad: cantidadAcero, precio: precioAcero, costo: costoAcero },
    { nombre: `Alambre Dulce (${pctAlambre}% del Acero)`, unidad: 'kg', cantidad: cantidadAlambre, precio: precioAlambre, costo: costoAlambre },
  ];

  // Mano de Obra — mismo patrón que Vibrocompactado: costo/día de cada cuadrilla ÷ unidades/día.
  let manoObra = 0;
  const manoObraDetalle = [];
  (c.manoObra || []).forEach(row => {
    const cu = CUADRILLAS_PRODUCTIVAS.find(x => x.nombre === row.nombre);
    const costoDia = cu ? _totalCuadrilla(cu).diario : 0;
    const costo = (cu && unidadesDia > 0) ? costoDia / unidadesDia : 0;
    manoObra += costo;
    manoObraDetalle.push({ nombre: row.nota ? `${row.nombre} — ${row.nota}` : row.nombre, costoDia, costo, noEncontrado: !cu });
  });
  const herramientaMenor = manoObra * ((c.pctHerramientaMenor || 0) / 100);

  // Maquinaria — cada máquina según su PROPIA unidad de uso: "día" ÷ unidades/día (grúa,
  // montacargas, minicargador — igual criterio que Vibrocompactado); "m³" × volumen de la pieza
  // (mezcladora, vibrador de aguja — máquinas que se cobran por m³ de concreto, no por día ni
  // por ciclo); "ciclo" directo, sin dividir (moldes: 1 uso del molde = 1 pieza producida —
  // Reforzado no tiene "unidades/ciclo" como Vibrocompactado).
  let maquinaria = 0;
  const maquinariaDetalle = [];
  (c.maquinas || []).forEach(row => {
    const maq = MAQUINARIA_EQUIPOS.find(x => x.nombre === row.nombre);
    if (!maq) { maquinariaDetalle.push({ nombre: row.nombre, unidadUso: '', costoUnidad: 0, costo: 0, noEncontrado: true }); return; }
    const costoUnidad = calcularCostoMaquina(maq).costoUnidad;
    let costo = 0;
    if (maq.unidadUso === 'dia' && unidadesDia > 0) costo = costoUnidad / unidadesDia;
    else if (maq.unidadUso === 'm3' && volumenUnidadM3 > 0) costo = costoUnidad * volumenUnidadM3;
    else if (maq.unidadUso === 'ciclo') costo = costoUnidad;
    maquinaria += costo;
    maquinariaDetalle.push({ nombre: row.nombre, unidadUso: _labelUnidadUso(maq.unidadUso), costoUnidad, costo });
  });

  // Insumos — "por día" (consumos: ensayos, combustible...) o "directo" (Desmoldante y
  // similares: la cantidad ya es por unidad, no se reparte) — acumulados en "Otros insumos",
  // separado de Empaque/Consumos porque no encaja en ninguna de esas dos categorías.
  let empaque = 0, consumos = 0, otros = 0;
  const empaqueDetalle = [], consumosDetalle = [], otrosDetalle = [];
  (c.insumos || []).forEach(row => {
    const ins = INSUMOS_COSTOS.find(x => x.nombre === row.nombre);
    if (!ins) return;
    const costoIns = calcularCostoInsumo(ins);
    const precio = productoGeneraIva ? costoIns.costoSinIva : costoIns.valorFinal;
    if (row.reparto === 'dia') {
      if (unidadesDia > 0) { const costo = (row.cantidad * precio) / unidadesDia; consumos += costo; consumosDetalle.push({ nombre: row.nombre, cantidad: row.cantidad, precio, costo }); }
    } else if (row.reparto === 'directo') {
      const costo = row.cantidad * precio;
      otros += costo;
      otrosDetalle.push({ nombre: row.nombre, cantidad: row.cantidad, precio, costo });
    } else {
      if (r.unidadesEstiba > 0) { const costo = (row.cantidad * precio) / r.unidadesEstiba; empaque += costo; empaqueDetalle.push({ nombre: row.nombre, cantidad: row.cantidad, precio, costo }); }
    }
  });

  const totalUnidad = materiaPrima + desperdicio + refuerzo + manoObra + herramientaMenor + maquinaria + empaque + consumos + otros;
  const precioSugeridoLista = _precioPorMargenSobreVenta(totalUnidad, c.margenLista);
  const precioSugeridoMinimo = _precioPorMargenSobreVenta(totalUnidad, c.margenMinimo);

  return {
    volumenUnidadM3, pesoEstimadoKg, unidadesDia,
    materiaPrima, desperdicio, refuerzo, manoObra, herramientaMenor, maquinaria, empaque, consumos, otros, totalUnidad,
    precioSugeridoLista, precioSugeridoMinimo,
    materiaPrimaDetalle, refuerzoDetalle, manoObraDetalle, maquinariaDetalle, empaqueDetalle, consumosDetalle, otrosDetalle,
  };
}

// ── Pretensado (viguetas, prelosas) ──
// Se produce por "Banco de Pretensado": una cama de tensionado de largo fijo (metros lineales/
// banco) donde se tensan varios hilos de acero, se vacía concreto una sola vez, se cura, se corta
// en piezas y se destensa. Todo lo que se gasta en esa colada (mano de obra, máquinas, energía)
// se reparte entre los metros lineales que rinde el banco — por eso el costeo es "por metro
// lineal" (ml), no "por unidad/pieza" como Vibrocompactado/Reforzado (los 12 productos reales,
// 5 viguetas + 7 prelosas, ya están en el catálogo con `unidad: 'ML'`, ver js/catalogo.js).
// Grounding real: Excel "COSTOS MAESTRO 2026_V2 para subir.xlsx", pestañas BD MEZCLA PRETENSADOS
// y FICHAS NUEVAS (categoría "PRETENSADOS", 475 filas) — verificado 2026-08-16 que las fórmulas
// de abajo reproducen exacto los $ de esa ficha para los 12 productos reales.
function _calcularCosteoPretensado(c) {
  const diseno = DISENOS_MEZCLA.find(d => d.codigo === c.disenoMezclaCodigo);
  const r = c.rendimiento || {};
  const volumenUnidadM3 = r.volumenUnidadM3 || 0;
  const metrosLinealesBanco = r.metrosLinealesBanco || 0;
  const hilosBanco = r.hilosBanco || 0;
  const longitudBrutaHilo = r.longitudBrutaHilo || 0;
  const bancosDiaLinea = r.bancosDiaLinea || 0;
  const unidadesDiaLinea = bancosDiaLinea * metrosLinealesBanco;

  const productoCosteo = CATALOGO.find(p => p.codigo === c.productoCodigo);
  const productoGeneraIva = productoCosteo?.iva === 'SI';

  // Materia Prima — idéntico criterio que Reforzado: cantidad por ml = cantidad por m³ del
  // Diseño × volumen real de concreto por ml (confirmado exacto contra el Excel).
  let materiaPrima = 0;
  const materiaPrimaDetalle = [];
  const m = diseno?.materiales || {};
  if (volumenUnidadM3 > 0) {
    _MATERIALES_COSTEO_PESO.forEach(k => {
      if (!((m[k] || 0) > 0)) return;
      const cantidad = (m[k] || 0) * volumenUnidadM3;
      const precio = _precioInsumoPorNombre(m[`${k}Producto`], productoGeneraIva, _UNIDAD_RECETA_MATERIAL[k]);
      const costo = cantidad * precio;
      materiaPrima += costo;
      materiaPrimaDetalle.push({ nombre: m[`${k}Producto`] || _LABEL_MAT_COSTEO[k], unidad: k === 'agua' ? 'L' : 'kg', cantidad, precio, costo, esCemento: k === 'cemento' });
    });
    (m.agregados || []).forEach(a => {
      if (!((Number(a.volumen) || 0) > 0)) return;
      const cantidad = (Number(a.volumen) || 0) * volumenUnidadM3;
      const precio = _precioInsumoPorNombre(a.producto, productoGeneraIva);
      const costo = cantidad * precio;
      materiaPrima += costo;
      materiaPrimaDetalle.push({ nombre: a.producto || _LABEL_ROL_AGREGADO_COSTEO[a.rolBase] || a.rolBase, unidad: 'm³', cantidad, precio, costo });
    });
    (m.adiciones || []).forEach(a => {
      if (!((Number(a.cantidad) || 0) > 0)) return;
      const cantidad = (Number(a.cantidad) || 0) * volumenUnidadM3;
      const precio = _precioInsumoPorNombre(a.producto, productoGeneraIva);
      const costo = cantidad * precio;
      materiaPrima += costo;
      materiaPrimaDetalle.push({ nombre: a.producto || 'Adición', unidad: 'kg', cantidad, precio, costo });
    });
    (m.aditivos || []).forEach(a => {
      if (!((Number(a.dosis) || 0) > 0)) return;
      const cantidad = (Number(a.dosis) || 0) * volumenUnidadM3;
      const precio = _precioInsumoPorNombre(a.producto, productoGeneraIva);
      const costo = cantidad * precio;
      materiaPrima += costo;
      materiaPrimaDetalle.push({ nombre: a.producto || a.tipo, unidad: 'kg', cantidad, precio, costo });
    });
  }
  const desperdicio = materiaPrima * ((c.pctDesperdicio || 0) / 100);

  // Refuerzo — Acero de Pretensionamiento: única cantidad que SÍ se puede derivar de una fórmula
  // exacta (a diferencia del Acero Figurado de Reforzado, que depende del diseño de cada pieza y
  // no se puede calcular solo). Cantidad = hilos tensados en el banco × longitud bruta de cada
  // hilo (incluye colas), repartido entre los metros lineales que rinde ese banco — confirmado
  // exacto contra el Excel real (vigueta H11 2H: 27 × 101 ÷ 840 = 3,246428571). El resto del
  // refuerzo (Resorte Loza, Alambre Dulce) no tiene fórmula — se cargan como Insumos normales
  // con reparto "Directo" (ver sección 6), igual que Reforzado hace con su Desmoldante.
  const cantidadAcero = metrosLinealesBanco > 0 ? (hilosBanco * longitudBrutaHilo) / metrosLinealesBanco : 0;
  const precioAcero = _precioInsumoPorNombre('Acero 5mm Pretensionamiento', productoGeneraIva);
  const costoAcero = cantidadAcero * precioAcero;
  const refuerzo = costoAcero;
  const refuerzoDetalle = cantidadAcero > 0
    ? [{ nombre: 'Acero de Pretensionamiento', unidad: 'm', cantidad: cantidadAcero, precio: precioAcero, costo: costoAcero }]
    : [];

  // Mano de Obra — cada cuadrilla real tiene su propio ritmo (Bobcat, Montacargas, Puente Grúa y
  // las cuadrillas de oficial+ayudantes NO avanzan igual de rápido; confirmado contra el Excel
  // que hasta cambia entre vigueta y prelosa para la misma cuadrilla) — por fila, "Bancos/día"
  // propio si se indica, si no hereda el de la línea.
  let manoObra = 0;
  const manoObraDetalle = [];
  (c.manoObra || []).forEach(row => {
    const cu = CUADRILLAS_PRODUCTIVAS.find(x => x.nombre === row.nombre);
    const costoDia = cu ? _totalCuadrilla(cu).diario : 0;
    const bancosDiaFila = row.bancosDiaFila || bancosDiaLinea;
    const unidadesDiaFila = bancosDiaFila * metrosLinealesBanco;
    const costo = (cu && unidadesDiaFila > 0) ? costoDia / unidadesDiaFila : 0;
    manoObra += costo;
    manoObraDetalle.push({ nombre: row.nota ? `${row.nombre} — ${row.nota}` : row.nombre, costoDia, costo, noEncontrado: !cu });
  });
  const herramientaMenor = manoObra * ((c.pctHerramientaMenor || 0) / 100);

  // Maquinaria — por defecto, un uso fijo por colada (÷ metros lineales/banco: Bancos de
  // Pretensado, Moldeadora, Cortadora, Pinza Sacadora, Gato de Destensionamiento — todas se usan
  // UNA vez por banco completo, sin importar cuántos hilos tenga). Tres excepciones reales:
  // "m³" escala con el volumen de concreto (mezcladora, vibrador de aguja, igual que Reforzado);
  // "día" tiene su propio rendimiento por fila igual que Mano de Obra (Bobcat, Montacargas,
  // Puente Grúa — confirmado que su ritmo real coincide con el de su operario); y la fila
  // marcada "× hilo" se usa una vez POR CADA hilo tensionado, no una vez por banco (único caso
  // real: Gato de Tensionamiento — confirmado exacto: 600 × 27 ÷ 840 = 19,285714).
  let maquinaria = 0;
  const maquinariaDetalle = [];
  (c.maquinas || []).forEach(row => {
    const maq = MAQUINARIA_EQUIPOS.find(x => x.nombre === row.nombre);
    if (!maq) { maquinariaDetalle.push({ nombre: row.nombre, unidadUso: '', costoUnidad: 0, costo: 0, noEncontrado: true }); return; }
    const costoUnidad = calcularCostoMaquina(maq).costoUnidad;
    let costo = 0;
    if (row.porHilo) costo = metrosLinealesBanco > 0 ? (costoUnidad * hilosBanco) / metrosLinealesBanco : 0;
    else if (maq.unidadUso === 'm3') costo = costoUnidad * volumenUnidadM3;
    else if (maq.unidadUso === 'dia') {
      const bancosDiaFila = row.bancosDiaFila || bancosDiaLinea;
      const unidadesDiaFila = bancosDiaFila * metrosLinealesBanco;
      costo = unidadesDiaFila > 0 ? costoUnidad / unidadesDiaFila : 0;
    } else costo = metrosLinealesBanco > 0 ? costoUnidad / metrosLinealesBanco : 0;
    maquinaria += costo;
    maquinariaDetalle.push({ nombre: row.nombre, unidadUso: _labelUnidadUso(maq.unidadUso), costoUnidad, costo });
  });

  // Insumos — mismo mecanismo ya existente (sección 6, compartida con los demás tipos):
  // "Por día" usa el rendimiento de línea (Energía, Agua, ACPM, Detergente, Ensayo de compresión,
  // Discos de corte); "Directo" para cantidades ya calculadas por ml (Resorte Loza, Alambre
  // Dulce). "Por estiba" no aplica a Pretensado (se vende por ml) pero queda disponible por si
  // algún producto puntual lo necesita.
  let empaque = 0, consumos = 0, otros = 0;
  const empaqueDetalle = [], consumosDetalle = [], otrosDetalle = [];
  (c.insumos || []).forEach(row => {
    const ins = INSUMOS_COSTOS.find(x => x.nombre === row.nombre);
    if (!ins) return;
    const costoIns = calcularCostoInsumo(ins);
    const precio = productoGeneraIva ? costoIns.costoSinIva : costoIns.valorFinal;
    if (row.reparto === 'dia') {
      if (unidadesDiaLinea > 0) { const costo = (row.cantidad * precio) / unidadesDiaLinea; consumos += costo; consumosDetalle.push({ nombre: row.nombre, cantidad: row.cantidad, precio, costo }); }
    } else if (row.reparto === 'directo') {
      const costo = row.cantidad * precio;
      otros += costo;
      otrosDetalle.push({ nombre: row.nombre, cantidad: row.cantidad, precio, costo });
    } else {
      if (r.unidadesEstiba > 0) { const costo = (row.cantidad * precio) / r.unidadesEstiba; empaque += costo; empaqueDetalle.push({ nombre: row.nombre, cantidad: row.cantidad, precio, costo }); }
    }
  });

  const totalUnidad = materiaPrima + desperdicio + refuerzo + manoObra + herramientaMenor + maquinaria + empaque + consumos + otros;
  const precioSugeridoLista = _precioPorMargenSobreVenta(totalUnidad, c.margenLista);
  const precioSugeridoMinimo = _precioPorMargenSobreVenta(totalUnidad, c.margenMinimo);

  return {
    volumenUnidadM3, metrosLinealesBanco, hilosBanco, longitudBrutaHilo, bancosDiaLinea,
    materiaPrima, desperdicio, refuerzo, manoObra, herramientaMenor, maquinaria, empaque, consumos, otros, totalUnidad,
    precioSugeridoLista, precioSugeridoMinimo,
    materiaPrimaDetalle, refuerzoDetalle, manoObraDetalle, maquinariaDetalle, empaqueDetalle, consumosDetalle, otrosDetalle,
  };
}

function _actualizarResumenCosteo() {
  const div = document.getElementById('costeo-resumen');
  if (!div) return;
  _actualizarPreviewDiseno();
  const c = _leerFormularioCosteo();
  const k = calcularCosteoProducto(c);
  const producto = _productoDesdeTextoCosteo(document.getElementById('m-costeo-producto').value);
  const esReforzado = c.tipoEstructura === 'reforzado';
  const esPretensado = c.tipoEstructura === 'pretensado';
  document.getElementById('costeo-calculo-vivo').innerHTML = esPretensado
    ? `<div class="fila"><span>Volumen de concreto / ml</span><span>${(k.volumenUnidadM3 || 0).toLocaleString('es-CO', { maximumFractionDigits: 4 })} m³</span></div>
       <div class="fila"><span>Metros lineales / banco</span><span>${(k.metrosLinealesBanco || 0).toLocaleString('es-CO')} ml</span></div>
       <div class="fila"><span>Hilos de pretensado / banco</span><span>${(k.hilosBanco || 0).toLocaleString('es-CO')}</span></div>
       <div class="fila"><span>Bancos / día (línea)</span><span>${(k.bancosDiaLinea || 0).toLocaleString('es-CO')}</span></div>`
    : esReforzado
    ? `<div class="fila"><span>Volumen de concreto por unidad</span><span>${(k.volumenUnidadM3 || 0).toLocaleString('es-CO', { maximumFractionDigits: 4 })} m³</span></div>
       <div class="fila sub"><span>≈ Peso equivalente (× 2450 kg/m³, solo de referencia)</span><span>${(k.pesoEstimadoKg || 0).toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg</span></div>
       <div class="fila"><span>Unidades / día</span><span>${k.unidadesDia.toLocaleString('es-CO')} unidades</span></div>`
    : `<div class="fila"><span>Capacidad de bache (de la mezcladora de la línea)</span><span>${k.capacidadCochadaM3.toLocaleString('es-CO')} m³</span></div>
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
    ${k.refuerzo > 0 ? `<div class="fila"><span>🔩 Refuerzo${esPretensado ? ' (Acero de Pretensionamiento)' : ' (Acero + Alambre)'}</span><span>${_fmtCosteoProd(k.refuerzo)}</span></div>` : ''}
    <div class="fila"><span>👷 Mano de Obra</span><span>${_fmtCosteoProd(k.manoObra)}</span></div>
    <div class="fila sub"><span>+ Herramienta Menor (${c.pctHerramientaMenor}%)</span><span>${_fmtCosteoProd(k.herramientaMenor)}</span></div>
    <div class="fila"><span>🔧 Maquinaria</span><span>${_fmtCosteoProd(k.maquinaria)}</span></div>
    <div class="fila"><span>📦 Insumos de empaque</span><span>${_fmtCosteoProd(k.empaque)}</span></div>
    <div class="fila"><span>⚡ Consumos (energía/agua/combustible)</span><span>${_fmtCosteoProd(k.consumos)}</span></div>
    ${k.otros > 0 ? `<div class="fila"><span>📎 Otros insumos</span><span>${_fmtCosteoProd(k.otros)}</span></div>` : ''}
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

// `filtro(c)` acota a los costeos que de verdad dependen de lo que se acaba de guardar — sin
// esto, cualquier costeo que ya estuviera desincronizado del catálogo por OTRO motivo (ej. un
// precio de catálogo cargado a mano en la semilla, distinto del costo real) aparecía como si lo
// hubiera causado el cambio actual, aunque no tuviera ninguna relación (bug real, reportado
// 2026-08-19: guardar un Diseño de Mezcla nuevo, sin usar todavía en ningún producto, mostraba
// "2 productos cambian de precio" de otros productos sin relación). Si no se pasa `filtro`, se
// revisan todos — usarlo siempre que se sepa qué costeos pueden verse afectados de verdad.
function _costeosAfectadosPorCambio(filtro) {
  return COSTEO_PRODUCTOS.filter(c => !filtro || filtro(c)).map(c => {
    const producto = CATALOGO.find(p => p.codigo === c.productoCodigo);
    if (!producto) return null;
    const k = calcularCosteoProducto(c);
    const listaNueva = Math.round(k.precioSugeridoLista);
    const minimoNueva = Math.round(k.precioSugeridoMinimo);
    if (listaNueva === (producto.lista || 0) && minimoNueva === (producto.minimo || 0)) return null;
    return { codigo: c.productoCodigo, nombre: c.productoNombre, listaActual: producto.lista || 0, listaNueva, minimoActual: producto.minimo || 0, minimoNueva };
  }).filter(Boolean);
}

// Un costeo "usa" un insumo si aparece directo en su tabla de Insumos, o indirecto vía el
// Diseño de Mezcla que tiene asignado (Cemento/Agua/Agregados/Adiciones/Aditivos), o vía los
// insumos hardcodeados de Refuerzo (Acero Figurado/Alambre Dulce en Reforzado, Acero 5mm
// Pretensionamiento en Pretensado — ver _calcularCosteoReforzado()/_calcularCosteoPretensado()).
// `nombres` es un arreglo porque un insumo renombrado hay que buscarlo por el nombre nuevo Y el
// anterior (los costeos ya guardados todavía referencian el nombre viejo hasta que alguien los
// vuelva a guardar).
function _costeoUsaInsumo(c, nombres) {
  if ((c.insumos || []).some(r => nombres.includes(r.nombre))) return true;
  const diseno = DISENOS_MEZCLA.find(d => d.codigo === c.disenoMezclaCodigo);
  const m = diseno?.materiales || {};
  if (nombres.includes(m.cementoProducto) || nombres.includes(m.aguaProducto)) return true;
  if ((m.agregados || []).some(a => nombres.includes(a.producto))) return true;
  if ((m.adiciones || []).some(a => nombres.includes(a.producto))) return true;
  if ((m.aditivos || []).some(a => nombres.includes(a.producto))) return true;
  if (c.tipoEstructura === 'reforzado' && (nombres.includes('Acero Figurado') || nombres.includes('Alambre Dulce'))) return true;
  if (c.tipoEstructura === 'pretensado' && nombres.includes('Acero 5mm Pretensionamiento')) return true;
  return false;
}

// Se llama al final de cada guardarX() que pueda mover un costo (insumo, máquina, cuadrilla,
// nivel salarial, diseño de mezcla) — si ningún costeo cambió de precio no muestra nada.
function _revisarImpactoPrecios(origenLabel, filtro) {
  const afectados = _costeosAfectadosPorCambio(filtro);
  if (!afectados.length) return;
  _impactoPreciosActual = afectados;
  document.getElementById('impacto-precios-origen').textContent = origenLabel;
  document.getElementById('impacto-precios-count').textContent = afectados.length;
  document.getElementById('impacto-precios-body').innerHTML = afectados.map(a => `
    <tr>
      <td style="font-weight:600">${_esc(a.nombre)}</td>
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
  // Orden manual (2026-08-21, a pedido del usuario, reemplaza el alfabético de antes) — se
  // aplica DESPUÉS del filtro de búsqueda/tipo, así que buscar/filtrar sigue funcionando igual.
  // COSTEO_PRODUCTOS ya llega ordenado por `orden` (_normalizarOrdenLista(), ver
  // js/datos-realtime.js) — Productos (js/catalogo.js, _ordenCosteo) hereda este mismo orden
  // porque lee directo del arreglo global, sin volver a ordenar por su cuenta.
  data.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><div class="icono">🏗️</div><div>No hay costeos de producto registrados.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(c => {
    const k = calcularCosteoProducto(c);
    const tipo = TIPOS_ESTRUCTURA_COSTEO[c.tipoEstructura] || TIPOS_ESTRUCTURA_COSTEO.vibrocompactado;
    const nombreEsc = _escNombreOnclick(c.productoCodigo);
    return `<tr ondragover="permitirSoltarCosteoProducto(event)" ondragleave="quitarResaltadoSoltarCosteoProducto(event)" ondrop="soltarCosteoProductoSobreCosteoProducto(event,'${nombreEsc}')">
      <td style="text-align:center"><span class="drag-handle" draggable="true" ondragstart="iniciarArrastreCosteoProducto(event,'${nombreEsc}')" ondragend="terminarArrastreCosteoProducto(event)" title="Arrastra para reordenar">☰</span></td>
      <td style="font-weight:600">${_esc(c.productoNombre)}</td>
      <td><span class="badge-tipo" style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:600;background:${tipo.bg};color:${tipo.fg}">${tipo.label}</span></td>
      <td style="text-align:right;font-weight:700;color:var(--azul)">${_fmtCosteoProd(k.totalUnidad)}</td>
      <td style="font-size:12px;color:var(--gris-medio)">${_esc(c.disenoMezclaCodigo) || '—'}</td>
      <td style="font-size:12px;color:var(--gris-medio)">${c._modificado ? new Date(c._modificado).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-secundario btn-xs" onclick="abrirDetalleCosteoProducto('${nombreEsc}')" title="Ver consolidado">➕</button>
          <button class="btn btn-primario btn-xs" onclick="editarCosteoProducto('${nombreEsc}')">✏️</button>
          <button class="btn btn-secundario btn-xs" onclick="duplicarCosteoProducto('${nombreEsc}')" title="Duplicar como base de un costeo nuevo">📋</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarCosteoProducto('${nombreEsc}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function _filtrarCosteoProductos() { renderCosteoProductos(); }

// ── Reordenar por arrastre (mismo patrón que Logística, ver js/config.js) — opera sobre
// COSTEO_PRODUCTOS completo, no la vista filtrada `data`, así que sigue siendo consistente
// aunque haya un buscador/filtro de tipo activo en ese momento. ──
let _costeoProductoArrastradoCodigo = null;
function iniciarArrastreCosteoProducto(event, codigo) {
  _costeoProductoArrastradoCodigo = codigo;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', codigo);
  event.currentTarget.closest('tr')?.classList.add('fila-arrastrando');
}
function terminarArrastreCosteoProducto(event) {
  event.currentTarget.closest('tr')?.classList.remove('fila-arrastrando');
  _costeoProductoArrastradoCodigo = null;
}
function permitirSoltarCosteoProducto(event) {
  if (!_costeoProductoArrastradoCodigo) return;
  event.preventDefault();
  event.currentTarget.classList.add('fila-dragover');
}
function quitarResaltadoSoltarCosteoProducto(event) {
  event.currentTarget.classList.remove('fila-dragover');
}
function soltarCosteoProductoSobreCosteoProducto(event, codigoDestino) {
  event.preventDefault();
  event.currentTarget.classList.remove('fila-dragover');
  if (!_costeoProductoArrastradoCodigo) return;
  const origen = _costeoProductoArrastradoCodigo;
  _costeoProductoArrastradoCodigo = null;
  const resultado = _reordenarPorArrastre(COSTEO_PRODUCTOS, origen, codigoDestino, x => x.productoCodigo,
    c => sb.from('costeo_productos').upsert({ producto_codigo: c.productoCodigo, datos: c, modificado: new Date().toISOString() }, { onConflict: 'producto_codigo' })
      .then(({ error }) => { if (error) console.error('Error guardando orden de costeo de producto:', error.message); }));
  renderCosteoProductos();
  return resultado;
}

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
  document.getElementById('m-costeo-volumen-unidad').value = '';
  document.getElementById('m-costeo-unidades-dia-reforzado').value = '';
  document.getElementById('m-costeo-acero-kg').value = '';
  document.getElementById('m-costeo-pct-alambre').value = 2;
  document.getElementById('m-costeo-volumen-unidad-pretensado').value = '';
  document.getElementById('m-costeo-metros-banco').value = '';
  document.getElementById('m-costeo-hilos-banco').value = '';
  document.getElementById('m-costeo-longitud-hilo').value = '';
  document.getElementById('m-costeo-bancos-dia').value = '';
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
  document.getElementById('m-costeo-volumen-unidad').value = r.volumenUnidadM3 || '';
  document.getElementById('m-costeo-unidades-dia-reforzado').value = r.unidadesDia || '';
  document.getElementById('m-costeo-acero-kg').value = r.aceroKgUnidad || '';
  document.getElementById('m-costeo-pct-alambre').value = r.pctAlambre ?? 2;
  document.getElementById('m-costeo-volumen-unidad-pretensado').value = r.volumenUnidadM3 || '';
  document.getElementById('m-costeo-metros-banco').value = r.metrosLinealesBanco || '';
  document.getElementById('m-costeo-hilos-banco').value = r.hilosBanco || '';
  document.getElementById('m-costeo-longitud-hilo').value = r.longitudBrutaHilo || '';
  document.getElementById('m-costeo-bancos-dia').value = r.bancosDiaLinea || '';
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

// Muchos productos comparten la misma estructura de costeo (mismas máquinas, misma mano de
// obra, mismos insumos) y solo cambian rendimiento/cantidades — "Duplicar" evita rearmar todo
// desde cero (2026-08-21, a pedido del usuario). Reutiliza TODO el prellenado de campos de
// editarCosteoProducto() (para no duplicar esa lógica) y solo corrige lo que lo distingue de
// una edición real: el producto de destino queda vacío (obligatorio elegir uno nuevo — el
// desplegable ya excluye productos con costeo, así que ni siquiera se puede duplicar encima
// del mismo producto de origen) y `codigo-anterior` queda vacío, para que guardarCosteoProducto()
// cree un registro NUEVO en vez de reemplazar el de origen (ver ese `if` más abajo).
function duplicarCosteoProducto(codigo) {
  const c = COSTEO_PRODUCTOS.find(x => x.productoCodigo === codigo);
  if (!c) return;
  editarCosteoProducto(codigo);
  document.getElementById('m-costeo-producto-codigo-anterior').value = '';
  document.getElementById('m-costeo-producto').value = '';
  document.getElementById('modal-costeo-producto-titulo').textContent = `🏗️ Nuevo Costeo de Producto (basado en ${c.productoNombre})`;
  document.getElementById('costeo-producto-sugerencias').style.display = 'none';
  // editarCosteoProducto() ya recalculó la vista en vivo con el producto de origen todavía
  // puesto — se vuelve a calcular ahora que el campo Producto quedó vacío, para que el aviso
  // de IVA y el resumen reflejen de una que falta elegir el producto nuevo.
  _actualizarResumenCosteo();
}

function guardarCosteoProducto() {
  const producto = _productoDesdeTextoCosteo(document.getElementById('m-costeo-producto').value);
  if (!producto) { alert('Selecciona un producto válido del catálogo (busca por código o nombre).'); return; }
  const tipoElegido = document.getElementById('m-costeo-tipo').value;
  if (tipoElegido !== 'vibrocompactado' && tipoElegido !== 'reforzado' && tipoElegido !== 'pretensado') { alert('Elige el tipo de estructura (por ahora solo Vibrocompactado, Reforzado y Pretensado están disponibles).'); return; }
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

// Compartido con el "Resolver duplicados" de Productos — borra un costeo sin pedir
// confirmación individual, porque ese flujo ya tiene su propia confirmación agregada.
function _borrarCosteoProductoDB(codigo) {
  COSTEO_PRODUCTOS = COSTEO_PRODUCTOS.filter(x => x.productoCodigo !== codigo);
  return sb.from('costeo_productos').delete().eq('producto_codigo', codigo);
}

function eliminarCosteoProducto(codigo) {
  const c = COSTEO_PRODUCTOS.find(x => x.productoCodigo === codigo);
  if (!c || !confirm(`¿Eliminar el costeo de "${c.productoNombre}"?`)) return;
  _borrarCosteoProductoDB(codigo).then(({ error }) => { if (error) console.error('Error eliminando costeo de producto:', error.message); });
  renderCosteoProductos();
}

// % que representa un costo frente al costo total por unidad del producto (2026-08-04, a
// pedido del usuario, para ver de un vistazo qué insumos pesan más en el costo).
function _pctCosteoProd(costo, totalUnidad) {
  if (!totalUnidad) return '—';
  return ((costo || 0) / totalUnidad * 100).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

// Fila de una tabla de detalle del consolidado: Nombre | Cantidad (con unidad) | Precio | Costo | % del costo total.
function _filaDetalleCosteo(nombre, cantidad, unidad, precio, costo, noEncontrado, totalUnidad) {
  const nombreHtml = noEncontrado ? `${_esc(nombre)} <span style="color:var(--rojo);font-size:11px">(ya no existe)</span>` : _esc(nombre);
  return `<tr>
    <td>${nombreHtml}</td>
    <td style="text-align:right;color:var(--gris-medio)">${cantidad != null ? cantidad.toLocaleString('es-CO', { maximumFractionDigits: 4 }) + (unidad ? ' ' + _esc(unidad) : '') : '—'}</td>
    <td style="text-align:right;color:var(--gris-medio)">${precio != null ? _fmtCosteoProd(precio) : '—'}</td>
    <td style="text-align:right;font-weight:700">${_fmtCosteoProd(costo)}</td>
    <td style="text-align:right;color:var(--gris-medio);font-size:12px">${_pctCosteoProd(costo, totalUnidad)}</td>
  </tr>`;
}

// Una sección con título + tabla de detalle (o un aviso si la lista viene vacía).
function _seccionDetalleCosteo(titulo, filasHtml, vacioTexto) {
  return `
    <div class="seccion-costeo">
      <div class="seccion-costeo-titulo">${titulo}</div>
      <table class="tabla-items" style="width:100%">
        <thead><tr><th>Insumo</th><th style="text-align:right;width:130px">Cantidad</th><th style="text-align:right;width:110px">Precio</th><th style="text-align:right;width:110px">Costo/unidad</th><th style="text-align:right;width:70px">% Costo</th></tr></thead>
        <tbody>${filasHtml || `<tr><td colspan="5" style="text-align:center;color:var(--gris-medio);font-size:12px">${vacioTexto}</td></tr>`}</tbody>
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
  const filasMP = k.materiaPrimaDetalle.map(f => _filaDetalleCosteo(f.nombre, f.cantidad, f.unidad, f.precio, f.costo, false, k.totalUnidad)).join('')
    + `<tr style="border-top:1px solid var(--gris-borde)"><td colspan="3" style="text-align:right;color:var(--gris-medio)">+ Desperdicio (${c.pctDesperdicio}%)</td><td style="text-align:right;font-weight:700">${_fmtCosteoProd(k.desperdicio)}</td><td style="text-align:right;color:var(--gris-medio);font-size:12px">${_pctCosteoProd(k.desperdicio, k.totalUnidad)}</td></tr>
       <tr style="font-weight:700"><td colspan="3" style="text-align:right">Subtotal Materia Prima</td><td style="text-align:right;color:var(--azul)">${_fmtCosteoProd(k.materiaPrima + k.desperdicio)}</td><td style="text-align:right;color:var(--azul);font-size:12px">${_pctCosteoProd(k.materiaPrima + k.desperdicio, k.totalUnidad)}</td></tr>`;
  const seccionMP = `<div style="font-size:11px;color:var(--gris-medio);margin:14px 0 -8px">${notaIvaDetalle}</div>` + _seccionDetalleCosteo('🧱 Materia Prima <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(por unidad de producto)</span>', filasMP, 'Sin Diseño de Mezcla o sin materiales con cantidad.');

  // Refuerzo — solo Reforzado/Pretensado (Vibrocompactado siempre trae refuerzoDetalle vacío).
  const seccionRef = k.refuerzoDetalle.length
    ? _seccionDetalleCosteo(`🔩 Refuerzo <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(${c.tipoEstructura === 'pretensado' ? 'Acero de Pretensionamiento' : 'Acero Figurado + Alambre Dulce'})</span>`,
        k.refuerzoDetalle.map(f => _filaDetalleCosteo(f.nombre, f.cantidad, f.unidad, f.precio, f.costo, false, k.totalUnidad)).join('')
        + `<tr style="font-weight:700;border-top:1px solid var(--gris-borde)"><td colspan="3" style="text-align:right">Subtotal Refuerzo</td><td style="text-align:right;color:var(--azul)">${_fmtCosteoProd(k.refuerzo)}</td><td style="text-align:right;color:var(--azul);font-size:12px">${_pctCosteoProd(k.refuerzo, k.totalUnidad)}</td></tr>`,
        'Sin refuerzo agregado.')
    : '';

  const filasMO = k.manoObraDetalle.map(f => _filaDetalleCosteo(f.nombre, null, null, f.costoDia ? f.costoDia : null, f.costo, f.noEncontrado, k.totalUnidad)).join('')
    + (k.manoObraDetalle.length ? `<tr style="border-top:1px solid var(--gris-borde)"><td colspan="3" style="text-align:right;color:var(--gris-medio)">+ Herramienta Menor (${c.pctHerramientaMenor}%)</td><td style="text-align:right;font-weight:700">${_fmtCosteoProd(k.herramientaMenor)}</td><td style="text-align:right;color:var(--gris-medio);font-size:12px">${_pctCosteoProd(k.herramientaMenor, k.totalUnidad)}</td></tr>
       <tr style="font-weight:700"><td colspan="3" style="text-align:right">Subtotal Mano de Obra</td><td style="text-align:right;color:var(--azul)">${_fmtCosteoProd(k.manoObra + k.herramientaMenor)}</td><td style="text-align:right;color:var(--azul);font-size:12px">${_pctCosteoProd(k.manoObra + k.herramientaMenor, k.totalUnidad)}</td></tr>` : '');
  const seccionMO = _seccionDetalleCosteo('👷 Mano de Obra <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(Precio = costo/día de la cuadrilla)</span>', filasMO, 'Sin cuadrillas agregadas.');

  const filasMaq = k.maquinariaDetalle.map(f => _filaDetalleCosteo(f.nombre, null, null, f.costoUnidad ? f.costoUnidad : null, f.costo, f.noEncontrado, k.totalUnidad)).join('')
    + (k.maquinariaDetalle.length ? `<tr style="font-weight:700;border-top:1px solid var(--gris-borde)"><td colspan="3" style="text-align:right">Subtotal Maquinaria</td><td style="text-align:right;color:var(--azul)">${_fmtCosteoProd(k.maquinaria)}</td><td style="text-align:right;color:var(--azul);font-size:12px">${_pctCosteoProd(k.maquinaria, k.totalUnidad)}</td></tr>` : '');
  const seccionMaq = _seccionDetalleCosteo('🔧 Maquinaria <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(Precio = costo/ciclo o costo/día de la máquina)</span>', filasMaq, 'Sin máquinas agregadas.');

  const filasEmp = k.empaqueDetalle.map(f => _filaDetalleCosteo(f.nombre, f.cantidad, null, f.precio, f.costo, false, k.totalUnidad)).join('')
    + (k.empaqueDetalle.length ? `<tr style="font-weight:700;border-top:1px solid var(--gris-borde)"><td colspan="3" style="text-align:right">Subtotal Empaque</td><td style="text-align:right;color:var(--azul)">${_fmtCosteoProd(k.empaque)}</td><td style="text-align:right;color:var(--azul);font-size:12px">${_pctCosteoProd(k.empaque, k.totalUnidad)}</td></tr>` : '');
  const seccionEmp = _seccionDetalleCosteo('📦 Insumos de empaque', filasEmp, 'Sin insumos de empaque.');

  const filasCons = k.consumosDetalle.map(f => _filaDetalleCosteo(f.nombre, f.cantidad, null, f.precio, f.costo, false, k.totalUnidad)).join('')
    + (k.consumosDetalle.length ? `<tr style="font-weight:700;border-top:1px solid var(--gris-borde)"><td colspan="3" style="text-align:right">Subtotal Consumos</td><td style="text-align:right;color:var(--azul)">${_fmtCosteoProd(k.consumos)}</td><td style="text-align:right;color:var(--azul);font-size:12px">${_pctCosteoProd(k.consumos, k.totalUnidad)}</td></tr>` : '');
  const seccionCons = _seccionDetalleCosteo('⚡ Consumos <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(energía/agua/combustible)</span>', filasCons, 'Sin consumos agregados.');

  // Otros insumos — reparto "directo" (Desmoldante y similares); solo aparece si hay filas.
  const seccionOtros = k.otrosDetalle.length
    ? _seccionDetalleCosteo('📎 Otros insumos <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(cantidad directa por unidad)</span>',
        k.otrosDetalle.map(f => _filaDetalleCosteo(f.nombre, f.cantidad, null, f.precio, f.costo, false, k.totalUnidad)).join('')
        + `<tr style="font-weight:700;border-top:1px solid var(--gris-borde)"><td colspan="3" style="text-align:right">Subtotal Otros insumos</td><td style="text-align:right;color:var(--azul)">${_fmtCosteoProd(k.otros)}</td><td style="text-align:right;color:var(--azul);font-size:12px">${_pctCosteoProd(k.otros, k.totalUnidad)}</td></tr>`,
        '')
    : '';

  return seccionMP + seccionRef + seccionMO + seccionMaq + seccionEmp + seccionCons + seccionOtros;
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

  const esReforzado = c.tipoEstructura === 'reforzado';
  const esPretensado = c.tipoEstructura === 'pretensado';

  document.getElementById('modal-detalle-costeo-titulo').textContent = `Consolidado — ${c.productoNombre}`;
  document.getElementById('detalle-costeo-resumen').innerHTML = esPretensado
    ? `<span>${tipo.label}</span>
       <span><strong>Diseño:</strong> ${diseno ? `${_esc(diseno.codigo)} — ${_esc(diseno.nombre)}` : (_esc(c.disenoMezclaCodigo) || '—')}</span>
       <span><strong>Metros lineales/banco:</strong> ${(r.metrosLinealesBanco || 0).toLocaleString('es-CO')}</span>
       <span><strong>Bancos/día:</strong> ${(r.bancosDiaLinea || 0).toLocaleString('es-CO')}</span>`
    : esReforzado
    ? `<span>${tipo.label}</span>
       <span><strong>Diseño:</strong> ${diseno ? `${_esc(diseno.codigo)} — ${_esc(diseno.nombre)}` : (_esc(c.disenoMezclaCodigo) || '—')}</span>
       <span><strong>Volumen/unidad:</strong> ${(k.volumenUnidadM3 || 0).toLocaleString('es-CO', { maximumFractionDigits: 4 })} m³</span>
       <span><strong>Unidades/día:</strong> ${k.unidadesDia.toLocaleString('es-CO')}</span>`
    : `<span>${tipo.label}</span>
       <span><strong>Diseño:</strong> ${diseno ? `${_esc(diseno.codigo)} — ${_esc(diseno.nombre)}` : (_esc(c.disenoMezclaCodigo) || '—')}</span>
       <span><strong>Unidades/Bache:</strong> ${(r.unidadesBache || 0).toLocaleString('es-CO')}</span>
       <span><strong>Unidades/día:</strong> ${k.unidadesDia.toLocaleString('es-CO')}</span>`;

  const seccionRendimiento = `
    <div class="seccion-costeo">
      <div class="seccion-costeo-titulo">Rendimiento de producción</div>
      <div class="caja-costeo">
        ${esPretensado ? `
        <div class="fila"><span>Volumen de concreto / ml <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(del diseño de la pieza)</span></span><span>${(r.volumenUnidadM3 || 0).toLocaleString('es-CO', { maximumFractionDigits: 4 })} m³</span></div>
        <div class="fila"><span>Metros lineales / banco</span><span>${(r.metrosLinealesBanco || 0).toLocaleString('es-CO')} ml</span></div>
        <div class="fila"><span>Hilos de pretensado / banco</span><span>${(r.hilosBanco || 0).toLocaleString('es-CO')}</span></div>
        <div class="fila"><span>Longitud bruta del hilo</span><span>${(r.longitudBrutaHilo || 0).toLocaleString('es-CO')} m</span></div>
        <div class="fila"><span>Bancos / día <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(rendimiento por defecto de la línea)</span></span><span>${(r.bancosDiaLinea || 0).toLocaleString('es-CO')}</span></div>` : esReforzado ? `
        <div class="fila"><span>Volumen de concreto / unidad <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(del diseño de la pieza)</span></span><span>${(r.volumenUnidadM3 || 0).toLocaleString('es-CO', { maximumFractionDigits: 4 })} m³</span></div>
        <div class="fila sub"><span>≈ Peso equivalente (× 2450 kg/m³, solo de referencia)</span><span>${(k.pesoEstimadoKg || 0).toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg</span></div>
        <div class="fila"><span>Unidades / día</span><span>${(r.unidadesDia || 0).toLocaleString('es-CO')}</span></div>
        <div class="fila"><span>Acero Figurado / unidad</span><span>${(r.aceroKgUnidad || 0).toLocaleString('es-CO')} kg</span></div>
        <div class="fila"><span>% Alambre Dulce</span><span>${(r.pctAlambre ?? 2).toLocaleString('es-CO')}%</span></div>` : `
        <div class="fila"><span>Peso / unidad <span style="font-weight:400;text-transform:none;color:var(--gris-medio)">(informativo)</span></span><span>${(r.pesoUnidadKg || 0).toLocaleString('es-CO')} kg</span></div>
        <div class="fila"><span>Ciclos / día</span><span>${(r.ciclosDia || 0).toLocaleString('es-CO')}</span></div>
        <div class="fila"><span>Unidades / Ciclo</span><span>${(r.unidadesCiclo || 0).toLocaleString('es-CO')}</span></div>
        <div class="fila"><span>Unidades / Bache</span><span>${(r.unidadesBache || 0).toLocaleString('es-CO')}</span></div>`}
        ${esPretensado ? '' : `<div class="fila"><span>Unidades / estiba</span><span>${(r.unidadesEstiba || 0).toLocaleString('es-CO')}</span></div>`}
      </div>
    </div>`;

  const seccionTotal = `
    <div class="seccion-costeo">
      <div class="seccion-costeo-titulo">Resumen — costo por unidad</div>
      <div class="caja-costeo caja-costeo-resumen">
        <div class="fila"><span>🧱 Materia Prima</span><span>${_fmtCosteoProd(k.materiaPrima)}</span></div>
        <div class="fila sub"><span>+ Desperdicio (${c.pctDesperdicio}%)</span><span>${_fmtCosteoProd(k.desperdicio)}</span></div>
        ${k.refuerzo > 0 ? `<div class="fila"><span>🔩 Refuerzo</span><span>${_fmtCosteoProd(k.refuerzo)}</span></div>` : ''}
        <div class="fila"><span>👷 Mano de Obra</span><span>${_fmtCosteoProd(k.manoObra)}</span></div>
        <div class="fila sub"><span>+ Herramienta Menor (${c.pctHerramientaMenor}%)</span><span>${_fmtCosteoProd(k.herramientaMenor)}</span></div>
        <div class="fila"><span>🔧 Maquinaria</span><span>${_fmtCosteoProd(k.maquinaria)}</span></div>
        <div class="fila"><span>📦 Insumos de empaque</span><span>${_fmtCosteoProd(k.empaque)}</span></div>
        <div class="fila"><span>⚡ Consumos</span><span>${_fmtCosteoProd(k.consumos)}</span></div>
        ${k.otros > 0 ? `<div class="fila"><span>📎 Otros insumos</span><span>${_fmtCosteoProd(k.otros)}</span></div>` : ''}
        <div class="fila fila-total"><span>Costo total por unidad</span><span>${_fmtCosteoProd(k.totalUnidad)}</span></div>
      </div>
    </div>`;

  document.getElementById('detalle-costeo-contenido').innerHTML = seccionRendimiento + _seccionesDetalleCosteo(c, k) + seccionTotal;

  const producto = CATALOGO.find(p => p.codigo === c.productoCodigo);
  _pintarPrecioSugerido('detalle-costeo-precio', c, k, producto);
  document.getElementById('detalle-costeo-btn-aplicar').onclick = () => aplicarPreciosCatalogoDesdeDetalle(codigo);
  document.getElementById('modal-detalle-costeo').classList.add('abierto');
}

// Cemento teórico (kg) por unidad de un producto, según su Costeo de Producto guardado —
// usado por Producción Diaria para comparar el consumo real de cemento contra este teórico
// (control de consumo por producto, 2026-08-19). `null` si el producto no existe o no tiene
// Costeo de Producto guardado — no es un error, simplemente no hay con qué comparar todavía.
function _cementoTeoricoPorUnidad(productoNombre) {
  const prod = CATALOGO.find(p => p.nombre === productoNombre);
  if (!prod) return null;
  const costeo = COSTEO_PRODUCTOS.find(c => c.productoCodigo === prod.codigo);
  if (!costeo) return null;
  const k = calcularCosteoProducto(costeo);
  const filaCemento = k.materiaPrimaDetalle.find(f => f.esCemento);
  return filaCemento ? filaCemento.cantidad : null;
}
