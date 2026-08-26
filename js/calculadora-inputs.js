// ═══════════════════════════════
// CALCULADORA EN CAMPOS NUMÉRICOS (2026-08-25, a pedido del usuario)
// ═══════════════════════════════
// Cualquier <input type="number"> de TODA la app admite escribir una operación básica
// (+, -, *, /) en vez de solo el resultado ya calculado — ej. escribir "1500+320" y que al
// salir del campo quede "1820". Un <input type="number"> normal NO deja escribir +, *, / por
// su cuenta (el navegador rechaza esos caracteres) — por eso, mientras el campo tiene el foco
// se cambia a type="text" (para poder escribir la operación), y al perder el foco se evalúa y
// se vuelve a type="number" (para conservar el spinner/validación nativa cuando no se está
// editando). Es un solo listener delegado en `document` (fase de captura, para que funcione
// también moviéndose con Tab) — no hay que tocar NINGÚN <input> existente en ningún archivo, y
// funciona automático con filas que se agreguen después en tiempo real (Insumos, Máquinas,
// ítems de cotización, etc.), porque no depende de que el input ya exista al cargar la página.

// Solo dígitos, espacios, coma/punto decimal, operadores y paréntesis — cualquier otro
// carácter (letras, símbolos) descarta la evaluación. Con esta lista blanca, `Function(...)`
// más abajo nunca puede ejecutar nada distinto de una cuenta aritmética.
const _CARACTERES_EXPRESION_NUMERICA = /^[\d\s.,+\-*/()]+$/;

function _evaluarExpresionNumerica(texto) {
  const limpio = (texto || '').trim().replace(/,/g, '.');
  if (!limpio) return null;
  // Sin operador real (aparte de un posible '-' inicial de número negativo, ej. "-5") no hay
  // ninguna cuenta que hacer — se deja el campo tal cual, como un número normal.
  if (!/[+\-*/]/.test(limpio.slice(1))) return null;
  if (!_CARACTERES_EXPRESION_NUMERICA.test(limpio)) return null;
  try {
    const resultado = Function('"use strict"; return (' + limpio + ')')();
    return (typeof resultado === 'number' && isFinite(resultado)) ? resultado : null;
  } catch (e) {
    return null;
  }
}

document.addEventListener('focusin', (e) => {
  if (e.target.matches && e.target.matches('input[type="number"]')) {
    e.target.type = 'text';
    e.target.setAttribute('inputmode', 'decimal');
    e.target.setAttribute('data-calc', '1');
  }
}, true);

document.addEventListener('focusout', (e) => {
  if (!(e.target.matches && e.target.matches('input[data-calc="1"]'))) return;
  const resultado = _evaluarExpresionNumerica(e.target.value);
  if (resultado != null) {
    e.target.value = resultado;
    // Dispara los mismos eventos que un <input> nativo, para que el oninput/onchange ya
    // cableado en cada fila (que actualiza el dato real del formulario) se entere del cambio.
    e.target.dispatchEvent(new Event('input', { bubbles: true }));
    e.target.dispatchEvent(new Event('change', { bubbles: true }));
  }
  e.target.type = 'number';
  e.target.removeAttribute('inputmode');
  e.target.removeAttribute('data-calc');
}, true);
