// ═══════════════════════════════
// PRODUCCIÓN DIARIA
// ═══════════════════════════════
let PRODUCCIONES = [];

function renderProduccionDiaria() {
  const tbody = document.getElementById('produccion-body');
  const resumen = document.getElementById('prod-diaria-resumen');
  const q = (document.getElementById('buscar-produccion')?.value || '').toLowerCase();
  const fFecha = document.getElementById('filtro-fecha-prod')?.value || '';

  let data = [...PRODUCCIONES];
  if (fFecha) data = data.filter(p => p.fecha === fFecha);
  if (q) data = data.filter(p => (p.producto || '').toLowerCase().includes(q) || (p.responsable || '').toLowerCase().includes(q));
  // Orden: más reciente primero
  data.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creadoEn || '').localeCompare(a.creadoEn || ''));

  // Resumen
  const hoy = new Date().toISOString().split('T')[0];
  const totalHoy = PRODUCCIONES.filter(p => p.fecha === hoy).reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
  const totalMostrado = data.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
  resumen.innerHTML = `
    <div style="background:white;border-radius:6px;padding:8px 14px;box-shadow:var(--sombra);border-top:3px solid var(--verde);min-width:140px">
      <div style="font-size:10px;font-weight:700;color:var(--verde);text-transform:uppercase">Producido hoy</div>
      <div style="font-size:18px;font-weight:800;color:var(--gris-oscuro)">${totalHoy.toLocaleString()} ud</div>
    </div>
    <div style="background:white;border-radius:6px;padding:8px 14px;box-shadow:var(--sombra);border-top:3px solid var(--azul);min-width:140px">
      <div style="font-size:10px;font-weight:700;color:var(--azul);text-transform:uppercase">${fFecha || q ? 'Filtrado' : 'Total registros'}</div>
      <div style="font-size:18px;font-weight:800;color:var(--gris-oscuro)">${totalMostrado.toLocaleString()} ud</div>
      <div style="font-size:11px;color:var(--gris-medio)">${data.length} registro${data.length===1?'':'s'}</div>
    </div>`;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><div class="icono">📅</div><div>No hay producciones registradas${fFecha||q?' para este filtro':''}.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(p => `
    <tr style="border-top:2px solid var(--azul-oscuro)">
      <td style="font-weight:600">${p.fecha ? new Date(p.fecha+'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td style="font-weight:600;color:var(--azul)">${p.producto || '—'}</td>
      <td style="font-weight:700">${(Number(p.cantidad)||0).toLocaleString()} <span style="font-size:11px;color:var(--gris-medio);font-weight:400">${p.unidad||'ud'}</span></td>
      <td>${p.orden ? `<span style="font-size:11px;background:#E3F2FD;color:#1565C0;padding:2px 6px;border-radius:3px;font-weight:600">${p.orden}</span>` : '—'}</td>
      <td>${p.responsable || '—'}</td>
      <td style="color:var(--gris-medio);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${p.observaciones||''}">${p.observaciones || '—'}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-primario btn-xs" onclick="editarProduccion('${p.id}')">✏️ Editar</button>
          <button class="btn btn-rojo btn-xs" onclick="eliminarProduccion('${p.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function poblarSelectProductos() {
  const sel = document.getElementById('m-prod-producto');
  if (!sel) return;
  // Agrupar productos por grupo
  const grupos = {};
  PRODUCTOS.forEach(p => { (grupos[p.grupo] = grupos[p.grupo] || []).push(p); });
  let html = '<option value="">— Selecciona un producto —</option>';
  Object.keys(grupos).sort().forEach(g => {
    html += `<optgroup label="${g}">`;
    grupos[g].forEach(p => {
      html += `<option value="${p.nombre}" data-unidad="${p.unidad}">${p.nombre}</option>`;
    });
    html += '</optgroup>';
  });
  sel.innerHTML = html;
}

function poblarSelectOrdenesProd() {
  const sel = document.getElementById('m-prod-orden');
  if (!sel) return;
  let html = '<option value="">— Sin orden asociada —</option>';
  ORDENES.filter(o => o.estado !== 'Despachado' && o.estado !== 'Cancelado')
    .forEach(o => { html += `<option value="${o.numero}">${o.numero} — ${o.cliente||''}</option>`; });
  sel.innerHTML = html;
}

function abrirModalProduccion() {
  document.getElementById('m-prod-id').value = '';
  document.getElementById('modal-produccion-titulo').textContent = '📅 Registrar Producción';
  poblarSelectProductos();
  poblarSelectOrdenesProd();
  document.getElementById('m-prod-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('m-prod-cantidad').value = '';
  document.getElementById('m-prod-producto').value = '';
  document.getElementById('m-prod-orden').value = '';
  const perfil = USUARIOS_CRM[USUARIO_ACTUAL?.email];
  document.getElementById('m-prod-responsable').value = perfil?.nombre || '';
  document.getElementById('m-prod-obs').value = '';
  document.getElementById('modal-produccion').classList.add('abierto');
}

function editarProduccion(id) {
  const p = PRODUCCIONES.find(x => String(x.id) === String(id));
  if (!p) return;
  document.getElementById('m-prod-id').value = p.id;
  document.getElementById('modal-produccion-titulo').textContent = '✏️ Editar Producción';
  poblarSelectProductos();
  poblarSelectOrdenesProd();
  document.getElementById('m-prod-fecha').value = p.fecha || '';
  document.getElementById('m-prod-cantidad').value = p.cantidad || '';
  document.getElementById('m-prod-producto').value = p.producto || '';
  // Si la orden asociada ya no está en la lista activa, agregarla
  if (p.orden && !document.querySelector(`#m-prod-orden option[value="${p.orden}"]`)) {
    const opt = document.createElement('option'); opt.value = p.orden; opt.textContent = p.orden; document.getElementById('m-prod-orden').appendChild(opt);
  }
  document.getElementById('m-prod-orden').value = p.orden || '';
  document.getElementById('m-prod-responsable').value = p.responsable || '';
  document.getElementById('m-prod-obs').value = p.observaciones || '';
  document.getElementById('modal-produccion').classList.add('abierto');
}

