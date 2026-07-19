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
// Fecha de ensayo, las resistencias por probeta y Observaciones. Si el informe cubre varios
// cilindros, se repite el proceso por cada uno: nuevo ensayo, mismo PDF, otro N° de Cilindro —
// no se duplica en Storage (ver js/compresor-pdf.js).
//
// Es un lector de MEJOR ESFUERZO — cada laboratorio arma su propio formato de PDF, así que esto
// se ajusta contra informes reales a medida que se prueba (mismo proceso que se siguió con RUT).
// Nunca guarda nada solo: siempre rellena el formulario para que se revise antes de Guardar.

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

function _detectarLaboratorioInforme(lineas) {
  const texto = lineas.join(' ').toLowerCase();
  if (/asprecon/.test(texto)) return 'ASPRECON INGENIERÍA';
  if (/consuas/.test(texto)) return 'CONSUAS INGENIERÍA';
  return '';
}

function _extraerFechaEnsayoInforme(lineas) {
  const linea = lineas.find(l => /FECHA DE REALIZACI[ÓO]N DE ENSAYO/i.test(l));
  return linea ? _parsearFechaTextoEs(linea) : '';
}

// Ancla la búsqueda en la línea donde aparece el N° de cilindro como número aislado (no como
// parte de otro número más largo) — desde ahí se buscan, en las líneas siguientes, las
// resistencias y los códigos de probeta de esa muestra puntual.
function _lineaCilindro(lineas, cilindroNo) {
  const re = new RegExp(`(^|[^0-9])${cilindroNo}([^0-9]|$)`);
  return lineas.findIndex(l => re.test(l));
}

// Cada probeta imprime un grupo de 4 números con coma decimal (psi / kg-cm² / MPa / %) — el
// tercero de cada grupo es la resistencia en MPa. La fila del promedio (que sale después de la
// primera probeta) tiene la misma forma, así que solo se toman los primeros 3 grupos.
function _extraerProbetasCilindro(lineas, cilindroNo) {
  const idx = _lineaCilindro(lineas, cilindroNo);
  if (idx === -1) return [];
  const bloque = lineas.slice(idx, idx + 15).join(' ');
  const grupos = [...bloque.matchAll(/(\d{3,6}[.,]?\d*)\s+(\d{2,4}[.,]\d)\s+(\d{1,3}[.,]\d)\s+(\d{2,3}[.,]\d)/g)];
  return grupos.slice(0, 3).map(g => parseFloat(g[3].replace(',', '.')));
}

// Códigos de probeta (ej. "T2-21, T2-22, T2-23, T2-24") que suelen ir al final de la descripción
// del elemento — quedan como Observaciones del ensayo.
function _extraerObservacionesInforme(lineas, cilindroNo) {
  const idx = _lineaCilindro(lineas, cilindroNo);
  if (idx === -1) return '';
  const ventana = lineas.slice(idx, idx + 5).join(' ');
  const m = ventana.match(/([A-Z][A-Z0-9]*-[A-Z0-9]+(?:\s*,\s*[A-Z][A-Z0-9]*-[A-Z0-9]+)*)/);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

async function leerInformeLaboratorio(file, cilindroNo) {
  const lineas = await _leerLineasPDF(file);
  return {
    laboratorio: _detectarLaboratorioInforme(lineas),
    fechaEnsayo: _extraerFechaEnsayoInforme(lineas),
    probetas: _extraerProbetasCilindro(lineas, cilindroNo),
    observaciones: _extraerObservacionesInforme(lineas, cilindroNo),
  };
}
