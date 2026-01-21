const rForm = document.getElementById('registerForm');
const rBtn = document.getElementById('registerBtn');
const rMsg = document.getElementById('registerMsg');

function setBtnLoading(btn, loading, text) {
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';
  } else {
    btn.disabled = false;
    btn.textContent = text;
  }
}

function showMsg(el, text, color = 'black') {
  el.style.color = color;
  el.textContent = text;
  if (text) setTimeout(() => (el.textContent = ''), 5000);
}

rForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('r_name').value.trim();
  const last_name = document.getElementById('r_last_name').value.trim();
  const usuario = document.getElementById('r_usuario').value.trim();
  const email = document.getElementById('r_email').value.trim();
  const password = document.getElementById('r_password').value;
  const password2 = document.getElementById('r_password2').value;

  if (password !== password2) {
    return showMsg(rMsg, 'Las contraseñas no coinciden', 'red');
  }

  setBtnLoading(rBtn, true, 'Crear cuenta');
  try {
    const res = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, last_name, usuario, email, password }),
    });

    const data = await res.json().catch(() => ({}));
    setBtnLoading(rBtn, false, 'Crear cuenta');

    if (!res.ok) {
      return showMsg(rMsg, data.msg || 'Error en registro', 'red');
    }


    rForm.reset();


    showMsg(rMsg, data.msg || 'Registro exitoso. Revisa tu correo para confirmar.', 'green');

    setTimeout(() => {
      window.location.href = 'login.html';
    }, 3000);

  } catch (err) {
    setBtnLoading(rBtn, false, 'Crear cuenta');
    showMsg(rMsg, 'Error de conexión', 'red');
  }
});

async function checkAuth() {
  try {
    const res = await fetch("/me", { credentials: "include" });
    if (res.ok) {
      // Usuario ya logeado → redirigir al perfil
      window.location.href = "/perfil.html";
    }
  } catch (e) {
    console.error("Error comprobando sesión", e);
  }
}

checkAuth();

// toggle show/hide password (colocado antes que el listener del form)
const togglePasswordBtn = document.getElementById('view');
const passwordInput = document.getElementById('r_password');
const passwordInput2 = document.getElementById('r_password2');
if (togglePasswordBtn && passwordInput && passwordInput2) {
  togglePasswordBtn.addEventListener('click', () => {
    if (passwordInput.type === 'password' && passwordInput2.type === 'password') {
      passwordInput.type = 'text';
      passwordInput2.type = 'text';
    } else {
      passwordInput.type = 'password';
      passwordInput2.type = 'password';
    }
  });
}
