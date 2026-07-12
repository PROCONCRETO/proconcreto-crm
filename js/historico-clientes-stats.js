// ═══════════════════════════════
// FILTROS COMPARTIDOS: PERÍODO (todo/anual/mensual) + VENDEDOR
// Mismo patrón que Estadísticas, reutilizado en Histórico y Pipeline.
// ═══════════════════════════════
function _setPeriodoBotones(prefijo, periodo) {
  ['todo', 'anual', 'mensual'].forEach(k => {
    const btn = document.getElementById(`${prefijo}-btn-${k}`);
    if (!btn) return;
    btn.style.background = k === periodo ? 'var(--azul)' : 'white';
    btn.style.color = k === periodo ? 'white' : 'var(--gris-medio)';
  });
  const selAnio = document.getElementById(`${prefijo}-filtro-anio`);
  const selMes = document.getElementById(`${prefijo}-filtro-mes`);
  if (selAnio) selAnio.style.display = periodo === 'todo' ? 'none' : '';
  if (selMes) selMes.style.display = periodo === 'mensual' ? '' : 'none';
}

// Repuebla los <select> de año y vendedor a partir de COTIZACIONES, preservando
// lo ya seleccionado, para no perder el filtro activo cada vez que se re-renderiza.
function _poblarFiltrosPeriodoVendedor(prefijo) {
  const selAnio = document.getElementById(`${prefijo}-filtro-anio`);
  const selMes = document.getElementById(`${prefijo}-filtro-mes`);
  const selVendedor = document.getElementById(`${prefijo}-filtro-vendedor`);
  if (!selAnio || !selVendedor) return;

  const anios = [...new Set(COTIZACIONES.map(c => c.fecha ? c.fecha.substring(0, 4) : null).filter(Boolean))].sort().reverse();
  const anioActual = new Date().getFullYear().toString();
  const prevAnio = selAnio.value;
  selAnio.innerHTML = anios.map(a => `<option value="${a}">${a}</option>`).join('');
  selAnio.value = anios.includes(prevAnio) ? prevAnio : (anios.includes(anioActual) ? anioActual : (anios[0] || ''));
  if (selMes && !selMes.value) selMes.value = new Date().getMonth() + 1;

  const vendedores = [...new Set(COTIZACIONES.map(c => c.vendedor?.nombre).filter(Boolean))].sort();
  const prevVendedor = selVendedor.value;
  selVendedor.innerHTML = '<option value="">Todos los vendedores</option>' + vendedores.map(v => `<option value="${v}">${v}</option>`).join('');
  selVendedor.value = prevVendedor;
}

function _filtrarPorPeriodoVendedor(datos, prefijo, periodo) {
  const anio = document.getElementById(`${prefijo}-filtro-anio`)?.value || '';
  const mes = document.getElementById(`${prefijo}-filtro-mes`)?.value || '';
  const vendedor = document.getElementById(`${prefijo}-filtro-vendedor`)?.value || '';
  let res = datos;
  if (vendedor) res = res.filter(c => c.vendedor?.nombre === vendedor);
  if (periodo !== 'todo' && anio) {
    res = res.filter(c => c.fecha && c.fecha.startsWith(anio));
    if (periodo === 'mensual' && mes) {
      const mesStr = String(mes).padStart(2, '0');
      res = res.filter(c => c.fecha && c.fecha.substring(5, 7) === mesStr);
    }
  }
  return res;
}

// ═══════════════════════════════
// HISTÓRICO
// ═══════════════════════════════
let filtroTexto = '', filtroEstado = '', _periodoHistorico = 'todo';

function setPeriodoHistorico(p) {
  _periodoHistorico = p;
  _setPeriodoBotones('hist', p);
  renderHistorico();
}

