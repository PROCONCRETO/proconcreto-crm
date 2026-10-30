// ── Ventanas flotantes: modales arrastrables y no bloqueantes (2026-10-30) ──────────────────
// A pedido del usuario: "permite que las ventanas secundarias (programación de vaciados,
// despachos, costeos, etc.) se puedan mover del centro de la pantalla con el mouse sostenido" +
// "permite que se pueda, teniendo estas ventanas abiertas, y dando clic por fuera de esta
// ventana, hacer otras cosas en el prosuite sin necesidad de cerrarla" — ejemplo real del
// usuario: editando un Costeo, se da cuenta que falta una Materia Prima; sin esto, tocaba
// guardar/cerrar el Costeo, ir a Materias Primas, crearla, y volver a abrir el Costeo para
// seguir. Con esto puede abrir "Materias primas" encima, sin perder el Costeo abierto.
//
// Mecanismo ÚNICO y genérico para TODOS los modales de la app — se confirmó antes de escribir
// esto que los ~39 `.modal-overlay` existentes comparten exactamente la misma estructura
// (`.modal-overlay` > `.modal` > `.modal-titulo`, 39 de cada uno, sin excepciones, y ninguno
// tiene un elemento interactivo dentro de `.modal-titulo`), así que no hace falta tocar ninguno
// de los ~30 `abrirXxx()` que ya existen repartidos por el resto del código: alcanza con
// observar/escuchar estos mismos elementos genéricos, acá, una sola vez.
//
// - El backdrop ya no bloquea ni oscurece (`pointer-events: none` + sin fondo, ver
//   css/estilos.css) — el propio `.modal` vuelve a `pointer-events: auto`. Esto permite que
//   varios modales queden abiertos a la vez, cada uno flotando independiente.
// - Arrastre: mousedown sobre `.modal-titulo` convierte ESE `.modal` de "centrado por flex" a
//   `position: fixed` con `left/top` explícitos, capturados de su posición actual en pantalla
//   (no salta al empezar a arrastrar), y los va actualizando con el mousemove pegado al punto
//   exacto donde se agarró — con límites para no poder soltarlo fuera de la pantalla.
// - "Al frente": cualquier clic dentro de un `.modal` (no solo el título) sube su z-index por
//   encima de los demás modales abiertos.
// - Al cerrarse (se le quita la clase `abierto` a su `.modal-overlay`) se limpia la posición
//   arrastrada — la próxima vez que se abra, ese modal vuelve a nacer centrado.

let _zIndexModalTope = 200;
function _traerModalAlFrente(overlay) {
  if (!overlay) return;
  overlay.style.zIndex = String(++_zIndexModalTope);
}
function _limpiarPosicionModal(modal) {
  if (!modal) return;
  modal.style.position = '';
  modal.style.left = '';
  modal.style.top = '';
  modal.style.margin = '';
}

let _modalArrastrando = null;
let _dragOffsetX = 0;
let _dragOffsetY = 0;
document.addEventListener('mousedown', (e) => {
  const modal = e.target.closest('.modal');
  if (!modal) return;
  _traerModalAlFrente(modal.closest('.modal-overlay'));
  if (e.button !== 0) return; // solo clic izquierdo arrastra
  const titulo = e.target.closest('.modal-titulo');
  if (!titulo) return;
  const rect = modal.getBoundingClientRect();
  if (modal.style.position !== 'fixed') {
    modal.style.position = 'fixed';
    modal.style.margin = '0';
    modal.style.left = `${rect.left}px`;
    modal.style.top = `${rect.top}px`;
  }
  _modalArrastrando = modal;
  _dragOffsetX = e.clientX - rect.left;
  _dragOffsetY = e.clientY - rect.top;
  titulo.style.cursor = 'grabbing';
  document.body.style.userSelect = 'none';
  e.preventDefault();
});
document.addEventListener('mousemove', (e) => {
  if (!_modalArrastrando) return;
  const modal = _modalArrastrando;
  const maxLeft = Math.max(0, window.innerWidth - modal.offsetWidth);
  const maxTop = Math.max(0, window.innerHeight - modal.offsetHeight);
  modal.style.left = `${Math.min(Math.max(e.clientX - _dragOffsetX, 0), maxLeft)}px`;
  modal.style.top = `${Math.min(Math.max(e.clientY - _dragOffsetY, 0), maxTop)}px`;
});
document.addEventListener('mouseup', () => {
  if (!_modalArrastrando) return;
  const titulo = _modalArrastrando.querySelector('.modal-titulo');
  if (titulo) titulo.style.cursor = 'grab';
  document.body.style.userSelect = '';
  _modalArrastrando = null;
});

// Un observer liviano POR modal (no uno global de todo el `document.body`, que dispararía con
// cualquier cambio de clase en cualquier parte de la app — chips, pestañas, filtros, etc.) para
// detectar cuándo ESE modal puntual se abre o se cierra y resetear su posición arrastrada.
document.querySelectorAll('.modal-overlay').forEach((overlay) => {
  let estabaAbierto = overlay.classList.contains('abierto');
  new MutationObserver(() => {
    const abiertoAhora = overlay.classList.contains('abierto');
    if (abiertoAhora === estabaAbierto) return;
    estabaAbierto = abiertoAhora;
    _limpiarPosicionModal(overlay.querySelector('.modal'));
    if (abiertoAhora) _traerModalAlFrente(overlay);
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
});
