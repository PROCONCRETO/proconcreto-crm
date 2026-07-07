async function cargarDatosSupabase() {
  const [{ data: cots, error: e1 }, { data: clts, error: e2 }, { data: ords, error: e3 }, { data: prods, error: e4 }, { data: disenos, error: e5 }, { data: ensayos, error: e6 }, { data: mprima, error: e7 }, { data: nconf, error: e8 }, { data: ajustes, error: e9 }] = await Promise.all([
    sb.from('cotizaciones').select('datos, estado').order('creado', { ascending: true }),
    sb.from('clientes').select('datos').order('creado', { ascending: true }),
    sb.from('ordenes_servicio').select('datos').order('creado', { ascending: false }),
    sb.from('producciones').select('datos').order('creado', { ascending: false }),
    sb.from('disenos_mezcla').select('datos').order('creado', { ascending: false }),
    sb.from('ensayos_calidad').select('datos').order('creado', { ascending: false }),
    sb.from('materia_prima').select('datos').order('creado', { ascending: false }),
    sb.from('no_conformidades').select('datos').order('creado', { ascending: false }),
    sb.from('ajustes_mezcla').select('datos').order('creado', { ascending: false })
  ]);
  if (e3) console.warn('Tabla ordenes_servicio no disponible aún.');
  if (e4) console.warn('Tabla producciones no disponible aún.');
  if (e5) console.warn('Tabla disenos_mezcla no disponible aún.');
  if (e6) console.warn('Tabla ensayos_calidad no disponible aún.');
  if (e7) console.warn('Tabla materia_prima no disponible aún.');
  if (e8) console.warn('Tabla no_conformidades no disponible aún.');
  if (e9) console.warn('Tabla ajustes_mezcla no disponible aún.');
  ORDENES = (ords || []).filter(r => r.datos).map(r => r.datos);
  PRODUCCIONES = (prods || []).filter(r => r.datos).map(r => r.datos);
  DISENOS_MEZCLA = (disenos || []).filter(r => r.datos).map(r => r.datos);
  ENSAYOS_CALIDAD = (ensayos || []).filter(r => r.datos).map(r => r.datos);
  MATERIA_PRIMA = (mprima || []).filter(r => r.datos).map(r => r.datos);
  NO_CONFORMIDADES = (nconf || []).filter(r => r.datos).map(r => r.datos);
  AJUSTES_MEZCLA = (ajustes || []).filter(r => r.datos).map(r => r.datos);

  // Catálogo de productos desde Supabase (con auto-siembra la primera vez)
  await cargarCatalogo();
  if (e1) console.error('Error cargando cotizaciones:', e1.message);
  if (e2) console.error('Error cargando clientes:', e2.message);
  COTIZACIONES = (cots || []).filter(r => r.datos).map(r => ({ ...r.datos, estado: r.estado }));

  // Clientes desde la tabla clientes
  CLIENTES = (clts || []).filter(r => r.datos).map(r => r.datos);

  // Migración: clientes que solo existen en cotizaciones → guardarlos en la tabla clientes
  const clientesFaltantes = [];
  COTIZACIONES.forEach(c => {
    if (c.cliente?.nombre && !CLIENTES.find(x => x.nombre === c.cliente.nombre) && !clientesFaltantes.find(x => x.nombre === c.cliente.nombre)) {
      clientesFaltantes.push({ id: Date.now() + Math.floor(Math.random()*10000), nombre: c.cliente.nombre, contacto: c.cliente.contacto || '', cel: c.cliente.cel || '', email: '', ciudad: '', nit: '' });
    }
  });
  if (clientesFaltantes.length) {
    CLIENTES.push(...clientesFaltantes);
    clientesFaltantes.forEach(c => {
      sb.from('clientes').upsert({ nombre: c.nombre, datos: c }, { onConflict: 'nombre' });
    });
  }
}

async function mostrarApp() {
  document.getElementById('usuario-email').textContent = USUARIO_ACTUAL.email;
  const perfil = USUARIOS_CRM[USUARIO_ACTUAL.email];
  if (perfil) {
    document.getElementById('vendedor-nombre').value = perfil.nombre;
    document.getElementById('vendedor-cargo').value = perfil.cargo;
  }
  await cargarDatosSupabase();
  poblarGrupos();
  document.getElementById('fecha-cot').value = new Date().toISOString().split('T')[0];
  document.getElementById('num-cot').value = '';
  document.getElementById('display-num-cot').textContent = '—';
  document.getElementById('sugerencia-num').textContent = '— Último usado: ' + (COTIZACIONES.length ? COTIZACIONES.reduce((a,b) => (parseInt(a.numero.replace(/\D/g,''))||0) > (parseInt(b.numero.replace(/\D/g,''))||0) ? a : b).numero : 'ninguno');
  const sel = document.getElementById('destino-transporte');
  while (sel.options.length > 1) sel.remove(1);
  Object.keys(TARIFAS_TRANSPORTE).forEach(d => {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = d + ' ($' + TARIFAS_KG_TRANSPORTE[d].toLocaleString() + '/kg)';
    sel.appendChild(opt);
  });
  const optOtro = document.createElement('option');
  optOtro.value = 'Otro'; optOtro.textContent = 'Otro (tarifa manual)';
  sel.appendChild(optOtro);
  suscribirRealtime();
}

// ═══════════════════════════════
// SINCRONIZACIÓN EN TIEMPO REAL
// ═══════════════════════════════
let _canalRealtime = null;
let _rtTimers = {};

