// Ítems actuales
let itemsActuales = [];

// ═══════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════
function activarModulo(modulo) {
  document.getElementById('vista-previa').style.display = 'none';
  document.querySelectorAll('.nav-modulo').forEach(b => b.classList.remove('activo'));
  event.currentTarget.classList.add('activo');
  document.getElementById('subnav-cotizaciones').style.display = modulo === 'cotizaciones' ? 'flex' : 'none';
  document.getElementById('subnav-produccion').style.display = modulo === 'produccion' ? 'flex' : 'none';
  document.getElementById('subnav-calidad').style.display = modulo === 'calidad' ? 'flex' : 'none';
  if (modulo === 'produccion') {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
    document.getElementById('pantalla-ordenes-servicio').classList.add('activa');
    renderOrdenes();
  }
  if (modulo === 'productos') {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
    document.getElementById('pantalla-productos').classList.add('activa');
    renderProductosAdmin();
  }
  if (modulo === 'calidad') {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
    document.getElementById('pantalla-diseno-mezcla').classList.add('activa');
    renderDisenosMezcla();
  }
}

function ir(pantalla) {
  document.getElementById('vista-previa').style.display = 'none';
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('activo'));
  document.getElementById('pantalla-' + pantalla).classList.add('activa');
  event.currentTarget.classList.add('activo');
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
  if (pantalla === 'materia-prima') renderMateriaPrima();
  if (pantalla === 'trazabilidad') { const inp = document.getElementById('buscar-trazabilidad'); if (inp) inp.value = ''; buscarTrazabilidad(); }
  if (pantalla === 'no-conformidades') renderNoConformidades();
  if (pantalla === 'certificados-calidad') renderCertificadosCalidad();
}