function renderHistorico() {
  _poblarFiltrosPeriodoVendedor('hist');
  let data = COTIZACIONES;
  if (filtroTexto) data = data.filter(c =>
    c.numero.toLowerCase().includes(filtroTexto) ||
    c.cliente.nombre.toLowerCase().includes(filtroTexto) ||
    (c.cliente.proyecto || '').toLowerCase().includes(filtroTexto)
  );
  if (filtroEstado) data = data.filter(c => c.estado === filtroEstado);
  data = _filtrarPorPeriodoVendedor(data, 'hist', _periodoHistorico);
  const tbody = document.getElementById('historico-body');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><div class="icono">📋</div><div>No hay cotizaciones guardadas aún.</div></td></tr>`;
    return;
  }
  // Agrupar por número, orden descendente por número
  const grupos = {};
  [...data].forEach(c => {
    if (!grupos[c.numero]) grupos[c.numero] = [];
    grupos[c.numero].push(c);
  });
  // Ordenar versiones dentro de cada grupo (más reciente primero)
  Object.values(grupos).forEach(vers => {
    vers.sort((a, b) => {
      const na = parseInt((a.version||'V1').replace(/\D/g,'')) || 1;
      const nb = parseInt((b.version||'V1').replace(/\D/g,'')) || 1;
      return nb - na;
    });
  });
  // Ordenar grupos por número descendente
  const numerosOrdenados = Object.keys(grupos).sort((a, b) => {
    const na = parseInt(a.replace(/\D/g,'')) || 0;
    const nb = parseInt(b.replace(/\D/g,'')) || 0;
    return nb - na;
  });

  tbody.innerHTML = numerosOrdenados.map(num => {
    const versiones = grupos[num];
    const latest = versiones[0];
    const oldVersions = versiones.slice(1);
    const tieneVersiones = oldVersions.length > 0;
    const verBtn = tieneVersiones
      ? `<button class="btn-toggle-ver" id="btn-toggle-${num}" onclick="toggleVersiones('${num}')" title="Mostrar/ocultar versiones anteriores">▲ ocultar versiones</button>`
      : '';
    const numOps = obtenerOpcionesCot(latest).length;
    const menorVal = valorMenorCot(latest);
    const mainRow = `<tr style="border-top:2px solid var(--azul-oscuro)">
      <td>
        <div style="font-weight:700;color:var(--azul);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${latest.numero}
          <span style="font-size:11px;background:var(--azul);color:white;padding:2px 6px;border-radius:3px;font-weight:600">${latest.version||'V1'}</span>
          <span style="font-size:10px;background:#E8F5E9;color:#2E7D32;padding:1px 5px;border-radius:3px">ACTIVA</span>
          ${numOps > 1 ? `<span style="font-size:10px;background:#FFF3E0;color:#E65100;padding:1px 5px;border-radius:3px;font-weight:600" title="Esta cotización tiene ${numOps} opciones">🔁 ${numOps} opciones</span>` : ''}
        </div>
        ${tieneVersiones ? `<div style="margin-top:4px">${verBtn}</div>` : ''}
      </td>
      <td>${new Date(latest.fecha+'T12:00').toLocaleDateString('es-CO')}</td>
      <td style="font-weight:600">${latest.cliente.nombre}</td>
      <td style="color:var(--gris-medio)">${latest.cliente.proyecto||'—'}</td>
      <td style="color:var(--gris-medio)">${latest.vendedor?.nombre||'—'}</td>
      <td style="font-weight:700">$${(numOps > 1 ? menorVal : latest.totales.total).toLocaleString()}${numOps > 1 ? `<div style="font-size:10px;color:var(--gris-medio);font-weight:400">desde (menor opción)</div>` : ''}</td>
      <td><span class="badge badge-${latest.estado.toLowerCase()}">${latest.estado}</span></td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-primario btn-xs" onclick="cargarCotizacion(${latest.id})">✏️ Editar</button>
          <button class="btn btn-secundario btn-xs" onclick="abrirModalEstado(${latest.id})">Estado</button>
          <button class="btn btn-secundario btn-xs" onclick="previsualizarCotizacionById(${latest.id})">👁️</button>
          ${latest.estado === 'Aceptada' ? `<button class="btn btn-xs" style="background:#E8F5E9;color:#2E7D32;border:1px solid #A5D6A7" onclick="irAOrdenDeCotizacion('${latest.numero}')">📝 OS</button>` : ''}
          <button class="btn btn-rojo btn-xs" onclick="eliminarCotizacion(${latest.id})">🗑️</button>
        </div>
      </td>
    </tr>`;
    const oldRows = oldVersions.map((v, idx) => `
      <tr class="historico-version-row" id="ver-row-${num}-${v.version}" style="background:#F8F9FB;border-left:3px solid var(--gris-borde)">
        <td style="padding-left:20px">
          <div style="display:flex;align-items:center;gap:6px;color:var(--gris-medio)">
            <span style="font-size:11px;color:var(--gris-texto)">↳</span>
            <span style="font-weight:600;color:var(--gris-texto)">${v.numero}</span>
            <span style="font-size:11px;background:var(--gris-borde);color:var(--gris-texto);padding:2px 6px;border-radius:3px;font-weight:600">${v.version||'V1'}</span>
          </div>
        </td>
        <td style="color:var(--gris-medio);font-size:13px">${new Date(v.fecha+'T12:00').toLocaleDateString('es-CO')}</td>
        <td style="color:var(--gris-medio);font-size:13px">${v.cliente.nombre}</td>
        <td style="color:var(--gris-medio);font-size:13px">${v.cliente.proyecto||'—'}</td>
        <td style="color:var(--gris-medio);font-size:13px">${v.vendedor?.nombre||'—'}</td>
        <td style="color:var(--gris-medio);font-size:13px">$${v.totales.total.toLocaleString()}</td>
        <td><span class="badge badge-${v.estado.toLowerCase()}" style="opacity:0.7">${v.estado}</span></td>
        <td>
          <div class="flex-gap">
            <button class="btn btn-secundario btn-xs" onclick="previsualizarCotizacionById(${v.id})">👁️ Ver PDF</button>
            <button class="btn btn-rojo btn-xs" onclick="eliminarCotizacion(${v.id})">🗑️</button>
          </div>
        </td>
      </tr>`).join('');
    return mainRow + oldRows;
  }).join('');
}

function toggleVersiones(num) {
  const rows = document.querySelectorAll(`[id^="ver-row-${num}-"]`);
  const btn = document.getElementById(`btn-toggle-${num}`);
  const visible = rows.length && rows[0].style.display !== 'none';
  rows.forEach(r => { r.style.display = visible ? 'none' : ''; });
  if (btn) btn.textContent = visible ? '▼ ver versiones anteriores' : '▲ ocultar versiones';
}

function filtrarHistorico(q) {
  filtroTexto = q.toLowerCase();
  renderHistorico();
}
function filtrarHistoricoEstado(e) {
  filtroEstado = e;
  renderHistorico();
}

function eliminarCotizacion(id) {
  const cot = COTIZACIONES.find(c => c.id === id);
  if (!cot) return;
  const label = `${cot.numero} ${cot.version || 'V1'}`;
  if (!confirm(`¿Eliminar la cotización ${label}?`)) return;
  COTIZACIONES = COTIZACIONES.filter(c => c.id !== id);
  // Si hay otras versiones del mismo número, borrar solo esta versión; si no, borrar todo el número
  const otrasVersiones = COTIZACIONES.filter(c => c.numero === cot.numero);
  const deleteQuery = sb.from('cotizaciones').delete().eq('numero', cot.numero);
  if (otrasVersiones.length > 0 && cot.version) {
    deleteQuery.eq('version', cot.version).then(({ error }) => { if (error) console.error('Error eliminando:', error.message); });
  } else {
    deleteQuery.then(({ error }) => { if (error) console.error('Error eliminando:', error.message); });
  }
  renderHistorico();
  renderPipeline();
  renderEstadisticas();
}

function abrirModalEstado(id) {
  document.getElementById('estado-cot-id').value = id;
  document.getElementById('modal-estado').classList.add('abierto');
}

function cambiarEstado(estado) {
  const id = document.getElementById('estado-cot-id').value;
  const cot = COTIZACIONES.find(c => String(c.id) === String(id));
  if (cot) {
    // Si se acepta y hay varias opciones, preguntar cuál eligió el cliente
    if (estado === 'Aceptada') {
      const ops = obtenerOpcionesCot(cot);
      if (ops.length > 1) {
        const lista = ops.map((o, i) => `${i + 1}) Opción ${i + 1} — $${(o.totales?.total || 0).toLocaleString()}`).join('\n');
        const resp = prompt(`El cliente aceptó la cotización ${cot.numero}.\n¿Cuál opción eligió?\n\n${lista}\n\nEscribe el número de la opción (1-${ops.length}):`, '1');
        if (resp === null) return; // canceló
        const sel = parseInt(resp);
        if (!(sel >= 1 && sel <= ops.length)) { alert('Opción inválida. No se cambió el estado.'); return; }
        cot.opcionAceptada = sel - 1;
      } else {
        cot.opcionAceptada = 0;
      }
    }
    cot.estado = estado;
    const cotActualizada = { ...cot, estado };
    sb.from('cotizaciones').upsert({
      numero: cot.numero,
      version: cot.version || 'V1',
      estado,
      cliente: cot.cliente,
      items: cot.items,
      condiciones: cot.condiciones,
      datos: cotActualizada,
      modificado: new Date().toISOString()
    }, { onConflict: 'numero,version' }).then(({ error }) => {
      if (error) console.error('Error actualizando estado:', error.message);
    });
    // Auto-crear Orden de Servicio al aceptar
    if (estado === 'Aceptada') {
      const osExistente = ORDENES.find(o => o.cotizacion === cot.numero);
      if (!osExistente) crearOrdenDesdeCotizacion(cot);
    }
  }
  cerrarModal('modal-estado');
  renderHistorico();
  renderPipeline();
  renderEstadisticas();
}

// ═══════════════════════════════
// NOTAS DE SEGUIMIENTO (PIPELINE — NEGOCIACIÓN)
// ═══════════════════════════════
function abrirModalNotas(id) {
  const cot = COTIZACIONES.find(c => String(c.id) === String(id));
  if (!cot) return;
  document.getElementById('notas-cot-id').value = id;
  document.getElementById('modal-notas-titulo').textContent = `📝 Notas de Seguimiento — ${cot.numero} ${cot.version || ''}`;
  document.getElementById('nueva-nota-texto').value = '';
  renderNotasSeguimiento();
  document.getElementById('modal-notas-seguimiento').classList.add('abierto');
}

function renderNotasSeguimiento() {
  const id = document.getElementById('notas-cot-id').value;
  const cot = COTIZACIONES.find(c => String(c.id) === String(id));
  const cont = document.getElementById('notas-seguimiento-lista');
  const notas = [...(cot?.notasSeguimiento || [])].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  if (!notas.length) {
    cont.innerHTML = `<div style="text-align:center;padding:16px;color:var(--gris-medio);font-size:13px">Aún no hay notas de seguimiento para esta cotización.</div>`;
    return;
  }
  cont.innerHTML = notas.map(n => `
    <div style="background:#F8F9FB;border-left:3px solid var(--azul);border-radius:4px;padding:8px 12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;gap:8px">
        <span style="font-size:11px;font-weight:700;color:var(--azul)">${new Date(n.fecha).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        <span style="font-size:10px;color:var(--gris-medio)">${USUARIOS_CRM[n.autor]?.nombre || n.autor || ''}</span>
      </div>
      <div style="font-size:13px;white-space:pre-wrap">${n.texto}</div>
    </div>`).join('');
}

function agregarNotaSeguimiento() {
  const id = document.getElementById('notas-cot-id').value;
  const texto = document.getElementById('nueva-nota-texto').value.trim();
  if (!texto) { alert('Escribe una nota antes de agregarla.'); return; }
  const cot = COTIZACIONES.find(c => String(c.id) === String(id));
  if (!cot) return;
  if (!cot.notasSeguimiento) cot.notasSeguimiento = [];
  cot.notasSeguimiento.push({ fecha: new Date().toISOString(), texto, autor: USUARIO_ACTUAL?.email });
  document.getElementById('nueva-nota-texto').value = '';
  renderNotasSeguimiento();
  renderPipeline();
  sb.from('cotizaciones').upsert({
    numero: cot.numero,
    version: cot.version || 'V1',
    estado: cot.estado,
    cliente: cot.cliente,
    items: cot.items,
    condiciones: cot.condiciones,
    datos: cot,
    modificado: new Date().toISOString()
  }, { onConflict: 'numero,version' }).then(({ error }) => {
    if (error) console.error('Error guardando nota de seguimiento:', error.message);
  });
}

function siguienteNumeroOS() {
  const nums = ORDENES.map(o => parseInt((o.numero || '').replace(/\D/g, '')) || 0);
  const max = nums.length ? Math.max(...nums) : 0;
  return 'OS-' + String(max + 1).padStart(4, '0');
}

function crearOrdenDesdeCotizacion(cot) {
  // Usar la opción que eligió el cliente (si la cotización tenía varias)
  const ops = obtenerOpcionesCot(cot);
  const idxOp = (cot.opcionAceptada != null && ops[cot.opcionAceptada]) ? cot.opcionAceptada : 0;
  const op = ops[idxOp];
  const itemsOp = op.items || [];
  const orden = {
    id: String(Date.now()),
    numero: siguienteNumeroOS(),
    cotizacion: cot.numero,
    versionCotizacion: cot.version || 'V1',
    opcionElegida: ops.length > 1 ? ('Opción ' + (idxOp + 1)) : '',
    cliente: cot.cliente?.nombre || '',
    clienteData: cot.cliente,
    descripcion: itemsOp.map(i => `${i.nombre} (${i.cantidad} ${i.unidad})`).join(' / '),
    items: itemsOp,
    transporte: op.transporte,
    cargue: op.cargue,
    descargue: op.descargue,
    condiciones: cot.condiciones,
    vendedor: cot.vendedor,
    totales: op.totales,
    cantidad: itemsOp.reduce((s, i) => s + (i.cantidad || 0), 0),
    fechaEntrega: '',
    estado: 'Pendiente',
    prioridad: 'Normal',
    observaciones: '',
    creadoPor: USUARIO_ACTUAL?.email,
    creadoEn: new Date().toISOString(),
  };
  ORDENES.unshift(orden);
  sb.from('ordenes_servicio').upsert({ numero: orden.numero, datos: orden, modificado: new Date().toISOString() }, { onConflict: 'numero' })
    .then(({ error }) => { if (error) console.error('Error creando OS:', error.message); });
}

// ═══════════════════════════════
// CLIENTES
// ═══════════════════════════════
function renderClientes(lista) {
  const data = lista || CLIENTES;
  const grid = document.getElementById('grid-clientes');
  if (!data.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="icono">👥</div><div>No hay clientes registrados aún.</div></div>`;
    return;
  }
  grid.innerHTML = data.map(c => {
    const numCots = COTIZACIONES.filter(q => q.cliente?.nombre === c.nombre);
    const latestCots = versionesLatest ? versionesLatest().filter(q => q.cliente?.nombre === c.nombre) : numCots;
    const cotLabel = latestCots.length ? `📋 ${latestCots.length} cotización${latestCots.length>1?'es':''}` : '📋 Sin cotizaciones';
    return `
    <div class="cliente-card">
      <div class="nombre">${c.nombre}</div>
      ${c.nit ? `<div class="dato" style="font-size:11px;color:var(--gris-medio)">NIT: ${c.nit}</div>` : ''}
      ${c.contacto ? `<div class="dato">👤 ${c.contacto}</div>` : ''}
      ${c.cel ? `<div class="dato">📱 ${c.cel}</div>` : ''}
      ${c.email ? `<div class="dato">✉️ ${c.email}</div>` : ''}
      ${c.ciudad ? `<div class="dato">📍 ${c.ciudad}</div>` : ''}
      <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">
        <button class="btn btn-primario btn-xs" onclick="usarCliente('${c.id}')">+ Cotizar</button>
        <button class="btn btn-secundario btn-xs" onclick="editarCliente('${c.id}')">✏️ Editar</button>
        <button class="btn btn-secundario btn-xs" onclick="verCotizacionesCliente('${c.nombre.replace(/'/g,"\\'")}')">📋 Ver cots.</button>
        <button class="btn btn-rojo btn-xs" onclick="eliminarCliente('${c.id}')">🗑️</button>
      </div>
      ${latestCots.length ? `<div style="font-size:11px;color:var(--gris-medio);margin-top:6px">${cotLabel}</div>` : ''}
    </div>`;
  }).join('');
}

