// Funcionalidad de la sección de desarrolladores
document.addEventListener('DOMContentLoaded', () => {
    const developersToggle = document.querySelector('.developers-toggle');
    const developersInfo = document.querySelector('.developers-info');
    const devTeamTitle = document.getElementById('dev-team-title');
    const developersSection = document.getElementById('developers-section');

    if (developersToggle && developersInfo && devTeamTitle && developersSection) {

        const closeSection = () => {
            if (developersInfo.classList.contains('active')) {
                developersInfo.classList.remove('active');
                developersToggle.classList.remove('active');
                devTeamTitle.style.opacity = '0';
            }
        };

        const openSection = () => {
            if (!developersInfo.classList.contains('active')) {
                developersInfo.classList.add('active');
                developersToggle.classList.add('active');
                devTeamTitle.style.opacity = '1';
            }
        };

        developersToggle.addEventListener('click', () => {
            if (developersInfo.classList.contains('active')) {
                closeSection();
            } else {
                openSection();
            }
        });

        developersSection.addEventListener('mouseleave', closeSection);


        let lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const header = document.querySelector('header');

        window.addEventListener('scroll', () => {
            let st = window.pageYOffset || document.documentElement.scrollTop;

            // Lógica para ocultar/mostrar header
            if (st > lastScrollTop && st > 100) {
                // Scroll hacia abajo y pasamos los 100px -> Ocultar
                if (header) header.classList.add('header-hidden');
            } else {
                // Scroll hacia arriba -> Mostrar
                if (header) header.classList.remove('header-hidden');
            }

            // Lógica existente de desarrolladores
            if (st < lastScrollTop) {
                closeSection();
            }
            lastScrollTop = st <= 0 ? 0 : st;
        }, false);
    }

    startGlobalSessionGuard();
});

// Funcionalidad del menú de hamburguesa
const mobileMenu = document.getElementById('mobile-menu');
const mainNav = document.getElementById('main-nav');

if (mobileMenu && mainNav) {
    mobileMenu.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
        mainNav.classList.toggle('active');
    });
}

// Funcionalidad del Chatbot y Scroll-to-Top
document.addEventListener('DOMContentLoaded', () => {
    // Scroll to top button functionality
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    if (scrollToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 200) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        });

        scrollToTopBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Chatbot functionality
    const chatFab = document.querySelector('.chat-fab');
    const chatbotContainer = document.getElementById('chatbotContainer');
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatbotMessages = document.getElementById('chatbotMessages');
    const chatbotHeaderAvatar = document.querySelector('.chatbot-header .avatar');
    const apiKey = 'AIzaSyBDv0y9MVBZ8r2UK8yVEqTytV8rFIIWrws';
    const websiteContext = document.body.innerText;

    if (chatFab && chatbotContainer && chatInput && chatSendBtn && chatbotMessages) {
        const toggleChatbot = (show) => {
            chatbotContainer.classList.toggle('visible', show);
        };

        chatFab.addEventListener('click', (e) => {
            e.preventDefault();
            toggleChatbot(!chatbotContainer.classList.contains('visible'));
        });

        chatbotContainer.addEventListener('mouseleave', () => toggleChatbot(false));

        const displayMessage = (text, type, avatar) => {
            const message = document.createElement('div');
            message.classList.add('message', type);
            const avatarImg = (type === 'user-message')
                ? `<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzMzMyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MxLjY2IDAgMyAxLjM0IDMgM3MtMS4zNCAzLTMgMy0zLTEuMzQtMy0zIDEuMzQtMyAzLTN6bTAgMTRjLTIuNjcgMC01LTEuMjgtNi42Ny0zLjIyLjI0LS45OCAxLjUzLTEuNzggMy4xNy0yLjE4IDQuNTMtMS4xMyA3LjMyLjU1IDcuNSA1LjQyQzE3LjE3IDE3Ljc1IDE0LjggMTkgMTIgMTl6Ii8+PC9zdmc+" alt="User" class="avatar">`
                : `<img src="https://i.ibb.co/1nC1g6x/avatar.png" alt="Lia" class="avatar">`;

            const messageContent = (type === 'user-message')
                ? `<p>${text}</p>${avatarImg}`
                : `${avatarImg}<p>${text}</p>`;

            message.innerHTML = messageContent;
            chatbotMessages.appendChild(message);
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
            return message;
        };

        const getAIResponse = async (prompt) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
            const fullPrompt = `
                Eres "Lia", una asistente virtual amigable para "Pitts Bowling".
                Responde preguntas sobre Pitts Bowling basándote en la siguiente información.
                Si una pregunta no está relacionada con Pitts Bowling o la información proporcionada,
                responde amablemente: "Lo siento, solo puedo responder preguntas sobre Pitts Bowling."
                Se breve y directo.

                Contexto del sitio web:
                ---
                ${websiteContext}
                ---

                Pregunta del usuario: "${prompt}"

                Respuesta:`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }]
                })
            });

            if (!response.ok) {
                return "Lo siento, estoy teniendo problemas para conectarme. Por favor, inténtalo de nuevo más tarde.";
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        };

        const handleSendMessage = async () => {
            const messageText = chatInput.value.trim();
            if (messageText === '') return;

            displayMessage(messageText, 'user-message');
            chatInput.value = '';

            // Cambiar el avatar del encabezado a "Pensando"
            if (chatbotHeaderAvatar) {
                chatbotHeaderAvatar.src = '/gifs/Pensando.gif';
            }

            const typingIndicator = document.createElement('div');
            typingIndicator.classList.add('message', 'bot-message');
            typingIndicator.innerHTML = `
                <img src="/gifs/Pensando.gif" alt="FABI" class="avatar">
                <div class="typing-indicator"><span></span><span></span><span></span></div>`;
            chatbotMessages.appendChild(typingIndicator);
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

            const aiResponseText = await getAIResponse(messageText);

            chatbotMessages.removeChild(typingIndicator);
            displayMessage(aiResponseText, 'bot-message');

            // Volver el avatar del encabezado a "Hablando"
            if (chatbotHeaderAvatar) {
                chatbotHeaderAvatar.src = 'gifs/Hablando.gif';
            }
        };

        chatSendBtn.addEventListener('click', handleSendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSendMessage();
        });
    }
});

