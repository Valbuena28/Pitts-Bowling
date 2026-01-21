// js/header-auth.js

// Variable para el intervalo de notificaciones global
let globalNotifyInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificar sesión usando la función compartida de general.js
    let user = null;
    if (typeof verificarSesionActiva === 'function') {
        user = await verificarSesionActiva();
    } else {
        console.error("Error: general.js debe cargarse antes que header-auth.js");
    }

    // 2. Actualizar la interfaz del Header (Avatar vs Botones)
    updateHeaderUI(user);

    // 3. Actualizar los botones de la página (Reservar/Comprar)
    window.updateAuthButtons = (isLoggedIn) => {
        // A. Botones de Paquetes (Reservar)
        const reserveBtns = document.querySelectorAll('.btn-reservar-plan');
        reserveBtns.forEach(btn => {
            if (isLoggedIn) {
                btn.textContent = "Reservar Ahora";
                btn.classList.remove('btn-login-mode');
            } else {
                btn.textContent = "Inicia Sesión para Reservar";
                btn.classList.add('btn-login-mode');
            }
        });

        // B. Botón del Carrito (Confirmar)
        const confirmBtn = document.getElementById('confirmar-pedido');
        if (confirmBtn) {
            if (isLoggedIn) {
                confirmBtn.textContent = "✅ Confirmar pedido";
            } else {
                confirmBtn.textContent = "  Inicia Sesión para Confirmar ";
            }
        }
    };

    // Ejecutamos la actualización de botones inmediatamente
    window.updateAuthButtons(!!user);

    // --- Lógica del Menú Desplegable ---
    const avatarBtn = document.getElementById('avatarBtn');
    const userDropdown = document.getElementById('userDropdown');

    document.addEventListener('click', (e) => {
        if (avatarBtn && userDropdown) {
            if (!avatarBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.add('hidden');
            }
        }
    });

    if (avatarBtn) {
        avatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('hidden');
        });
    }

    // Manejar Logout
    const logoutBtn = document.getElementById('headerLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await performLogout();
        });
    }

    // === NUEVO: INICIAR MONITOR DE NOTIFICACIONES GLOBAL ===
    if (user) {
        startGlobalNotificationMonitor();
    }
});

function updateHeaderUI(user) {
    const guestView = document.getElementById('guest-view');
    const userView = document.getElementById('user-view');
    const userInitial = document.getElementById('userInitial');
    const dropdownUser = document.getElementById('dropdownUser');

    if (user) {
        // LOGUEADO
        if(guestView) guestView.classList.add('hidden');
        if(userView) userView.classList.remove('hidden');

        const nombreUsuario = user.usuario || 'U';
        if(userInitial) userInitial.textContent = nombreUsuario.charAt(0).toUpperCase();
        if(dropdownUser) dropdownUser.textContent = nombreUsuario;
        
        // Guardamos ID globalmente por si acaso
        window.currentUserId = user.id; 

    } else {
        // INVITADO
        if(guestView) guestView.classList.remove('hidden');
        if(userView) userView.classList.add('hidden');
    }
}

async function performLogout() {
    try {
        const csrf = getCookie("csrfToken"); 
        const res = await fetch('/logout', {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-CSRF-Token': csrf || '' }
        });

        if (res.ok) window.location.reload();
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}

// === FUNCIONES NUEVAS PARA NOTIFICACIONES GLOBALES ===

function startGlobalNotificationMonitor() {
    // Primera carga inmediata
    checkGlobalNotifications();

    // Polling cada 10 segundos (más relajado que el dashboard para no saturar)
    if (globalNotifyInterval) clearInterval(globalNotifyInterval);
    globalNotifyInterval = setInterval(checkGlobalNotifications, 10000); 
}

async function checkGlobalNotifications() {
    try {
        const res = await fetch('/api/user/notifications/unread-count', { credentials: 'include' });
        
        // Si hay error de auth (401), no hacemos nada (el SessionGuard de general.js se encargará)
        if (res.status === 401) return;
        
        if (!res.ok) return;

        const data = await res.json();
        updateGlobalBadgeUI(data.total);

    } catch (error) {
        // Error silencioso de red
    }
}

function updateGlobalBadgeUI(count) {
    // --- 1. ACTUALIZAR BADGE DEL AVATAR (CIRCULO PRINCIPAL) ---
    const avatarContainer = document.getElementById('avatarBtn');
    if (avatarContainer) {
        let badge = document.getElementById('header-notify-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.id = 'header-notify-badge';
                badge.className = 'header-notify-badge';
                avatarContainer.appendChild(badge);
            }
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = 'flex';
        } else {
            if (badge) badge.style.display = 'none';
        }
    }

    // --- 2. ACTUALIZAR BADGE EN EL MENÚ DESPLEGABLE (DASHBOARD) ---
    const dropdownMenu = document.getElementById('userDropdown');
    const dashboardLink = dropdownMenu ? dropdownMenu.querySelector('a[href*="dasboard"]') : null;

    if (dashboardLink) {
        let dropBadge = document.getElementById('dropdown-notify-badge');

        if (count > 0) {
            // Si no existe la burbuja en el menú, la creamos
            if (!dropBadge) {
                dropBadge = document.createElement('span');
                dropBadge.id = 'dropdown-notify-badge';
                dropBadge.className = 'dropdown-notify-badge';
                dashboardLink.appendChild(dropBadge);
            }
            // Actualizamos el número
            dropBadge.textContent = count > 9 ? '9+' : count;
            dropBadge.style.display = 'inline-flex';
        } else {
            // Si no hay notificaciones, ocultamos la burbuja del menú
            if (dropBadge) dropBadge.style.display = 'none';
        }
    }
}