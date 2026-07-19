// ═══════════════════════════════
// LECTURA DE INFORMES DE LABORATORIO (PDF) — modal Nuevo/Editar Ensayo
// ═══════════════════════════════
// Mismo principio que el lector de RUT (js/rut-parser.js): el PDF se lee por completo en el
// navegador (pdf.js, reutilizando _leerLineasPDF de rut-parser.js) y nunca se sube crudo a
// ningún lado más que al bucket ya existente (laboratorio-pdf) — leerlo es aparte de guardarlo.
//
// A diferencia del RUT, acá el usuario YA eligió el N° de Cilindro manualmente antes de soltar
// el PDF (paso obligatorio del flujo) — así el lector no tiene que adivinar cuál de las muestras
// del informe le corresponde: busca puntualmente la fila de ESE cilindro y llena Laboratorio,
// Fecha de ensayo, las resistencias por probeta y Observaciones. Si el cilindro elegido NO
// aparece en el PDF, se bloquea la subida por completo (ver manejarArchivoLaboratorio en
// calidad-mezclas.js) — evita adjuntar por error el informe de otro cilindro. Si el informe cubre
// varios cilindros, se repite el proceso por cada uno: nuevo ensayo, mismo PDF, otro N° de
// Cilindro — no se duplica en Storage (ver js/compresor-pdf.js).
//
// Cada laboratorio arma su propio formato de PDF, así que hay un extractor por laboratorio
// (_extractorInforme[laboratorio]), ajustado contra informes reales a medida que se prueba
// (mismo proceso que se siguió con RUT). Es lectura de MEJOR ESFUERZO: nunca guarda nada
// solo, siempre rellena el formulario para que se revise antes de Guardar.

const _MESES_ES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