function filtrarClientes(q) {
  const res = CLIENTES.filter(c =>
    c.nombre.toLowerCase().includes(q.toLowerCase()) ||
    (c.contacto||'').toLowerCase().includes(q.toLowerCase())
  );
  renderClientes(res);
}

function abrirModalCliente() {
  document.getElementById('m-cliente-id').value = '';
  document.getElementById('modal-cliente-titulo').textContent = '➕ Nuevo Cliente';
  ['m-cliente-nombre','m-cliente-contacto','m-cliente-cel','m-cliente-email','m-cliente-ciudad','m-cliente-nit']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('modal-cliente').classList.add('abierto');
}

function editarCliente(id) {
  const c = CLIENTES.find(cl => String(cl.id) === String(id));
  if (!c) return;
  document.getElementById('m-cliente-id').value = c.id;
  document.getElementById('modal-cliente-titulo').textContent = '✏️ Editar Cliente';
  document.getElementById('m-cliente-nombre').value = c.nombre || '';
  document.getElementById('m-cliente-contacto').value = c.contacto || '';
  document.getElementById('m-cliente-cel').value = c.cel || '';
  document.getElementById('m-cliente-email').value = c.email || '';
  document.getElementById('m-cliente-ciudad').value = c.ciudad || '';
  document.getElementById('m-cliente-nit').value = c.nit || '';
  document.getElementById('modal-cliente').classList.add('abierto');
}

