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

function renderProyectos() {
  const tbody = document.getElementById('tabla-proyectos-body');
  if (!tbody) return;
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
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--gris-medio)">No hay proyectos${(q || filtroEstado) ? ' con ese filtro.' : ' todavía — crea el primero con "+ Nuevo Proyecto".'}</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(p => {
    const col = _COLOR_ESTADO_PROYECTO[p.estado] || { bg: '#EEE', fg: '#555' };
    return `<tr>
      <td style="font-weight:600">${_esc(p.nombre)}</td>
      <td>${_esc(p.cliente) || '—'}</td>
      <td>${_esc(p.ciudad) || '—'}</td>
      <td><span class="badge" style="background:${col.bg};color:${col.fg}">${_esc(p.estado)}</span></td>
      <td>${p.fechaInicio ? new Date(p.fechaInicio + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${p.fechaFinEstimada ? new Date(p.fechaFinEstimada + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td>${_esc(p.responsable) || '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-secundario btn-xs" onclick="abrirModalProyecto('${_escAttr(p.id)}')">✏️ Editar</button>
        <button class="btn btn-rojo btn-xs" onclick="eliminarProyecto('${_escAttr(p.id)}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function abrirModalProyecto(id) {
  const esEdit = !!id;
  const p = esEdit ? PROYECTOS.find(x => x.id === id) : null;
  document.getElementById('modal-proyecto-titulo').textContent = esEdit ? `✏️ Editar Proyecto — ${p?.nombre || ''}` : '📁 Nuevo Proyecto';
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
  if (!confirm(`¿Eliminar el proyecto "${p.nombre}"?\n\nEsto no se puede deshacer.`)) return;
  PROYECTOS = PROYECTOS.filter(x => x.id !== id);
  sb.from('proyectos').delete().eq('id', id).then(({ error }) => { if (error) { console.error(error.message); alert('No se pudo eliminar: ' + error.message); } });
  renderProyectos();
}
