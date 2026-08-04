// ═══════════════════════════════
// CALIDAD — AJUSTE DIARIO DE MEZCLA (CORRECCIÓN DE HUMEDAD)
// ═══════════════════════════════
let AJUSTES_MEZCLA = [];
let _clientesAdicionalesAjuste = [];

// Normaliza un ajuste recién cargado: si no trae `agregados` (formato viejo, de antes de
// 2026-08-02, cuando Diseño de Mezcla solo permitía una Arena y un Triturado Grueso fijos),
// lo sintetiza a partir de los campos viejos `a.arena`/`a.triturado`/`a.materiales.arena`/
// `a.materiales.triturado` — así el resto del código (este archivo, Trazabilidad) siempre
// puede asumir que `agregados` existe, sin importar cuándo se guardó el ajuste. Un ajuste
// histórico real de producción NUNCA se debe perder ni cambiar de valor por esta migración.
function _normalizarAjuste(a) {
  if (!a) return a;
  if (!Array.isArray(a.agregados)) {
    const agregados = [];
    if (a.arena) agregados.push({ rolBase: 'arena', producto: '', pesoRecipiente: a.arena.pesoRecipiente || 0, pesoHumedo: a.arena.pesoHumedo || 0, pesoSeco: a.arena.pesoSeco || 0, absorcion: a.arena.absorcion || 0, disenoCantidad: a.materiales?.arena?.diseno || 0, humedad: a.humedadArena || 0, ajustada: a.materiales?.arena?.ajustada || 0, unidad: 'kg' });
    if (a.triturado) agregados.push({ rolBase: 'grava', producto: '', pesoRecipiente: a.triturado.pesoRecipiente || 0, pesoHumedo: a.triturado.pesoHumedo || 0, pesoSeco: a.triturado.pesoSeco || 0, absorcion: a.triturado.absorcion || 0, disenoCantidad: a.materiales?.triturado?.diseno || 0, humedad: a.humedadTriturado || 0, ajustada: a.materiales?.triturado?.ajustada || 0, unidad: 'kg' });
    a.agregados = agregados;
  }
  return a;
}

