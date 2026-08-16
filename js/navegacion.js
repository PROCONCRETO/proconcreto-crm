// Ítems actuales
let itemsActuales = [];

// ═══════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════
// Pantallas que viven bajo el módulo Centro de Costos — restringidas a
// _EMAILS_CENTRO_COSTOS (2026-08-04, ver js/config.js). Esto es solo la capa de UI: bloquea
// el clic normal y una llamada directa desde la consola, pero la protección real está en las
// políticas RLS de Supabase (sql/2026-08-04_rls_centro_costos.sql).
const _PANTALLAS_CENTRO_COSTOS = ['productos', 'costeo-mo', 'costeo-maquinaria', 'costeo-referencia', 'costeo-producto'];

function activarModulo(modulo) {
  if (modulo === 'costeo' && !_esUsuarioCentroCostos()) { alert('No tienes acceso a Centro de Costos.'); return; }
  document.getElementById('vista-previa').style.display = 'none';
  document.querySelectorAll('.nav-modulo').forEach(b => b.classList.remove('activo'));
  event.currentTarget.classList.add('activo');
  document.getElementById('subnav-cotizaciones').style.display = modulo === 'cotizaciones' ? 'flex' : 'none';
  document.getElementById('subnav-produccion').style.display = modulo === 'produccion' ? 'flex' : 'none';
  document.getElementById('subnav-logistica').style.display = modulo === 'logistica' ? 'flex' : 'none';
  document.getElementById('subnav-calidad').style.display = modulo === 'calidad' ? 'flex' : 'none';
  document.getElementById('subnav-costeo').style.display = modulo === 'costeo' ? 'flex' : 'none';
  if (modulo === 'cotizaciones') {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
    document.getElementById('pantalla-nueva-cotizacion').classList.add('activa');
    document.querySelectorAll('#subnav-cotizaciones .nav-btn').forEach(b => b.classList.remove('activo'));
    document.querySelector('#subnav-cotizaciones .nav-btn[onclick*="nueva-cotizacion"]')?.classList.add('activo');
    if (typeof _resetFormularioCotizacion === 'function') _resetFormularioCotizacion();
  }
  if (modulo === 'logistica') {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
    document.getElementById('pantalla-logistica').classList.add('activa');
    renderCalendarioLogistica();
  }
  if (modulo === 'produccion') {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
    document.getElementById('pantalla-ordenes-servicio').classList.add('activa');
    renderOrdenes();
  }
  if (modulo === 'calidad') {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
    document.getElementById('pantalla-ajuste-mezcla').classList.add('activa');
    document.querySelectorAll('#subnav-calidad .nav-btn').forEach(b => b.classList.remove('activo'));
    document.querySelector('#subnav-calidad .nav-btn[onclick*="ajuste-mezcla"]')?.classList.add('activo');
    renderAjustesMezcla();
  }
  if (modulo === 'costeo') {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
    document.getElementById('pantalla-productos').classList.add('activa');
    document.querySelectorAll('#subnav-costeo .nav-btn').forEach(b => b.classList.remove('activo'));
    document.querySelector('#subnav-costeo .nav-btn[onclick*="productos"]')?.classList.add('activo');
    renderProductosAdmin();
  }
}

function ir(pantalla) {
  if (_PANTALLAS_CENTRO_COSTOS.includes(pantalla) && !_esUsuarioCentroCostos()) { alert('No tienes acceso a Centro de Costos.'); return; }
  document.getElementById('vista-previa').style.display = 'none';
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('activo'));
  document.getElementById('pantalla-' + pantalla).classList.add('activa');
  event.currentTarget.classList.add('activo');
  // Entrar a "Nueva Cotización" siempre debe dejar el formulario en blanco — si no se hiciera,
  // cualquier dato que hubiera quedado pegado ahí (de previsualizar, de una edición abandonada
  // sin guardar, etc.) se seguiría mostrando como si fuera la cotización nueva, y hasta se
  // podía terminar guardando "encima" de la cotización vieja con su mismo número (bug real,
  // reportado como "se pierde el consecutivo porque se graba con el de la que previsualizaron").
  if (pantalla === 'nueva-cotizacion' && typeof _resetFormularioCotizacion === 'function') _resetFormularioCotizacion();
  if (pantalla === 'pipeline') renderPipeline();
  if (pantalla === 'pipeline-produccion') renderPipelineProduccion();
  if (pantalla === 'ordenes-servicio') renderOrdenes();
  if (pantalla === 'produccion-diaria') renderProduccionDiaria();
  if (pantalla === 'inventario') renderInventario();
  if (pantalla === 'historico') renderHistorico();
  if (pantalla === 'clientes') renderClientes();
  if (pantalla === 'estadisticas') { poblarFiltrosEstadisticas(); renderEstadisticas(); }
  if (pantalla === 'diseno-mezcla') renderDisenosMezcla();
  if (pantalla === 'ajuste-mezcla') renderAjustesMezcla();
  if (pantalla === 'control-ensayos') renderEnsayosCalidad();
  if (pantalla === 'analisis-estadistico') renderAnalisisEstadistico();
  if (pantalla === 'materia-prima') renderMateriaPrima();
  if (pantalla === 'logistica') renderCalendarioLogistica();
  if (pantalla === 'logistica-estadisticas') renderEstadisticasLogistica();
  if (pantalla === 'productos') renderProductosAdmin();
  if (pantalla === 'costeo-mo') renderCosteoManoObra();
  if (pantalla === 'costeo-maquinaria') renderCosteoMaquinaria();
  if (pantalla === 'costeo-referencia') renderCosteoReferencia();
  if (pantalla === 'costeo-producto') renderCosteoProductos();
}

