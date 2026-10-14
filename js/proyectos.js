// ═══════════════════════════════
// PROYECTOS (2026-10-11, a pedido del usuario: "vamos a crear una nueva ventana de PROYECTOS...
// gestión de proyectos como entidad nueva") — módulo nuevo, independiente de lo que ya existe en
// Clientes/Cotizaciones (`cliente.proyectos[]`, `cot.cliente.proyecto`): un Proyecto acá es su
// propio registro, con su propio estado/fechas/responsable, sin tocar esas otras estructuras.
// Mismo patrón del resto de la app: `datos jsonb` en Supabase (ver sql/2026-10-11_proyectos.sql).
// ═══════════════════════════════
let PROYECTOS = [];

const ESTADOS_PROYECTO = ['Planeación', 'En ejecución', 'Finalizado', 'Cancelado'];
const _COLOR_ESTADO_PROYECTO = {
  'Planeación': { bg: '#FFF3CD', fg: '#8A6D00' },
  'En ejecución': { bg: '#D1ECF1', fg: '#0C5464' },
  'Finalizado': { bg: '#D4EDDA', fg: '#155724' },
  'Cancelado': { bg: '#F8D7DA', fg: '#842029' },
};

// (2026-10-13, a pedido del usuario: "en vez de un listado de proyectos, iconos de acceso para
// los proyectos... tamaño similar a los iconos de la pantalla de inicio") — reusa tal cual las
// clases `.inicio-grid`/`.inicio-modulo` (css/estilos.css) que ya arma el grid de módulos de
// Inicio, para que el tamaño quede idéntico sin duplicar CSS. Clic en la tarjeta entra a las
// Carpetas de ese proyecto (Memorias de Cálculo/Planos/Listas de Producción/Producción y
// Despachos, ver js/losas-proyecto.js — `abrirCarpetasProyecto()`); Editar/Eliminar quedan
// como botones chiquitos aparte, con `stopPropagation` para no disparar también el clic de la
// tarjeta. (2026-10-16: el atajo a las subventanas NO va acá — el usuario aclaró que lo que
// quería era una sub-navegación tipo Cotizaciones y Ventas, no botones por tarjeta; ver
// `_sincronizarSubnavProyecto()` en js/losas-proyecto.js.)
function renderProyectos() {
  const grid = document.getElementById('grid-proyectos');
  if (!grid) return;
  const q = (document.getElementById('buscar-proyecto')?.value || '').toLowerCase().trim();
  const filtroEstado = document.getElementById('filtro-estado-proyecto')?.value || '';
  let data = PROYECTOS.slice();
  if (filtroEstado) data = data.filter(p => p.estado === filtroEstado);
  if (q) data = data.filter(p =>
    (p.nombre || '').toLowerCase().includes(q) ||
    (p.cliente || '').toLowerCase().includes(q) ||
    (p.ciudad || '').toLowerCase().includes(q)
  );
  data.sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));
  if (!data.length) {
    grid.innerHTML = `<div style="width:100%;text-align:center;padding:20px;color:var(--gris-medio)">No hay proyectos${(q || filtroEstado) ? ' con ese filtro.' : ' todavía — crea el primero con "+ Nuevo Proyecto".'}</div>`;
    return;
  }
  grid.innerHTML = data.map(p => {
    const col = _COLOR_ESTADO_PROYECTO[p.estado] || { bg: '#EEE', fg: '#555' };
    const detalle = [p.ciudad, p.responsable].filter(Boolean).join(' · ');
    return `<div class="inicio-modulo" onclick="abrirCarpetasProyecto('${_escAttr(p.id)}')" title="${_escAttr(detalle)}">
      <span class="inicio-modulo-icono">🏗️</span>
      <span class="inicio-modulo-nombre" style="text-align:center">${_esc(p.nombre)}</span>
      ${p.cliente ? `<span style="font-size:11.5px;color:var(--gris-medio);text-align:center">${_esc(p.cliente)}</span>` : ''}
      <span class="badge" style="background:${col.bg};color:${col.fg}">${_esc(p.estado)}</span>
      <div style="display:flex;gap:6px;margin-top:2px" onclick="event.stopPropagation()">
        <button class="btn btn-secundario btn-xs" onclick="abrirModalProyecto('${_escAttr(p.id)}')" title="Editar">✏️</button>
        <button class="btn btn-rojo btn-xs" onclick="eliminarProyecto('${_escAttr(p.id)}')" title="Eliminar">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function abrirModalProyecto(id) {
  const esEdit = !!id;
  const p = esEdit ? PROYECTOS.find(x => x.id === id) : null;
  document.getElementById('modal-proyecto-titulo').textContent = esEdit ? `✏️ Editar Proyecto — ${p?.nombre || ''}` : '🏛️ Nuevo Proyecto';
  document.getElementById('mpy-id').value = id || '';
  document.getElementById('mpy-nombre').value = p?.nombre || '';
  document.getElementById('mpy-cliente').value = p?.cliente || '';
  document.getElementById('mpy-ciudad').value = p?.ciudad || '';
  document.getElementById('mpy-estado').value = p?.estado || 'Planeación';
  document.getElementById('mpy-fecha-inicio').value = p?.fechaInicio || '';
  document.getElementById('mpy-fecha-fin').value = p?.fechaFinEstimada || '';
  document.getElementById('mpy-responsable').value = p?.responsable || '';
  document.getElementById('mpy-descripcion').value = p?.descripcion || '';
  document.getElementById('mpy-cliente-resultados').style.display = 'none';
  document.getElementById('modal-proyecto').classList.add('abierto');
}

// Buscador de cliente — mismo patrón que el resto de la app (ej. filtrarClienteEntrega() en
// js/logistica.js), pero sin obligar a elegir uno existente: un proyecto puede ser de un cliente
// que todavía no está en el catálogo de Clientes, así que también se puede escribir libre.
function filtrarClienteProyecto() {
  const inputEl = document.getElementById('mpy-cliente');
  const div = document.getElementById('mpy-cliente-resultados');
  if (!inputEl || !div) return;
  const q = inputEl.value.toLowerCase().trim();
  if (q.length < 2) { div.style.display = 'none'; return; }
  const res = (typeof CLIENTES !== 'undefined' ? CLIENTES : []).filter(c => c.nombre.toLowerCase().includes(q)).slice(0, 18);
  div.innerHTML = res.length
    ? res.map(c => `
      <div data-cliente="${_escAttr(c.nombre)}" onclick="elegirClienteProyecto(this.dataset.cliente)" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9" onmouseover="this.style.background='#EFF6FF'" onmouseout="this.style.background=''">
        <div style="font-weight:600;font-size:13px;color:#1e293b">${_esc(c.nombre)}</div>
      </div>`).join('')
    : '<div style="padding:10px 14px;color:#888;font-size:12px">Sin resultados — puedes dejar el nombre que escribiste, no tiene que existir en Clientes.</div>';
  div.style.display = 'block';
}
function elegirClienteProyecto(nombre) {
  const inputEl = document.getElementById('mpy-cliente');
  if (inputEl) inputEl.value = nombre;
  const div = document.getElementById('mpy-cliente-resultados');
  if (div) div.style.display = 'none';
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('#mpy-cliente') && !e.target.closest('#mpy-cliente-resultados')) {
    const div = document.getElementById('mpy-cliente-resultados');
    if (div) div.style.display = 'none';
  }
});

function guardarProyecto() {
  const nombre = document.getElementById('mpy-nombre').value.trim();
  if (!nombre) { alert('Completa el Nombre del proyecto.'); return; }
  const idOrig = document.getElementById('mpy-id').value;
  const existente = idOrig ? PROYECTOS.find(x => x.id === idOrig) : null;
  const p = {
    id: idOrig || String(Date.now()),
    nombre,
    cliente: document.getElementById('mpy-cliente').value.trim(),
    ciudad: document.getElementById('mpy-ciudad').value.trim(),
    estado: document.getElementById('mpy-estado').value,
    fechaInicio: document.getElementById('mpy-fecha-inicio').value,
    fechaFinEstimada: document.getElementById('mpy-fecha-fin').value,
    responsable: document.getElementById('mpy-responsable').value.trim(),
    descripcion: document.getElementById('mpy-descripcion').value.trim(),
    creadoPor: existente?.creadoPor || (typeof USUARIO_ACTUAL !== 'undefined' ? USUARIO_ACTUAL?.email : '') || '',
    creadoEn: existente?.creadoEn || new Date().toISOString(),
  };
  const idx = PROYECTOS.findIndex(x => x.id === p.id);
  const anterior = idx >= 0 ? { ...PROYECTOS[idx] } : null;
  if (idx >= 0) PROYECTOS[idx] = p; else PROYECTOS.unshift(p);
  sb.from('proyectos').upsert({ id: p.id, datos: p, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => {
      if (error) {
        // Si el guardado falla, se revierte el cambio local para no dejar un proyecto
        // "fantasma" (o un edit fantasma) que no exista de verdad en la base de datos.
        if (!anterior) PROYECTOS = PROYECTOS.filter(x => x.id !== p.id);
        else { const i2 = PROYECTOS.findIndex(x => x.id === p.id); if (i2 >= 0) PROYECTOS[i2] = anterior; }
        renderProyectos();
        alert('Error al guardar: ' + error.message);
      }
    });
  cerrarModal('modal-proyecto');
  renderProyectos();
}

function eliminarProyecto(id) {
  const p = PROYECTOS.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`¿Eliminar el proyecto "${p.nombre}"?`)) return;
  const idx = PROYECTOS.findIndex(x => x.id === id);
  PROYECTOS = PROYECTOS.filter(x => x.id !== id);
  renderProyectos();
  _ofrecerDeshacer(`🗑️ Proyecto "${p.nombre}" eliminado`,
    () => { sb.from('proyectos').delete().eq('id', id).then(({ error }) => { if (error) { console.error(error.message); alert('No se pudo eliminar: ' + error.message); } }); },
    () => { PROYECTOS.splice(Math.min(idx, PROYECTOS.length), 0, p); renderProyectos(); }
  );
}
