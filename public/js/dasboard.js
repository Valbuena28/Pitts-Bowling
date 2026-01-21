// public/js/dasboard.js

// Cache global para mensajes
window.messagesCache = {};

// Variable para controlar el intervalo de tiempo real
let pollingInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Verificación inicial fuerte
    if (typeof verificarSesionActiva !== 'function') {
        console.error("Error crítico: No se encontró general.js.");
        window.location.href = '/login.html';
        return;
    }
    const user = await verificarSesionActiva();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }
    initDashboard(user);
    createNotificationModal();
});

function initDashboard(user) {
    const userNameEl = document.getElementById('dash-user-name');
    const userInitialEl = document.getElementById('dash-user-initial');
    if (userNameEl) userNameEl.textContent = user.usuario || 'Usuario';
    if (userInitialEl) userInitialEl.textContent = (user.usuario || 'U').charAt(0).toUpperCase();

    setupTabs();

    const logoutBtn = document.getElementById('dash-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const csrfCookie = document.cookie.match(/(^| )csrfToken=([^;]+)/);
                const csrfToken = csrfCookie ? decodeURIComponent(csrfCookie[2]) : '';
                await fetch('/logout', { 
                    method: 'POST',
                    headers: { 'X-CSRF-Token': csrfToken }
                });
                window.location.href = '/login.html';
            } catch (error) { console.error(error); }
        });
    }

    // Carga inicial (Normal)
    loadReservations(); 
    loadOrders(); 

    // === INICIAR MONITOR DE TIEMPO REAL ===
    startRealTimeUpdates();
}

function startRealTimeUpdates() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(async () => {
        await loadReservations(true); 
        await loadOrders(true);
    }, 5000); // Cada 5 segundos
}

function setupTabs() {
    const tabItems = document.querySelectorAll('.nav-tab-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabItems.forEach(item => {
        item.addEventListener('click', () => {
            if (item.id === 'dash-logout-btn') return;

            tabItems.forEach(i => i.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            item.classList.add('active');
            const targetId = item.dataset.target;
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'tab-reservas') loadReservations(false);
            if (targetId === 'tab-pedidos') loadOrders(false);
            if (targetId === 'tab-facturas') loadUnifiedInvoices();
            if (targetId === 'tab-nuevo-paquete') loadAvailablePackages();
        });
    });
}


async function fetchUserData(endpoint) {
    try {
        const res = await fetch(`/api/user/${endpoint}`, { credentials: 'include' });
        
        if (res.status === 401) {
            console.warn(`Auth falló en ${endpoint}. Esperando a SessionGuard...`);
            return null; // Retornamos null y no hacemos nada más
        }
        
        if (!res.ok) throw new Error(`Error ${res.status}`);
        
        return await res.json();
    } catch (err) {
        console.error(`Error silencioso en ${endpoint}:`, err);
        return [];
    }
}

