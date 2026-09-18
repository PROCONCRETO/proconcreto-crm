// ═══════════════════════════════
// PRODUCCIÓN — DÍAS ATÍPICOS (2026-09-17)
// ═══════════════════════════════
// Permite marcar un día de producción como "atípico" (fuera de lo normal para su producto) y
// excluirlo del estándar de ciclos/día (media/desviación por producto, usado más adelante para
// costear mano de obra al fijar precios — esa conexión con Costeo de Producto queda fuera de
// esta vuelta, a pedido del usuario), SIN borrar el registro original y SIN que la exclusión sea
// automática ni arbitraria. Reglas de negocio (dadas textualmente por el usuario):
//   1) Nunca se borra un registro — la exclusión es un estado adicional (`estado` en
//      PRODUCCIONES, ver abajo).
//   2) Toda exclusión exige una causa de una lista cerrada (CAUSAS_DIA_ATIPICO).
//   3) Ningún registro se excluye automáticamente por estar fuera de rango estadístico — el
//      sistema solo puede sugerir "revisar" (_evaluarDesviacionRegistro()); la exclusión real la
//      hace una persona con causa registrada.
//   4) Quien marca sin ser aprobador deja el registro en 'pendiente_revision'; solo un aprobador
//      (_esUsuarioAprobadorProduccion(), js/config.js) puede pasarlo a 'excluido' — o saltarse el
//      paso intermedio si quien marca ya es aprobador.
//   5) El estándar se calcula por producto (o agrupado por Unidades/Ciclo si el producto no
//      tiene suficiente historial propio), solo con registros 'incluido', y se cachea — nunca se
//      recalcula solo porque llegó un dato nuevo (_recalcularEstandaresCiclos() es explícito).
//   6) Cada registro se compara contra el estándar de su producto: fuera de ±2σ -> "revisar";
//      fuera de ±3σ -> prioridad alta. Estos avisos nunca excluyen nada por sí mismos.
// Protección real del lado de Supabase (RLS + trigger de autoría) en
// sql/2026-09-17_dias_atipicos_produccion.sql — lo de acá es la capa de UI, igual que
// _esUsuarioCentroCostos() ya lo es para Centro de Costos.

let EVENTOS_ESPECIALES = [];

// Causas cerradas — clave estable (para agrupar el reporte de ciclos perdidos sin depender del
// texto exacto) + etiqueta visible. A diferencia de CAUSAS_REPROGRAMACION_CANCELACION
// (js/logistica.js, un array plano de strings) acá se necesita la clave porque también se
// convierte en `eventos_especiales.datos.tipoEvento`.
const CAUSAS_DIA_ATIPICO = [
  { clave: 'averia', etiqueta: 'Avería o falla mecánica' },
  { clave: 'falta_material', etiqueta: 'Falta de material o insumos' },
  { clave: 'ausencia_personal', etiqueta: 'Ausencia de personal' },
  { clave: 'cambio_molde', etiqueta: 'Cambio de molde (más tiempo del habitual)' },
  { clave: 'lote_parcial', etiqueta: 'Arranque o cierre parcial de lote' },
  { clave: 'mantenimiento', etiqueta: 'Mantenimiento programado' },
  { clave: 'otro', etiqueta: 'Otra razón' },
];
const ETIQUETA_CAUSA = Object.fromEntries(CAUSAS_DIA_ATIPICO.map(c => [c.clave, c.etiqueta]));

