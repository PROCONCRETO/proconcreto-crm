async function iniciarSesion() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const btn = document.getElementById('btn-login');
  const errDiv = document.getElementById('login-error');
  errDiv.textContent = '';
  btn.textContent = 'Verificando...'; btn.disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  btn.textContent = 'Ingresar'; btn.disabled = false;
  if (error) { errDiv.textContent = 'Email o contraseña incorrectos.'; return; }
  USUARIO_ACTUAL = data.user;
  document.getElementById('login-overlay').style.display = 'none';
  await mostrarApp();
}

async function cerrarSesion() {
  await sb.auth.signOut();
  window.location.href = window.location.origin + window.location.pathname;
}

function mostrarRecuperacion() {
  document.querySelector('.login-box').style.display = 'none';
  document.getElementById('panel-recuperacion').style.display = 'block';
  document.getElementById('recuperar-msg').textContent = '';
}

function mostrarLogin() {
  document.getElementById('panel-recuperacion').style.display = 'none';
  document.querySelector('.login-box').style.display = 'block';
}

async function enviarRecuperacion() {
  const email = document.getElementById('recuperar-email').value.trim();
  const msgDiv = document.getElementById('recuperar-msg');
  const btn = document.getElementById('btn-recuperar');
  if (!email) { msgDiv.style.color = '#C62828'; msgDiv.textContent = 'Ingresa tu correo.'; return; }
  btn.textContent = 'Enviando...'; btn.disabled = true;
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  btn.textContent = 'Enviar enlace'; btn.disabled = false;
  if (error) {
    msgDiv.style.color = '#C62828';
    msgDiv.textContent = 'Error: ' + error.message;
  } else {
    msgDiv.style.color = 'var(--verde)';
    msgDiv.textContent = '✅ Enlace enviado. Revisa tu bandeja de entrada.';
  }
}

async function guardarNuevaContrasena() {
  const pass1 = document.getElementById('nueva-pass-1').value;
  const pass2 = document.getElementById('nueva-pass-2').value;
  const msgDiv = document.getElementById('nueva-pass-msg');
  const btn = document.getElementById('btn-nueva-pass');
  msgDiv.textContent = '';
  if (pass1.length < 8) { msgDiv.style.color = '#C62828'; msgDiv.textContent = 'La contraseña debe tener al menos 8 caracteres.'; return; }
  if (pass1 !== pass2) { msgDiv.style.color = '#C62828'; msgDiv.textContent = 'Las contraseñas no coinciden.'; return; }
  btn.textContent = 'Guardando...'; btn.disabled = true;
  const { error } = await sb.auth.updateUser({ password: pass1 });
  btn.textContent = 'Guardar contraseña'; btn.disabled = false;
  if (error) {
    msgDiv.style.color = '#C62828';
    msgDiv.textContent = 'Error: ' + error.message;
  } else {
    msgDiv.style.color = 'var(--verde)';
    msgDiv.textContent = '✅ Contraseña guardada. Ingresando...';
    setTimeout(async () => {
      document.getElementById('panel-nueva-contrasena').style.display = 'none';
      document.getElementById('login-overlay').style.display = 'none';
      // Limpiar el hash de la URL
      history.replaceState(null, '', window.location.pathname);
      await mostrarApp();
    }, 1500);
  }
}

