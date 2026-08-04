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