// "15 DE JULIO DE 2026" -> "2026-07-15"
function _parsearFechaTextoEs(texto) {
  const m = texto.match(/(\d{1,2})\s+DE\s+([A-ZÁÉÍÓÚa-záéíóú]+)\s+DE\s+(\d{4})/i);
  if (!m) return '';
  const mes = _MESES_ES[m[2].toLowerCase()];
  if (!mes) return '';
  return `${m[3]}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// "11/07/2026" o "1/6/2026" (algunos informes no traen cero adelante) -> "2026-07-11" / "2026-06-01"
function _parsearFechaDDMMAAAA(texto) {
  const m = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}

function _detectarLaboratorioInforme(lineas) {
  const texto = lineas.join(' ').toLowerCase();
  if (/asprecon/.test(texto)) return 'ASPRECON INGENIERÍA';
  if (/consuas/.test(texto)) return 'CONSUAS INGENIERÍA';
  return '';
}

// Ancla la búsqueda en la línea donde aparece el N° de cilindro como número aislado (no como
// parte de otro número más largo, ej. "1467" no debe matchear dentro de "14670").
function _lineaCilindro(lineas, cilindroNo) {
  const re = new RegExp(`(^|[^0-9])${cilindroNo}([^0-9]|$)`);
  return lineas.findIndex(l => re.test(l));
}

function _lineasCilindro(lineas, cilindroNo) {
  const re = new RegExp(`(^|[^0-9])${cilindroNo}([^0-9]|$)`);
  return lineas.filter(l => re.test(l));
}

// La resistencia en MPa de cada probeta viene como el TERCERO de un grupo de 4 números seguidos
// (con coma decimal en los dos del medio) al final de la fila — ej. ASPRECON
// "7506 527,7 51,7 166,8" (psi/kg-cm²/MPa/%). El primero puede traer o no decimales; el cuarto
// (%) sí trae decimal siempre en este formato.
function _extraerResistenciasMPa(texto) {
  const grupos = [...texto.matchAll(/(\d{2,6}[.,]?\d*)\s+(\d{2,4}[.,]\d)\s+(\d{1,3}[.,]\d)\s+(\d{2,6}[.,]?\d*)/g)];
  return grupos.map(g => parseFloat(g[3].replace(',', '.')));
}

// CONSUAS trae más columnas antes de la resistencia (Área, Altura, Carga, Kg/cm², MPa, P.S.I.) —
// "Área Altura Carga Kg/cm²" tiene la misma forma de 4-números-con-coma que el grupo real
// "Carga Kg/cm² MPa P.S.I.", así que la heurística genérica de arriba agarra el grupo
// equivocado (confirmado a mano contra un informe real: leía la Carga en vez del MPa). Acá el
// 4° número (P.S.I.) es SIEMPRE un entero sin coma — eso sí distingue el grupo correcto.
function _extraerResistenciaConsuas(texto) {
  const grupos = [...texto.matchAll(/(\d{1,4}[.,]\d)\s+(\d{2,4}[.,]\d)\s+(\d{1,3}[.,]\d)\s+(\d{3,6})(?![.,]\d)/g)];
  return grupos.map(g => parseFloat(g[3].replace(',', '.')));
}

// ── ASPRECON: la fecha de ensayo va en texto ("FECHA DE REALIZACIÓN DE ENSAYO: 15 DE JULIO DE
// 2026", una sola vez para todo el informe). El N° de cilindro y las filas de las 3 probetas NO
// quedan en un orden de lectura prolijo — pdf.js reconstruye el texto por posición, y en un
// informe real la fila de la 1ra probeta (con sus números) aparece ANTES de la línea donde
// figura el N° de cilindro, mientras que la 2da probeta comparte línea con el cilindro y la 3ra
// va después (confirmado línea por línea contra un informe real: cilindro en la línea 20, pero
// la 1ra probeta está en la línea 17 — buscar solo hacia adelante la dejaba afuera). Por eso la
// ventana de búsqueda mira unas líneas hacia atrás Y hacia adelante del cilindro.
//
// La fila de la PRIMERA probeta trae además, pegado al final de la misma línea, el grupo de
// "resistencia promedio" (misma forma de 4 números que una probeta) — por eso se recorre línea
// por línea tomando como mucho UN valor por línea, así ese promedio (2do grupo de esa línea)
// queda descartado solo en vez de colarse como si fuera otra probeta. ──
function _extractorAsprecon(lineas, cilindroNo) {
  const fechaLinea = lineas.find(l => /FECHA DE REALIZACI[ÓO]N DE ENSAYO/i.test(l));
  const idx = _lineaCilindro(lineas, cilindroNo);
  const ventana = idx === -1 ? [] : lineas.slice(Math.max(0, idx - 5), idx + 10);
  const probetas = [];
  for (const linea of ventana) {
    const grupos = _extraerResistenciasMPa(linea);
    if (grupos.length) probetas.push(grupos[0]);
    if (probetas.length >= 3) break;
  }
  // Códigos de probeta (ej. "T2-21, T2-22, T2-23, T2-24") al final de la descripción del
  // elemento, quedan como Observaciones.
  const ventanaObs = idx === -1 ? '' : lineas.slice(idx, idx + 5).join(' ');
  const obs = ventanaObs.match(/([A-Z][A-Z0-9]*-[A-Z0-9]+(?:\s*,\s*[A-Z][A-Z0-9]*-[A-Z0-9]+)*)/);
  return {
    fechaEnsayo: fechaLinea ? _parsearFechaTextoEs(fechaLinea) : '',
    probetas,
    observaciones: obs ? obs[1].replace(/\s+/g, ' ').trim() : '',
  };
}

// ── CONSUAS: cada probeta es una fila propia que repite el N° de cilindro ("NUMERO o
// REFERENCIA") al principio, con dos fechas DD/MM/AAAA seguidas (fecha de vaciado, fecha de
// ensayo — se toma la segunda) y termina en el mismo grupo de 4 números. No trae códigos de
// probeta reconocibles en este formato, así que Observaciones queda vacío. ──
function _extractorConsuas(lineas, cilindroNo) {
  const filas = _lineasCilindro(lineas, cilindroNo);
  // Algunos informes de CONSUAS traen las fechas sin cero adelante (ej. "1/6/2026").
  const fechas = filas.length ? [...filas[0].matchAll(/\d{1,2}\/\d{1,2}\/\d{4}/g)] : [];
  return {
    fechaEnsayo: fechas.length >= 2 ? _parsearFechaDDMMAAAA(fechas[1][0]) : '',
    probetas: filas.map(l => _extraerResistenciaConsuas(l)[0]).filter(v => v != null),
    observaciones: '',
  };
}

const _EXTRACTORES_INFORME = {
  'ASPRECON INGENIERÍA': _extractorAsprecon,
  'CONSUAS INGENIERÍA': _extractorConsuas,
};

// true si el cilindro aparece en el PDF (independiente de si se logran leer bien los demás
// datos) — es el chequeo que decide si se bloquea la subida o no (ver calidad-mezclas.js).
function _cilindroEnInforme(lineas, cilindroNo) {
  return _lineaCilindro(lineas, cilindroNo) !== -1;
}

function _extraerDatosInformeCilindro(lineas, cilindroNo) {
  const laboratorio = _detectarLaboratorioInforme(lineas);
  const extractor = _EXTRACTORES_INFORME[laboratorio];
  const datos = extractor ? extractor(lineas, cilindroNo) : { fechaEnsayo: '', probetas: [], observaciones: '' };
  return { laboratorio, ...datos };
}
