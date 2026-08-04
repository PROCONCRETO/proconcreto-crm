async function cargarDatosSupabase() {
  const [{ data: cots, error: e1 }, { data: clts, error: e2 }, { data: ords, error: e3 }, { data: prods, error: e4 }, { data: disenos, error: e5 }, { data: ensayos, error: e6 }, { data: mprima, error: e7 }, { data: nconf, error: e8 }, { data: ajustes, error: e9 }, { data: entregas, error: e10 }, { data: pmo, error: e11 }, { data: clasesMo, error: e12 }, { data: cuadrillas, error: e13 }, { data: maquinas, error: e14 }, { data: insumos, error: e15 }, { data: costeoProd, error: e16 }] = await Promise.all([
    sb.from('cotizaciones').select('datos, estado').order('creado', { ascending: true }),
    sb.from('clientes').select('datos').order('creado', { ascending: true }),
    sb.from('ordenes_servicio').select('datos').order('creado', { ascending: false }),
    sb.from('producciones').select('datos').order('creado', { ascending: false }),
    sb.from('disenos_mezcla').select('datos').order('creado', { ascending: false }),
    sb.from('ensayos_calidad').select('datos').order('creado', { ascending: false }),
    sb.from('materia_prima').select('datos').order('creado', { ascending: false }),
    sb.from('no_conformidades').select('datos').order('creado', { ascending: false }),
    sb.from('ajustes_mezcla').select('datos').order('creado', { ascending: false }),
    sb.from('entregas_programadas').select('datos').order('creado', { ascending: false }),
    sb.from('parametros_mo').select('datos').eq('id', 1).maybeSingle(),
    sb.from('clases_salariales').select('datos').order('creado', { ascending: true }),
    sb.from('cuadrillas_productivas').select('datos, modificado').order('creado', { ascending: true }),
    sb.from('maquinaria_equipos').select('datos, modificado').order('creado', { ascending: true }),
    sb.from('insumos_costos').select('datos, modificado').order('creado', { ascending: true }),
    sb.from('costeo_productos').select('datos, modificado').order('creado', { ascending: true })
  ]);
  if (e3) console.warn('Tabla ordenes_servicio no disponible aún.');
  if (e4) console.warn('Tabla producciones no disponible aún.');
  if (e5) console.warn('Tabla disenos_mezcla no disponible aún.');
  if (e6) console.warn('Tabla ensayos_calidad no disponible aún.');
  if (e7) console.warn('Tabla materia_prima no disponible aún.');
  if (e8) console.warn('Tabla no_conformidades no disponible aún.');
  if (e9) console.warn('Tabla ajustes_mezcla no disponible aún.');
  if (e10) console.warn('Tabla entregas_programadas no disponible aún.');
  if (e11) console.warn('Tabla parametros_mo no disponible aún — corre sql/2026-07-26_costeo_mano_obra.sql en Supabase.');
  if (e12) console.warn('Tabla clases_salariales no disponible aún — corre sql/2026-07-26_costeo_mano_obra.sql en Supabase.');
  if (e13) console.warn('Tabla cuadrillas_productivas no disponible aún — corre sql/2026-07-26_costeo_mano_obra.sql en Supabase.');
  if (e14) console.warn('Tabla maquinaria_equipos no disponible aún — corre sql/2026-07-29_costeo_maquinaria.sql en Supabase.');
  if (e15) console.warn('Tabla insumos_costos no disponible aún — corre sql/2026-07-30_lista_referencia_costos.sql en Supabase.');
  if (e16) console.warn('Tabla costeo_productos no disponible aún — corre sql/2026-08-02_costeo_producto.sql en Supabase.');
  ORDENES = (ords || []).filter(r => r.datos).map(r => r.datos);
  PRODUCCIONES = (prods || []).filter(r => r.datos).map(r => r.datos);
  DISENOS_MEZCLA = (disenos || []).filter(r => r.datos).map(r => _normalizarDiseno(r.datos));
  ENSAYOS_CALIDAD = (ensayos || []).filter(r => r.datos).map(r => r.datos);
  MATERIA_PRIMA = (mprima || []).filter(r => r.datos).map(r => r.datos);
  NO_CONFORMIDADES = (nconf || []).filter(r => r.datos).map(r => r.datos);
  AJUSTES_MEZCLA = (ajustes || []).filter(r => r.datos).map(r => _normalizarAjuste(r.datos));
  VIAJES = (entregas || []).filter(r => r.datos).map(r => r.datos);
  PARAMETROS_MO = pmo?.datos || _defaultParametrosMO();
  CLASES_SALARIALES = (clasesMo || []).filter(r => r.datos).map(r => r.datos);
  CUADRILLAS_PRODUCTIVAS = (cuadrillas || []).filter(r => r.datos).map(r => ({ ...r.datos, _modificado: r.modificado }));
  MAQUINARIA_EQUIPOS = (maquinas || []).filter(r => r.datos).map(r => ({ ...r.datos, _modificado: r.modificado }));
  INSUMOS_COSTOS = (insumos || []).filter(r => r.datos).map(r => ({ ...r.datos, _modificado: r.modificado }));
  COSTEO_PRODUCTOS = (costeoProd || []).filter(r => r.datos).map(r => ({ ...r.datos, _modificado: r.modificado }));

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
  const navCentroCostos = document.getElementById('nav-centro-costos');
  if (navCentroCostos) navCentroCostos.style.display = _esUsuarioCentroCostos() ? '' : 'none';
  await cargarDatosSupabase();
  poblarGrupos();
  _resetFormularioCotizacion();
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
    case 'pantalla-analisis-estadistico': renderAnalisisEstadistico(); break;
    case 'pantalla-materia-prima': renderMateriaPrima(); break;
    case 'pantalla-no-conformidades': renderNoConformidades(); break;
    case 'pantalla-certificados-calidad': renderCertificadosCalidad(); break;
    case 'pantalla-trazabilidad': buscarTrazabilidad(); break;
    case 'pantalla-logistica': renderCalendarioLogistica(); break;
    case 'pantalla-logistica-estadisticas': renderEstadisticasLogistica(); break;
    case 'pantalla-costeo-mo': renderCosteoManoObra(); break;
    case 'pantalla-costeo-maquinaria': renderCosteoMaquinaria(); break;
    case 'pantalla-costeo-referencia': renderCosteoReferencia(); break;
    case 'pantalla-costeo-producto': renderCosteoProductos(); break;
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
  DISENOS_MEZCLA = (data || []).filter(r => r.datos).map(r => _normalizarDiseno(r.datos));
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
  AJUSTES_MEZCLA = (data || []).filter(r => r.datos).map(r => _normalizarAjuste(r.datos));
  rerenderPantallaActiva();
}
async function recargarViajesRT() {
  const { data } = await sb.from('entregas_programadas').select('datos').order('creado', { ascending: false });
  VIAJES = (data || []).filter(r => r.datos).map(r => r.datos);
  rerenderPantallaActiva();
}
async function recargarParametrosMoRT() {
  const { data } = await sb.from('parametros_mo').select('datos').eq('id', 1).maybeSingle();
  PARAMETROS_MO = data?.datos || _defaultParametrosMO();
  rerenderPantallaActiva();
}
async function recargarClasesSalarialesRT() {
  const { data } = await sb.from('clases_salariales').select('datos').order('creado', { ascending: true });
  CLASES_SALARIALES = (data || []).filter(r => r.datos).map(r => r.datos);
  rerenderPantallaActiva();
}
async function recargarCuadrillasRT() {
  const { data } = await sb.from('cuadrillas_productivas').select('datos, modificado').order('creado', { ascending: true });
  CUADRILLAS_PRODUCTIVAS = (data || []).filter(r => r.datos).map(r => ({ ...r.datos, _modificado: r.modificado }));
  rerenderPantallaActiva();
}
async function recargarMaquinariaRT() {
  const { data } = await sb.from('maquinaria_equipos').select('datos, modificado').order('creado', { ascending: true });
  MAQUINARIA_EQUIPOS = (data || []).filter(r => r.datos).map(r => ({ ...r.datos, _modificado: r.modificado }));
  rerenderPantallaActiva();
}
async function recargarInsumosCostosRT() {
  const { data } = await sb.from('insumos_costos').select('datos, modificado').order('creado', { ascending: true });
  INSUMOS_COSTOS = (data || []).filter(r => r.datos).map(r => ({ ...r.datos, _modificado: r.modificado }));
  rerenderPantallaActiva();
}
async function recargarCosteoProductosRT() {
  const { data } = await sb.from('costeo_productos').select('datos, modificado').order('creado', { ascending: true });
  COSTEO_PRODUCTOS = (data || []).filter(r => r.datos).map(r => ({ ...r.datos, _modificado: r.modificado }));
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas_programadas' }, () => _rtDebounce('viajes', recargarViajesRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'parametros_mo' },        () => _rtDebounce('parametrosmo', recargarParametrosMoRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clases_salariales' },     () => _rtDebounce('clasessalariales', recargarClasesSalarialesRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cuadrillas_productivas' }, () => _rtDebounce('cuadrillas', recargarCuadrillasRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'maquinaria_equipos' },      () => _rtDebounce('maquinaria', recargarMaquinariaRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'insumos_costos' },           () => _rtDebounce('insumoscostos', recargarInsumosCostosRT))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'costeo_productos' },          () => _rtDebounce('costeoproductos', recargarCosteoProductosRT))
    .subscribe((status) => {
      const ind = document.getElementById('rt-indicador');
      if (ind) {
        if (status === 'SUBSCRIBED') { ind.textContent = '🟢 En vivo'; ind.title = 'Sincronización en tiempo real activa'; ind.style.color = '#2E7D32'; }
        else { ind.textContent = '🔴 Sin conexión'; ind.title = 'Sincronización inactiva — refresca la página'; ind.style.color = '#C62828'; }
      }
    });
}