function guardarProduccion() {
  const fecha = document.getElementById('m-prod-fecha').value;
  const producto = document.getElementById('m-prod-producto').value;
  const cantidad = parseFloat(document.getElementById('m-prod-cantidad').value);
  if (!fecha || !producto || !(cantidad > 0)) { alert('Completa los campos obligatorios: Fecha, Producto y Cantidad (mayor a 0).'); return; }
  const prodCat = PRODUCTOS.find(p => p.nombre === producto);
  const editId = document.getElementById('m-prod-id').value;
  const reg = {
    id: editId || String(Date.now()),
    fecha,
    producto,
    unidad: prodCat?.unidad || 'ud',
    grupo: prodCat?.grupo || '',
    cantidad,
    orden: document.getElementById('m-prod-orden').value,
    responsable: document.getElementById('m-prod-responsable').value.trim(),
    observaciones: document.getElementById('m-prod-obs').value.trim(),
    creadoPor: USUARIO_ACTUAL?.email,
    creadoEn: editId ? (PRODUCCIONES.find(x => String(x.id) === String(editId))?.creadoEn || new Date().toISOString()) : new Date().toISOString(),
  };
  const idx = PRODUCCIONES.findIndex(x => String(x.id) === String(reg.id));
  if (idx >= 0) PRODUCCIONES[idx] = reg; else PRODUCCIONES.unshift(reg);
  sb.from('producciones').upsert({ id: reg.id, datos: reg, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) console.error('Error guardando producción:', error.message); });
  cerrarModal('modal-produccion');
  renderProduccionDiaria();
}

function eliminarProduccion(id) {
  const p = PRODUCCIONES.find(x => String(x.id) === String(id));
  if (!p || !confirm(`¿Eliminar el registro de producción de ${p.producto} (${p.cantidad} ${p.unidad||'ud'})?`)) return;
  PRODUCCIONES = PRODUCCIONES.filter(x => String(x.id) !== String(id));
  renderProduccionDiaria();
  sb.from('producciones').delete().eq('id', p.id)
    .then(({ error }) => {
      if (error) {
        console.error('Error eliminando producción:', error.message);
        alert('Error al eliminar el registro: ' + error.message);
        PRODUCCIONES.push(p);
        renderProduccionDiaria();
      }
    });
}

// ═══════════════════════════════
// INVENTARIO DE PRODUCTO TERMINADO
// ═══════════════════════════════
function calcularInventario() {
  // Producido: suma de producciones diarias por producto
  const inv = {};
  PRODUCCIONES.forEach(p => {
    const k = p.producto;
    if (!k) return;
    if (!inv[k]) {
      const cat = PRODUCTOS.find(x => x.nombre === k);
      inv[k] = { producto: k, grupo: p.grupo || cat?.grupo || '—', unidad: p.unidad || cat?.unidad || 'ud', producido: 0, despachado: 0, ultima: '' };
    }
    inv[k].producido += Number(p.cantidad) || 0;
    if ((p.fecha || '') > inv[k].ultima) inv[k].ultima = p.fecha || '';
  });
  // Despachado: ítems de órdenes en estado "Despachado"
  ORDENES.filter(o => o.estado === 'Despachado').forEach(o => {
    (o.items || []).forEach(it => {
      const k = it.nombre;
      if (!k || !inv[k]) return; // solo descontar si el producto existe en inventario
      inv[k].despachado += Number(it.cantidad) || 0;
    });
  });
  return Object.values(inv).map(r => ({ ...r, enInventario: r.producido - r.despachado }));
}

