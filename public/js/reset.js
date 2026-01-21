const resetForm = document.getElementById('resetForm');
const resetBtn = document.getElementById('resetBtn');
const resetMsg = document.getElementById('resetMsg');

// leer token de la URL
const params = new URLSearchParams(window.location.search);
const token = params.get('token');

function setLoading(btn, on, text) {
  if (on) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';
  } else {
    btn.disabled = false;
    btn.textContent = text;
  }
}

function showMsg(el, text, color='black') {
  el.style.color = color;
  el.textContent = text;
  if (text) setTimeout(()=> el.textContent = '', 6000);
}

resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const p1 = document.getElementById('newPassword').value;
  const p2 = document.getElementById('newPassword2').value;

  if (p1 !== p2) {
    return showMsg(resetMsg, 'Las contraseñas no coinciden ❌', 'red');
  }

  setLoading(resetBtn, true, 'Cambiar contraseña');

  try {
    const res = await fetch('/reset-password', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ token, password: p1 }),
    });
    const data = await res.json().catch(()=> ({}));

    setLoading(resetBtn, false, 'Cambiar contraseña');
    if (!res.ok) {
      return showMsg(resetMsg, data.msg || 'Error al reestablecer contraseña', 'red');
    }

    showMsg(resetMsg, data.msg || 'Contraseña cambiada ✅', 'green');
    setTimeout(()=> {
      window.location.href = 'login.html';
    }, 3000);

  } catch (err) {
    setLoading(resetBtn, false, 'Cambiar contraseña');
    showMsg(resetMsg, 'Error de conexión ❌', 'red');
  }
});

async function checkAuth() {
    try {
      const res = await fetch("/me", { credentials: "include" });
      if (res.ok) {
        // Usuario ya logeado → redirigir al perfil
        window.location.href = "/perfil.html";
      }
      // si devuelve 401 → no hace nada (se queda en login o register)
    } catch (e) {
      console.error("Error comprobando sesión", e);
    }
  }


const togglePasswordBtn = document.getElementById('view');
const passwordInput = document.getElementById('newPassword');
const passwordInput2 = document.getElementById('newPassword2');
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
  checkAuth();