// Cadenas de la UI — texto exacto pedido por el usuario, fuente única de verdad para el JS (el
// HTML estático del diálogo en cotizaciones.html debe coincidir a mano con esto, mismo trade-off
// ya aceptado en el resto de la app, ej. _EMAILS_CENTRO_COSTOS).
const TEXTOS_DIA_ATIPICO = {
  title: 'Marcar día como atípico',
  context_template: '{fecha} — {producto}: {ciclos} ciclos registrados. El promedio de los últimos {dias} días para este producto es de {media} ciclos, con una variación típica de ± {desviacion}. Este valor está {n_sigmas} desviaciones estándar por {direccion} de lo normal.',
  causa_label: 'Causa',
  causa_otro_placeholder: 'Especifica la razón',
  descripcion_label: 'Descripción (opcional)',
  descripcion_placeholder: 'Agrega cualquier detalle que ayude a entender lo que pasó ese día',
  advertencia_variacion_normal: 'Este valor no se aleja de forma importante del comportamiento normal de este producto. Si lo excluyes sin una razón clara, tu estándar de costeo puede quedar sesgado. ¿Seguro que quieres continuar?',
  nota_no_se_elimina: 'Este registro no se elimina. Se conserva completo en el historial; solo se excluye del cálculo del estándar de ciclos/día, y queda registrado en la bitácora de eventos de la máquina.',
  boton_confirmar: 'Confirmar exclusión',
  boton_enviar_revision: 'Enviar para revisión',
  boton_cancelar: 'Cancelar',
  nota_pendiente_aprobacion: 'Un supervisor debe confirmar esta exclusión antes de que se aplique al cálculo del estándar.',
  estados: { incluido: 'Incluido', pendiente: 'Pendiente de revisión', excluido: 'Excluido — causa especial' },
};

// Mínimo de días "incluido" (propios o del grupo por Unidades/Ciclo) antes de calcular un
// estándar — ~2 semanas de planta. Más estricto que _MIN_INTENTADO_RANKING_DEFICIENCIA = 5
// (estadisticas-produccion.js), que solo alimenta un ranking cosmético — acá un σ inestable con
// pocos puntos alimentaría directo un flujo de aprobación real.
const N_MIN_DIAS_ESTANDAR = 10;

// Ventana del estándar — propia e independiente del período del dashboard general
// (_periodoProduccion, estadisticas-produccion.js): el estándar tiene su propio default de 90
// días pedido por el usuario, no debe cambiar solo porque alguien filtra el dashboard a "7 días".
let _periodoEstandarCiclos = 90;

// Caché del estándar — NUNCA se recalcula automáticamente (regla 5). Se llena perezosamente la
// primera vez que se necesita en la sesión, y solo se refresca con _recalcularEstandaresCiclos()
// (botón "🔄 Recalcular estándar" en Estadísticas de Producción).
let _estandaresCiclosCache = null;
let _estandaresCiclosCacheFecha = null;

