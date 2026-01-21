const msgEl = document.getElementById("confirmMsg");

// Leer el token de la URL
const params = new URLSearchParams(window.location.search);
const token = params.get("token");

async function confirmarCuenta() {
  if (!token) {
    msgEl.textContent = "Token inválido ❌";
    msgEl.style.color = "red";
    return;
  }

  try {
    const res = await fetch(`/confirm-email?token=${token}`, {
      method: "GET",
      credentials: "include",
    });
    const data = await res.json();

    if (!res.ok) {
      msgEl.textContent = data.msg || "Error al confirmar la cuenta ❌";
      msgEl.style.color = "red";
      return;
    }

    msgEl.textContent = data.msg || "Cuenta confirmada ✅ Redirigiendo...";
    msgEl.style.color = "green";

    // Redirigir al login después de 3 segundos
    setTimeout(() => {
      window.location.href = "login.html";
    }, 3000);
  } catch (err) {
    msgEl.textContent = "Error de conexión ❌";
    msgEl.style.color = "red";
  }
}

confirmarCuenta();

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

  checkAuth();
