// ═══════════════════════════════
// SUPABASE + DATOS
// ═══════════════════════════════
const _SB_URL = 'https://wyfjmgywyqluzoymxoyp.supabase.co';
const _SB_KEY = 'sb_publishable_t1YO4FWYyljZaQXWc2xK0A_zcukxDa1';
const sb = supabase.createClient(_SB_URL, _SB_KEY);

// Escape genérico de HTML — para cualquier texto libre (nombre de cliente, causa, observaciones,
// etc.) que se interpola dentro de un template literal asignado a innerHTML (2026-08-04,
// auditoría de seguridad: clientes/cotizaciones no tenían RLS y ese texto se mostraba sin
// escapar en Histórico/Cotizador — alguien podía insertar un cliente con HTML/JS malicioso en
// el nombre y ejecutarlo en el navegador del primer empleado que lo viera). No hace falta
// donde el destino es .value/.textContent/alert()/confirm() — esos nunca interpretan HTML.
function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Reordenamiento manual (arrastrar y soltar) ──
// Mismo patrón que `viaje.orden`/`soltarViajeSobreViaje()` en js/logistica.js, generalizado
// para reutilizar en Costos de Referencia, Maquinaria y Equipos, y Costeo de Producto
// (2026-08-21, a pedido del usuario: poder ordenar estas listas manualmente con un handle de
// arrastre, "de acuerdo al avance" de su trabajo, en vez del orden alfabético/de creación).

// Rellena `orden` en los ítems que no lo tengan todavía (con su posición de llegada, mismo
// criterio que Logística usa con el id/timestamp como respaldo) y ordena la lista por ese
// campo — se llama cada vez que se cargan/recargan estas listas (cargarDatosSupabase() y cada
// recargarXRT() en js/datos-realtime.js), igual que _normalizarDiseno()/_normalizarAjuste().
function _normalizarOrdenLista(lista) {
  lista.forEach((x, i) => { if (x.orden === undefined || x.orden === null) x.orden = i; });
  lista.sort((a, b) => a.orden - b.orden);
  return lista;
}

// Mueve el ítem `claveArrastrada` a la posición de `claveDestino` DENTRO de `lista` (el
// arreglo completo, no una vista filtrada — así el resultado es consistente aunque haya un
// buscador/filtro activo en ese momento) y renumera `orden` de todo el arreglo (0..n-1), igual
// que soltarViajeSobreViaje() en js/logistica.js. `claveFn` obtiene la clave única de una fila;
// `guardarFila` persiste una fila en Supabase (debe devolver una Promise).
function _reordenarPorArrastre(lista, claveArrastrada, claveDestino, claveFn, guardarFila) {
  if (claveArrastrada === claveDestino) return;
  const idxA = lista.findIndex(x => claveFn(x) === claveArrastrada);
  if (idxA < 0) return;
  const [item] = lista.splice(idxA, 1);
  const idxB = lista.findIndex(x => claveFn(x) === claveDestino);
  if (idxB < 0) { lista.splice(idxA, 0, item); return; } // destino no encontrado, revertir
  lista.splice(idxB, 0, item);
  lista.forEach((x, i) => { x.orden = i; });
  return Promise.all(lista.map(guardarFila));
}

const USUARIOS_CRM = {
  'jose.escobar@proconcreto.com.co':      { nombre: 'Jose Pablo Escobar Mejia',      cargo: 'Gerente Técnico',       cel: '+57 301 623 9733' },
  'maria.escobar@proconcreto.com.co':     { nombre: 'Maria Alejandra Escobar Mejia', cargo: 'Gerente Administrativa', cel: '+57 311 635 1086' },
  'mercadeo@proconcreto.com.co':          { nombre: 'Valentina Escobar Mejia',        cargo: 'Gerente Comercial',      cel: '+57 316 742 7494' },
  'departamentotecnico@proconcreto.com.co':{ nombre: 'Ana María Mazuera',             cargo: 'Coordinadora Técnica',   cel: '+57 301 539 0344' },
  'produccion@proconcreto.com.co':        { nombre: 'Jaime Eduardo Franco',           cargo: 'Jefe de Producción',     cel: '+57 311 408 2285' },
  'logistica@proconcreto.com.co':         { nombre: 'Jennifer Lopez',                 cargo: 'Jefe de Logística',      cel: '+57 324 367 8723' },
  'calidad@proconcreto.com.co':           { nombre: 'Juan Esteban Valencia',          cargo: 'Asistente de Calidad',   cel: '+57 313 709 2049' },
};

