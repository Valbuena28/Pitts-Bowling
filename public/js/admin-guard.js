(async function() {
    try {
        // 1. Preguntar al servidor si somos admin
        // Usamos la ruta que acabamos de crear
        const res = await fetch('/auth/admin-check', { 
            method: 'GET',
            credentials: 'include' // Importante para enviar las cookies
        });

        if (res.ok) {
            // 2. Si responde OK (200), somos admin. 
            // Dejamos que la página cargue normalmente.
            console.log("Acceso Admin Autorizado ✅");
            
            // Opcional: Mostrar el contenido del body (si decidimos ocultarlo por defecto)
            document.body.style.display = 'block'; 
        } else {
            // 3. Si responde 401 o 403, NO somos admin.
            throw new Error("Acceso denegado");
        }

    } catch (error) {
        // 4. PATEAR AL USUARIO
        console.warn("Intento de acceso no autorizado al panel admin.");
        alert("⛔ Acceso denegado. Se requieren permisos de administrador.");
        
        // Redirigir al login o al inicio
        window.location.href = '/index.html'; 
    }
})();