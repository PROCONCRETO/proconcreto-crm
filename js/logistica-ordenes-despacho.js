// ═══════════════════════════════
// ÓRDENES DE DESPACHO (Logística) — 2026-08-29, a pedido del usuario
// ═══════════════════════════════
// Encadena Producción → Logística: hasta ahora, para programar una entrega alguien en Logística
// tenía que saber de memoria qué Orden de Producción ya estaba lista y elegirla a mano en un
// desplegable escondido dentro del modal de "Nuevo Viaje" (aplicarOrdenAEntrega(), js/logistica.js)
// — no había ninguna vista que dijera "esto ya se puede despachar". Esta pantalla es esa vista.
//
// Es una vista CALCULADA en memoria sobre ORDENES (js/ordenes-produccion.js), el inventario
// (calcularInventario()/evaluarInventarioOrden(), js/produccion-diaria.js y
// js/historico-clientes-stats.js) y lo que ya está programado en VIAJES
// (_cantidadProgramadaPorProducto(), js/logistica.js) — no hay tabla ni migración nueva en
// Supabase, ni suscripción de tiempo real aparte: se refresca sola cada vez que cambian
// ordenes_servicio/producciones/entregas_programadas, porque esos recargarXRT() ya llaman
// rerenderPantallaActiva() (ver js/datos-realtime.js).

// "Lista para despachar" = estado "Listo" O, aunque siga "En producción", ya hay algo de
// inventario disponible para al menos un producto de la orden (confirmado con el usuario: mejor
// que se pueda empezar a programar lo que ya hay, sin esperar a que TODA la orden termine).
function renderOrdenesDespacho() {
  const tbody = document.getElementById('ordenes-despacho-body');
  if (!tbody) return;

  const invMap = {};
  calcularInventario().forEach(r => { invMap[r.producto] = r.enInventario; });

  const q = (document.getElementById('buscar-ordenes-despacho')?.value || '').toLowerCase();
  const mostrarProgramadas = document.getElementById('mostrar-programadas-despacho')?.checked || false;

  let data = ORDENES.filter(o => o.estado !== 'Cancelado' && o.estado !== 'Despachado');
  data = data.filter(o => o.estado === 'Listo' || _itemsDeOrden(o).some(it => (invMap[it.nombre] || 0) > 0));

  // Saldo pendiente de PROGRAMAR (no de entregar): lo que todavía no tiene NINGÚN viaje asignado,
  // ni siquiera uno pendiente — ver _cantidadProgramadaPorProducto() en js/logistica.js. Por
  // defecto se ocultan las órdenes ya completamente programadas (aunque sus entregas todavía no
  // se hayan marcado "Hecha"), para que la lista solo muestre lo que de verdad falta por programar.
  data = data.map(o => {
    const programadoPorClave = _cantidadProgramadaPorProducto(o.id);
    const itemsConSaldo = _itemsDeOrden(o).map(it => {
      const clave = _claveItemOrden(it);
      const saldo = Math.max(0, (Number(it.cantidad) || 0) - (programadoPorClave[clave] || 0));
      return { ...it, saldo };
    });
    const saldoTotal = itemsConSaldo.reduce((s, it) => s + it.saldo, 0);
    return { orden: o, itemsConSaldo, saldoTotal };
  });

  if (!mostrarProgramadas) data = data.filter(r => r.saldoTotal > 0);

  if (q) data = data.filter(r =>
    (r.orden.numero || '').toLowerCase().includes(q) ||
    (r.orden.cliente || '').toLowerCase().includes(q)
  );

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><div class="icono">📦</div><div>No hay órdenes listas para despachar${mostrarProgramadas ? '' : ' (o ya están completamente programadas — marca "Mostrar completamente programadas" para verlas)'}.</div></td></tr>`;
    return;
  }

  // Mismos colores que el badge de estado de Órdenes de Producción (js/ordenes-produccion.js,
  // renderOrdenes()) — para que el estado se vea igual en las dos pantallas.
  const colorOS = { 'Pendiente': '#E65100', 'En producción': '#1565C0', 'Listo': '#2E7D32', 'Despachado': '#00695C', 'Cancelado': '#C62828' };
  const bgOS = { 'Pendiente': '#FFF3E0', 'En producción': '#E3F2FD', 'Listo': '#E8F5E9', 'Despachado': '#E0F2F1', 'Cancelado': '#FFEBEE' };

  tbody.innerHTML = data.map(({ orden: o, itemsConSaldo, saldoTotal }) => {
    const invEval = evaluarInventarioOrden(o, invMap);
    const invBadge = invEval.estado === 'suficiente'
      ? `<span style="color:#2E7D32;font-weight:700;font-size:11px" title="${_esc(invEval.detalle)}">🟢 Con inventario</span>`
      : invEval.estado === 'insuficiente'
        ? `<span style="color:#E65100;font-weight:700;font-size:11px" title="${_esc(invEval.detalle)}">🟡 Parcial</span>`
        : `<span style="color:var(--gris-medio);font-size:11px" title="${_esc(invEval.detalle)}">⚪ Sin datos</span>`;
    const itemsTxt = itemsConSaldo.map(it =>
      `${_esc(it.nombre)}: ${it.saldo.toLocaleString()} ${_esc(it.unidad || '')} pendiente de programar (de ${(Number(it.cantidad) || 0).toLocaleString()})`
    ).join('<br>');
    return `
    <tr style="border-top:2px solid var(--azul-oscuro)">
      <td style="font-weight:700;color:var(--azul)">${_esc(o.numero)}</td>
      <td style="font-weight:600">${_esc(o.cliente)}</td>
      <td style="font-size:12px;max-width:280px">${itemsTxt || '—'}</td>
      <td>${invBadge}</td>
      <td>${o.fechaEntrega ? new Date(o.fechaEntrega + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
      <td><span class="badge" style="background:${bgOS[o.estado] || '#eee'};color:${colorOS[o.estado] || '#333'}">${_esc(o.estado)}</span></td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-primario btn-xs" onclick="programarEntregaDesdeOrden('${o.id}')" ${saldoTotal <= 0 ? 'disabled title="Ya está completamente programada"' : ''}>🚛 Programar entrega</button>
          <button class="btn btn-secundario btn-xs" onclick="editarOrden('${o.id}')">👁️ Ver orden</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// Abre "Nuevo Viaje" con una entrega ya vinculada a esta orden — reutiliza 100% el flujo que ya
// existía (abrirModalViaje()/agregarEntregaViaje()/aplicarOrdenAEntrega(), js/logistica.js), no
// hay ningún modal nuevo que construir. Si la orden tiene fecha de entrega estimada y todavía no
// pasó, se usa esa; si no, hoy — el campo Fecha del modal sigue siendo editable antes de guardar.
function programarEntregaDesdeOrden(ordenId) {
  const orden = ORDENES.find(o => String(o.id) === String(ordenId));
  if (!orden) return;
  const hoy = _fmtISO(new Date());
  const fecha = (orden.fechaEntrega && orden.fechaEntrega >= hoy) ? orden.fechaEntrega : hoy;
  abrirModalViaje(fecha);
  agregarEntregaViaje();
  aplicarOrdenAEntrega(0, ordenId);
}
