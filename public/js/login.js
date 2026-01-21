const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const mensaje = document.getElementById('mensaje');
const mensaje2FA = document.getElementById('mensaje2FA');
const resendBtn = document.getElementById("resendBtn");
const resendMsg = document.getElementById("resendMsg");
const codeInputs = document.querySelectorAll('.code');

let tempUserId = null;
let resendTimer = null;

// Helpers para mensajes con timeout
function showMessage(el, text, color = 'black', unlockCallback = null) {
  el.style.color = color;
  el.textContent = text;
  if (text) {
    setTimeout(() => { 
      el.textContent = ''; 
      if (typeof unlockCallback === "function") unlockCallback();
    }, 3000);
  }
}

// Cambiar botón a spinner
function setButtonLoading(btn, isLoading, textDefault) {
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner"></div>`;
  } else {
    btn.disabled = false;
    btn.textContent = textDefault;
  }
}

// 🔒 Bloquear / desbloquear inputs de código
function setCodeInputsDisabled(disabled) {
  codeInputs.forEach(i => i.disabled = disabled);
}

// LOGIN
form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const usuarioInput = document.getElementById('usuario');
  const passwordInput = document.getElementById('password');

  usuarioInput.disabled = true;
  passwordInput.disabled = true;

  showMessage(mensaje, "Enviando credenciales...", "#333");

  setButtonLoading(loginBtn, true, "Entrar");

  const usuario = usuarioInput.value;
  const password = passwordInput.value;

  const recaptchaResponse = grecaptcha.getResponse();
  if (!recaptchaResponse) {
    setButtonLoading(loginBtn, false, "Entrar");
    return showMessage(mensaje, "Por favor, completa el reCAPTCHA", "red", () => {
      usuarioInput.disabled = false;
      passwordInput.disabled = false;
    });
  }

  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ usuario, password, recaptcha: recaptchaResponse }),
    });

    const data = await res.json();
    setButtonLoading(loginBtn, false, "Entrar");
    grecaptcha.reset();

    if (!res.ok) throw new Error(data.msg || 'Error en login');

    if (data.fase === '2fa') {
      tempUserId = data.userId;
      document.getElementById('container').style.display = 'none';
      document.getElementById('twoFactorSection').style.display = 'block';
      showMessage(mensaje2FA, 'Código enviado a tu correo', 'green', () => {
        setCodeInputsDisabled(false);
        resendBtn.disabled = false;
      });
    } else {
      showMessage(mensaje, 'Login exitoso', 'green', () => {
        usuarioInput.disabled = false;
        passwordInput.disabled = false;
      });
      setTimeout(() => (window.location.href = 'index.html'), 800);
    }
  } catch (err) {
    setButtonLoading(loginBtn, false, "Entrar");
    showMessage(mensaje, err.message, 'red', () => {
      usuarioInput.disabled = false;
      passwordInput.disabled = false;
    });
    grecaptcha.reset();
  }
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 2FA
async function verifyCode() {
  const code = [...document.querySelectorAll('.code')].map(i => i.value).join('');
  if (code.length !== 6) {
    return showMessage(mensaje2FA, 'Ingresa los 6 dígitos', 'red');
  }

  showMessage(mensaje2FA, "Verificando...", "#333");

  setCodeInputsDisabled(true);
  resendBtn.disabled = true;

  try {
    const [res] = await Promise.all([
      fetch('/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: tempUserId, code }),
      }),
      delay(3000)
    ]);

    const data = await res.json();

    if (!res.ok) throw new Error(data.msg);

    showMessage(mensaje2FA, 'Login exitoso', 'green', () => {
      setCodeInputsDisabled(false);
      resendBtn.disabled = false;
    });
    setTimeout(() => (window.location.href = 'index.html'), 800);

  } catch (err) {
    showMessage(mensaje2FA, err.message, 'red', () => {
      setCodeInputsDisabled(false);
      if (!resendBtn.textContent.includes("Reenviar en")) {
        resendBtn.disabled = false;
      }
    });
  }
}

// Inputs 2FA
codeInputs.forEach((input, idx) => {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '');
    if (input.value && idx < codeInputs.length - 1) {
      codeInputs[idx + 1].focus();
    }
    const code = Array.from(codeInputs).map(i => i.value).join('');
    if (code.length === codeInputs.length) {
      verifyCode();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && idx > 0) {
      codeInputs[idx - 1].focus();
      codeInputs[idx - 1].value = '';
    }
    if (e.key === 'Enter') {
      verifyCode();
    }
  });
});

// Reenviar código
if (resendBtn) {
  resendBtn.addEventListener("click", async () => {
    resendBtn.disabled = true;
    resendBtn.innerHTML = `<div class="spinner"></div>`;
    setCodeInputsDisabled(true);

    try {
      const res = await fetch("/resend-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: tempUserId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.remaining) {
          showMessage(resendMsg, data.msg, "red", () => {
            setCodeInputsDisabled(false);
          });
          startResendCooldown(data.remaining);
        } else {
          showMessage(resendMsg, data.msg, "red", () => {
            setCodeInputsDisabled(false);
          });
          resendBtn.textContent = "Reenviar código";
          resendBtn.disabled = false;
        }
        return;
      }

      showMessage(resendMsg, data.msg, "green", () => {
        setCodeInputsDisabled(false);
      });
      startResendCooldown(data.remaining || 60);

    } catch (err) {
      showMessage(resendMsg, err.message, "red", () => {
        setCodeInputsDisabled(false);
      });
      resendBtn.textContent = "Reenviar código";
      resendBtn.disabled = false;
    }
  });
}

function startResendCooldown(seconds) {
  clearInterval(resendTimer);
  resendBtn.disabled = true;
  resendBtn.textContent = `Reenviar en ${seconds}s`;

  resendTimer = setInterval(() => {
    seconds--;
    if (seconds > 0) {
      resendBtn.textContent = `Reenviar en ${seconds}s`;
    } else {
      clearInterval(resendTimer);
      resendBtn.disabled = false;
      resendBtn.textContent = "Reenviar código";
    }
  }, 1000);
}

// toggle show/hide password
const togglePasswordBtn = document.getElementById('view');
const passwordInput = document.getElementById('password');
if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener('click', () => {
    passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
  });
}

// Mostrar errores Google
(function showGoogleErrors() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  if (!error) return;

  let msg = "";
  if (error === "permanent") {
    msg = "Cuenta bloqueada permanentemente. Debes restablecer tu contraseña.";
  } else if (error === "locked") {
    const until = new Date(parseInt(params.get("until")));
    msg = `Cuenta bloqueada temporalmente hasta las ${until.toLocaleTimeString("es-VE", { timeZone: "America/Caracas" })}`;
  } else if (error === "oauth") {
    msg = "Error en inicio de sesión con Google. Inténtalo de nuevo.";
  }
  if (msg) showMessage(mensaje, msg, "red");
})();

async function checkAuth() {
  try {
    const res = await fetch("/me", { credentials: "include" });
    if (res.ok) {
      window.location.href = "/perfil.html";
    }
  } catch (e) {
    console.error("Error comprobando sesión", e);
  }
}
checkAuth();
