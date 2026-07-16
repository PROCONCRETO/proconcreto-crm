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

// Un NIT colombiano son 9 dígitos + 1 dígito de verificación (DV). En el RUT a veces quedan
// separados por espacios (una casilla por dígito) — se juntan y se separa el último como DV.
function _extraerNitDv(lineas) {
  const valor = _valorDespuesDe(lineas, /^5\.\s*N[úu]mero de Identificaci[óo]n Tributaria/i);
  const digitos = (valor.match(/\d/g) || []).join('');
  if (digitos.length < 2) return { nit: valor.replace(/\s+/g, ''), dv: '' };
  return { nit: digitos.slice(0, -1), dv: digitos.slice(-1) };
}

function _extraerDatosRut(lineas) {
  const texto = lineas.join('\n');

  const { nit, dv } = _extraerNitDv(lineas);
  const razonSocial = _valorDespuesDe(lineas, /^35\.\s*Raz[óo]n social/i);
  const direccion = _valorDespuesDe(lineas, /^41\.\s*Direcci[óo]n principal/i);

  // El correo es un patrón muy distintivo — más confiable buscarlo en todo el texto que
  // depender de la posición exacta de la casilla 42.
  const matchEmail = texto.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const correoFacturacion = matchEmail ? matchEmail[0] : '';

  // Representante legal: la fila "REPRS LEGAL PRIN" (o variantes de "Representante Legal")
  // en la Hoja 3 va seguida, un par de líneas más abajo, de los 4 nombres en una sola fila
  // (104. Primer apellido / 105. Segundo apellido / 106. Primer nombre / 107. Otros nombres).
  let representanteLegal = '';
  const idxRepLegal = lineas.findIndex(l => /REPR?S?\.?\s*LEGAL/i.test(l));
  if (idxRepLegal !== -1) {
    for (let i = idxRepLegal + 1; i < Math.min(idxRepLegal + 4, lineas.length); i++) {
      const candidata = lineas[i];
      // Debe verse como nombres: solo letras/espacios, todo en mayúsculas, sin dígitos ni "N°/label".
      if (/^[A-ZÁÉÍÓÚÑ ]{4,}$/.test(candidata) && !/\d/.test(candidata)) {
        const partes = candidata.split(/\s+/);
        if (partes.length >= 2) {
          // RUT trae Apellido1 Apellido2 Nombre1 [Nombre2] — se muestra como "Nombres Apellidos".
          const mitad = Math.ceil(partes.length / 2);
          representanteLegal = [...partes.slice(mitad), ...partes.slice(0, mitad)].join(' ');
        } else {
          representanteLegal = candidata;
        }
        break;
      }
    }
  }

  return {
    nit: dv ? `${nit}-${dv}` : nit,
    nombre: razonSocial,
    direccion,
    correoFacturacion,
    representanteLegal,
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
    if (datos.representanteLegal) document.getElementById('m-cliente-repLegal').value = datos.representanteLegal;

    const leidos = ['nombre', 'nit', 'direccion', 'correoFacturacion', 'representanteLegal'].filter(k => datos[k]).length;
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