function poblarFiltroGrupoInv() {
  const sel = document.getElementById('filtro-grupo-inv');
  if (!sel) return;
  const actual = sel.value;
  const grupos = [...new Set(calcularInventario().map(r => r.grupo))].filter(Boolean).sort();
  sel.innerHTML = '<option value="">Todos los grupos</option>' + grupos.map(g => `<option value="${g}">${g}</option>`).join('');
  sel.value = actual;
}

function renderInventario() {
  poblarFiltroGrupoInv();
  const tbody = document.getElementById('inventario-body');
  const resumen = document.getElementById('inv-resumen');
  const q = (document.getElementById('buscar-inventario')?.value || '').toLowerCase();
  const grupo = document.getElementById('filtro-grupo-inv')?.value || '';

  let data = calcularInventario();
  if (grupo) data = data.filter(r => r.grupo === grupo);
  if (q) data = data.filter(r => r.producto.toLowerCase().includes(q));
  data.sort((a, b) => a.grupo.localeCompare(b.grupo) || a.producto.localeCompare(b.producto));

  const totalRefs = data.length;
  const totalStock = data.reduce((s, r) => s + r.enInventario, 0);
  resumen.innerHTML = `
    <div style="background:white;border-radius:6px;padding:8px 14px;box-shadow:var(--sombra);border-top:3px solid var(--azul);min-width:150px">
      <div style="font-size:10px;font-weight:700;color:var(--azul);text-transform:uppercase">Referencias en stock</div>
      <div style="font-size:18px;font-weight:800;color:var(--gris-oscuro)">${totalRefs}</div>
    </div>
    <div style="background:white;border-radius:6px;padding:8px 14px;box-shadow:var(--sombra);border-top:3px solid var(--verde);min-width:150px">
      <div style="font-size:10px;font-weight:700;color:var(--verde);text-transform:uppercase">Unidades en inventario</div>
      <div style="font-size:18px;font-weight:800;color:var(--gris-oscuro)">${totalStock.toLocaleString()}</div>
    </div>`;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><div class="icono">📦</div><div>Sin existencias${grupo||q?' para este filtro':''}. Registra producciones diarias para alimentar el inventario.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(r => {
    const bajo = r.enInventario <= 0;
    return `
    <tr style="border-top:1px solid var(--gris-borde)">
      <td style="font-weight:600;color:var(--azul)">${r.producto}</td>
      <td style="color:var(--gris-medio)">${r.grupo}</td>
      <td>${r.unidad}</td>
      <td style="text-align:right">${r.producido.toLocaleString()}</td>
      <td style="text-align:right;color:var(--gris-medio)">${r.despachado.toLocaleString()}</td>
      <td style="text-align:right;font-weight:800;color:${bajo?'#C62828':'#2E7D32'}">${r.enInventario.toLocaleString()}</td>
      <td style="color:var(--gris-medio)">${r.ultima ? new Date(r.ultima+'T12:00').toLocaleDateString('es-CO') : '—'}</td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════
// AUTH + INIT
// ═══════════════════════════════
window.onload = async function() {
  // Detectar si venimos de un link de invitación o recuperación de contraseña
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION' && session && window.location.hash.includes('type=invite')) {
      // Mostrar formulario de nueva contraseña
      document.getElementById('login-overlay').style.display = 'flex';
      document.querySelector('.login-box').style.display = 'none';
      document.getElementById('panel-recuperacion').style.display = 'none';
      document.getElementById('panel-nueva-contrasena').style.display = 'block';
      if (window.location.hash.includes('type=invite')) {
        document.getElementById('nueva-pass-titulo').textContent = 'Bienvenido/a al CRM';
        document.getElementById('nueva-pass-sub').textContent = 'Crea tu contraseña para comenzar a usar el sistema.';
      } else {
        document.getElementById('nueva-pass-titulo').textContent = 'Restablecer contraseña';
        document.getElementById('nueva-pass-sub').textContent = 'Ingresa tu nueva contraseña.';
      }
      USUARIO_ACTUAL = session.user;
      return;
    }
    if (event === 'SIGNED_IN' && session && !document.getElementById('panel-nueva-contrasena').style.display.includes('block')) {
      if (!USUARIO_ACTUAL) {
        USUARIO_ACTUAL = session.user;
        document.getElementById('login-overlay').style.display = 'none';
        await mostrarApp();
      }
    }
  });

  const { data: { session } } = await sb.auth.getSession();
  if (session && !window.location.hash.includes('type=recovery') && !window.location.hash.includes('type=invite')) {
    USUARIO_ACTUAL = session.user;
    await mostrarApp();
  } else if (!session && !window.location.hash.includes('access_token')) {
    document.getElementById('login-overlay').style.display = 'flex';
  }
};