// Un mismo ajuste (misma mezcla, mismo cilindro) a veces se fabrica para varios
// clientes/proyectos a la vez; esta tabla solo aparece cuando hay más de un cliente.
function renderClientesAdicionalesAjuste() {
  const wrap = document.getElementById('clientes-adicionales-ajuste-wrap');
  if (!wrap) return;
  if (!_clientesAdicionalesAjuste.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
    <table class="tabla-items" style="width:100%">
      <thead><tr><th>Cliente adicional</th><th>Proyecto</th><th style="width:36px"></th></tr></thead>
      <tbody>
        ${_clientesAdicionalesAjuste.map((c, i) => `
          <tr>
            <td>
              <div class="buscador-cliente" style="position:relative">
                <input type="text" id="cliente-adicional-input-${i}" value="${c.cliente || ''}" title="${c.cliente || ''}" oninput="filtrarClienteAdicionalAjuste(${i})" placeholder="Busca un cliente existente...">
                <div id="cliente-adicional-resultados-${i}" style="display:none;position:absolute;z-index:60;left:0;right:0;margin-top:2px;border:1.5px solid #93C5FD;border-radius:8px;background:#fff;max-height:200px;overflow-y:auto;box-shadow:var(--sombra-md)"></div>
              </div>
            </td>
            <td><select id="cliente-adicional-proyecto-${i}" onchange="_clientesAdicionalesAjuste[${i}].proyecto=this.value" style="width:100%;padding:5px 7px;border:1px solid var(--gris-borde);border-radius:4px;font-size:12px"></select></td>
            <td><button class="btn btn-rojo btn-xs" onclick="eliminarClienteAdicionalAjuste(${i})">✕</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  _clientesAdicionalesAjuste.forEach((c, i) => {
    poblarSelectProyectosDeCliente(`cliente-adicional-proyecto-${i}`, c.cliente);
    const sel = document.getElementById(`cliente-adicional-proyecto-${i}`);
    if (sel && c.proyecto) sel.value = c.proyecto;
  });
}

function _alCambiarClienteAdicionalAjuste(i) {
  poblarSelectProyectosDeCliente(`cliente-adicional-proyecto-${i}`, _clientesAdicionalesAjuste[i].cliente);
  _clientesAdicionalesAjuste[i].proyecto = ''; // el proyecto anterior puede no existir para el nuevo cliente
}

// Buscador de cliente propio para cada fila de clientes adicionales — mismo motivo y patrón
// que filtrarClienteAjuste()/filtrarClienteEntrega() (ver ahí el porqué de no usar <datalist>).
function filtrarClienteAdicionalAjuste(i) {
  const inputEl = document.getElementById(`cliente-adicional-input-${i}`);
  const div = document.getElementById(`cliente-adicional-resultados-${i}`);
  if (!inputEl || !div) return;
  inputEl.title = inputEl.value;
  _clientesAdicionalesAjuste[i].cliente = inputEl.value;
  _alCambiarClienteAdicionalAjuste(i);
  const q = inputEl.value.toLowerCase().trim();
  if (q.length < 2) { div.style.display = 'none'; return; }
  const res = CLIENTES.filter(c => c.nombre.toLowerCase().includes(q)).slice(0, 18);
  div.innerHTML = res.length
    ? res.map(c => `
      <div data-cliente="${_esc(c.nombre)}" onclick="elegirClienteAdicionalAjuste(${i},this.dataset.cliente)" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9" onmouseover="this.style.background='#EFF6FF'" onmouseout="this.style.background=''">
        <div style="font-weight:600;font-size:13px;color:#1e293b">${_esc(c.nombre)}</div>
      </div>`).join('')
    : '<div style="padding:10px 14px;color:#888;font-size:12px">Sin resultados para esta búsqueda.</div>';
  div.style.display = 'block';
}

function elegirClienteAdicionalAjuste(i, nombre) {
  const inputEl = document.getElementById(`cliente-adicional-input-${i}`);
  if (inputEl) { inputEl.value = nombre; inputEl.title = nombre; }
  _clientesAdicionalesAjuste[i].cliente = nombre;
  _alCambiarClienteAdicionalAjuste(i);
  const div = document.getElementById(`cliente-adicional-resultados-${i}`);
  if (div) div.style.display = 'none';
}

function agregarClienteAdicionalAjuste() {
  _clientesAdicionalesAjuste.push({ cliente: '', proyecto: '' });
  renderClientesAdicionalesAjuste();
}

function eliminarClienteAdicionalAjuste(i) {
  _clientesAdicionalesAjuste.splice(i, 1);
  renderClientesAdicionalesAjuste();
}

// Buscador de cliente propio para el campo Cliente principal de Ajuste Diario, en vez del
// <datalist> nativo del navegador — el datalist filtra distinto según el navegador y en
// muchos casos solo busca desde el INICIO del nombre, no por cualquier fragmento (bug real
// reportado: escribir un fragmento del nombre no filtraba nada). Mismo patrón que el
// buscador de producto de Nueva Cotización / Logística.
function filtrarClienteAjuste() {
  const inputEl = document.getElementById('m-ajuste-cliente');
  const div = document.getElementById('m-ajuste-cliente-resultados');
  if (!inputEl || !div) return;
  inputEl.title = inputEl.value;
  _alCambiarClienteAjuste();
  const q = inputEl.value.toLowerCase().trim();
  if (q.length < 2) { div.style.display = 'none'; return; }
  const res = CLIENTES.filter(c => c.nombre.toLowerCase().includes(q)).slice(0, 18);
  div.innerHTML = res.length
    ? res.map(c => `
      <div data-cliente="${_esc(c.nombre)}" onclick="elegirClienteAjuste(this.dataset.cliente)" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9" onmouseover="this.style.background='#EFF6FF'" onmouseout="this.style.background=''">
        <div style="font-weight:600;font-size:13px;color:#1e293b">${_esc(c.nombre)}</div>
      </div>`).join('')
    : '<div style="padding:10px 14px;color:#888;font-size:12px">Sin resultados para esta búsqueda.</div>';
  div.style.display = 'block';
}

function elegirClienteAjuste(nombre) {
  const inputEl = document.getElementById('m-ajuste-cliente');
  if (inputEl) { inputEl.value = nombre; inputEl.title = nombre; }
  _alCambiarClienteAjuste();
  const div = document.getElementById('m-ajuste-cliente-resultados');
  if (div) div.style.display = 'none';
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.buscador-cliente')) {
    document.querySelectorAll('#m-ajuste-cliente-resultados, [id^="cliente-adicional-resultados-"]').forEach(d => { d.style.display = 'none'; });
  }
});

function _clienteValidoAjuste(nombre) {
  const t = (nombre || '').trim();
  if (!t) return true; // el campo es opcional; solo se valida si se llenó
  return CLIENTES.some(c => c.nombre.trim().toLowerCase() === t.toLowerCase());
}

// Trazabilidad Cliente → Proyecto: el proyecto ya NO se escribe a mano en ningún lado del
// aplicativo (Logística ni Calidad) — se elige de los proyectos que ese cliente tiene
// registrados (cliente.proyectos, ver "+ Agregar proyecto" en el modal de Cliente), para no
// terminar con el mismo proyecto escrito de formas distintas en cada módulo. El desplegable
// queda deshabilitado hasta que el texto del campo Cliente coincida con un cliente real.
function poblarSelectProyectosDeCliente(selectId, nombreCliente) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const cliente = CLIENTES.find(c => c.nombre.trim().toLowerCase() === (nombreCliente || '').trim().toLowerCase());
  if (!cliente) {
    sel.disabled = true;
    sel.innerHTML = '<option value="">Elige primero un cliente válido...</option>';
    return;
  }
  const proyectos = cliente.proyectos || [];
  if (!proyectos.length) {
    sel.disabled = true;
    sel.innerHTML = '<option value="">Este cliente no tiene proyectos registrados — agrégalo en Clientes</option>';
    return;
  }
  sel.disabled = false;
  sel.innerHTML = '<option value="">Elige un proyecto...</option>' + proyectos.map(p => `<option value="${_esc(p.nombre)}">${_esc(p.nombre)}</option>`).join('');
}

let _productosAdicionalesAjuste = []; // cada entrada es el texto tecleado "CODIGO — Nombre"

// Un mismo lote de mezcla a veces alimenta varios moldes/productos distintos a la vez;
// solo se permiten productos que compartan el mismo Diseño de Mezcla que el producto
// principal, para no mezclar sin querer dos diseños distintos en un mismo ajuste.
function renderProductosAdicionalesAjuste() {
  const wrap = document.getElementById('productos-adicionales-ajuste-wrap');
  if (!wrap) return;
  if (!_productosAdicionalesAjuste.length) { wrap.innerHTML = ''; return; }
  const disenoActual = document.getElementById('m-ajuste-diseno').value;
  const compatibles = PRODUCTOS.filter(p => p.disenoMezcla === disenoActual);
  wrap.innerHTML = `
    <table class="tabla-items" style="width:100%">
      <thead><tr><th>Producto adicional (mismo diseño de mezcla)</th><th style="width:36px"></th></tr></thead>
      <tbody>
        ${_productosAdicionalesAjuste.map((texto, i) => `
          <tr>
            <td><input type="text" value="${texto}" list="datalist-productos-adicionales-ajuste" oninput="_productosAdicionalesAjuste[${i}]=this.value" placeholder="Busca por código o nombre..."></td>
            <td><button class="btn btn-rojo btn-xs" onclick="eliminarProductoAdicionalAjuste(${i})">✕</button></td>
          </tr>`).join('')}
      </tbody>
    </table>
    <datalist id="datalist-productos-adicionales-ajuste">${compatibles.map(p => `<option value="${_textoProducto(p)}">`).join('')}</datalist>`;
}

function agregarProductoAdicionalAjuste() {
  if (!document.getElementById('m-ajuste-diseno').value) {
    alert('Primero elige el Producto a fabricar principal, para saber qué Diseño de Mezcla aplica.');
    return;
  }
  _productosAdicionalesAjuste.push('');
  renderProductosAdicionalesAjuste();
}

function eliminarProductoAdicionalAjuste(i) {
  _productosAdicionalesAjuste.splice(i, 1);
  renderProductosAdicionalesAjuste();
}

// Agrega un <option> a un <select> si el valor aún no existe entre sus opciones.
// Compara por igualdad de valores en JS (no arma selectores CSS) para no romperse
// con valores que contienen comillas, como 3/4", 1/2", etc.
function agregarOpcionSiNoExiste(selectId, valor) {
  if (!valor) return;
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const yaExiste = [...sel.options].some(o => o.value === valor);
  if (!yaExiste) {
    const opt = document.createElement('option');
    opt.value = valor; opt.textContent = valor;
    sel.appendChild(opt);
  }
}

// Nombre del cliente principal de un ajuste, con respaldo al campo viejo "clienteElemento"
// (registros guardados antes de separar Cliente/Proyecto), y aviso si hay clientes adicionales.
// OJO: NO escapar acá adentro — _textoCilindroEnsayo() reutiliza este texto para el
// <option value> del datalist de cilindros y hace match exacto por string contra lo que el
// navegador devuelve ya decodificado; si esta función escapara, esa comparación se rompería
// para cualquier cliente con &/</>/comillas en el nombre. El escape va en cada sitio donde
// esto se pinta como HTML de solo lectura (ver renderAjustesMezcla()).
function _clienteResumenAjuste(a) {
  const principal = a.cliente || a.clienteElemento || '';
  const extra = (a.clientesAdicionales || []).length;
  if (!principal && !extra) return '';
  return principal + (extra ? ` (+${extra} más)` : '');
}

// Nombre del producto principal de un ajuste, con aviso si se aprovechó la misma
// mezcla para fabricar productos adicionales al tiempo.
function _productoResumenAjuste(a) {
  const principal = a.productoNombre || '';
  const extra = (a.productosAdicionales || []).length;
  if (!principal && !extra) return '';
  return _esc(principal) + (extra ? ` (+${extra} más)` : '');
}

function siguienteCilindroNo() {
  const nums = AJUSTES_MEZCLA.map(a => parseInt(a.cilindroNo) || 0);
  return nums.length ? Math.max(...nums) + 1 : '';
}

function calcularHumedadAgregado(pesoRecipiente, pesoHumedo, pesoSeco) {
  const denom = pesoSeco - pesoRecipiente;
  if (!denom) return 0;
  return ((pesoHumedo - pesoSeco) / denom) * 100;
}

// Clientes y proyectos de un ajuste (cliente/proyecto principal + adicionales) — mismo patrón
// que _clientesProyectosEnsayo() en calidad-mezclas.js, para los filtros del histórico.
function _clientesProyectosAjuste(a) {
  const clientes = new Set(), proyectos = new Set();
  const principal = a.cliente || a.clienteElemento || '';
  if (principal) clientes.add(principal);
  if (a.proyecto) proyectos.add(a.proyecto);
  (a.clientesAdicionales || []).forEach(c => { if (c.cliente) clientes.add(c.cliente); if (c.proyecto) proyectos.add(c.proyecto); });
  return { clientes: [...clientes], proyectos: [...proyectos] };
}

// Puebla los desplegables de Cliente/Proyecto/Resistencia con los valores que de verdad
// aparecen en el histórico — mismo patrón que poblarFiltrosEnsayosLista() en calidad-mezclas.js.
function poblarFiltrosAjustesLista() {
  const selCliente = document.getElementById('ajustes-filtro-cliente');
  const selProyecto = document.getElementById('ajustes-filtro-proyecto');
  const selResistencia = document.getElementById('ajustes-filtro-resistencia');
  if (!selCliente || !selProyecto || !selResistencia) return;

  const clientes = new Set(), proyectos = new Set();
  AJUSTES_MEZCLA.forEach(a => {
    const ctx = _clientesProyectosAjuste(a);
    ctx.clientes.forEach(c => clientes.add(c));
    ctx.proyectos.forEach(p => proyectos.add(p));
  });
  const prevCliente = selCliente.value, prevProyecto = selProyecto.value;
  selCliente.innerHTML = '<option value="">Todos los clientes</option>' +
    [...clientes].sort().map(c => `<option value="${c}">${c}</option>`).join('');
  selProyecto.innerHTML = '<option value="">Todos los proyectos</option>' +
    [...proyectos].sort().map(p => `<option value="${p}">${p}</option>`).join('');
  if (prevCliente) selCliente.value = prevCliente;
  if (prevProyecto) selProyecto.value = prevProyecto;

  const disenosConAjuste = [...new Set(AJUSTES_MEZCLA.map(a => a.disenoCodigo).filter(Boolean))]
    .map(c => DISENOS_MEZCLA.find(d => d.codigo === c) || { codigo: c, nombre: '' })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const prevResistencia = selResistencia.value;
  selResistencia.innerHTML = '<option value="">Todas las resistencias</option>' +
    disenosConAjuste.map(d => `<option value="${d.codigo}">${d.codigo}${d.nombre ? ' — ' + d.nombre : ''}</option>`).join('');
  if (prevResistencia) selResistencia.value = prevResistencia;
}

// Aplica los filtros de la pantalla de Ajuste Diario (búsqueda, cliente, proyecto, resistencia)
// — mismo patrón que _ensayosFiltrados() en calidad-mezclas.js.
function _ajustesFiltrados() {
  const q = (document.getElementById('buscar-ajuste')?.value || '').toLowerCase();
  const fCliente = document.getElementById('ajustes-filtro-cliente')?.value || '';
  const fProyecto = document.getElementById('ajustes-filtro-proyecto')?.value || '';
  const fResistencia = document.getElementById('ajustes-filtro-resistencia')?.value || '';
  let data = [...AJUSTES_MEZCLA];
  if (q) data = data.filter(a => (String(a.cilindroNo) + ' ' + (a.cliente || a.clienteElemento || '') + ' ' + (a.proyecto || '') + ' ' + (a.disenoCodigo || '')).toLowerCase().includes(q));
  if (fCliente) data = data.filter(a => _clientesProyectosAjuste(a).clientes.includes(fCliente));
  if (fProyecto) data = data.filter(a => _clientesProyectosAjuste(a).proyectos.includes(fProyecto));
  if (fResistencia) data = data.filter(a => a.disenoCodigo === fResistencia);
  data.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (Number(b.cilindroNo) || 0) - (Number(a.cilindroNo) || 0));
  return data;
}

function renderAjustesMezcla() {
  const tbody = document.getElementById('ajustes-body');
  if (!tbody) return;
  poblarFiltrosAjustesLista();
  const data = _ajustesFiltrados();

  if (!data.length) {
    const hayFiltros = document.getElementById('buscar-ajuste')?.value || document.getElementById('ajustes-filtro-cliente')?.value || document.getElementById('ajustes-filtro-proyecto')?.value || document.getElementById('ajustes-filtro-resistencia')?.value;
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state"><div class="icono">🌡️</div><div>${hayFiltros ? 'No hay ajustes que coincidan con los filtros seleccionados.' : 'No hay ajustes diarios registrados.'}</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(a => {
    const revision = _proximaRevisionDiseno(a.disenoCodigo, a.fecha);
    const notaRevision = revision
      ? `<span title="Diseño revisado el ${new Date(revision.fecha + 'T12:00').toLocaleDateString('es-CO')}${revision.modificadoPor ? ' por ' + _esc(USUARIOS_CRM[revision.modificadoPor]?.nombre || revision.modificadoPor) : ''} — este ajuste usa la versión anterior de la receta." style="cursor:help;margin-left:5px">🔄</span>`
      : '';
    return `
    <tr style="border-top:2px solid var(--azul-oscuro)">
      <td style="font-weight:700;color:var(--azul)">${_esc(a.cilindroNo)}</td>
      <td>${a.fecha ? new Date(a.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${a.disenoCodigo ? `<span style="font-size:11px;background:var(--gris-borde);color:#333;padding:2px 6px;border-radius:3px;font-weight:600">${_esc(a.disenoCodigo)}</span>` : '—'}${notaRevision}</td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${_esc(_clienteResumenAjuste(a))}">${_esc(_clienteResumenAjuste(a)) || '—'}</td>
      <td>${_esc(USUARIOS_CRM[a.creadoPor]?.nombre || a.creadoPor) || '—'}</td>
      <td style="text-align:center">${a.resistenciaDiseno || '—'} MPa</td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${_productoResumenAjuste(a)}">${_productoResumenAjuste(a) || '—'}</td>
      <td>${_esc(a.proyecto) || '—'}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-secundario btn-xs" onclick="verFormatoProduccionAjuste('${a.id}')">🖨️ Formato</button>
          <button class="btn btn-primario btn-xs" onclick="editarAjusteMezcla('${a.id}')">✏️ Editar</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarAjusteMezcla('${a.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function _textoProducto(p) { return `${p.codigo} — ${p.nombre}`; }

// El catálogo tiene demasiados productos para un <select> plano, así que se usa un
// <input> de texto libre con <datalist> — permite buscar por código o por nombre.
function poblarDatalistProductos(datalistId) {
  const dl = document.getElementById(datalistId);
  if (!dl) return;
  const activos = [...PRODUCTOS].sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nombre.localeCompare(b.nombre));
  dl.innerHTML = activos.map(p => `<option value="${_textoProducto(p)}">`).join('');
}

function _productoDesdeTextoAjuste(texto) {
  const t = (texto || '').trim();
  if (!t) return null;
  return PRODUCTOS.find(p => _textoProducto(p) === t) || null;
}

// Reinicia los campos que dependen del diseño de mezcla (se usa cuando el producto
// elegido no tiene diseño asignado, para no dejar en pantalla datos de un producto anterior).
function _limpiarCamposDisenoAjuste() {
  ['m-ajuste-resistencia', 'm-ajuste-tamano',
    'm-ajuste-mat-agua', 'm-ajuste-mat-cemento', 'm-ajuste-mat-adicion', 'm-ajuste-mat-plastificante', 'm-ajuste-mat-acelerante'
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = id.includes('tamano') ? '' : 0; });
  _agregadosAjusteActual = [];
  recalcularAjusteMezcla();
}

function cargarDesdeProducto() {
  const disenoSelect = document.getElementById('m-ajuste-diseno');
  // Cambiar el producto principal invalida los productos adicionales que se
  // hubieran agregado (podían depender de un diseño de mezcla distinto).
  _productosAdicionalesAjuste = [];
  const producto = _productoDesdeTextoAjuste(document.getElementById('m-ajuste-producto').value);
  if (!producto) { disenoSelect.value = ''; _limpiarCamposDisenoAjuste(); renderProductosAdicionalesAjuste(); return; }
  const codigoDiseno = producto.disenoMezcla;
  if (!codigoDiseno) {
    alert(`⚠️ El producto "${producto.nombre}" no tiene un Diseño de Mezcla asignado.\nAsígnalo en la ventana de Productos antes de continuar.`);
    disenoSelect.value = '';
    _limpiarCamposDisenoAjuste();
    renderProductosAdicionalesAjuste();
    return;
  }
  agregarOpcionSiNoExiste('m-ajuste-diseno', codigoDiseno);
  disenoSelect.value = codigoDiseno;
  cargarBaseDesdeDiseno();
  renderProductosAdicionalesAjuste();
}

// Agregados (Arena/Triturado Grueso) del ajuste en curso — una fila por cada agregado del
// Diseño de Mezcla elegido (puede haber más de una Arena o más de un Triturado a la vez desde
// 2026-08-02). Cada fila trae su absorción y su "cantidad diseño" ya congeladas desde el
// Diseño (igual que antes) más las 3 pesadas del día (recipiente/húmedo/seco) que llena el
// operario — de ahí sale su humedad y su corrección de agua, sumadas entre todas las filas.
let _agregadosAjusteActual = [];

function cargarBaseDesdeDiseno() {
  const codigo = document.getElementById('m-ajuste-diseno').value;
  const d = DISENOS_MEZCLA.find(x => x.codigo === codigo);
  if (!d) return;
  document.getElementById('m-ajuste-resistencia').value = d.resistenciaDiseno || '';
  document.getElementById('m-ajuste-tamano').value = d.tamanoMaximo || '';
  document.getElementById('m-ajuste-mat-agua').value = d.materiales?.agua || 0;
  document.getElementById('m-ajuste-mat-cemento').value = d.materiales?.cemento || 0;
  // Adición = suma de todas las adiciones cementantes del diseño (Metacaolín, Puzolana,
  // Escoria... pueden ser varias a la vez, 2026-08-02) — no necesitan corrección de humedad
  // individual como Arena/Triturado, así que en Ajuste Diario basta con el total.
  document.getElementById('m-ajuste-mat-adicion').value = (d.materiales?.adiciones || []).reduce((s, a) => s + (Number(a.cantidad) || 0), 0);
  const aditivos = d.materiales?.aditivos || [];
  const sumaPorTipo = (tipo) => aditivos.filter(a => a.tipo === tipo).reduce((s, a) => s + (Number(a.dosis) || 0), 0);
  document.getElementById('m-ajuste-mat-plastificante').value = sumaPorTipo('Superplastificante');
  document.getElementById('m-ajuste-mat-acelerante').value = sumaPorTipo('Acelerante');
  _agregadosAjusteActual = (d.materiales?.agregados || []).map(a => ({
    rolBase: a.rolBase, producto: a.producto || '', absorcion: Number(a.absorcion) || 0,
    disenoCantidad: Number(a.cantidad) || 0, pesoRecipiente: 0, pesoHumedo: 0, pesoSeco: 0, humedad: 0, ajustada: 0,
  }));
  recalcularAjusteMezcla();
}

// Repinta la tabla de agregados completa — se usa cuando cambia CUÁLES filas hay (cargar un
// diseño nuevo, o abrir un ajuste guardado), no en cada tecla (eso lo hace
// _recalcularAgregadoAjuste, que solo actualiza las celdas calculadas sin perder el foco).
function renderAgregadosAjuste() {
  const tbody = document.getElementById('ajuste-agregados-body');
  if (!tbody) return;
  if (!_agregadosAjusteActual.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:10px;color:var(--gris-medio);font-size:12px">Elige el producto a fabricar para traer los agregados de su Diseño de Mezcla</td></tr>`;
    return;
  }
  tbody.innerHTML = _agregadosAjusteActual.map((row, i) => `
    <tr>
      <td style="font-weight:600">${row.producto || (row.rolBase === 'arena' ? 'Arena' : 'Triturado Grueso')}</td>
      <td><input type="number" value="${row.pesoRecipiente || 0}" oninput="_agregadosAjusteActual[${i}].pesoRecipiente=parseFloat(this.value)||0;_recalcularAgregadoAjuste(${i})"></td>
      <td><input type="number" value="${row.pesoHumedo || 0}" oninput="_agregadosAjusteActual[${i}].pesoHumedo=parseFloat(this.value)||0;_recalcularAgregadoAjuste(${i})"></td>
      <td><input type="number" value="${row.pesoSeco || 0}" oninput="_agregadosAjusteActual[${i}].pesoSeco=parseFloat(this.value)||0;_recalcularAgregadoAjuste(${i})"></td>
      <td style="text-align:center;font-weight:700" id="ajuste-agregado-humedad-${i}">${(row.humedad || 0).toFixed(1)}%</td>
      <td><input type="number" value="${row.absorcion || 0}" step="0.1" readonly style="background:#F7FAFC;color:var(--gris-medio)"></td>
      <td style="text-align:right;color:var(--gris-medio)">${(row.disenoCantidad || 0).toFixed(1)}</td>
      <td style="text-align:right;font-weight:700" id="ajuste-agregado-ajustada-${i}">${(row.ajustada || 0).toFixed(1)} kg</td>
    </tr>`).join('');
}

// Recalcula UNA fila de agregado (humedad + cantidad ajustada) y el agua ajustada total —
// solo toca esas celdas puntuales, sin reconstruir la tabla, para no perder el foco/cursor
// del input que el operario está llenando en ese momento.
function _recalcularAgregadoAjuste(i) {
  const row = _agregadosAjusteActual[i];
  if (!row) return;
  row.humedad = calcularHumedadAgregado(row.pesoRecipiente, row.pesoHumedo, row.pesoSeco);
  row.ajustada = (row.disenoCantidad || 0) * (1 + row.humedad / 100);
  const humCell = document.getElementById(`ajuste-agregado-humedad-${i}`);
  if (humCell) humCell.textContent = row.humedad.toFixed(1) + '%';
  const ajCell = document.getElementById(`ajuste-agregado-ajustada-${i}`);
  if (ajCell) ajCell.textContent = row.ajustada.toFixed(1) + ' kg';
  _recalcularAguaAjustada();
}

// El agua ajustada resta el aporte de humedad de TODOS los agregados a la vez (antes solo
// arena+triturado, ahora la suma de cuantas filas haya) — cada agregado húmedo por encima de
// su absorción "regala" agua a la mezcla, que hay que descontar del agua a dosificar.
function _recalcularAguaAjustada() {
  const disenoAgua = parseFloat(document.getElementById('m-ajuste-mat-agua').value) || 0;
  const totalAporte = _agregadosAjusteActual.reduce((s, row) => s + (row.disenoCantidad || 0) * ((row.humedad || 0) - (row.absorcion || 0)) / 100, 0);
  const el = document.getElementById('m-ajuste-ajustada-agua');
  if (el) el.textContent = (disenoAgua - totalAporte).toFixed(1) + ' L';
}

function recalcularAjusteMezcla() {
  const g = id => parseFloat(document.getElementById(id).value) || 0;
  _agregadosAjusteActual.forEach(row => { row.humedad = calcularHumedadAgregado(row.pesoRecipiente, row.pesoHumedo, row.pesoSeco); row.ajustada = (row.disenoCantidad || 0) * (1 + row.humedad / 100); });
  renderAgregadosAjuste();
  _recalcularAguaAjustada();
  document.getElementById('m-ajuste-ajustada-cemento').textContent = g('m-ajuste-mat-cemento').toFixed(1) + ' kg';
  document.getElementById('m-ajuste-ajustada-adicion').textContent = g('m-ajuste-mat-adicion').toFixed(1) + ' kg';
  document.getElementById('m-ajuste-ajustada-plastificante').textContent = g('m-ajuste-mat-plastificante').toFixed(1) + ' g';
  document.getElementById('m-ajuste-ajustada-acelerante').textContent = g('m-ajuste-mat-acelerante').toFixed(1) + ' g';
}

// El proyecto ya no se escribe a mano — se elige de los proyectos registrados para el cliente
// que esté en el campo Cliente en este momento (ver poblarSelectProyectosDeCliente()).
function _alCambiarClienteAjuste() {
  poblarSelectProyectosDeCliente('m-ajuste-proyecto', document.getElementById('m-ajuste-cliente').value);
}

function abrirModalAjusteMezcla() {
  document.getElementById('m-ajuste-id').value = '';
  document.getElementById('modal-ajuste-titulo').textContent = '🌡️ Nuevo Ajuste Diario de Mezcla';
  document.getElementById('m-ajuste-cilindro').value = siguienteCilindroNo();
  document.getElementById('m-ajuste-fecha').value = new Date().toISOString().split('T')[0];
  poblarSelectDisenos('m-ajuste-diseno');
  poblarDatalistProductos('datalist-productos-ajuste');
  document.getElementById('m-ajuste-producto').value = '';
  document.getElementById('m-ajuste-diseno').value = '';
  _clientesAdicionalesAjuste = [];
  renderClientesAdicionalesAjuste();
  _productosAdicionalesAjuste = [];
  renderProductosAdicionalesAjuste();
  ['m-ajuste-resistencia', 'm-ajuste-cliente', 'm-ajuste-tamano',
    'm-ajuste-mat-agua', 'm-ajuste-mat-cemento', 'm-ajuste-mat-adicion', 'm-ajuste-mat-plastificante',
    'm-ajuste-mat-acelerante', 'm-ajuste-obs'
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = id.includes('obs') || id.includes('cliente') || id.includes('tamano') ? '' : 0; });
  _agregadosAjusteActual = [];
  _alCambiarClienteAjuste(); // deja el select de Proyecto deshabilitado hasta elegir cliente
  recalcularAjusteMezcla();
  document.getElementById('modal-ajuste-mezcla').classList.add('abierto');
}

function editarAjusteMezcla(id) {
  const a = AJUSTES_MEZCLA.find(x => String(x.id) === String(id));
  if (!a) return;
  document.getElementById('m-ajuste-id').value = a.id;
  document.getElementById('modal-ajuste-titulo').textContent = '✏️ Editar Ajuste Diario de Mezcla';
  document.getElementById('m-ajuste-cilindro').value = a.cilindroNo || '';
  document.getElementById('m-ajuste-fecha').value = a.fecha || '';
  poblarSelectDisenos('m-ajuste-diseno');
  poblarDatalistProductos('datalist-productos-ajuste');
  document.getElementById('m-ajuste-producto').value = a.productoCodigo
    ? `${a.productoCodigo} — ${a.productoNombre || PRODUCTOS.find(p => p.codigo === a.productoCodigo)?.nombre || ''}`
    : '';
  document.getElementById('m-ajuste-diseno').value = a.disenoCodigo || '';
  document.getElementById('m-ajuste-cliente').value = a.cliente || a.clienteElemento || '';
  document.getElementById('m-ajuste-cliente').title = a.cliente || a.clienteElemento || '';
  poblarSelectProyectosDeCliente('m-ajuste-proyecto', a.cliente || a.clienteElemento || '');
  document.getElementById('m-ajuste-proyecto').value = a.proyecto || '';
  _clientesAdicionalesAjuste = JSON.parse(JSON.stringify(a.clientesAdicionales || []));
  renderClientesAdicionalesAjuste();
  _productosAdicionalesAjuste = (a.productosAdicionales || []).map(p => `${p.codigo} — ${p.nombre}`);
  renderProductosAdicionalesAjuste();
  document.getElementById('m-ajuste-obs').value = a.observaciones || '';

  // Un Diseño de Mezcla se va ajustando con el tiempo (disponibilidad y calidad de
  // materiales), así que las cantidades "Cantidad diseño", la resistencia/tamaño y la
  // absorción de un ajuste ya guardado SIEMPRE se cargan desde lo que quedó congelado
  // en el propio ajuste — nunca en vivo desde el Diseño de Mezcla actual — para que un
  // ajuste histórico no cambie retroactivamente solo por abrirlo y volver a guardarlo.
  // Si el usuario cambia el Producto durante la edición, ahí sí se vuelve a traer en
  // vivo (cargarDesdeProducto → cargarBaseDesdeDiseno), porque esa es una decisión
  // explícita de aplicar un diseño distinto.
  document.getElementById('m-ajuste-tamano').value = a.tamanoMaximo || '';
  document.getElementById('m-ajuste-resistencia').value = a.resistenciaDiseno || 0;
  document.getElementById('m-ajuste-mat-agua').value = a.materiales?.agua?.diseno || 0;
  document.getElementById('m-ajuste-mat-cemento').value = a.materiales?.cemento?.diseno || 0;
  document.getElementById('m-ajuste-mat-adicion').value = a.materiales?.adicion?.diseno || 0;
  document.getElementById('m-ajuste-mat-plastificante').value = a.materiales?.plastificante?.diseno || 0;
  document.getElementById('m-ajuste-mat-acelerante').value = a.materiales?.acelerante?.diseno || 0;
  _normalizarAjuste(a);
  _agregadosAjusteActual = JSON.parse(JSON.stringify(a.agregados || []));

  recalcularAjusteMezcla();
  document.getElementById('modal-ajuste-mezcla').classList.add('abierto');
}

function guardarAjusteMezcla() {
  const cilindroNo = document.getElementById('m-ajuste-cilindro').value.trim();
  const fecha = document.getElementById('m-ajuste-fecha').value;
  const producto = _productoDesdeTextoAjuste(document.getElementById('m-ajuste-producto').value);
  if (!cilindroNo || !fecha || !producto) { alert('Completa los campos obligatorios: Cilindro N°, Fecha y Producto a fabricar (elige uno de la lista).'); return; }
  if (!document.getElementById('m-ajuste-diseno').value) { alert('El producto seleccionado no tiene un Diseño de Mezcla asignado. Asígnalo en la ventana de Productos antes de guardar.'); return; }

  const clientePrincipal = document.getElementById('m-ajuste-cliente').value.trim();
  if (!_clienteValidoAjuste(clientePrincipal)) {
    alert(`El cliente "${clientePrincipal}" no existe en la base de datos de Cotizaciones y Ventas.\nCréalo allá primero, o selecciona uno existente de la lista.`);
    return;
  }
  for (const c of _clientesAdicionalesAjuste) {
    if (!_clienteValidoAjuste(c.cliente)) {
      alert(`El cliente adicional "${c.cliente}" no existe en la base de datos de Cotizaciones y Ventas.\nCréalo allá primero, o selecciona uno existente de la lista.`);
      return;
    }
  }

  const disenoActual = document.getElementById('m-ajuste-diseno').value;
  const productosCompatibles = PRODUCTOS.filter(p => p.disenoMezcla === disenoActual);
  const productosAdicionalesResueltos = [];
  for (const texto of _productosAdicionalesAjuste) {
    const t = texto.trim();
    if (!t) continue;
    const pAdicional = productosCompatibles.find(pp => _textoProducto(pp) === t);
    if (!pAdicional) { alert(`El producto adicional "${t}" no es válido, o no comparte el mismo Diseño de Mezcla del producto principal. Elige uno de la lista.`); return; }
    productosAdicionalesResueltos.push({ codigo: pAdicional.codigo, nombre: pAdicional.nombre });
  }

  if (AJUSTES_MEZCLA.some(a => String(a.cilindroNo) === String(cilindroNo) && String(a.id) !== document.getElementById('m-ajuste-id').value)) {
    if (!confirm(`Ya existe un ajuste con el Cilindro N° ${cilindroNo}. ¿Deseas continuar de todas formas?`)) return;
  }
  const g = id => parseFloat(document.getElementById(id).value) || 0;

  // Cada agregado (Arena/Triturado, puede haber más de uno) se recalcula limpio al guardar,
  // en vez de confiar en los campos transitorios `row.humedad`/`row.ajustada` que solo se
  // usan para pintar la pantalla — y el agua ajustada resta el aporte de TODOS a la vez.
  const disenoAgua = g('m-ajuste-mat-agua');
  const agregadosFinal = _agregadosAjusteActual.map(row => {
    const humedad = calcularHumedadAgregado(row.pesoRecipiente, row.pesoHumedo, row.pesoSeco);
    const ajustada = (row.disenoCantidad || 0) * (1 + humedad / 100);
    return { rolBase: row.rolBase, producto: row.producto || '', pesoRecipiente: row.pesoRecipiente || 0, pesoHumedo: row.pesoHumedo || 0, pesoSeco: row.pesoSeco || 0, absorcion: row.absorcion || 0, disenoCantidad: row.disenoCantidad || 0, humedad, ajustada, unidad: 'kg' };
  });
  const totalAporteAgua = agregadosFinal.reduce((s, row) => s + row.disenoCantidad * (row.humedad - row.absorcion) / 100, 0);
  const aguaAjustada = disenoAgua - totalAporteAgua;

  const editId = document.getElementById('m-ajuste-id').value;
  const ajuste = {
    id: editId || String(Date.now()),
    cilindroNo, fecha,
    productoCodigo: producto.codigo,
    productoNombre: producto.nombre,
    productosAdicionales: productosAdicionalesResueltos,
    disenoCodigo: document.getElementById('m-ajuste-diseno').value,
    resistenciaDiseno: g('m-ajuste-resistencia'),
    cliente: document.getElementById('m-ajuste-cliente').value.trim(),
    proyecto: document.getElementById('m-ajuste-proyecto').value.trim(),
    clientesAdicionales: _clientesAdicionalesAjuste.filter(c => c.cliente.trim() || c.proyecto.trim()),
    tamanoMaximo: document.getElementById('m-ajuste-tamano').value.trim(),
    agregados: agregadosFinal,
    materiales: {
      agua: { diseno: disenoAgua, ajustada: aguaAjustada, unidad: 'L' },
      cemento: { diseno: g('m-ajuste-mat-cemento'), ajustada: g('m-ajuste-mat-cemento'), unidad: 'kg' },
      adicion: { diseno: g('m-ajuste-mat-adicion'), ajustada: g('m-ajuste-mat-adicion'), unidad: 'kg' },
      plastificante: { diseno: g('m-ajuste-mat-plastificante'), ajustada: g('m-ajuste-mat-plastificante'), unidad: 'g' },
      acelerante: { diseno: g('m-ajuste-mat-acelerante'), ajustada: g('m-ajuste-mat-acelerante'), unidad: 'g' },
    },
    observaciones: document.getElementById('m-ajuste-obs').value.trim(),
    creadoPor: USUARIO_ACTUAL?.email,
    creadoEn: editId ? (AJUSTES_MEZCLA.find(x => String(x.id) === String(editId))?.creadoEn || new Date().toISOString()) : new Date().toISOString(),
  };
  const idx = AJUSTES_MEZCLA.findIndex(x => String(x.id) === String(ajuste.id));
  if (idx >= 0) AJUSTES_MEZCLA[idx] = ajuste; else AJUSTES_MEZCLA.unshift(ajuste);
  sb.from('ajustes_mezcla').upsert({ id: ajuste.id, datos: ajuste, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) console.error('Error guardando ajuste de mezcla:', error.message); });
  cerrarModal('modal-ajuste-mezcla');
  renderAjustesMezcla();
}

function eliminarAjusteMezcla(id) {
  const a = AJUSTES_MEZCLA.find(x => String(x.id) === String(id));
  if (!a || !confirm(`¿Eliminar el ajuste del Cilindro N° ${a.cilindroNo}?`)) return;
  AJUSTES_MEZCLA = AJUSTES_MEZCLA.filter(x => String(x.id) !== String(id));
  renderAjustesMezcla();
  sb.from('ajustes_mezcla').delete().eq('id', a.id)
    .then(({ error }) => {
      if (error) { console.error('Error eliminando ajuste:', error.message); alert('Error al eliminar: ' + error.message); AJUSTES_MEZCLA.push(a); renderAjustesMezcla(); }
    });
}

// ── Integración con Control de Ensayos ──
function _textoCilindroEnsayo(a) {
  return `Cilindro ${a.cilindroNo} — ${a.fecha ? new Date(a.fecha + 'T12:00').toLocaleDateString('es-CO') : ''} (${_clienteResumenAjuste(a)})`;
}

// Igual que Producto/Cliente en Ajuste Diario: con muchos cilindros un <select> plano
// se vuelve difícil de recorrer, así que se busca por texto contra un <datalist>.
function poblarDatalistCilindros(datalistId) {
  const dl = document.getElementById(datalistId);
  if (!dl) return;
  const ordenados = [...AJUSTES_MEZCLA].sort((a, b) => (Number(b.cilindroNo) || 0) - (Number(a.cilindroNo) || 0));
  dl.innerHTML = ordenados.map(a => `<option value="${_textoCilindroEnsayo(a)}">`).join('');
}

function _ajusteDesdeTextoCilindroEnsayo(texto) {
  const t = (texto || '').trim();
  if (!t) return null;
  return AJUSTES_MEZCLA.find(a => _textoCilindroEnsayo(a) === t) || null;
}

// Producto, Cliente y Proyecto del ensayo son solo un reflejo de lo que ya quedó
// registrado en el Ajuste Diario de ese cilindro — no se guardan aparte, se recalculan
// siempre en vivo a partir del cilindroNo para no duplicar ni desactualizar el dato.
function _poblarProductoClienteProyectoEnsayo(cilindroNo) {
  const a = AJUSTES_MEZCLA.find(x => String(x.cilindroNo) === String(cilindroNo));
  document.getElementById('m-ensayo-producto').value = a?.productoNombre || '';
  document.getElementById('m-ensayo-cliente').value = a ? (a.cliente || a.clienteElemento || '') : '';
  document.getElementById('m-ensayo-proyecto').value = a?.proyecto || '';
}

// Diseño de mezcla usado se muestra como texto plano (no como un desplegable activo),
// ya que es un valor automático que no se puede escoger manualmente en este formulario.
function _textoDisenoEnsayo(codigo) {
  const d = DISENOS_MEZCLA.find(x => x.codigo === codigo);
  return d ? `${d.codigo} — ${d.nombre} (${d.resistenciaDiseno} MPa)` : (codigo || '');
}

function cargarDesdeAjusteMezcla() {
  const a = _ajusteDesdeTextoCilindroEnsayo(document.getElementById('m-ensayo-cilindro').value);
  _poblarProductoClienteProyectoEnsayo(a?.cilindroNo || '');
  if (!a) return;
  // Al relacionar el cilindro, se arrastran automáticamente los datos que ya se conocen
  // desde el Ajuste Diario de Mezcla, en vez de pedirlos de nuevo en el ensayo.
  if (a.fecha) document.getElementById('m-ensayo-fecha').value = a.fecha;
  document.getElementById('m-ensayo-diseno').value = a.disenoCodigo || '';
  document.getElementById('m-ensayo-diseno-display').value = _textoDisenoEnsayo(a.disenoCodigo);
  actualizarObjetivoDesdeDiseno();
  if (a.resistenciaDiseno) document.getElementById('m-ensayo-objetivo').value = a.resistenciaDiseno;
}

// ── Formato de Producción (PDF para el operario de mezclado) ──
// Reproduce el formato físico de planta: para cada volumen de concreto a producir,
// el "Peso a cargar" de Arena y Triturado incluye una compensación por buggy (material
// que queda pegado en cada buggy al vaciarlo), porque esos dos insumos se cargan a mano
// en buggies de capacidad fija; los demás insumos se dosifican directo, sin ese ajuste.
const BUGGY_CAPACIDAD_KG = 150;
const BUGGY_COMPENSACION_KG = 17;
const VOLUMENES_FORMATO_PRODUCCION = [0.05, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70];

function _filaFormatoProduccion(nombre, cantidadAjustada, volumen, esAgregado, unidad) {
  const pesoTeorico = cantidadAjustada * volumen;
  if (!esAgregado) {
    return { nombre, pesoACargar: pesoTeorico, cantBuggies: 'N/A', pesoTeorico, pesoBuggies: 'N/A', unidad };
  }
  const cantBuggies = Math.ceil(pesoTeorico / BUGGY_CAPACIDAD_KG - 1e-9) || 0;
  const pesoBuggies = cantBuggies * BUGGY_COMPENSACION_KG;
  return { nombre, pesoACargar: pesoTeorico + pesoBuggies, cantBuggies, pesoTeorico, pesoBuggies, unidad };
}

function _tablaVolumenFormatoProduccion(a, volumen) {
  const m = a.materiales || {};
  const filas = [
    _filaFormatoProduccion('Agua', m.agua?.ajustada || 0, volumen, false, 'kg'),
    _filaFormatoProduccion('Cemento', m.cemento?.ajustada || 0, volumen, false, 'kg'),
    _filaFormatoProduccion('Adición', m.adicion?.ajustada || 0, volumen, false, 'kg'),
    _filaFormatoProduccion('Plastificante', m.plastificante?.ajustada || 0, volumen, false, 'g'),
    // Cada agregado (Arena/Triturado, puede haber más de uno desde 2026-08-02) se carga en
    // buggy aparte — una fila por cada uno, con su propio nombre de producto.
    ...(a.agregados || []).map(ag => _filaFormatoProduccion(ag.producto || (ag.rolBase === 'arena' ? 'Arena' : 'Triturado'), ag.ajustada || 0, volumen, true, 'kg')),
  ];
  // El +1e-9 evita que un valor como 365*0.7=255.49999999999997 (imprecisión de punto
  // flotante) redondee hacia abajo cuando matemáticamente cae justo en 255.5 → 256.
  const fmt = (v, unidad) => v === 'N/A' ? 'N/A' : Math.round(v + 1e-9) + ' ' + unidad;
  return `
    <table style="width:100%;border-collapse:collapse;font-size:9.5px">
      <thead>
        <tr style="background:#FFC107">
          <th colspan="2" style="padding:2px 5px;text-align:left;font-weight:700">VOLUMEN DE CONCRETO ${volumen.toFixed(2).replace('.', ',')} m3</th>
          <th colspan="3" style="padding:2px 5px;text-align:left;font-weight:700">Cantidades</th>
        </tr>
        <tr style="background:#f0f0f0">
          <th style="padding:2px 5px;text-align:left">Material</th>
          <th style="padding:2px 5px;text-align:center">Peso a cargar</th>
          <th style="padding:2px 5px;text-align:center">Cant de Buggies</th>
          <th style="padding:2px 5px;text-align:center">Peso Teórico</th>
          <th style="padding:2px 5px;text-align:center">Peso buggies</th>
        </tr>
      </thead>
      <tbody>
        ${filas.map(f => `
          <tr>
            <td style="padding:1.5px 5px;border-bottom:1px solid #eee;font-weight:600">${_esc(f.nombre)}</td>
            <td style="padding:1.5px 5px;border-bottom:1px solid #eee;text-align:center;font-weight:700">${fmt(f.pesoACargar, f.unidad)}</td>
            <td style="padding:1.5px 5px;border-bottom:1px solid #eee;text-align:center">${f.cantBuggies === 'N/A' ? 'N/A' : f.cantBuggies + ' buggies'}</td>
            <td style="padding:1.5px 5px;border-bottom:1px solid #eee;text-align:center;color:#888">${fmt(f.pesoTeorico, f.unidad)}</td>
            <td style="padding:1.5px 5px;border-bottom:1px solid #eee;text-align:center;color:#888">${fmt(f.pesoBuggies, f.unidad)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function verFormatoProduccionAjuste(id) {
  const a = AJUSTES_MEZCLA.find(x => String(x.id) === String(id));
  if (!a) return;
  const diseno = DISENOS_MEZCLA.find(d => d.codigo === a.disenoCodigo);
  const pares = [];
  for (let i = 0; i < VOLUMENES_FORMATO_PRODUCCION.length / 2; i++) {
    pares.push([VOLUMENES_FORMATO_PRODUCCION[i], VOLUMENES_FORMATO_PRODUCCION[i + VOLUMENES_FORMATO_PRODUCCION.length / 2]]);
  }
  const html = `
    <div class="no-print" style="background:#1C2333;color:white;padding:12px 24px;display:flex;align-items:center;gap:16px">
      <span style="font-weight:700">Formato de Producción — Cilindro N° ${_esc(a.cilindroNo)}</span>
      <div style="flex:1"></div>
      <button onclick="descargarFormatoProduccionAjuste('${a.id}')" style="background:#1976D2;color:white;border:none;padding:8px 18px;border-radius:5px;cursor:pointer;font-weight:700">⬇️ Descargar PDF</button>
      <button onclick="document.getElementById('vista-previa').style.display='none';document.getElementById('pantalla-ajuste-mezcla').classList.add('activa')" style="background:#555;color:white;border:none;padding:8px 14px;border-radius:5px;cursor:pointer">← Volver</button>
    </div>
    <div class="preview-doc" id="formato-produccion-doc">
      <div class="preview-membrete-header">
        <img src="membrete-top.jpg" alt="">
      </div>
      <div class="preview-content" id="formato-produccion-content" style="padding-top:6px">
        <div style="text-align:center;font-size:12px;font-weight:700;color:#003F7F;letter-spacing:0.03em;margin-bottom:8px">FORMATO DE PRODUCCIÓN — MEZCLA AJUSTADA POR HUMEDAD</div>
        <div style="padding-bottom:6px;border-bottom:1px solid #eee;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div style="font-size:14px;font-weight:700;color:#003F7F">CILINDRO No. ${_esc(a.cilindroNo) || '—'}</div>
            <div style="font-size:11px;color:#555">${a.fecha ? new Date(a.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</div>
          </div>
          <div style="font-size:12px;font-weight:600;margin-top:2px">${_esc(a.cliente || a.clienteElemento) || '—'}${a.proyecto ? ' — ' + _esc(a.proyecto) : ''}</div>
          ${(a.clientesAdicionales || []).map(c => `<div style="font-size:12px;font-weight:600;margin-top:2px">${_esc(c.cliente)}${c.proyecto ? ' — ' + _esc(c.proyecto) : ''}</div>`).join('')}
          <div style="font-size:10.5px;margin-top:6px"><b>PRODUCTO:</b> ${_esc(a.productoNombre) || '—'}${(a.productosAdicionales && a.productosAdicionales.length) ? ` + ${_esc(a.productosAdicionales.map(p => p.nombre).join(', '))}` : ''}</div>
          <div style="font-size:10.5px;margin-top:6px"><b>DISEÑO DE MEZCLA:</b> ${diseno ? `${_esc(diseno.codigo)} — ${_esc(diseno.nombre)}` : _esc(a.disenoCodigo) || '—'}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-top:4px;font-size:10.5px">
            <div><b>RESISTENCIA DE DISEÑO:</b> ${a.resistenciaDiseno || '—'} MPa</div>
            <div><b>TAMAÑO MÁXIMO DE AGREGADO:</b> ${_esc(a.tamanoMaximo) || '—'}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:10.5px">
            ${(a.agregados || []).map(ag => `<span><b>HUMEDAD ${(ag.producto || (ag.rolBase === 'arena' ? 'ARENA' : 'TRITURADO')).toUpperCase()}:</b> ${ag.humedad != null ? ag.humedad.toFixed(1) + '%' : '—'}</span>`).join('')}
          </div>
        </div>
        ${pares.map(([izq, der]) => `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">
            <div style="border:1px solid #ddd;border-radius:4px;overflow:hidden">${_tablaVolumenFormatoProduccion(a, izq)}</div>
            <div style="border:1px solid #ddd;border-radius:4px;overflow:hidden">${_tablaVolumenFormatoProduccion(a, der)}</div>
          </div>`).join('')}
        <div style="margin-top:6px;font-size:10.5px;color:#555">
          <b>Elaborado por:</b> ${USUARIOS_CRM[a.creadoPor]?.nombre || a.creadoPor || '—'}
        </div>
      </div>
      <div class="preview-membrete-footer" id="formato-produccion-footer">
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

// Genera el PDF con el mismo membrete (cabecera repetida + pie con arco/datos de contacto)
// que se usa en las cotizaciones, para unificar la presentación de todos los documentos.
async function descargarFormatoProduccionAjuste(id) {
  const a = AJUSTES_MEZCLA.find(x => String(x.id) === String(id));
  if (!a) return;
  const btn = document.querySelector('button[onclick*="descargarFormatoProduccionAjuste"]');
  if (btn) { btn.textContent = '⏳ Generando...'; btn.disabled = true; }
  try {
    const { jsPDF } = window.jspdf;
    const pageW = 210, pageH = 297;

    const topImg = await cargarImagen('membrete-top.jpg');
    const headerH = pageW * (topImg.naturalHeight / topImg.naturalWidth);

    const contentEl = document.getElementById('formato-produccion-content');
    const contentCanvas = await html2canvas(contentEl, { scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false });
    const pxToMm = pageW / contentCanvas.width;
    const contentH_px = _alturaContenidoReal(contentCanvas);

    const footerEl = document.getElementById('formato-produccion-footer');
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
      sliceCanvas.getContext('2d').drawImage(
        contentCanvas, 0, Math.floor(cursorY),
        contentCanvas.width, Math.ceil(sliceH_px),
        0, 0, contentCanvas.width, Math.ceil(sliceH_px)
      );
      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, headerH + 2, pageW, sliceH_px * pxToMm);
      pdf.addImage(footerData, 'JPEG', 0, pageH - footerH, pageW, footerH);

      cursorY = bottom;
      pageIndex++;
    }
    pdf.save(`Formato_Produccion_Cilindro_${a.cilindroNo || a.id}.pdf`);
  } finally {
    if (btn) { btn.textContent = '⬇️ Descargar PDF'; btn.disabled = false; }
  }
}