// =========================================================
// 1. CARGAR RESERVAS
// =========================================================
async function loadReservations(isBackground = false) {
    const loading = document.getElementById('reservations-loading');
    const container = document.getElementById('reservations-container');
    
    if (!isBackground) {
        loading.classList.remove('hidden');
        container.classList.add('hidden');
    }
    
    const data = await fetchUserData('reservations');
    
    // Si data es null (por error 401), salimos sin romper nada
    if (data === null) return;

    if (!isBackground) {
        loading.classList.add('hidden');
        container.classList.remove('hidden');
    }

    if (!data || data.length === 0) {
        if (!isBackground) container.innerHTML = '<p>No tienes reservas realizadas.</p>';
        updateTabBadge('tab-reservas', 0);
        return;
    }

    let totalUnread = 0;
    data.forEach(r => totalUnread += (r.unread_count || 0));
    updateTabBadge('tab-reservas', totalUnread);

    const tabVisible = document.getElementById('tab-reservas').classList.contains('active');
    if (isBackground && !tabVisible) return; 

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Paquete</th>
                    <th>Pista</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Personas</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Notificación</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(res => {
        const cacheKey = `res-${res.id}`;
        window.messagesCache[cacheKey] = res.notes_history || [];

        const isPackage = res.package_id != null;
        const nombrePaquete = isPackage ? (res.package_name || 'Paquete Personalizado') : 'No incluye (Solo Pista)';
        const nombrePista = res.lane_name ? res.lane_name : (res.lane_number ? `Pista ${res.lane_number}` : 'Asignando...');
        
        const start = new Date(res.start_time);
        const end = new Date(res.end_time);
        
        const fechaStr = start.toLocaleDateString();
        const opcionesHora = { hour: '2-digit', minute: '2-digit', hour12: true };
        const horaInicio = start.toLocaleTimeString([], opcionesHora);
        const horaFin = end.toLocaleTimeString([], opcionesHora);
        
        const statusClass = res.status === 'confirmed' ? 'status-confirmed' : (res.status === 'pending' ? 'status-pending' : 'status-cancelled');

        const unread = res.unread_count || 0;
        const hasNotes = res.notes_history && res.notes_history.length > 0;
        
        let notifBtn = '<span style="color:#aaa; font-size:0.8em;">Sin mensajes</span>';
        
        if (hasNotes) {
            const badgeHtml = unread > 0 ? `<span class="badge-counter">${unread}</span>` : '';
            const btnClass = unread > 0 ? 'btn-notify-unread' : 'btn-notify-read';
            
            notifBtn = `
                <button class="btn-action ${btnClass} js-view-msg" 
                        data-id="${res.id}" 
                        data-type="reservation" 
                        data-key="${cacheKey}">
                    ${badgeHtml} <i class="fa-solid fa-envelope"></i> Ver
                </button>
            `;
        }

        html += `
            <tr>
                <td>#${res.id}</td>
                <td><strong>${nombrePaquete}</strong></td>
                <td>${nombrePista}</td>
                <td>${fechaStr} <br> ${horaInicio}</td>
                <td>${fechaStr} <br> ${horaFin}</td>
                <td>${res.number_of_people}</td>
                <td>$${(res.total_price_cents).toFixed(2)}</td>
                <td><span class="status-badge ${statusClass}">${res.status}</span></td>
                <td>${notifBtn}</td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    
    container.innerHTML = html;
    attachMessageListeners(container);
}

// =========================================================
// 2. CARGAR PEDIDOS
// =========================================================
async function loadOrders(isBackground = false) {
    const loading = document.getElementById('orders-loading');
    const container = document.getElementById('orders-container');

    if (!isBackground) {
        loading.classList.remove('hidden');
        container.classList.add('hidden');
    }

    const data = await fetchUserData('orders');
    
    if (data === null) return; // Si falló auth, salimos

    if (!isBackground) {
        loading.classList.add('hidden');
        container.classList.remove('hidden');
    }

    if (!data || data.length === 0) {
        if (!isBackground) container.innerHTML = '<p>No has realizado pedidos de comida.</p>';
        updateTabBadge('tab-pedidos', 0);
        return;
    }

    let totalUnread = 0;
    data.forEach(o => totalUnread += (o.unread_count || 0));
    updateTabBadge('tab-pedidos', totalUnread);

    const tabVisible = document.getElementById('tab-pedidos').classList.contains('active');
    if (isBackground && !tabVisible) return;

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>ID</th><th>Fecha</th><th>Detalles</th><th>Total</th><th>Estado</th>
                    <th>Notificación</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(order => {
        const cacheKey = `ord-${order.id}`;
        window.messagesCache[cacheKey] = order.notes_history || [];

        const date = new Date(order.date);
        const statusClass = order.status === 'pagada' ? 'status-paid' : 'status-pending';
        const itemsSummary = order.items.map(item => `<div>${item.quantity}x ${item.food_name}</div>`).join('');

        const unread = order.unread_count || 0;
        const hasNotes = order.notes_history && order.notes_history.length > 0;
        let notifBtn = '<span style="color:#aaa; font-size:0.8em;">Sin mensajes</span>';

        if (hasNotes) {
            const badgeHtml = unread > 0 ? `<span class="badge-counter">${unread}</span>` : '';
            const btnClass = unread > 0 ? 'btn-notify-unread' : 'btn-notify-read';
            
            notifBtn = `
                <button class="btn-action ${btnClass} js-view-msg" 
                        data-id="${order.id}" 
                        data-type="invoice" 
                        data-key="${cacheKey}">
                    ${badgeHtml} <i class="fa-solid fa-envelope"></i> Ver
                </button>
            `;
        }

        html += `
            <tr>
                <td>#${order.id}</td>
                <td>${date.toLocaleDateString()}</td>
                <td>${itemsSummary || 'Sin detalles'}</td>
                <td><strong>$${Number(order.total).toFixed(2)}</strong></td>
                <td><span class="status-badge ${statusClass}">${order.status}</span></td>
                <td>${notifBtn}</td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
    attachMessageListeners(container);
}

function attachMessageListeners(container) {
    const buttons = container.querySelectorAll('.js-view-msg');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const refId = btn.dataset.id;
            const refType = btn.dataset.type;
            const cacheKey = btn.dataset.key;
            openNotificationModal(refId, refType, cacheKey);
        });
    });
}