// Estándar de ciclos/día por producto, solo sobre registros 'incluido' del período. Si un
// producto no alcanza N_MIN_DIAS_ESTANDAR días propios, se agrupa con los demás productos que
// comparten su mismo Unidades/Ciclo (mapaCiclo, mismo cruce CATALOGO↔COSTEO_PRODUCTOS que ya usa
// estadisticas-produccion.js) — un proxy de "mismo molde" — y se usa el promedio/desviación
// COMBINADO de ese grupo. Si ni el grupo alcanza el mínimo, no hay estándar (null): nunca se
// flaguea un registro sin una base mínimamente sólida. Reusa _ciclosPorDia()/_desviacionEstandar()
// (estadisticas-produccion.js, 2026-09-16) como bloques ya probados, no los reescribe.
function _calcularEstandaresCiclosPorProducto(periodoDias) {
  const mapaCiclo = _unidadesCicloPorProducto();
  const desde = periodoDias > 0 ? _fmtISO(_sumarDias(new Date(), -periodoDias)) : null;
  const incluidos = (typeof PRODUCCIONES !== 'undefined' ? PRODUCCIONES : []).filter(p =>
    (p.estado || 'incluido') === 'incluido' && mapaCiclo[p.producto] && (!desde || (p.fecha || '') >= desde));

  const porProducto = {};
  incluidos.forEach(p => { (porProducto[p.producto] = porProducto[p.producto] || []).push(p); });

  const gruposPorCiclo = {};
  Object.keys(mapaCiclo).forEach(prod => { (gruposPorCiclo[mapaCiclo[prod]] = gruposPorCiclo[mapaCiclo[prod]] || []).push(prod); });

  // Se evalúan TODOS los productos vibrocompactados con Unidades/Ciclo registrado (2026-09-18,
  // corrige que antes solo se evaluaban los que ya tenían al menos un registro propio en la
  // ventana — un producto sin ninguna producción reciente, pero cuyo grupo de Unidades/Ciclo SÍ
  // tiene historial suficiente, se quedaba fuera del resultado por completo, sin ni siquiera un
  // `null` que explicara por qué). Así la tabla puede mostrar cada referencia con su estándar o
  // con la razón por la que todavía no lo tiene, en vez de simplemente no aparecer.
  const resultado = {};
  Object.keys(mapaCiclo).forEach(producto => {
    const propios = porProducto[producto] || [];
    const valoresPropios = Object.values(_ciclosPorDia(propios, mapaCiclo));
    if (valoresPropios.length >= N_MIN_DIAS_ESTANDAR) {
      const media = valoresPropios.reduce((s, v) => s + v, 0) / valoresPropios.length;
      resultado[producto] = { media, desviacion: _desviacionEstandar(valoresPropios), n: valoresPropios.length, fuente: 'producto' };
      return;
    }
    const grupo = gruposPorCiclo[mapaCiclo[producto]] || [producto];
    const valoresGrupo = Object.values(_ciclosPorDia(incluidos.filter(p => grupo.includes(p.producto)), mapaCiclo));
    resultado[producto] = valoresGrupo.length >= N_MIN_DIAS_ESTANDAR
      ? { media: valoresGrupo.reduce((s, v) => s + v, 0) / valoresGrupo.length, desviacion: _desviacionEstandar(valoresGrupo), n: valoresGrupo.length, fuente: 'grupo_unidadesciclo', grupoProductos: grupo }
      : null;
  });
  return resultado;
}

function _obtenerEstandaresCiclos() {
  if (!_estandaresCiclosCache) _recalcularEstandaresCiclos();
  return _estandaresCiclosCache;
}

function _recalcularEstandaresCiclos() {
  _estandaresCiclosCache = _calcularEstandaresCiclosPorProducto(_periodoEstandarCiclos);
  _estandaresCiclosCacheFecha = new Date().toISOString();
  if (document.getElementById('pantalla-produccion-estadisticas')?.classList.contains('activa') && typeof renderEstadisticasProduccion === 'function') {
    renderEstadisticasProduccion();
  }
}

// Evalúa UN registro contra el estándar cacheado de su producto — solo clasifica (para el
// contexto del diálogo y el aviso "revisar" de la tabla), nunca decide exclusión (regla 3/6).
// 'sin_ciclo': el producto no tiene Unidades/Ciclo en su Costeo, no hay con qué medir ciclos/día.
// 'sin_datos': sí hay ciclos/día, pero todavía no hay estándar calculable para ese producto/grupo.
function _evaluarDesviacionRegistro(p, estandares) {
  const uc = _unidadesCicloPorProducto()[p.producto];
  if (!uc) return { ciclosDia: null, estandar: null, nSigmas: null, direccion: null, nivel: 'sin_ciclo' };
  const ciclosDia = (Number(p.cantidad) || 0) / uc;
  const est = estandares[p.producto];
  if (!est || !(est.desviacion > 0)) return { ciclosDia, estandar: est || null, nSigmas: null, direccion: null, nivel: 'sin_datos' };
  const nSigmas = Math.abs(ciclosDia - est.media) / est.desviacion;
  const direccion = ciclosDia < est.media ? 'debajo' : 'encima';
  const nivel = nSigmas >= 3 ? 'alta_prioridad' : (nSigmas >= 2 ? 'revisar' : 'normal');
  return { ciclosDia, estandar: est, nSigmas, direccion, nivel };
}

// ── Badge de estado + aviso de desviación en la tabla de Producción Diaria ──