function guardarCliente() {
  const nombre = document.getElementById('m-cliente-nombre').value.trim();
  if (!nombre) { alert('El nombre es requerido.'); return; }
  const editId = document.getElementById('m-cliente-id').value;
  const clienteData = {
    nombre,
    contacto: document.getElementById('m-cliente-contacto').value,
    cel: document.getElementById('m-cliente-cel').value,
    email: document.getElementById('m-cliente-email').value,
    ciudad: document.getElementById('m-cliente-ciudad').value,
    nit: document.getElementById('m-cliente-nit').value,
  };
  if (editId) {
    const idx = CLIENTES.findIndex(c => String(c.id) === String(editId));
    if (idx >= 0) {
      const nombreAnterior = CLIENTES[idx].nombre;
      const clienteActualizado = { ...CLIENTES[idx], ...clienteData };
      CLIENTES[idx] = clienteActualizado;
      if (nombreAnterior !== nombre) {
        // Nombre cambió: borrar registro anterior e insertar nuevo
        sb.from('clientes').delete().eq('nombre', nombreAnterior).then(() => {
          sb.from('clientes').insert({ nombre: nombre, datos: clienteActualizado })
            .then(({ error }) => { if (error) console.error('Error guardando cliente:', error.message); });
        });
      } else {
        // Mismo nombre: actualizar directamente
        sb.from('clientes').update({ datos: clienteActualizado, modificado: new Date().toISOString() })
          .eq('nombre', nombreAnterior)
          .then(({ error }) => { if (error) console.error('Error actualizando cliente:', error.message); });
      }
    }
  } else {
    const nuevoCliente = { id: Date.now(), ...clienteData };
    CLIENTES.push(nuevoCliente);
    sb.from('clientes').insert({ nombre: nuevoCliente.nombre, datos: nuevoCliente })
      .then(({ error }) => {
        if (error) {
          // Si ya existe, actualizar
          sb.from('clientes').update({ datos: nuevoCliente }).eq('nombre', nuevoCliente.nombre);
        }
      });
  }
  cerrarModal('modal-cliente');
  renderClientes();
}

