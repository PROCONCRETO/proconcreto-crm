// ═══════════════════════════════
// COMPRESOR DE PDF (resultados de laboratorio)
// ═══════════════════════════════
// Reduce el peso de un PDF escaneado re-renderizando cada página como imagen (pdf.js) y
// reconstruyendo un PDF nuevo con esas imágenes comprimidas como JPEG (jsPDF). La resolución
// (~200 dpi) y la calidad JPEG (20%) son las que se probaron a mano contra PDFs reales de
// resultados de laboratorio antes de meter esto al código: bajar la resolución de más difumina
// texto/tablas, pero la calidad JPEG sí se puede bajar bastante en un documento de fondo blanco
// con texto negro sin que se note.
//
// Solo tiene sentido para PDFs pesados (escaneados) — uno ya liviano (PDF nativo, sin imágenes
// grandes) casi no baja de peso y perdería el texto seleccionable sin ganar nada, por eso
// _comprimirPdfSiPesa() solo actúa por encima de un umbral de tamaño.

const _PDF_COMPRESION_ESCALA = 2.8;        // ~200 dpi
const _PDF_COMPRESION_CALIDAD = 0.20;      // 20% JPEG
const _PDF_COMPRESION_UMBRAL = 300 * 1024; // 300 KB — por debajo de esto, se sube tal cual

async function _comprimirPdf(file, escala = _PDF_COMPRESION_ESCALA, calidad = _PDF_COMPRESION_CALIDAD) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const { jsPDF } = window.jspdf;
  let docSalida = null;

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewportBase = page.getViewport({ scale: 1 });
    const viewportRender = page.getViewport({ scale: escala });

    const canvas = document.createElement('canvas');
    canvas.width = viewportRender.width;
    canvas.height = viewportRender.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: viewportRender }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', calidad);

    const anchoMM = (viewportBase.width / 72) * 25.4;
    const altoMM = (viewportBase.height / 72) * 25.4;
    const orientacion = anchoMM > altoMM ? 'l' : 'p';

    if (!docSalida) {
      docSalida = new jsPDF({ orientation: orientacion, unit: 'mm', format: [anchoMM, altoMM] });
    } else {
      docSalida.addPage([anchoMM, altoMM], orientacion);
    }
    docSalida.addImage(dataUrl, 'JPEG', 0, 0, anchoMM, altoMM);
  }
  return docSalida.output('blob');
}

// Comprime solo si vale la pena (por encima del umbral) — si no, devuelve el archivo tal cual.
async function _comprimirPdfSiPesa(file) {
  if (file.size <= _PDF_COMPRESION_UMBRAL) {
    return { blob: file, comprimido: false, tamanoOriginal: file.size, tamanoFinal: file.size };
  }
  const blob = await _comprimirPdf(file);
  return { blob, comprimido: true, tamanoOriginal: file.size, tamanoFinal: blob.size };
}

// Abre un archivo de un bucket privado de Supabase Storage en una pestaña nueva, vía URL firmada
// (el bucket no es público — solo usuarios autenticados de la app pueden generar el link, y ese
// link vence en una hora).
async function _abrirPdfStorage(bucket, path) {
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) { alert('No se pudo abrir el PDF: ' + error.message); return; }
  window.open(data.signedUrl, '_blank');
}