const _COLOR_ESTADO_PRODUCCION = { incluido: '#2E7D32', pendiente_revision: '#E65100', excluido: '#C62828' };
const _BG_ESTADO_PRODUCCION = { incluido: '#E8F5E9', pendiente_revision: '#FFF3E0', excluido: '#FFEBEE' };

function _badgeEstadoProduccion(p) {
  const estado = p.estado || 'incluido';
  const claveTexto = estado === 'pendiente_revision' ? 'pendiente' : estado;
  const etiqueta = TEXTOS_DIA_ATIPICO.estados[claveTexto] || estado;
  return `<span class="badge" style="background:${_BG_ESTADO_PRODUCCION[estado] || '#eee'};color:${_COLOR_ESTADO_PRODUCCION[estado] || '#333'}">${_esc(etiqueta)}</span>`;
}

// Solo para registros 'incluido' — un registro ya marcado/excluido no necesita este aviso, ya se
// está manejando.
function _notaDesviacionProduccion(p, estandares) {
  if ((p.estado || 'incluido') !== 'incluido') return '';
  const ev = _evaluarDesviacionRegistro(p, estandares);
  if (ev.nivel !== 'revisar' && ev.nivel !== 'alta_prioridad') return '';
  const color = ev.nivel === 'alta_prioridad' ? 'var(--rojo)' : 'var(--naranja)';
  return `<div style="font-size:10px;font-weight:600;color:${color};margin-top:2px">Este día se aleja de lo normal para ${_esc(p.producto)}. Revisar.</div>`;
}

// ── Diálogo "Marcar día como atípico" ──

function abrirModalDiaAtipico(id) {
  const p = (typeof PRODUCCIONES !== 'undefined' ? PRODUCCIONES : []).find(x => String(x.id) === String(id));
  if (!p) return;
  const ev = _evaluarDesviacionRegistro(p, _obtenerEstandaresCiclos());

  document.getElementById('mda-id').value = p.id;
  document.getElementById('mda-contexto').innerHTML = _contextoDiaAtipicoHTML(p, ev);

  const selCausa = document.getElementById('mda-causa');
  selCausa.innerHTML = '<option value="">— Selecciona —</option>' + CAUSAS_DIA_ATIPICO.map(c => `<option value="${c.clave}">${_esc(c.etiqueta)}</option>`).join('');
  selCausa.value = '';
  document.getElementById('mda-causa-otro-wrap').style.display = 'none';
  document.getElementById('mda-causa-otro').value = '';
  document.getElementById('mda-descripcion').value = '';

  const esAprobador = _esUsuarioAprobadorProduccion();
  document.getElementById('mda-nota-pendiente').style.display = esAprobador ? 'none' : '';
  const btn = document.getElementById('mda-btn-accion');
  btn.textContent = esAprobador ? TEXTOS_DIA_ATIPICO.boton_confirmar : TEXTOS_DIA_ATIPICO.boton_enviar_revision;

  document.getElementById('modal-dia-atipico').classList.add('abierto');
}