function verCotizacionesCliente(nombre) {
  // Ir al histórico con filtro del cliente
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  document.getElementById('pantalla-historico').classList.add('activa');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('activo'));
  // Activar botón Histórico
  document.querySelector('[onclick="ir(\'historico\')"]')?.classList.add('activo');
  // Aplicar filtro
  const input = document.querySelector('#pantalla-historico input[type="text"]');
  if (input) { input.value = nombre; }
  filtroTexto = nombre.toLowerCase();
  renderHistorico();
}

function eliminarCliente(id) {
  if (!confirm('¿Eliminar este cliente?')) return;
  const cli = CLIENTES.find(c => String(c.id) === String(id));
  CLIENTES = CLIENTES.filter(c => String(c.id) !== String(id));
  if (cli) sb.from('clientes').delete().eq('nombre', cli.nombre);
  renderClientes();
}

function usarCliente(id) {
  const c = CLIENTES.find(cl => String(cl.id) === String(id));
  if (!c) return;
  document.getElementById('cliente-nombre').value = c.nombre;
  document.getElementById('cliente-contacto').value = c.contacto || '';
  document.getElementById('cliente-cel').value = c.cel || '';
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  document.getElementById('pantalla-nueva-cotizacion').classList.add('activa');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('activo'));
  document.querySelectorAll('.nav-btn')[0].classList.add('activo');
}

