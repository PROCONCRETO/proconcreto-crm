// ═══════════════════════════════
// SUPABASE + DATOS
// ═══════════════════════════════
const _SB_URL = 'https://wyfjmgywyqluzoymxoyp.supabase.co';
const _SB_KEY = 'sb_publishable_t1YO4FWYyljZaQXWc2xK0A_zcukxDa1';
const sb = supabase.createClient(_SB_URL, _SB_KEY);

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

// Contador de cotizaciones
function siguienteNum() {
  const nums = COTIZACIONES.map(c => parseInt(c.numero.replace('C','')) || 0);
  const max = nums.length ? Math.max(...nums) : 0;
  return 'C' + String(max + 1).padStart(4, '0');
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

// kg por viaje para calcular transportes (usamos tarifa por viaje de 10 TON)
const TARIFAS_KG_TRANSPORTE = {
  'Manizales': 43, 'Pereira': 53, 'Armenia': 106, 'Chinchiná': 21,
  'Santarosa': 36, 'Palestina': 23, 'Viterbo': 97, 'San José': 90,
  'Risaralda': 87, 'Belalcázar': 80, 'Anserma': 93, 'Supía': 100,
  'Riosucio': 96, 'Marmato': 113, 'La Merced': 110, 'Neira': 82
};