function _contextoDiaAtipicoHTML(p, ev) {
  const fechaTxt = p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : '—';

  if (ev.nivel === 'sin_ciclo') {
    return `<div>${_esc(fechaTxt)} — ${_esc(p.producto)}: este producto no tiene "Unidades/Ciclo" registrado en su Costeo, así que no hay un dato de ciclos/día con el cual compararlo.</div>`;
  }

  const ciclosTxt = ev.ciclosDia.toLocaleString('es-CO', { maximumFractionDigits: 1 });

  if (ev.nivel === 'sin_datos') {
    return `<div>${_esc(fechaTxt)} — ${_esc(p.producto)}: ${ciclosTxt} ciclos registrados. Todavía no hay suficiente historial "incluido" para calcular un estándar de este producto (mínimo ${N_MIN_DIAS_ESTANDAR} días en los últimos ${_periodoEstandarCiclos} días).</div>`;
  }

  const est = ev.estandar;
  const principal = TEXTOS_DIA_ATIPICO.context_template
    .replace('{fecha}', fechaTxt)
    .replace('{producto}', p.producto)
    .replace('{ciclos}', ciclosTxt)
    .replace('{dias}', String(_periodoEstandarCiclos))
    .replace('{media}', est.media.toLocaleString('es-CO', { maximumFractionDigits: 1 }))
    .replace('{desviacion}', est.desviacion.toLocaleString('es-CO', { maximumFractionDigits: 1 }))
    .replace('{n_sigmas}', ev.nSigmas.toLocaleString('es-CO', { maximumFractionDigits: 1 }))
    .replace('{direccion}', ev.direccion);

  const extra = est.fuente === 'grupo_unidadesciclo'
    ? `<div style="font-size:11px;color:var(--gris-medio);margin-top:4px">"${_esc(p.producto)}" no tiene suficiente historial propio (mínimo ${N_MIN_DIAS_ESTANDAR} días) — este promedio se calculó junto con otros productos que comparten el mismo Unidades/Ciclo: ${_esc((est.grupoProductos || []).join(', '))}.</div>`
    : '';

  return `<div>${_esc(principal)}</div>${extra}`;
}

function _alCambiarCausaDiaAtipico() {
  const causa = document.getElementById('mda-causa').value;
  document.getElementById('mda-causa-otro-wrap').style.display = causa === 'otro' ? '' : 'none';
}

function guardarMarcaDiaAtipico() {
  const id = document.getElementById('mda-id').value;
  const p = (typeof PRODUCCIONES !== 'undefined' ? PRODUCCIONES : []).find(x => String(x.id) === String(id));
  if (!p) return;

  const causa = document.getElementById('mda-causa').value;
  if (!causa) { alert('Elige la causa de la exclusión.'); return; }
  const causaOtro = document.getElementById('mda-causa-otro').value.trim();
  if (causa === 'otro' && !causaOtro) { alert('Especifica la razón en "Otra razón".'); return; }
  const descripcion = document.getElementById('mda-descripcion').value.trim();

  const ev = _evaluarDesviacionRegistro(p, _obtenerEstandaresCiclos());
  if (ev.nivel === 'normal') {
    if (!confirm(TEXTOS_DIA_ATIPICO.advertencia_variacion_normal)) return;
  }

  const esAprobador = _esUsuarioAprobadorProduccion();
  const ahora = new Date().toISOString();
  const reg = {
    ...p,
    estado: esAprobador ? 'excluido' : 'pendiente_revision',
    causa,
    causaOtro: causa === 'otro' ? causaOtro : '',
    descripcion,
    marcadoPor: USUARIO_ACTUAL?.email,
    fechaMarcado: ahora,
  };
  if (esAprobador) {
    reg.aprobadoPor = USUARIO_ACTUAL?.email;
    reg.fechaAprobacion = ahora;
  }

  const idx = PRODUCCIONES.findIndex(x => String(x.id) === String(reg.id));
  if (idx >= 0) PRODUCCIONES[idx] = reg;
  sb.from('producciones').upsert({ id: reg.id, datos: reg, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) { console.error('Error marcando día atípico:', error.message); alert('Error al guardar: ' + error.message); } });

  if (esAprobador) _generarEventoEspecial(reg);

  cerrarModal('modal-dia-atipico');
  renderProduccionDiaria();
}

// ── Bitácora de eventos especiales — generada SOLO al aprobar una exclusión ──

function _generarEventoEspecial(p) {
  const uc = _unidadesCicloPorProducto()[p.producto];
  const ciclosPerdidos = uc ? Math.round(((Number(p.cantidad) || 0) / uc) * 100) / 100 : null;
  const evento = {
    fecha: p.fecha,
    maquinaLinea: 'Vibrocompactadora',
    tipoEvento: p.causa,
    tipoEventoOtro: p.causa === 'otro' ? (p.causaOtro || '') : '',
    descripcion: p.descripcion || '',
    producto: p.producto,
    ciclosPerdidos,
    produccionId: p.id,
    generadoPor: 'sistema',
    aprobadoPor: p.aprobadoPor || USUARIO_ACTUAL?.email,
  };
  const id = `${Date.now()}-${p.id}`;
  EVENTOS_ESPECIALES.unshift(evento);
  sb.from('eventos_especiales').upsert({ id, datos: evento, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) console.error('Error generando evento especial:', error.message); });
}