function buscarClienteEnCot(q) {
  const div = document.getElementById('lista-clientes-cot');
  if (!q || q.length < 2) { div.style.display = 'none'; return; }
  const res = CLIENTES.filter(c => c.nombre.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  if (!res.length) { div.style.display = 'none'; return; }
  div.innerHTML = res.map(c => `
    <div class="buscador-item" onclick="seleccionarClienteCot(${c.id})">
      <div class="nombre">${c.nombre}</div>
      <div class="detalle">${c.contacto||''} ${c.cel ? '· ' + c.cel : ''}</div>
    </div>`).join('');
  div.style.display = 'block';
}

function seleccionarClienteCot(id) {
  const c = CLIENTES.find(cl => cl.id === id);
  if (!c) return;
  document.getElementById('cliente-nombre').value = c.nombre;
  document.getElementById('cliente-contacto').value = c.contacto || '';
  document.getElementById('cliente-cel').value = c.cel || '';
  document.getElementById('cliente-proyecto').value = '';
  document.getElementById('lista-clientes-cot').style.display = 'none';
  document.getElementById('buscar-cliente-cot').value = '';
  document.getElementById('cliente-proyecto').focus();
}

// ═══════════════════════════════
// ESTADÍSTICAS
// ═══════════════════════════════
let _periodoStats = 'anual';

function setPeriodo(p) {
  _periodoStats = p;
  document.getElementById('btn-anual').style.background = p === 'anual' ? 'var(--azul)' : 'white';
  document.getElementById('btn-anual').style.color = p === 'anual' ? 'white' : 'var(--gris-medio)';
  document.getElementById('btn-mensual').style.background = p === 'mensual' ? 'var(--azul)' : 'white';
  document.getElementById('btn-mensual').style.color = p === 'mensual' ? 'white' : 'var(--gris-medio)';
  document.getElementById('filtro-mes').style.display = p === 'mensual' ? '' : 'none';
  renderEstadisticas();
}

function poblarFiltrosEstadisticas() {
  // Años disponibles
  const anios = [...new Set(COTIZACIONES.map(c => c.fecha ? c.fecha.substring(0,4) : null).filter(Boolean))].sort().reverse();
  const selAnio = document.getElementById('filtro-anio');
  const anioActual = new Date().getFullYear().toString();
  selAnio.innerHTML = '<option value="">Todos los años</option>' + anios.map(a => `<option value="${a}" ${a === anioActual ? 'selected' : ''}>${a}</option>`).join('');

  // Mes actual por defecto
  document.getElementById('filtro-mes').value = new Date().getMonth() + 1;

  // Vendedores disponibles
  const vendedores = [...new Set(COTIZACIONES.map(c => c.vendedor?.nombre).filter(Boolean))].sort();
  const selVendedor = document.getElementById('filtro-vendedor');
  selVendedor.innerHTML = '<option value="">Todos los vendedores</option>' + vendedores.map(v => `<option value="${v}">${v}</option>`).join('');
}

function renderEstadisticas() {
  const anio = document.getElementById('filtro-anio').value;
  const mes = document.getElementById('filtro-mes').value;
  const vendedor = document.getElementById('filtro-vendedor').value;

  let datos = versionesLatest();

  // Filtro por vendedor
  if (vendedor) datos = datos.filter(c => c.vendedor?.nombre === vendedor);

  // Filtro por período
  if (anio) {
    datos = datos.filter(c => c.fecha && c.fecha.startsWith(anio));
    if (_periodoStats === 'mensual' && mes) {
      const mesStr = String(mes).padStart(2, '0');
      datos = datos.filter(c => c.fecha && c.fecha.substring(5, 7) === mesStr);
    }
  }

  const total = datos.length;
  // Para cotizaciones con varias opciones, se usa el valor MENOR cotizado (o el aceptado si ya se eligió)
  const totalValor = datos.reduce((s, c) => s + valorRepresentativoCot(c), 0);
  const aceptadas = datos.filter(c => c.estado === 'Aceptada').length;
  const valorAceptado = datos.filter(c => c.estado === 'Aceptada').reduce((s, c) => s + valorRepresentativoCot(c), 0);
  const tasaExito = total > 0 ? Math.round((aceptadas / total) * 100) : 0;

  // Meta de ventas
  const META_MENSUAL = 350_000_000;
  const esMensual = _periodoStats === 'mensual';
  const hoy = new Date();
  const anoActual = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;
  const anoFiltrado = parseInt(anio) || anoActual;
  let mesesMeta = 1;
  let labelPeriodo = 'mensual';
  if (!esMensual) {
    if (anoFiltrado === anoActual) {
      mesesMeta = 13 - mesActual; // meses restantes incluyendo el mes actual
      labelPeriodo = `anual (${mesesMeta} meses restantes)`;
    } else {
      mesesMeta = 12;
      labelPeriodo = 'anual';
    }
  }
  const meta = META_MENSUAL * mesesMeta;
  const pct = Math.min(Math.round((valorAceptado / meta) * 100), 100);
  const pctReal = Math.round((valorAceptado / meta) * 100);
  const colorMeta = pctReal >= 100 ? '#2E7D32' : pctReal >= 80 ? '#1565C0' : pctReal >= 50 ? '#F57F17' : '#C62828';
  const labelMeta = pctReal >= 100 ? '🏆 Meta cumplida' : pctReal >= 80 ? '🔵 Muy cerca de la meta' : pctReal >= 50 ? '🟡 En progreso' : '🔴 Por debajo de la meta';

  document.getElementById('stats-cards').innerHTML = `
    <div class="stat-card" style="grid-column:1/-1;border-color:${colorMeta};padding:20px 24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:12px;font-weight:700;color:${colorMeta};text-transform:uppercase;letter-spacing:0.5px">Meta de ventas ${labelPeriodo}</div>
          <div style="font-size:22px;font-weight:800;color:${colorMeta};margin-top:2px">${pctReal}% cumplido</div>
          <div style="font-size:12px;color:var(--gris-medio);margin-top:2px">${labelMeta}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:12px;color:var(--gris-medio)">Ventas aceptadas</div>
          <div style="font-size:20px;font-weight:800;color:${colorMeta}">$${(valorAceptado/1000000).toFixed(1)}M</div>
          <div style="font-size:12px;color:var(--gris-medio)">de $${(meta/1000000).toFixed(0)}M meta</div>
        </div>
      </div>
      <div style="background:#eee;border-radius:8px;height:12px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${colorMeta};border-radius:8px;transition:width 0.5s ease"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px;color:var(--gris-medio)">
        <span>$0</span><span>Meta: $${(meta/1000000).toFixed(0)}M ($${(META_MENSUAL/1000000).toFixed(0)}M/mes × ${mesesMeta} ${mesesMeta===1?'mes':'meses'})</span>
      </div>
    </div>
    <div class="stat-card"><div class="valor">${total}</div><div class="etiqueta">Total cotizaciones</div></div>
    <div class="stat-card" style="border-color:var(--verde)"><div class="valor" style="color:var(--verde)">${aceptadas}</div><div class="etiqueta">Aceptadas</div></div>
    <div class="stat-card" style="border-color:var(--naranja)"><div class="valor" style="color:var(--naranja)">$${(totalValor/1000000).toFixed(1)}M</div><div class="etiqueta">Valor total cotizado</div></div>
    <div class="stat-card" style="border-color:var(--azul)">
      <div style="display:flex;flex-direction:column;gap:6px">
        <div>
          <div class="valor" style="color:var(--azul);font-size:20px">${tasaExito}%</div>
          <div class="etiqueta">Tasa de éxito (# cotizaciones)</div>
        </div>
        <div style="border-top:1px solid var(--gris-borde);padding-top:6px">
          <div class="valor" style="color:var(--verde);font-size:20px">${totalValor > 0 ? Math.round((valorAceptado/totalValor)*100) : 0}%</div>
          <div class="etiqueta">Tasa de éxito (valor cotizado)</div>
        </div>
      </div>
    </div>`;

  const estados = ['Prospecto','Borrador','Enviada','Negociación','Aceptada','Rechazada'];
  const colores = ['#7B1FA2','#E65100','#1565C0','#F57F17','#2E7D32','#C62828'];
  const conteos = estados.map(e => datos.filter(c => c.estado === e).length);
  const ctx = document.getElementById('chart-estados').getContext('2d');
  if (window._chartEstados) window._chartEstados.destroy();
  window._chartEstados = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: estados, datasets: [{ data: conteos, backgroundColor: colores, borderWidth: 2 }] },
    options: { plugins: { legend: { position: 'bottom' } } }
  });

  const porCliente = {};
  datos.forEach(c => {
    const k = c.cliente?.nombre;
    if (!k) return;
    if (!porCliente[k]) porCliente[k] = 0;
    porCliente[k] += (c.totales?.total || 0);
  });
  const top = Object.entries(porCliente).sort((a,b) => b[1]-a[1]).slice(0,5);
  document.getElementById('top-clientes').innerHTML = top.length ? top.map(([n,v],i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gris-claro)">
      <span style="background:var(--azul);color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${i+1}</span>
      <span style="flex:1;font-size:13px">${n}</span>
      <span style="font-weight:700;color:var(--azul)">$${(v/1000000).toFixed(2)}M</span>
    </div>`).join('') : '<div class="empty-state">Sin datos aún</div>';
}

// ═══════════════════════════════
// PIPELINE KANBAN
// ═══════════════════════════════
const COLUMNAS = [
  { id: 'Prospecto',   label: 'Prospecto',    color: '#7B1FA2', bg: '#F3E5F5' },
  { id: 'Borrador',    label: 'Cotizado',     color: '#E65100', bg: '#FFF3E0' },
  { id: 'Enviada',     label: 'Enviada',      color: '#1565C0', bg: '#E3F2FD' },
  { id: 'Negociación', label: 'Negociación',  color: '#F57F17', bg: '#FFF8E1' },
  { id: 'Aceptada',    label: 'Aceptada',     color: '#2E7D32', bg: '#E8F5E9' },
  { id: 'Rechazada',   label: 'Rechazada',    color: '#C62828', bg: '#FFEBEE' },
];

let dragId = null;
let _periodoPipeline = 'todo';

function setPeriodoPipeline(p) {
  _periodoPipeline = p;
  _setPeriodoBotones('pipe', p);
  renderPipeline();
}

function versionesLatest() {
  const map = {};
  COTIZACIONES.forEach(c => {
    const n = parseInt((c.version||'V1').replace(/\D/g,'')) || 1;
    if (!map[c.numero] || n > (parseInt((map[c.numero].version||'V1').replace(/\D/g,''))||1)) map[c.numero] = c;
  });
  return Object.values(map);
}

function renderPipeline() {
  _poblarFiltrosPeriodoVendedor('pipe');
  const board = document.getElementById('kanban-board');
  const resumen = document.getElementById('pipeline-resumen');
  const latest = _filtrarPorPeriodoVendedor(versionesLatest(), 'pipe', _periodoPipeline);

  board.innerHTML = COLUMNAS.map(col => {
    const cards = latest.filter(c => c.estado === col.id);
    const totalCol = cards.reduce((s, c) => s + c.totales.total, 0);
    const cardsHTML = cards.length
      ? cards.map(c => `
          <div class="kanban-card" draggable="true"
               style="border-left-color:${col.color}"
               data-id="${c.id}"
               ondragstart="onDragStart(event)"
               ondragend="onDragEnd(event)">
            <div class="kc-num">${c.numero} ${c.version||''}</div>
            <div class="kc-cliente">${c.cliente.nombre}</div>
            <div class="kc-proyecto">${c.cliente.proyecto || '—'}</div>
            <div class="kc-total">$${c.totales.total.toLocaleString()}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
              <div class="kc-fecha">${new Date(c.fecha+'T12:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}</div>
              <div class="flex-gap">
                <button class="btn btn-secundario btn-xs" onclick="abrirModalNotas(${c.id})" title="Notas de seguimiento">📝${c.notasSeguimiento?.length ? ' ' + c.notasSeguimiento.length : ''}</button>
                <button class="btn btn-secundario btn-xs" onclick="previsualizarCotizacionById(${c.id})" title="Ver PDF">👁️</button>
                <button class="btn btn-primario btn-xs" onclick="cargarCotizacion(${c.id})" title="Editar">✏️</button>
              </div>
            </div>
          </div>`).join('')
      : `<div class="kanban-drop-hint">Arrastra aquí</div>`;

    return `
      <div class="kanban-col">
        <div class="kanban-col-header" style="background:${col.bg};color:${col.color}">
          <span class="col-titulo">${col.label}</span>
          <span class="col-count">${cards.length}</span>
        </div>
        <div class="kanban-col-body"
             data-estado="${col.id}"
             ondragover="onDragOver(event)"
             ondragleave="onDragLeave(event)"
             ondrop="onDrop(event)">
          ${cardsHTML}
        </div>
      </div>`;
  }).join('');

  // Resumen de valores por columna (respeta los mismos filtros de período/vendedor que el tablero)
  resumen.innerHTML = COLUMNAS.map(col => {
    const cards = latest.filter(c => c.estado === col.id);
    const total = cards.reduce((s, c) => s + c.totales.total, 0);
    if (!cards.length) return '';
    return `<div style="background:white;border-radius:6px;padding:8px 14px;box-shadow:var(--sombra);border-top:3px solid ${col.color};min-width:130px">
      <div style="font-size:10px;font-weight:700;color:${col.color};text-transform:uppercase">${col.label}</div>
      <div style="font-size:15px;font-weight:700;color:var(--gris-oscuro)">$${(total/1000000).toFixed(1)}M</div>
      <div style="font-size:11px;color:var(--gris-medio)">${cards.length} cotización${cards.length>1?'es':''}</div>
    </div>`;
  }).join('');
}

function onDragStart(e) {
  dragId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.kanban-col-body').forEach(c => c.classList.remove('drag-over'));
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const nuevoEstado = e.currentTarget.dataset.estado;
  const cot = COTIZACIONES.find(c => String(c.id) === String(dragId));
  if (cot && cot.estado !== nuevoEstado) {
    cot.estado = nuevoEstado;
    const cotActualizada = { ...cot, estado: nuevoEstado };
    sb.from('cotizaciones').upsert({
      numero: cot.numero,
      version: cot.version || 'V1',
      estado: nuevoEstado,
      cliente: cot.cliente,
      items: cot.items,
      condiciones: cot.condiciones,
      datos: cotActualizada,
      modificado: new Date().toISOString()
    }, { onConflict: 'numero,version' }).then(({ error }) => {
      if (error) console.error('Error actualizando estado pipeline:', error.message);
    });
    if (nuevoEstado === 'Aceptada') {
      const osExistente = ORDENES.find(o => o.cotizacion === cot.numero);
      if (!osExistente) crearOrdenDesdeCotizacion(cot);
    }
    renderHistorico();
    renderEstadisticas();
  }
  dragId = null;
  renderPipeline();
}

// ═══════════════════════════════
// PIPELINE PRODUCCIÓN
// ═══════════════════════════════
const COLUMNAS_OS = [
  { id: 'Pendiente',     label: 'Pendiente',     color: '#E65100', bg: '#FFF3E0' },
  { id: 'En producción', label: 'En producción', color: '#1565C0', bg: '#E3F2FD' },
  { id: 'Listo',         label: 'Listo',          color: '#2E7D32', bg: '#E8F5E9' },
  { id: 'Despachado',    label: 'Despachado',     color: '#00695C', bg: '#E0F2F1' },
  { id: 'Cancelado',     label: 'Cancelado',      color: '#C62828', bg: '#FFEBEE' },
];

let dragOSId = null;

function evaluarInventarioOrden(o, invMap) {
  const items = o.items || [];
  if (!items.length) return { estado: 'sin-datos', detalle: 'Orden sin productos detallados — no se puede evaluar inventario' };
  const faltantes = [];
  items.forEach(it => {
    const req = Number(it.cantidad) || 0;
    const disp = invMap[it.nombre] !== undefined ? invMap[it.nombre] : 0;
    if (disp < req) faltantes.push(`${it.nombre}: faltan ${(req - disp).toLocaleString()} (hay ${disp.toLocaleString()} de ${req.toLocaleString()})`);
  });
  if (faltantes.length) return { estado: 'insuficiente', detalle: 'Inventario insuficiente:\n• ' + faltantes.join('\n• ') };
  return { estado: 'suficiente', detalle: 'Inventario suficiente para todos los productos de la orden' };
}

function renderPipelineProduccion() {
  const board = document.getElementById('kanban-board-prod');
  const resumen = document.getElementById('pipeline-prod-resumen');
  // Mapa de inventario disponible por producto (producido - despachado)
  const invMap = {};
  calcularInventario().forEach(r => { invMap[r.producto] = r.enInventario; });
  const bgInv = { 'suficiente':'#E8F5E9', 'insuficiente':'#FFEBEE', 'sin-datos':'#FFFFFF' };
  const bordeInv = { 'suficiente':'#2E7D32', 'insuficiente':'#C62828', 'sin-datos':null };
  board.innerHTML = COLUMNAS_OS.map(col => {
    const cards = ORDENES.filter(o => o.estado === col.id);
    const cardsHTML = cards.length
      ? cards.map(o => {
          const inv = evaluarInventarioOrden(o, invMap);
          const borde = bordeInv[inv.estado] || col.color;
          const iconoInv = inv.estado === 'suficiente' ? '🟢' : inv.estado === 'insuficiente' ? '🔴' : '⚪';
          return `
          <div class="kanban-card" draggable="true"
               style="border-left-color:${borde};background:${bgInv[inv.estado]}"
               data-os-id="${o.id}"
               title="${inv.detalle.replace(/"/g,'&quot;')}"
               ondragstart="onDragStartOS(event)"
               ondragend="onDragEndOS(event)">
            <div class="kc-num">${iconoInv} ${o.numero}</div>
            <div class="kc-cliente">${o.cliente}</div>
            <div class="kc-proyecto" style="font-size:11px;color:var(--gris-medio);margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${o.descripcion}">${o.descripcion}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
              <div class="kc-fecha">${o.fechaEntrega ? new Date(o.fechaEntrega+'T12:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short'}) : '—'}</div>
              <button class="btn btn-primario btn-xs" onclick="editarOrden('${o.id}')">✏️</button>
            </div>
          </div>`;
        }).join('')
      : `<div class="kanban-drop-hint">Arrastra aquí</div>`;
    return `
      <div class="kanban-col">
        <div class="kanban-col-header" style="background:${col.bg};color:${col.color}">
          <span class="col-titulo">${col.label}</span>
          <span class="col-count">${cards.length}</span>
        </div>
        <div class="kanban-col-body"
             data-os-estado="${col.id}"
             ondragover="onDragOverOS(event)"
             ondragleave="onDragLeaveOS(event)"
             ondrop="onDropOS(event)">
          ${cardsHTML}
        </div>
      </div>`;
  }).join('');

  // Leyenda de colores
  const leyenda = document.getElementById('pipeline-prod-leyenda');
  if (leyenda) leyenda.innerHTML = `
    <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border-radius:3px;background:#E8F5E9;border:1px solid #2E7D32;display:inline-block"></span> Inventario suficiente</span>
    <span style="display:inline-flex;align-items:center;gap:4px;margin-left:14px"><span style="width:12px;height:12px;border-radius:3px;background:#FFEBEE;border:1px solid #C62828;display:inline-block"></span> Inventario insuficiente</span>
    <span style="display:inline-flex;align-items:center;gap:4px;margin-left:14px"><span style="width:12px;height:12px;border-radius:3px;background:#fff;border:1px solid #ccc;display:inline-block"></span> Sin productos detallados</span>`;

  resumen.innerHTML = COLUMNAS_OS.map(col => {
    const count = ORDENES.filter(o => o.estado === col.id).length;
    if (!count) return '';
    return `<div style="background:white;border-radius:6px;padding:8px 14px;box-shadow:var(--sombra);border-top:3px solid ${col.color};min-width:130px">
      <div style="font-size:10px;font-weight:700;color:${col.color};text-transform:uppercase">${col.label}</div>
      <div style="font-size:15px;font-weight:700;color:var(--gris-oscuro)">${count}</div>
      <div style="font-size:11px;color:var(--gris-medio)">orden${count>1?'es':''}</div>
    </div>`;
  }).join('');
}

function onDragStartOS(e) {
  dragOSId = e.currentTarget.dataset.osId;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onDragEndOS(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.kanban-col-body').forEach(c => c.classList.remove('drag-over'));
}
function onDragOverOS(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}
function onDragLeaveOS(e) { e.currentTarget.classList.remove('drag-over'); }
function onDropOS(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const nuevoEstado = e.currentTarget.dataset.osEstado;
  cambiarEstadoOrden(dragOSId, nuevoEstado, true);
  dragOSId = null;
}

function abrirModalEstadoOS(id) {
  document.getElementById('estado-os-id').value = id;
  document.getElementById('modal-estado-os').classList.add('abierto');
}

function aplicarEstadoOrden(nuevoEstado) {
  const id = document.getElementById('estado-os-id').value;
  cerrarModal('modal-estado-os');
  cambiarEstadoOrden(id, nuevoEstado);
}

function cambiarEstadoOrden(id, nuevoEstado, fromDrop) {
  const idx = ORDENES.findIndex(o => String(o.id) === String(id));
  if (idx < 0) return;
  ORDENES[idx] = { ...ORDENES[idx], estado: nuevoEstado };
  const o = ORDENES[idx];
  sb.from('ordenes_servicio').upsert({ numero: o.numero, datos: o, modificado: new Date().toISOString() }, { onConflict: 'numero' })
    .then(({ error }) => { if (error) console.error('Error cambiando estado OS:', error.message); });
  if (fromDrop) renderPipelineProduccion();
  // re-render tabla si está visible
  if (document.getElementById('pantalla-ordenes-servicio')?.classList.contains('activa')) renderOrdenes();
}

// ═══════════════════════════════
// MODALES
// ═══════════════════════════════
function cerrarModal(id) { document.getElementById(id).classList.remove('abierto'); }
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('abierto'); });
});
