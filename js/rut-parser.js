// ═══════════════════════════════
// LECTURA DE RUT (PDF) — modal Nuevo/Editar Cliente
// ═══════════════════════════════
// El PDF se lee por completo en el navegador (pdf.js, cargado por CDN) y nunca se sube a
// ningún lado — ni a Supabase ni a ninguna otra parte. Se procesa en memoria y se descarta;
// lo único que sale de esta pantalla son los campos ya rellenados en el formulario.
//
// El RUT de la DIAN es un formulario estandarizado, pero pdf.js no entrega el texto en orden
// de lectura visual por defecto (suele separar "plantilla" de "valores llenados" en bloques
// distintos). Por eso _leerLineasPDF reconstruye renglones agrupando por posición Y y
// ordenando por X, y _extraerDatosRut busca patrones sobre esas líneas ya reconstruidas.
//
// Es un parser de mejor esfuerzo, no infalible — por eso SIEMPRE se muestra lo leído en el
// formulario para que se revise antes de guardar, nunca se guarda solo.

async function _leerLineasPDF(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lineas = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const contenido = await page.getTextContent();
    const items = contenido.items
      .map(it => ({ texto: it.str, x: it.transform[4], y: it.transform[5] }))
      .filter(it => it.texto && it.texto.trim());
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    let renglon = null, yRenglon = null;
    items.forEach(it => {
      if (yRenglon === null || Math.abs(it.y - yRenglon) > 3) {
        renglon = [];
        lineas.push(renglon);
        yRenglon = it.y;
      }
      renglon.push(it.texto);
    });
  }
  return lineas.map(r => r.join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// Busca la línea que matchea `patronLabel` y devuelve la siguiente línea no vacía (el valor
// suele quedar impreso justo debajo de la etiqueta de la casilla, no al lado).
function _valorDespuesDe(lineas, patronLabel) {
  const idx = lineas.findIndex(l => patronLabel.test(l));
  if (idx === -1 || idx + 1 >= lineas.length) return '';
  return lineas[idx + 1].trim();
}

// Un NIT colombiano son 9 dígitos + 1 dígito de verificación (DV), impresos como una fila de
// casillas de un solo dígito. Esa fila a veces queda pegada a otros valores de la misma
// franja del formulario (ej. "12. Dirección seccional"), así que no basta con tomar "la línea
// siguiente" a la etiqueta tal cual — se busca, en las líneas después de la etiqueta, la
// primera que sea (o empiece por) una racha de solo dígitos/espacios/guiones de al menos 9
// caracteres, en vez de confiar en que esa línea venga sola.
function _extraerNitDv(lineas) {
  const idxLabel = lineas.findIndex(l => /N[úu]mero de Identificaci[óo]n Tributaria/i.test(l));
  if (idxLabel === -1) return { nit: '', dv: '' };
  for (let i = idxLabel + 1; i < Math.min(idxLabel + 6, lineas.length); i++) {
    const linea = lineas[i];
    // Racha de dígitos al inicio de la línea (cubre tanto una línea 100% numérica como una
    // línea donde el NIT viene primero y después se pega texto de otra casilla).
    const m = linea.match(/^[\d\s-]{9,}/);
    const digitos = ((m ? m[0] : '').match(/\d/g) || []).join('');
    if (digitos.length >= 9) {
      return digitos.length >= 10 ? { nit: digitos.slice(0, -1), dv: digitos.slice(-1) } : { nit: digitos, dv: '' };
    }
  }
  return { nit: '', dv: '' };
}

// El correo se busca cerca de la etiqueta "42. Correo electrónico" primero — un PDF de RUT
// puede traer otros correos que no se ven a simple vista (metadatos, pie de página) pero sí
// aparecen en el texto que lee pdf.js, así que buscar en todo el documento es más arriesgado.
function _extraerCorreo(lineas) {
  const idxLabel = lineas.findIndex(l => /Correo electr[óo]nico/i.test(l));
  const rango = idxLabel === -1 ? lineas : lineas.slice(idxLabel, idxLabel + 4);
  for (const l of rango) {
    const m = l.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (m) return m[0];
  }
  const global = lineas.join('\n').match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return global ? global[0] : '';
}

// El RUT puede traer varios códigos marcados a la vez en "Responsabilidades, Calidades y
// Atributos" (casilla 53). Cada código presente aparece en la leyenda de esa sección como
// "NN- descripción" (con o sin espacio antes del guion) — buscar por el código en sí es más
// confiable que por el texto de la descripción, porque esas cajas son angostas y a veces
// cortan la palabra antes de terminar (ej. "régimen ordinario" queda como "régimen ordinar"
// en algunos RUT). La frase se deja como respaldo por si el guion no queda pegado al código.
// Prioridad si hay más de uno marcado: 47 (Régimen Simple, reemplaza al ordinario) > 13 (Gran
// Contribuyente, es una calidad aparte que suele ser la más relevante de anotar) > 05 (régimen
// ordinario, el más común/por defecto).
function _extraerRegimen(lineas) {
  const idxSeccion = lineas.findIndex(l => /Responsabilidades,?\s*Calidades\s*y\s*Atributos/i.test(l));
  const texto = (idxSeccion === -1 ? lineas : lineas.slice(idxSeccion)).join(' ');
  const tieneCodigo = (codigo) => new RegExp(`\\b${codigo}\\s*-`).test(texto);
  if (tieneCodigo('47') || /r[ée]gimen\s+simple/i.test(texto)) return '47. Régimen Simple de Tributación (SIMPLE)';
  if (tieneCodigo('13') || /gran\s+contribu/i.test(texto)) return '13. Gran contribuyente';
  if (tieneCodigo('05') || /r[ée]gimen\s+ordinar/i.test(texto)) return '05. Impuesto Sobre la Renta y Complementarios Régimen Ordinario';
  return '';
}

function _extraerDatosRut(lineas) {
  const { nit, dv } = _extraerNitDv(lineas);
  const razonSocial = _valorDespuesDe(lineas, /^35\.\s*Raz[óo]n social/i);
  const direccion = _valorDespuesDe(lineas, /^41\.\s*Direcci[óo]n principal/i);
  const correoFacturacion = _extraerCorreo(lineas);
  const regimen = _extraerRegimen(lineas);

  return {
    nit: dv ? `${nit}-${dv}` : nit,
    nombre: razonSocial,
    direccion,
    correoFacturacion,
    regimen,
  };
}

// ── Orquestación: leer archivo → extraer → rellenar el formulario (nunca se guarda el PDF) ──
function _estadoRut(msg, tipo) {
  const el = document.getElementById('rut-estado');
  if (!el) return;
  const color = tipo === 'error' ? 'var(--rojo)' : tipo === 'ok' ? 'var(--verde)' : 'var(--gris-medio)';
  el.style.color = color;
  el.textContent = msg;
}

async function manejarArchivoRut(file) {
  if (!file) return;
  if (file.type !== 'application/pdf') { _estadoRut('Ese archivo no es un PDF.', 'error'); return; }
  if (typeof pdfjsLib === 'undefined') { _estadoRut('No se pudo cargar el lector de PDF (revisa tu conexión) — completa los datos a mano.', 'error'); return; }

  _estadoRut('⏳ Leyendo el RUT...', null);
  try {
    const lineas = await _leerLineasPDF(file);
    const datos = _extraerDatosRut(lineas);

    if (datos.nombre) document.getElementById('m-cliente-nombre').value = datos.nombre;
    if (datos.nit) document.getElementById('m-cliente-nit').value = datos.nit;
    if (datos.direccion) document.getElementById('m-cliente-direccion').value = datos.direccion;
    if (datos.correoFacturacion) document.getElementById('m-cliente-emailFacturacion').value = datos.correoFacturacion;
    if (datos.regimen) document.getElementById('m-cliente-regimen').value = datos.regimen;

    const leidos = ['nombre', 'nit', 'direccion', 'correoFacturacion', 'regimen'].filter(k => datos[k]).length;
    if (leidos === 0) {
      _estadoRut('No pude reconocer los datos de este RUT — revisa que sea el formulario 001 de la DIAN, o completa a mano.', 'error');
    } else {
      _estadoRut(`✅ Se leyeron ${leidos} de 5 campos del RUT — revísalos antes de guardar. El PDF no se guardó en ningún lado.`, 'ok');
    }
  } catch (err) {
    console.error('Error leyendo RUT:', err);
    _estadoRut('No se pudo leer este PDF — completa los datos a mano.', 'error');
  }
}

function onSeleccionRut(event) {
  const file = event.target.files[0];
  manejarArchivoRut(file);
  event.target.value = ''; // permite volver a soltar el mismo archivo si hace falta releerlo
}

function onArrastreSobreRut(event) {
  event.preventDefault();
  event.currentTarget.style.borderColor = 'var(--azul-claro)';
}

function onArrastreFueraRut(event) {
  event.currentTarget.style.borderColor = 'var(--gris-borde)';
}

function onSoltarRut(event) {
  event.preventDefault();
  event.currentTarget.style.borderColor = 'var(--gris-borde)';
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  manejarArchivoRut(file);
}