// ── Pantalla de revisión — pendientes por aprobar + reporte de ciclos perdidos por causa ──

let _periodoRevisionAtipicos = 90;
function setPeriodoRevisionAtipicos(dias) {
  _periodoRevisionAtipicos = dias;
  [30, 90, 180, 0].forEach(d => {
    const btn = document.getElementById(`rev-atip-btn-${d}`);
    if (!btn) return;
    btn.style.background = d === dias ? 'var(--azul)' : 'white';
    btn.style.color = d === dias ? 'white' : 'var(--gris-medio)';
  });
  renderRevisionDiasAtipicos();
}

function renderRevisionDiasAtipicos() {
  const esAprobador = _esUsuarioAprobadorProduccion();
  const mapaCiclo = _unidadesCicloPorProducto();

  // Pendientes de revisión — sin filtro de período, son operativamente urgentes sin importar
  // cuándo se marcaron.
  const pendientes = (typeof PRODUCCIONES !== 'undefined' ? PRODUCCIONES : [])
    .filter(p => p.estado === 'pendiente_revision')
    .sort((a, b) => (b.fechaMarcado || '').localeCompare(a.fechaMarcado || ''));
  const bodyPend = document.getElementById('rev-atip-pendientes-body');
  if (bodyPend) {
    if (!pendientes.length) {
      bodyPend.innerHTML = `<tr><td colspan="7" class="empty-state"><div class="icono">✅</div><div>No hay días pendientes de revisión.</div></td></tr>`;
    } else {
      bodyPend.innerHTML = pendientes.map(p => {
        const uc = mapaCiclo[p.producto];
        const ciclos = uc ? ((Number(p.cantidad) || 0) / uc).toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—';
        const causaTxt = p.causa === 'otro' ? (p.causaOtro || ETIQUETA_CAUSA.otro) : (ETIQUETA_CAUSA[p.causa] || '—');
        const acciones = esAprobador
          ? `<div class="flex-gap">
               <button class="btn btn-primario btn-xs" onclick="aprobarExclusion('${p.id}')">✅ Aprobar exclusión</button>
               <button class="btn btn-secundario btn-xs" onclick="rechazarExclusion('${p.id}')">↩️ Rechazar</button>
             </div>`
          : `<span style="font-size:11px;color:var(--gris-medio)">Requiere un supervisor</span>`;
        return `<tr>
          <td style="font-weight:600">${p.fecha ? new Date(p.fecha + 'T12:00').toLocaleDateString('es-CO') : '—'}</td>
          <td style="font-weight:600;color:var(--azul)">${_esc(p.producto)}</td>
          <td style="text-align:right">${ciclos}</td>
          <td>${_esc(causaTxt)}</td>
          <td style="color:var(--gris-medio);max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${_esc(p.descripcion)}">${_esc(p.descripcion) || '—'}</td>
          <td>${_esc(p.marcadoPor) || '—'}</td>
          <td>${acciones}</td>
        </tr>`;
      }).join('');
    }
  }

  const bodyReporte = document.getElementById('rev-atip-reporte-body');
  if (bodyReporte) {
    const filas = _datosReporteCiclosPerdidos(_periodoRevisionAtipicos);
    if (!filas.length) {
      bodyReporte.innerHTML = `<tr><td colspan="4" class="empty-state"><div class="icono">📊</div><div>Sin exclusiones aprobadas en este período.</div></td></tr>`;
    } else {
      bodyReporte.innerHTML = filas.map(f => `
        <tr>
          <td style="font-weight:600">${_esc(f.etiqueta)}</td>
          <td style="text-align:right">${f.eventos}</td>
          <td style="text-align:right">${f.ciclosPerdidos.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
          <td style="text-align:right">${f.pct.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%</td>
        </tr>`).join('');
    }
  }
}

