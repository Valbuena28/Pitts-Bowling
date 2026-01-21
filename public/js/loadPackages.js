// public/js/loadPackages.js

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('pricing-container');
    const API_URL = 'http://localhost:3000/api/packages';

    try {
        const res = await fetch(API_URL);
        
        // Verificamos si la respuesta fue exitosa
        if (!res.ok) throw new Error("Error en la respuesta del servidor");
        
        const packages = await res.json();

        container.innerHTML = ''; // Limpiar mensaje de carga

        if (packages.length === 0) {
            container.innerHTML = '<p>No hay paquetes disponibles por el momento.</p>';
            return;
        }

        packages.forEach(pkg => {
            const price = pkg.price_cents;
            
            let descriptionHtml = '';
            if (pkg.description) {
                const points = pkg.description.split('.').filter(p => p.trim().length > 0);
                descriptionHtml = points.map(p => `<li>✓ ${p.trim()}</li>`).join('');
            }

            const card = document.createElement('div');
            card.classList.add('plan');
            
            if (pkg.name.toLowerCase().includes('prima') || pkg.name.toLowerCase().includes('premium')) {
                card.classList.add('popular');
                card.innerHTML += `<span class="popular-tag">Más Popular</span>`;
            }

            // OJO: Asegúrate que el data-id coincida con el formato que espera tu modal.js
            // Aquí lo pongo como 'plan_1', 'plan_2', etc.
           card.innerHTML += `
        <h3>${pkg.name}</h3>
        <p class="price">$${price}</p>
        <ul>
            <li>✓ ${pkg.duration_hours} horas de juego</li>
            <li>✓ Máx. ${pkg.max_people} personas</li>
            ${descriptionHtml}
        </ul>
        <button class="btn ${card.classList.contains('popular') ? 'btn-primary' : 'btn-outline'} btn-reservar-plan" 
                data-idbd="${pkg.id}"     data-plan="${pkg.name}" 
                data-precio="${price}"
                data-duration="${pkg.duration_hours}" data-maxpeople="${pkg.max_people}"    data-detalles="<li>✓ ${pkg.duration_hours} horas de juego</li>${descriptionHtml}">
            Verificando...
        </button>
    `;
            container.appendChild(card);
        });

        if (window.updateAuthButtons && typeof window.currentUserId !== 'undefined') {
            // Si header-auth ya terminó de cargar, usamos el estado actual
            window.updateAuthButtons(!!window.currentUserId);
        } else {
            // Si header-auth aun no termina o no ha cargado, hacemos un chequeo rápido
            const user = await verificarSesionActiva();
            if(window.updateAuthButtons) window.updateAuthButtons(!!user);
        }

    } catch (err) {
        console.error("Error cargando paquetes:", err);
        container.innerHTML = '<p>Error al cargar los paquetes. Intente recargar.</p>';
    }
});