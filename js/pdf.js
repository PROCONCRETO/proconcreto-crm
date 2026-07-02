async function descargarPDF(numCot) {
  const btn = document.querySelector('button[onclick*="descargarPDF"]');
  if (btn) { btn.textContent = '⏳ Generando...'; btn.disabled = true; }

  try {
    const { jsPDF } = window.jspdf;
    const pageW = 210, pageH = 297; // A4 en mm

    // Cargar imagen de cabecera
    const topImg = await cargarImagen('membrete-top.jpg');
    const headerH = pageW * (topImg.naturalHeight / topImg.naturalWidth);

    // Renderizar cabecera del documento y contenido
    const contentEl = document.querySelector('.preview-content');
    const contentCanvas = await html2canvas(contentEl, {
      scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false
    });
    const pxToMm = pageW / contentCanvas.width;
    const contentH_px = _alturaContenidoReal(contentCanvas); // recorta el blanco sobrante al final
    const contentTotalH = contentH_px * pxToMm;

    // Renderizar pie
    const footerEl = document.querySelector('.preview-membrete-footer');
    const footerCanvas = await html2canvas(footerEl, {
      scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false
    });
    const footerH = footerCanvas.height * pxToMm;

    // Área de contenido disponible por página
    const availH = pageH - headerH - footerH - 6;
    const pageH_px = availH / pxToMm;

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const footerData = footerCanvas.toDataURL('image/jpeg', 0.95);

    // Paginación con corte limpio: el límite de cada página se ajusta a una franja en blanco
    let cursorY = 0, pageIndex = 0, guard = 0;
    while (cursorY < contentH_px - 1 && guard < 60) {
      guard++;
      let bottom = Math.min(contentH_px, cursorY + pageH_px);
      // Si no es la última porción, retroceder hasta una fila en blanco para no partir texto
      if (bottom < contentH_px) {
        bottom = _filaBlancaCerca(contentCanvas, Math.floor(bottom), cursorY + pageH_px * 0.55);
      }
      const sliceH_px = bottom - cursorY;
      if (sliceH_px <= 1) break;

      if (pageIndex > 0) pdf.addPage();

      // Cabecera en cada página
      pdf.addImage(topImg, 'JPEG', 0, 0, pageW, headerH);

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = contentCanvas.width;
      sliceCanvas.height = Math.ceil(sliceH_px);
      sliceCanvas.getContext('2d').drawImage(
        contentCanvas, 0, Math.floor(cursorY),
        contentCanvas.width, Math.ceil(sliceH_px),
        0, 0, contentCanvas.width, Math.ceil(sliceH_px)
      );
      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG',
        0, headerH + 2, pageW, sliceH_px * pxToMm);

      // Pie en cada página
      pdf.addImage(footerData, 'JPEG', 0, pageH - footerH, pageW, footerH);

      cursorY = bottom;
      pageIndex++;
    }

    // Página final: ANEXO Medios de Pago (imagen a página completa)
    const pagoImg = await cargarImagenOpcional(['medios-de-pago.jpg', 'medios-de-pago.png', 'medios_de_pago.jpg']);
    if (pagoImg) {
      pdf.addPage();
      const margin = 24; // margen alrededor de la imagen (mm)
      const maxW = pageW - margin * 2, maxH = pageH - margin * 2;
      const ratio = pagoImg.naturalHeight / pagoImg.naturalWidth;
      let w = maxW, h = maxW * ratio;
      if (h > maxH) { h = maxH; w = maxH / ratio; }
      const x = (pageW - w) / 2, y = (pageH - h) / 2;
      pdf.addImage(pagoImg, 'JPEG', x, y, w, h);
      // Marco sutil alrededor de la imagen
      pdf.setDrawColor(210); pdf.setLineWidth(0.3); pdf.rect(x, y, w, h);
    } else {
      console.warn('No se encontró "medios-de-pago.jpg"; se omite la página de medios de pago.');
    }

    const cot = COTIZACIONES.find(c => c.numero === numCot);
    const fecha = (cot?.fecha || document.getElementById('fecha-cot').value || new Date().toISOString().split('T')[0]).replace(/-/g, '_');
    const nombreCliente = cot?.cliente?.nombre || document.getElementById('cliente-nombre').value || '';
    const cliente = nombreCliente.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().replace(/\s+/g, '_');
    pdf.save(`${numCot}_${fecha}_${cliente}.pdf`);
  } finally {
    if (btn) { btn.textContent = '⬇️ Descargar PDF'; btn.disabled = false; }
  }
}

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src + '?t=' + Date.now();
  });
}

// Detecta la última fila con contenido real (no blanco) de un canvas, para recortar el espacio
// en blanco sobrante al final del documento y evitar páginas vacías en el PDF.
function _alturaContenidoReal(canvas) {
  try {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    for (let y = h - 1; y >= 0; y -= 2) {
      const data = ctx.getImageData(0, y, w, 1).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) {
          return Math.min(h, y + 16); // pequeño respiro tras el último contenido
        }
      }
    }
    return h;
  } catch (e) {
    return canvas.height; // si el canvas está "tainted", usar la altura completa
  }
}

// Busca, desde targetY hacia arriba (sin pasar de minY), una fila completamente blanca
// para cortar la página ENTRE renglones y no partir el texto. Devuelve targetY si no encuentra.
function _filaBlancaCerca(canvas, targetY, minY) {
  try {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    minY = Math.max(0, Math.floor(minY));
    for (let y = Math.floor(targetY); y >= minY; y--) {
      const data = ctx.getImageData(0, y, w, 1).data;
      let blanca = true;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) { blanca = false; break; }
      }
      if (blanca) return y;
    }
  } catch (e) { /* canvas tainted: usar el corte por defecto */ }
  return targetY;
}

// Intenta cargar la primera imagen disponible de una lista de nombres; devuelve null si ninguna existe.
async function cargarImagenOpcional(nombres) {
  for (const src of nombres) {
    try { return await cargarImagen(src); } catch (e) { /* probar siguiente */ }
  }
  return null;
}