let COTIZACIONES = [];
let CLIENTES = [];
let USUARIO_ACTUAL = null;

// Correos con acceso a Centro de Costos (2026-08-04, a pedido del usuario: "me preocupa que
// entren personas y nos puedan alterar la estructura"). Esto es una capa de conveniencia en
// la UI — oculta el módulo y bloquea la navegación para el resto de usuarios — pero la
// protección real está en las políticas RLS de Supabase (sql/2026-08-04_rls_centro_costos.sql),
// que exigen exactamente estos mismos correos para poder escribir en esas tablas. Si cambia
// quién debe tener acceso, hay que actualizar ambos lados: esta lista y la función SQL
// es_usuario_centro_costos() (correr de nuevo solo ese CREATE OR REPLACE FUNCTION).
const _EMAILS_CENTRO_COSTOS = [
  'jose.escobar@proconcreto.com.co',
  'departamentotecnico@proconcreto.com.co',
  'produccion@proconcreto.com.co',
];
function _esUsuarioCentroCostos() {
  return !!USUARIO_ACTUAL && _EMAILS_CENTRO_COSTOS.includes(USUARIO_ACTUAL.email);
}

// Aprobador de exclusiones de "día atípico" en Producción (2026-09-17, a pedido del usuario) —
// reusa EXACTAMENTE la misma lista de correos de Centro de Costos (confirmado con el usuario, ya
// incluye a produccion@proconcreto.com.co, el Jefe de Producción) en vez de mantener una lista
// nueva sincronizada a mano. Nombre propio para que el código de Producción no tenga que "saber"
// que por debajo es la misma lista — mismo criterio ya aplicado en la protección real del lado de
// Supabase (es_usuario_aprobador_produccion() delega en es_usuario_centro_costos(), ver
// sql/2026-09-17_dias_atipicos_produccion.sql).
function _esUsuarioAprobadorProduccion() {
  return _esUsuarioCentroCostos();
}

// Consecutivo de cotización — se asigna solo, nunca se escribe a mano (antes era manual y
// causaba typos, saltos y duplicados). Arranca en 100001; los números de antes de esa fecha
// quedan intactos como referencia en cot.numeroAnterior tras la migración (ver docs).
function siguienteNum() {
  const nums = COTIZACIONES.map(c => parseInt((c.numero || '').replace(/\D/g, '')) || 0);
  const max = nums.length ? Math.max(...nums) : 0;
  return 'C' + String(Math.max(max + 1, 100001));
}

// Tarifas de transporte (desde Excel)
const TARIFAS_TRANSPORTE = {
  'Manizales': 470000, 'Pereira': 580000, 'Armenia': 1160000,
  'Chinchiná': 230000, 'Santarosa': 390000, 'Palestina': 250000,
  'Viterbo': 1060000, 'San José': 990000, 'Risaralda': 950000,
  'Belalcázar': 880000, 'Anserma': 1020000, 'Supía': 1100000,
  'Riosucio': 1050000, 'Marmato': 1240000, 'La Merced': 1210000,
  'Neira': 900000
};

// Peso asumido para "Por viaje completo" — cobro fijo cuando el destino es apartado y no se
// puede consolidar carga con otras entregas (se cobra el viaje entero, no lo que realmente
// pesa el pedido). Es la capacidad estándar de un camión: 11 toneladas.
const PESO_VIAJE_COMPLETO = 11000;