// =========================================================
// 3. CARGAR FACTURAS UNIFICADAS
// =========================================================
async function loadUnifiedInvoices() {
    const loading = document.getElementById('invoices-loading');
    const container = document.getElementById('invoices-container');
    loading.classList.remove('hidden');
    container.classList.add('hidden');

    const [reservas, pedidos] = await Promise.all([
        fetchUserData('reservations'),
        fetchUserData('orders')
    ]);

    // Si alguno falló por auth, salimos
    if (reservas === null || pedidos === null) return;

    let listaUnificada = [];
    const opcionesHora = { hour: '2-digit', minute: '2-digit', hour12: true };

    if (reservas && reservas.length > 0) {
        reservas.forEach(res => {
            const isPackage = res.package_id != null;
            const tipo = isPackage ? '📦 Reserva Paquete' : '🎳 Reserva Pista';
            const nombrePista = res.lane_name || `Pista ${res.lane_number || '?'}`;
            const start = new Date(res.start_time);
            const end = new Date(res.end_time);
            const rangoHoras = `${start.toLocaleTimeString([], opcionesHora)} - ${end.toLocaleTimeString([], opcionesHora)}`;
            
            let detalles = isPackage 
                ? `<strong>${res.package_name}</strong><br>${nombrePista} | ${rangoHoras}`
                : `<strong>${nombrePista}</strong><br>${rangoHoras}`;

            listaUnificada.push({
                id_visual: `R-${res.id}`,
                fecha_obj: new Date(res.created_at || res.start_time),
                fecha_str: new Date(res.created_at).toLocaleDateString(),
                tipo: tipo,
                detalles: detalles,
                total: (res.total_price_cents),
                metodo: res.payment_method,
                referencia: res.payment_reference,
                estado: res.status,
                capture: res.payment_capture_url
            });
        });
    }

    if (pedidos && pedidos.length > 0) {
        pedidos.forEach(ord => {
            const detalles = ord.items.map(item => `<div>• ${item.quantity}x ${item.food_name}</div>`).join('');
            listaUnificada.push({
                id_visual: `C-${ord.id}`,
                fecha_obj: new Date(ord.date),
                fecha_str: new Date(ord.date).toLocaleDateString(),
                tipo: '🍔 Comida',
                detalles: detalles,
                total: Number(ord.total),
                metodo: ord.payment_method,
                referencia: ord.payment_reference,
                estado: ord.status,
                capture: ord.capture_url
            });
        });
    }

    listaUnificada.sort((a, b) => b.fecha_obj - a.fecha_obj);

    loading.classList.add('hidden');
    container.classList.remove('hidden');

    if (listaUnificada.length === 0) {
        container.innerHTML = '<p>No hay facturas registradas.</p>';
        return;
    }

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Ref / ID</th><th>Fecha</th><th>Tipo</th><th>Detalles</th>
                    <th>Método</th><th>Total</th><th>Estado</th><th>Capture</th>
                </tr>
            </thead>
            <tbody>
    `;

    listaUnificada.forEach(item => {
        let statusClass = '';
        if (['confirmed','pagada','completed'].includes(item.estado)) statusClass = 'status-paid';
        else if (['pending','pendiente'].includes(item.estado)) statusClass = 'status-pending';
        else statusClass = 'status-cancelled';

        html += `
            <tr>
                <td><small>${item.id_visual}</small><br><span style="font-size:0.8em; color:#888;">Ref: ${item.referencia || 'N/A'}</span></td>
                <td>${item.fecha_str}</td>
                <td><span style="font-weight:bold; color:var(--primary-color);">${item.tipo}</span></td>
                <td style="font-size:0.9em;">${item.detalles}</td>
                <td>${item.metodo || '-'}</td>
                <td><strong>$${item.total.toFixed(2)}</strong></td>
                <td><span class="status-badge ${statusClass}">${item.estado}</span></td>
                <td>${item.capture ? `<a href="${item.capture}" target="_blank" class="btn-action btn-view"><i class="fa-solid fa-image"></i> Ver</a>` : '-'}</td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// 4. Cargar Paquetes Disponibles (Sin cambios)
let packagesLoaded = false;
async function loadAvailablePackages() {
    if (packagesLoaded) return;
    const loading = document.getElementById('packages-loading');
    const container = document.getElementById('available-packages-container');

    try {
        const res = await fetch('/api/packages');
        const packages = await res.json();
        
        loading.classList.add('hidden');
        container.classList.remove('hidden');
        packagesLoaded = true;

        if (!packages || packages.length === 0) {
            container.innerHTML = '<p>No hay paquetes disponibles.</p>';
            return;
        }

        let html = '';
        packages.forEach(pkg => {
            let featuresHtml = `<li>✓ ${pkg.duration_hours} horas</li><li>✓ Máx. ${pkg.max_people} pers.</li>`;
            if (pkg.description) featuresHtml += pkg.description.split('.').slice(0,2).map(p => `<li>✓ ${p.trim()}</li>`).join('');

            html += `
                <div class="dash-plan-card">
                    <h3>${pkg.name}</h3>
                    <div class="price">$${pkg.price_cents}</div>
                    <ul>${featuresHtml}</ul>
                    <a href="/index.html" class="btn-reserve">Reservar</a>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (err) {
        console.error(err);
        loading.textContent = "Error al cargar paquetes.";
    }
}

// =========================================================
// GESTIÓN DEL MODAL DE NOTIFICACIONES
// =========================================================
function createNotificationModal() {
    if (document.getElementById('notifyModal')) return;
    const modalHtml = `
        <div id="notifyModal" class="notify-modal-overlay hidden">
            <div class="notify-modal-box">
                <div class="notify-header">
                    <h3>📢 Mensajes del Administrador</h3>
                    <button id="btn-close-notify-x">✖</button>
                </div>
                <div id="notifyContent" class="notify-content"></div>
                <div class="notify-footer">
                    <button id="btn-close-notify-ok" class="notify-footer button">Entendido</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-close-notify-x').addEventListener('click', closeNotificationModal);
    document.getElementById('btn-close-notify-ok').addEventListener('click', closeNotificationModal);
}

let currentNotifyRefId = null;
let currentNotifyRefType = null;

function openNotificationModal(refId, refType, cacheKey) {
    const history = window.messagesCache[cacheKey] || [];
    
    currentNotifyRefId = refId;
    currentNotifyRefType = refType;

    const content = document.getElementById('notifyContent');
    let html = '';
    
    if (history.length === 0) {
        html = '<p style="text-align:center; color:#aaa;">No hay mensajes.</p>';
    } else {
        history.forEach(msg => {
            const date = new Date(msg.created_at);
            const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12:true});
            const isNew = msg.is_read === 0;
            
            html += `
                <div class="msg-bubble ${isNew ? 'msg-new' : 'msg-old'}">
                    <div class="msg-meta">Admin • ${timeStr} ${isNew ? '<span class="new-tag">NUEVO</span>' : ''}</div>
                    <div class="msg-text">${msg.message}</div>
                </div>
            `;
        });
    }

    content.innerHTML = html;
    document.getElementById('notifyModal').classList.remove('hidden');
};

async function closeNotificationModal() {
    document.getElementById('notifyModal').classList.add('hidden');
    
    if (currentNotifyRefId && currentNotifyRefType) {
        try {
            const csrfCookie = document.cookie.match(/(^| )csrfToken=([^;]+)/);
            const csrfToken = csrfCookie ? decodeURIComponent(csrfCookie[2]) : '';
            
            await fetch('/api/user/mark-read', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken 
                },
                body: JSON.stringify({ ref_id: currentNotifyRefId, ref_type: currentNotifyRefType })
            });
            
            if (currentNotifyRefType === 'reservation') loadReservations(true);
            if (currentNotifyRefType === 'invoice') loadOrders(true);

        } catch (e) { console.error("Error marcando leído", e); }
    }
};

function updateTabBadge(tabId, count) {
    const tab = document.querySelector(`.nav-tab-item[data-target="${tabId}"]`);
    if (!tab) return;
    
    let badge = tab.querySelector('.tab-badge');
    if (count > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'tab-badge';
            tab.appendChild(badge);
        }
        badge.textContent = count;
        badge.style.display = 'inline-flex';
    } else {
        if (badge) badge.style.display = 'none';
    }
}