function aprobarExclusion(id) {
  if (!_esUsuarioAprobadorProduccion()) { alert('Solo un usuario con permiso de aprobador puede confirmar esta exclusión.'); return; }
  const p = PRODUCCIONES.find(x => String(x.id) === String(id));
  if (!p || p.estado !== 'pendiente_revision') return;
  const ahora = new Date().toISOString();
  const reg = { ...p, estado: 'excluido', aprobadoPor: USUARIO_ACTUAL?.email, fechaAprobacion: ahora };
  const idx = PRODUCCIONES.findIndex(x => String(x.id) === String(reg.id));
  if (idx >= 0) PRODUCCIONES[idx] = reg;
  sb.from('producciones').upsert({ id: reg.id, datos: reg, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) { console.error('Error aprobando exclusión:', error.message); alert('Error al guardar: ' + error.message); } });
  _generarEventoEspecial(reg);
  renderRevisionDiasAtipicos();
}

function rechazarExclusion(id) {
  if (!_esUsuarioAprobadorProduccion()) { alert('Solo un usuario con permiso de aprobador puede rechazar esta exclusión.'); return; }
  const p = PRODUCCIONES.find(x => String(x.id) === String(id));
  if (!p || p.estado !== 'pendiente_revision') return;
  const ahora = new Date().toISOString();
  // La causa/descripción declaradas se conservan como rastro de la propuesta rechazada — no se
  // borran, solo dejan de tener efecto sobre el cálculo (estado vuelve a 'incluido').
  const reg = { ...p, estado: 'incluido', rechazadoPor: USUARIO_ACTUAL?.email, fechaRechazo: ahora };
  const idx = PRODUCCIONES.findIndex(x => String(x.id) === String(reg.id));
  if (idx >= 0) PRODUCCIONES[idx] = reg;
  sb.from('producciones').upsert({ id: reg.id, datos: reg, modificado: new Date().toISOString() }, { onConflict: 'id' })
    .then(({ error }) => { if (error) { console.error('Error rechazando exclusión:', error.message); alert('Error al guardar: ' + error.message); } });
  renderRevisionDiasAtipicos();
}

function _datosReporteCiclosPerdidos(periodoDias) {
  const desde = periodoDias > 0 ? _fmtISO(_sumarDias(new Date(), -periodoDias)) : null;
  const enPeriodo = EVENTOS_ESPECIALES.filter(e => !desde || (e.fecha || '') >= desde);
  const porCausa = {};
  enPeriodo.forEach(e => {
    const clave = e.tipoEvento || 'otro';
    if (!porCausa[clave]) porCausa[clave] = { eventos: 0, ciclosPerdidos: 0 };
    porCausa[clave].eventos++;
    porCausa[clave].ciclosPerdidos += Number(e.ciclosPerdidos) || 0;
  });
  const totalCiclos = Object.values(porCausa).reduce((s, r) => s + r.ciclosPerdidos, 0);
  return Object.keys(porCausa)
    .map(clave => ({
      clave,
      etiqueta: ETIQUETA_CAUSA[clave] || clave,
      eventos: porCausa[clave].eventos,
      ciclosPerdidos: Math.round(porCausa[clave].ciclosPerdidos * 10) / 10,
      pct: totalCiclos > 0 ? (porCausa[clave].ciclosPerdidos / totalCiclos) * 100 : 0,
    }))
    .sort((a, b) => b.ciclosPerdidos - a.ciclosPerdidos);
}