// kg por viaje para calcular transportes (usamos tarifa por viaje de 10 TON)
const TARIFAS_KG_TRANSPORTE = {
  'Manizales': 43, 'Pereira': 53, 'Armenia': 106, 'Chinchiná': 21,
  'Santarosa': 36, 'Palestina': 23, 'Viterbo': 97, 'San José': 90,
  'Risaralda': 87, 'Belalcázar': 80, 'Anserma': 93, 'Supía': 100,
  'Riosucio': 96, 'Marmato': 113, 'La Merced': 110, 'Neira': 82
};

// ── "Deshacer" genérico, por acción (2026-10-14, a pedido del usuario: "configurar para que
// cualquier acción que hagamos, podamos darle control z y devolver la acción") ──
// Un Ctrl+Z universal (deshacer CUALQUIER acción de la app) exigiría rehacer cómo guarda cada
// uno de los ~15 módulos — se optó por algo mucho más realista y ya acordado con el usuario:
// un botón "Deshacer" justo después de las acciones de eliminar más riesgosas, empezando por
// los registros que de verdad se pierden si uno se equivoca (Proyectos, Clientes, Productos,
// Costeo de Producto, Diseño de Mezcla, Cotizaciones, Órdenes, Viajes — ver cada `eliminarX()`).
//
// Patrón: en vez de borrar de Supabase al toque, la fila se quita de la pantalla de inmediato
// (se siente igual de instantáneo) y el DELETE real se manda recién cuando expira la ventana de
// "Deshacer" (8 segundos) — así, si se alcanza a deshacer, nunca llegó a faltar nada en la base
// de datos (nada que journar/recomponer, ni riesgo de que otro usuario vea desaparecer y
// reaparecer un registro por un error de alguien más).
let _deshacerPendiente = null; // { alConfirmar, alDeshacer, timer } o null

function _cajaToastDeshacer() {
  let t = document.getElementById('toast-deshacer');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast-deshacer';
    t.style.cssText = 'display:none;position:fixed;bottom:28px;left:50%;transform:translateX(-50%);align-items:center;gap:14px;background:#1C2333;color:white;padding:10px 12px 10px 20px;border-radius:20px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.25)';
    document.body.appendChild(t);
  }
  return t;
}
// `mensaje`: texto a mostrar. `alConfirmar`: se ejecuta sola a los 8s si nadie deshace (ahí sí
// se manda el DELETE real). `alDeshacer`: se ejecuta si se hace clic en "Deshacer" (solo
// devuelve la fila a la pantalla — nunca se llegó a mandar el DELETE).
function _ofrecerDeshacer(mensaje, alConfirmar, alDeshacer) {
  // Si ya había una acción esperando confirmación (el usuario no alcanzó a reaccionar a esa),
  // se confirma de una vez antes de empezar la nueva — nunca se pisan ni se pierden en el aire.
  if (_deshacerPendiente) { clearTimeout(_deshacerPendiente.timer); const prev = _deshacerPendiente.alConfirmar; _deshacerPendiente = null; prev(); }
  const t = _cajaToastDeshacer();
  const timer = setTimeout(() => {
    _deshacerPendiente = null;
    t.style.display = 'none';
    alConfirmar();
  }, 8000);
  _deshacerPendiente = { alConfirmar, alDeshacer, timer };
  t.innerHTML = `<span>${mensaje}</span><button type="button" onclick="_deshacerAccionPendiente()" style="background:#8BC53F;color:#001F3F;border:none;border-radius:14px;padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap">↩️ Deshacer</button>`;
  t.style.display = 'flex';
}
function _deshacerAccionPendiente() {
  if (!_deshacerPendiente) return;
  clearTimeout(_deshacerPendiente.timer);
  const { alDeshacer } = _deshacerPendiente;
  _deshacerPendiente = null;
  const t = document.getElementById('toast-deshacer');
  if (t) t.style.display = 'none';
  alDeshacer();
}