// public/js/general.js

//* =====================================================
//2. SISTEMA DE SEGURIDAD GLOBAL (SESSION GUARD) 🛡️
//Este bloque protege Admin, Dashboard, Menu e Index.
//===================================================== */

// Inyectar el HTML del modal de seguridad si no existe
function injectSessionModal() {
    if (document.getElementById('globalSessionModal')) return; // Ya existe

    const modalHtml = `
    <div id="globalSessionModal" class="session-modal-overlay" style="display: none;">
        <div class="session-modal-box">
            <h2>⚠️ Sesión Cerrada</h2>
            <p>
                Tu cuenta ha iniciado sesión en otro dispositivo o navegador.<br>
                Por seguridad, se ha cerrado esta sesión.
            </p>
            <button id="globalSessionBtn" class="session-modal-btn">Ir al Login</button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Evento del botón: Limpiar y redirigir
    document.getElementById('globalSessionBtn').addEventListener('click', async () => {
        const csrfCookie = document.cookie.match(/(^| )csrfToken=([^;]+)/);
        const csrfToken = csrfCookie ? decodeURIComponent(csrfCookie[2]) : '';

        try {
            await fetch('/logout', {
                method: 'POST',
                credentials: 'include',
                headers: { "X-CSRF-Token": csrfToken }
            });
        } catch (e) { console.error("Logout error", e); }

        window.location.href = '/login.html';
    });
}

// Polling: Verifica cada 5s si la sesión sigue siendo válida en el servidor
let sessionPoller = null;

function startGlobalSessionGuard() {
    // No ejecutar en páginas de autenticación (login, register, etc)
    const path = window.location.pathname;
    if (path.includes('login.html') || path.includes('register.html') || path.includes('reset.html') || path.includes('forjot.html')) {
        return;
    }

    // 1. Crear el modal oculto en el DOM
    injectSessionModal();

    if (sessionPoller) clearInterval(sessionPoller);

    // 2. Iniciar el ciclo de preguntas (Polling)
    sessionPoller = setInterval(async () => {
        try {
            // Preguntamos al servidor el estado de la sesión
            const res = await fetch('/session-status', { credentials: 'include' });

            if (res.status === 401) {
                const data = await res.json().catch(() => ({}));

                // CASO CRÍTICO: Alguien entró en otro lado
                if (data.msg === 'session_replaced') {
                    clearInterval(sessionPoller); // Dejamos de preguntar
                    showGlobalSessionModal();     // Mostramos el modal bloqueante
                } else {
                    // CASO COMÚN: Token expirado -> Intentar refresh silencioso
                    const refreshed = await trySilentRefresh();
                    if (!refreshed) {
                        // Si no se pudo refrescar, paramos (el usuario será redirigido al intentar navegar)
                        clearInterval(sessionPoller);
                    }
                }
            }
        } catch (e) {
            // Ignorar errores de red momentáneos
        }
    }, 5000); // Revisar cada 5 segundos
}

// Función auxiliar para refrescar token sin molestar al usuario
async function trySilentRefresh() {
    try {
        const csrfCookie = document.cookie.match(/(^| )csrfToken=([^;]+)/);
        const csrfToken = csrfCookie ? decodeURIComponent(csrfCookie[2]) : '';

        const res = await fetch("/refresh", {
            method: "POST",
            credentials: "include",
            headers: { "X-CSRF-Token": csrfToken },
        });
        return res.ok;
    } catch (e) {
        return false;
    }
}

function showGlobalSessionModal() {
    const modal = document.getElementById('globalSessionModal');
    if (modal) {
        modal.style.display = 'flex';
        // Opcional: Ocultar scroll del body para bloquear totalmente
        document.body.style.overflow = 'hidden';
    }
}


/**
 * FUNCIÓN GUARDIA DE SEGURIDAD 🛡️
 * Verifica si el usuario está logueado antes de realizar acciones críticas.
 * Intenta refrescar el token si está vencido.
 * Retorna el objeto usuario { id, usuario } o null si no hay sesión.
 */
async function verificarSesionActiva() {
    try {
        // 1. Intentar obtener datos (/me)
        let res = await fetch('/me', { method: 'GET', credentials: 'include' });

        // 2. Si venció el token (401), intentar refrescar
        if (res.status === 401) {
            console.log("Token vencido al intentar acción, refrescando...");
            const csrf = getCookie("csrfToken"); // Usamos el helper de cookies si existe, o definimos uno simple abajo

            const refreshRes = await fetch("/refresh", {
                method: "POST",
                credentials: "include",
                headers: { "X-CSRF-Token": csrf || "" },
            });

            if (refreshRes.ok) {
                // Reintentar /me con el nuevo token
                res = await fetch('/me', { method: 'GET', credentials: 'include' });
            } else {
                return null; // No se pudo refrescar
            }
        }

        // 3. Si todo está bien, devolver datos del usuario
        if (res.ok) {
            const data = await res.json();
            return data; // Retorna { loggedIn: true, id: 123, usuario: 'Eduardo' }
        }

        return null; // No autorizado

    } catch (error) {
        console.error("Error verificando sesión:", error);
        return null;
    }
}

// Helper para leer cookies (si no lo tienes en este archivo)
function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}