// ── Tabla del estándar por producto, dentro de Estadísticas de Producción ──
// Muestra TODAS las referencias vibrocompactadas con Unidades/Ciclo registrado (2026-09-18,
// corrige que antes solo aparecían las que ya alcanzaban el mínimo — una referencia sin
// suficiente historial simplemente no salía en la tabla, sin ninguna explicación, lo que hacía
// parecer que "faltaban" productos en vez de que su estándar todavía no era calculable). Ahora
// cada referencia sale siempre, con su estándar o con la razón de por qué no lo tiene todavía.
//
// También incluye el consumo de cemento por unidad — media y desviación (2026-09-18, a pedido
// del usuario: "incluyamos un nuevo cuadro estadístico que nos muestre el consumo promedio de
// cemento por unidad, por referencia, incluyendo la desviación" — y luego: "incluyamos dichos
// datos... en este cuadro", fusionándolo con esta tabla en vez de una aparte). Usa la MISMA
// ventana y el mismo filtro 'incluido' que el estándar de ciclos de esta tabla (no el período del
// dashboard general de arriba) para que las dos mitades describan la misma foto — no se cachea
// aparte porque es barata de recalcular y no alimenta ningún flujo de aprobación, a diferencia del
// estándar de ciclos.
function _renderTablaEstandaresCiclos() {
  const body = document.getElementById('est-prod-estandares-body');
  if (!body) return;
  const estandares = _obtenerEstandaresCiclos();

  // Mismo alcance que el resto del dashboard (solo Vibrocompactados, ver _mapaTipoEstructuraPorProducto()
  // en estadisticas-produccion.js) — sin este filtro, un producto Reforzado o Pretensado con
  // consumo de cemento registrado se colaría en esta tabla, que es explícitamente de Vibrocompactados.
  const mapaTipo = _mapaTipoEstructuraPorProducto();
  const desde = _periodoEstandarCiclos > 0 ? _fmtISO(_sumarDias(new Date(), -_periodoEstandarCiclos)) : null;
  const enVentanaIncluido = (typeof PRODUCCIONES !== 'undefined' ? PRODUCCIONES : []).filter(p =>
    (p.estado || 'incluido') === 'incluido' && mapaTipo[p.producto] === 'vibrocompactado' && (!desde || (p.fecha || '') >= desde));
  const cementoPorProducto = _calcularCementoPorReferencia(enVentanaIncluido);

  const productos = [...new Set([...Object.keys(estandares), ...Object.keys(cementoPorProducto)])].sort();
  if (!productos.length) {
    body.innerHTML = `<tr><td colspan="8" class="empty-state"><div class="icono">📏</div><div>Todavía no hay ningún producto vibrocompactado con Unidades/Ciclo registrado.</div></td></tr>`;
  } else {
    body.innerHTML = productos.map(p => {
      const est = estandares[p];
      const cem = cementoPorProducto[p];
      const fuenteHtml = est
        ? (est.fuente === 'grupo_unidadesciclo' ? 'Grupo (Unidades/Ciclo)' : 'Propio')
        : `<span style="color:var(--gris-medio);font-size:11px">Historial insuficiente (mín. ${N_MIN_DIAS_ESTANDAR} días)</span>`;
      return `<tr>
        <td style="font-weight:600;color:var(--azul)">${_esc(p)}</td>
        <td style="text-align:right">${est ? est.media.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—'}</td>
        <td style="text-align:right">${est && est.desviacion !== null ? est.desviacion.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : '—'}</td>
        <td style="text-align:right">${est ? est.n : '—'}</td>
        <td>${fuenteHtml}</td>
        <td style="text-align:right">${cem ? cem.media.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' kg' : '—'}</td>
        <td style="text-align:right">${cem && cem.desviacion !== null ? cem.desviacion.toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' kg' : '—'}</td>
        <td style="text-align:right">${cem ? cem.n : '—'}</td>
      </tr>`;
    }).join('');
  }
  const caption = document.getElementById('est-prod-estandares-caption');
  if (caption) {
    caption.textContent = _estandaresCiclosCacheFecha
      ? `Última actualización: ${new Date(_estandaresCiclosCacheFecha).toLocaleString('es-CO')}`
      : '';
  }
}
