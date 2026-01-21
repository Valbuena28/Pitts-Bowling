const forgotForm = document.getElementById('forgotForm');
const forgotBtn = document.getElementById('forgotBtn');
const forgotMsg = document.getElementById('forgotMsg');

function setLoading(btn, on, text) {
  if (on) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';
  } else {
    btn.disabled = false;
    btn.textContent = text;
  }
}

forgotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const emailInput = document.getElementById('f_email');
  const email = emailInput.value.trim();
  if (!email) return;

  setLoading(forgotBtn, true, 'Enviar');
  try {
    const res = await fetch('/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(forgotBtn, false, 'Enviar instrucciones');

    // Mensaje genérico
    showMsg(forgotMsg, data.msg || 'Si el correo existe, te enviamos instrucciones.', 'green');

    // 👇 limpiar campo y redirigir tras 3 segundos
    emailInput.value = '';
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 3000);
  } catch (err) {
    setLoading(forgotBtn, false, 'Enviar instrucciones');
    showMsg(forgotMsg, 'Error de conexión', 'red');
  }
});

function showMsg(el, text, color = 'black') {
  el.style.color = color;
  el.textContent = text;
  if (text) setTimeout(() => (el.textContent = ''), 5000);
}

async function checkAuth() {
  try {
    const res = await fetch('/me', { credentials: 'include' });
    if (res.ok) {
      // Usuario ya logeado → redirigir al perfil
      window.location.href = '/perfil.html';
    }
  } catch (e) {
    console.error('Error comprobando sesión', e);
  }
}

checkAuth();