function rerenderPantallaActiva() {
  const activa = document.querySelector('.pantalla.activa');
  if (!activa) return;
  switch (activa.id) {
    case 'pantalla-historico': renderHistorico(); break;
    case 'pantalla-pipeline': renderPipeline(); break;
    case 'pantalla-clientes': renderClientes(); break;
    case 'pantalla-estadisticas': renderEstadisticas(); break;
    case 'pantalla-ordenes-servicio': renderOrdenes(); break;
    case 'pantalla-pipeline-produccion': renderPipelineProduccion(); break;
    case 'pantalla-produccion-diaria': renderProduccionDiaria(); break;
    case 'pantalla-inventario': renderInventario(); break;
    case 'pantalla-productos': renderProductosAdmin(); break;
    case 'pantalla-diseno-mezcla': renderDisenosMezcla(); break;
    case 'pantalla-ajuste-mezcla': renderAjustesMezcla(); break;
    case 'pantalla-control-ensayos': renderEnsayosCalidad(); break;
    case 'pantalla-materia-prima': renderMateriaPrima(); break;
    case 'pantalla-no-conformidades': renderNoConformidades(); break;
    case 'pantalla-certificados-calidad': renderCertificadosCalidad(); break;
    case 'pantalla-trazabilidad': buscarTrazabilidad(); break;
  }
}

function _rtDebounce(tabla, fn) {
  clearTimeout(_rtTimers[tabla]);
  _rtTimers[tabla] = setTimeout(fn, 350);
}

async function recargarCotizacionesRT() {
  const { data } = await sb.from('cotizaciones').select('datos, estado').order('creado', { ascending: true });
  COTIZACIONES = (data || []).filter(r => r.datos).map(r => ({ ...r.datos, estado: r.estado }));
  rerenderPantallaActiva();
}
async function recargarClientesRT() {
  const { data } = await sb.from('clientes').select('datos').order('creado', { ascending: true });
  CLIENTES = (data || []).filter(r => r.datos).map(r => r.datos);
  rerenderPantallaActiva();
}
async function recargarOrdenesRT() {
  const { data } = await sb.from('ordenes_servicio').select('datos').order('creado', { ascending: false });
  ORDENES = (data || []).filter(r => r.datos).map(r => r.datos);
  rerenderPantallaActiva();
}
async function recargarProduccionesRT() {
  const { data } = await sb.from('producciones').select('datos').order('creado', { ascending: false });
  PRODUCCIONES = (data || []).filter(r => r.datos).map(r => r.datos);
  rerenderPantallaActiva();
}
async function recargarProductosRT() {
  const { data } = await sb.from('productos').select('*').order('grupo', { ascending: true }).order('nombre', { ascending: true });
  if (data) { refrescarCatalogo(data); rerenderPantallaActiva(); }
}
async function recargarDisenosRT() {
  const { data } = await sb.from('disenos_mezcla').select('datos').order('creado', { ascending: false });
  DISENOS_MEZCLA = (data || []).filter(r => r.datos).map(r => r.datos);
  rerenderPantallaActiva();
}
async function recargarEnsayosRT() {
  const { data } = await sb.from('ensayos_calidad').select('datos').order('creado', { ascending: false });
  ENSAYOS_CALIDAD = (data || []).filter(r => r.datos).map(r => r.datos);
  rerenderPantallaActiva();
}
async function recargarMateriaPrimaRT() {
  const { data } = await sb.from('materia_prima').select('datos').order('creado', { ascending: false });
  MATERIA_PRIMA = (data || []).filter(r => r.datos).map(r => r.datos);
  rerenderPantallaActiva();
}
async function recargarNCRT() {
  const { data } = await sb.from('no_conformidades').select('datos').order('creado', { ascending: false });
  NO_CONFORMIDADES = (data || []).filter(r => r.datos).map(r => r.datos);
  rerenderPantallaActiva();
}
async function recargarAjustesRT() {
  const { data } = await sb.from('ajustes_mezcla').select('datos').order('creado', { ascending: false });
  AJUSTES_MEZCLA = (data || []).filter(r => r.datos).map(r => r.datos);
  rerenderPantallaActiva();
}

function suscribirRealtime() {
  if (_canalRealtime) return; // evitar suscripciones duplicadas
  _canalRealtime = sb.channel('crm-cambios')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cotizaciones' },     () => _rtDebounce('cotizaciones', recargarCotizacionesRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' },          () => _rtDebounce('clientes', recargarClientesRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_servicio' },  () => _rtDebounce('ordenes', recargarOrdenesRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'producciones' },      () => _rtDebounce('producciones', recargarProduccionesRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' },          () => _rtDebounce('productos', recargarProductosRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'disenos_mezcla' },      () => _rtDebounce('disenos', recargarDisenosRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ensayos_calidad' },     () => _rtDebounce('ensayos', recargarEnsayosRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'materia_prima' },       () => _rtDebounce('materiaprima', recargarMateriaPrimaRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'no_conformidades' },    () => _rtDebounce('noconformidades', recargarNCRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ajustes_mezcla' },      () => _rtDebounce('ajustes', recargarAjustesRT))
    .subscribe((status) => {
      const ind = document.getElementById('rt-indicador');
      if (ind) {
        if (status === 'SUBSCRIBED') { ind.textContent = '🟢 En vivo'; ind.title = 'Sincronización en tiempo real activa'; ind.style.color = '#2E7D32'; }
        else { ind.textContent = '🔴 Sin conexión'; ind.title = 'Sincronización inactiva — refresca la página'; ind.style.color = '#C62828'; }
      }
    });
}

