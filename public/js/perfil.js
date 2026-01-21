// Esperamos a que el HTML cargue completamente antes de ejecutar nada
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
    setupListeners();
});

// Función para cargar datos
async function loadUserProfile() {
    try {
        let res = await fetch("/api/settings/profile-data", { credentials: "include" });

        // Intento de refresh token si falla
        if (res.status === 401) {
            const refreshed = await trySilentRefresh();
            if (refreshed) {
                res = await fetch("/api/settings/profile-data", { credentials: "include" });
            } else {
                window.location.href = "login.html";
                return;
            }
        }

        if (res.ok) {
            const data = await res.json();

            // Llenar Sidebar (Verificamos que existan los elementos por seguridad)
            if (document.getElementById('displayUsername')) 
                document.getElementById('displayUsername').textContent = data.usuario;
            
            if (document.getElementById('displayEmail'))
                document.getElementById('displayEmail').textContent = data.email;
            
            const initial = data.usuario ? data.usuario.charAt(0).toUpperCase() : 'U';
            if (document.getElementById('avatarInitial'))
                document.getElementById('avatarInitial').textContent = initial;

            // Llenar Formulario
            if(document.getElementById('inputName')) document.getElementById('inputName').value = data.name || '';
            if(document.getElementById('inputLastname')) document.getElementById('inputLastname').value = data.last_name || '';
            if(document.getElementById('inputUsername')) document.getElementById('inputUsername').value = data.usuario || '';
            if(document.getElementById('inputEmail')) document.getElementById('inputEmail').value = data.email || '';
        } else {
            console.error("Error al cargar datos");
        }

    } catch (error) {
        console.error("Error de red:", error);
    }
}

function setupListeners() {

    // --- AQUÍ ESTÁ LA MAGIA PROFESIONAL (Event Listeners) ---
    
    // 1. Botones del Menú Lateral
    const btnPersonal = document.getElementById('btn-personal');
    const btnSecurity = document.getElementById('btn-security');

    if (btnPersonal) {
        btnPersonal.addEventListener('click', () => {
            showSection('personal');
        });
    }

    if (btnSecurity) {
        btnSecurity.addEventListener('click', () => {
            showSection('security');
        });
    }

    // 2. Botón de Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const csrfToken = getCookie("csrfToken");
            try {
                await fetch("/logout", {
                    method: "POST",
                    credentials: "include",
                    headers: { "X-CSRF-Token": csrfToken },
                });
            } catch (e) {}
            window.location.href = "index.html";
        });
    }

    // 3. Botón para cerrar alertas (Modal)
    const btnCloseAlert = document.getElementById('btn-close-alert');
    if (btnCloseAlert) {
        btnCloseAlert.addEventListener('click', () => {
            closeAlert();
        });
    }

    // 4. Formulario Info Personal
    const formInfo = document.getElementById('form-info');
    if (formInfo) {
        formInfo.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnUpdateInfo');
            setLoading(btn, true);

            const payload = {
                name: document.getElementById('inputName').value,
                last_name: document.getElementById('inputLastname').value,
                usuario: document.getElementById('inputUsername').value
            };

            const csrfToken = getCookie("csrfToken");

            try {
                const res = await fetch("/api/settings/update-info", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": csrfToken
                    },
                    body: JSON.stringify(payload),
                    credentials: "include"
                });

                const data = await res.json();

                if (res.ok) {
                    showAlert("¡Éxito!", "Tus datos se actualizaron correctamente.");
                    // Actualizar sidebar visualmente al instante
                    document.getElementById('displayUsername').textContent = payload.usuario;
                    document.getElementById('avatarInitial').textContent = payload.usuario.charAt(0).toUpperCase();
                } else {
                    showAlert("Error", data.msg || "No se pudo actualizar.");
                }

            } catch (error) {
                showAlert("Error", "Ocurrió un error inesperado.");
            } finally {
                setLoading(btn, false, '<i class="fas fa-save"></i> Guardar Cambios');
            }
        });
    }

    // 5. Formulario Cambiar Contraseña
    const formPass = document.getElementById('form-password');
    if (formPass) {
        formPass.addEventListener('submit', async (e) => {
            e.preventDefault();

            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            if (newPassword !== confirmNewPassword) {
                showAlert("Atención", "Las contraseñas nuevas no coinciden.");
                return;
            }

            const btn = document.getElementById('btnUpdatePass');
            setLoading(btn, true);

            const csrfToken = getCookie("csrfToken");

            try {
                const res = await fetch("/api/settings/change-password", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": csrfToken
                    },
                    body: JSON.stringify({
                        currentPassword,
                        newPassword
                    }),
                    credentials: "include"
                });

                const data = await res.json();

                if (res.ok) {
                    showAlert("¡Seguridad Actualizada!", "Tu contraseña ha sido cambiada exitosamente.");
                    formPass.reset();
                } else {
                    showAlert("Error", data.msg || "No se pudo cambiar la contraseña.");
                }

            } catch (error) {
                showAlert("Error", "Error de conexión con el servidor.");
            } finally {
                setLoading(btn, false, '<i class="fas fa-key"></i> Actualizar Contraseña');
            }
        });
    }
}

// Lógica para tabs visuales
function showSection(sectionId) {
    // Ocultar todos
    const p = document.getElementById('section-personal');
    const s = document.getElementById('section-security');
    
    if(p) p.style.display = 'none';
    if(s) s.style.display = 'none';

    // Quitar clase active de botones
    const btnPersonal = document.getElementById('btn-personal');
    const btnSecurity = document.getElementById('btn-security');
    
    if(btnPersonal) btnPersonal.classList.remove('active');
    if(btnSecurity) btnSecurity.classList.remove('active');

    // Mostrar seleccionado
    const selected = document.getElementById('section-' + sectionId);
    if(selected) selected.style.display = 'block';

    // Activar botón visualmente
    if(sectionId === 'personal' && btnPersonal) btnPersonal.classList.add('active');
    if(sectionId === 'security' && btnSecurity) btnSecurity.classList.add('active');
}

function closeAlert() {
    const modal = document.getElementById('alertModal');
    if(modal) modal.style.display = 'none';
}

// Helpers Utilitarios
function showAlert(title, message) {
    const modal = document.getElementById('alertModal');
    if (modal) {
        document.getElementById('alertTitle').textContent = title;
        document.getElementById('alertMessage').textContent = message;
        modal.style.display = 'flex';
    } else {
        alert(title + ": " + message);
    }
}

function setLoading(btn, isLoading, originalContent = '') {
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner" style="border-color: rgba(0,0,0,0.3); border-top-color: #000; width: 20px; height: 20px; display:inline-block;"></div> Procesando...';
    } else {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}

async function trySilentRefresh() {
    try {
        const csrfToken = getCookie("csrfToken");
        const res = await fetch("/refresh", {
            method: "POST",
            credentials: "include",
            headers: {
                "X-CSRF-Token": csrfToken || ""
            },
        });
        return res.ok;
    } catch (e) {
        return false;
    }
}