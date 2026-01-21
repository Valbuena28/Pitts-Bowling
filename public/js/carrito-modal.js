/**
 * Módulo de Carrito de Compras y Pagos
 * Encapsula la lógica del carrito, facturación, métodos de pago y validación de usuarios.
 */

// ==============================
// VARIABLES GLOBALES
// ==============================
const API_URL_BASE = "http://localhost:3000/api";
let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
window.paqueteUnicoParaFactura = null; // Para pagos directos de reservas sin pasar por carrito

// Variables para Delivery y Pagos
let TASA_BCV = 60.00; // Fallback inicial
let SELECTED_SERVICE_TYPE = "N/A";
let SELECTED_PAYMENT_METHOD_TEMP = "";
let DELIVERY_COST = 0;
let DELIVERY_INFO_STR = "";
let mapDelivery = null;
let markerDelivery = null;

// Coordenadas Base (Costa Verde)
const ORIGIN_LAT = 10.6698;
const ORIGIN_LNG = -71.6057;
let userLat = 10.65;
let userLng = -71.63;

// ==============================
// SELECTORES DOM (Seguros con optional chaining o checks)
// ==============================
const carritoBtn = document.getElementById("carrito-flotante");
const carritoCount = document.getElementById("carrito-count");
const detalleCarrito = document.getElementById("detalle-carrito");
const listaCarrito = document.getElementById("lista-carrito");
const cerrarCarrito = document.getElementById("cerrar-carrito");
const confirmarPedidoBtn = document.getElementById("confirmar-pedido");

// Modales de Pago
const modalFactura = document.getElementById("modal-factura");
const modalMetodoPago = document.getElementById("modal-metodo-pago"); // Contenedor de botones Pago Movil / Transferencia
const modalTipoServicio = document.getElementById("modal-tipo-servicio"); // Delivery o Comer aqui
const modalPagoMovil = document.getElementById("modal-pago-movil");
const modalTransferencia = document.getElementById("modal-transferencia");
const modalVerificacion = document.getElementById("modal-verificacion");
const modalDeliveryMap = document.getElementById("modal-delivery-map");

// ==============================
// INICIALIZACIÓN
// ==============================
document.addEventListener('DOMContentLoaded', () => {
    actualizarCarrito();
    fetchTasaBCV();
    initEventListeners();
    initPaymentListeners();
});

// Obtener Tasa BCV
async function fetchTasaBCV() {
    try {
        const res = await fetch(`${API_URL_BASE}/config/tasa`);
        if (res.ok) {
            const data = await res.json();
            if (data.tasa) {
                TASA_BCV = parseFloat(data.tasa);
                console.log("Tasa BCV actualizada:", TASA_BCV);
                // Actualizar UI si hay modales abiertos
                document.querySelectorAll(".tasa-valor").forEach(el => el.textContent = TASA_BCV.toFixed(2));
            }
        }
    } catch (err) {
        console.error("Error obteniendo tasa BCV:", err);
    }
}

// ==============================
// LÓGICA DEL CARRITO
// ==============================

// Actualizar contador y localStorage
function actualizarCarrito() {
    const totalItems = carrito.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);

    if (carritoBtn) {
        if (totalItems > 0) {
            carritoBtn.classList.remove("hidden");
            if (carritoCount) carritoCount.textContent = totalItems;
        } else {
            carritoBtn.classList.add("hidden");
            if (carritoCount) carritoCount.textContent = 0;
        }
    }
    localStorage.setItem("carrito", JSON.stringify(carrito));
}

// Calcular total del carrito o lista items
function calcularTotal(cart = carrito) {
    return cart.reduce((acc, item) => {
        const extrasTotal = (item.extras_detail || []).reduce((s, e) => s + (Number(e.price) || 0), 0);
        const unit = Number(item.unit_price) + extrasTotal;
        const subtotal = (Number(item.quantity) || 0) * unit;
        return acc + (isNaN(subtotal) ? 0 : subtotal);
    }, 0);
}

// Agregar Item al Carrito (Expuesta globalmente)
window.agregarAlCarrito = function (pedido) {
    // Helper para identificar extras únicos
    function extrasKey(arr) {
        if (!Array.isArray(arr)) return "";
        return arr.slice().sort((a, b) => a - b).join(",");
    }

    const existente = carrito.find(
        item =>
            Number(item.food_id) === Number(pedido.food_id) &&
            Number(item.size_id || 0) === Number(pedido.size_id || 0) &&
            extrasKey(item.extras || []) === extrasKey(pedido.extras || [])
    );

    if (existente) {
        existente.quantity = (Number(existente.quantity) || 0) + (Number(pedido.quantity) || 0);
        const extrasTotal = (existente.extras_detail || []).reduce((s, e) => s + (Number(e.price) || 0), 0);
        existente.unit_price = Number(existente.unit_price) || 0;
        existente.subtotal = existente.quantity * (Number(existente.unit_price) + extrasTotal);
    } else {
        pedido.quantity = Number(pedido.quantity) || 1;
        pedido.unit_price = Number(pedido.unit_price) || 0;
        const extrasTotal = (pedido.extras_detail || []).reduce((s, e) => s + (Number(e.price) || 0), 0);
        pedido.subtotal = pedido.quantity * (Number(pedido.unit_price) + extrasTotal);
        carrito.push(pedido);
    }

    actualizarCarrito();
    // Feedback visual opcional
    // alert("Agregado al carrito ✅"); 
};

// Mostrar contenido del carrito en el modal
function mostrarCarrito() {
    if (!listaCarrito) return;
    listaCarrito.innerHTML = "";

    const montoTotalEl = document.getElementById("carrito-total-monto");
    // Calcular total actual
    const totalGeneral = calcularTotal(carrito);
    if (montoTotalEl) montoTotalEl.textContent = `$${totalGeneral.toFixed(2)}`;

    if (!Array.isArray(carrito) || carrito.length === 0) {
        listaCarrito.innerHTML = "<p style='text-align:center; padding:20px;'>El carrito está vacío 🛒</p>";
        return;
    }

    carrito.forEach((item, idx) => {
        const extrasDetail = item.extras_detail || [];
        const extrasHtml = extrasDetail.length
            ? `<div class="item-extras"><strong>Extras:</strong>
           <ul style="margin:6px 0 8px 18px; font-size:0.9em; color:#ddd;">
             ${extrasDetail.map(e => `<li>${escapeHtml(e.name || String(e.id))} — $${Number(e.price || 0).toFixed(2)}</li>`).join("")}
           </ul>
         </div>`
            : "";

        const div = document.createElement("div");
        div.classList.add("item-carrito");
        div.innerHTML = `
      <div class="item-carrito-contenido">
        <img src="${escapeHtml(item.img || '')}" alt="${escapeHtml(item.nombre || '')}" style="width:64px; height:64px; object-fit:cover; border-radius:8px;">
        <div style="flex:1;">
          <h4 style="margin:0;">${escapeHtml(item.nombre || '')}</h4>
          <p style="font-size:0.9em; color:#aaa;">Tamaño: ${escapeHtml(item.tamano || 'Único')}</p>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
             <span>Cant: ${Number(item.quantity)}</span>
             <span>$${Number(item.unit_price).toFixed(2)} c/u</span>
          </div>
          ${extrasHtml}
          <p style="margin-top:5px; font-weight:bold; color:#ffcc00;">Subtotal: $${Number(item.subtotal).toFixed(2)}</p>
        </div>
        <button class="eliminar-item" data-idx="${idx}" title="Eliminar" style="background:none; border:none; cursor:pointer; font-size:1.2em;">❌</button>
      </div>
    `;
        listaCarrito.appendChild(div);
    });

    // Listeners para eliminar items
    document.querySelectorAll(".eliminar-item").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const idx = Number(btn.dataset.idx);
            if (!isNaN(idx)) {
                carrito.splice(idx, 1);
                actualizarCarrito();
                mostrarCarrito();
            }
        });
    });
}

// ==============================
// FLUJO DE PAGO Y FACTURACIÓN
// ==============================

// Expuesta globalmente para que js/modal.js pueda llamarla tras reservar paquete
window.mostrarFactura = function () {
    // 1. Determinar items (Paquete directo VS Carrito)
    const itemsParaPagar = window.paqueteUnicoParaFactura
        ? [window.paqueteUnicoParaFactura]
        : carrito;

    if (!itemsParaPagar || itemsParaPagar.length === 0) {
        alert("⚠️ No hay items para pagar");
        return;
    }

    const itemsContainer = document.getElementById("factura-items");
    const totalEl = document.getElementById("factura-total");
    if (itemsContainer) itemsContainer.innerHTML = "";

    // 2. Llenar Factura
    if (itemsContainer) {
        itemsParaPagar.forEach(item => {
            const itemHtml = `
            <div class="factura-item" style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
                <div class="factura-item-info">
                    <strong>${escapeHtml(item.nombre)} (${item.quantity}x)</strong><br>
                    <span style="font-size:0.85em; color:#bbb;">${escapeHtml(item.tamano || 'Standard')}</span>
                </div>
                <div class="factura-item-price">$${Number(item.subtotal).toFixed(2)}</div>
            </div>
        `;
            itemsContainer.innerHTML += itemHtml;
        });
    }

    // 3. Totales
    const total = calcularTotal(itemsParaPagar);
    if (totalEl) totalEl.textContent = `Total: $${total.toFixed(2)}`;

    // 4. Cambiar de Modal
    if (detalleCarrito) detalleCarrito.classList.add("hidden");
    if (modalFactura) modalFactura.classList.remove("hidden");
};


// Verificar sesión (Depende de general.js o header-auth.js)
async function verificarSesion() {
    if (typeof window.verificarSesionActiva === 'function') {
        return await window.verificarSesionActiva();
    }
    // Fallback básico si no existe la fn
    const token = localStorage.getItem("token");
    if (token) return { id: localStorage.getItem("userId") };
    return null;
}

// ==============================
// EVENT LISTENERS DE MODALES
// ==============================
function initEventListeners() {

    // 1. Abrir Carrito
    if (carritoBtn) {
        carritoBtn.addEventListener("click", (e) => {
            e.preventDefault();
            mostrarCarrito();
            if (detalleCarrito) {
                detalleCarrito.classList.remove("hidden");
                document.body.classList.add("modal-open");
                document.documentElement.style.overflow = "hidden"; // Lock scroll
            }
        });
    }

    // 2. Cerrar Carrito
    if (cerrarCarrito) {
        cerrarCarrito.addEventListener("click", () => {
            if (detalleCarrito) detalleCarrito.classList.add("hidden");
            document.body.classList.remove("modal-open");
            document.documentElement.style.overflow = ""; // Unlock scroll
        });
    }

    // 3. Confirmar Pedido (Ir a Factura)
    if (confirmarPedidoBtn) {
        confirmarPedidoBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            if (carrito.length === 0) {
                alert("⚠️ Tu carrito está vacío");
                return;
            }

            const btnText = confirmarPedidoBtn.textContent;
            confirmarPedidoBtn.textContent = "Verificando...";
            confirmarPedidoBtn.disabled = true;

            const usuario = await verificarSesion();

            confirmarPedidoBtn.textContent = btnText;
            confirmarPedidoBtn.disabled = false;

            if (!usuario) {
                window.location.href = '../login.html'; // Ajustar path relativo si es necesario
                return;
            }

            window.currentUserId = usuario.id;
            window.paqueteUnicoParaFactura = null; // Nos aseguramos que sea flujo carrito
            window.mostrarFactura();
        });
    }

    // 4. Botón Pagar (De Factura -> Métodos de Pago)
    const btnPagar = document.getElementById("btn-pagar");
    if (btnPagar) {
        btnPagar.addEventListener("click", () => {
            if (modalFactura) modalFactura.classList.add("hidden");
            if (modalMetodoPago) modalMetodoPago.classList.remove("hidden");
        });
    }

    // 5. Botones CERRAR Modales Secundarios
    const cerrarIds = [
        "cerrar-modal-factura", "cerrar-modal-metodo",
        "cerrar-modal-servicio", "cerrar-modal-pago-movil",
        "cerrar-modal-transfer", "cerrar-modal-verificacion",
        "cerrar-modal-mapa"
    ];

    cerrarIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener("click", () => {
                // Cerrar el modal padre de este botón
                const modal = btn.closest(".detalle");
                if (modal) modal.classList.add("hidden");

                // Liberar scroll y estado de modal
                document.documentElement.style.overflow = "";
                document.body.style.overflow = "";
                document.body.classList.remove("modal-open");

                // Asegurar que el header vuelva a mostrarse si estaba oculto
                const header = document.querySelector('header');
                if (header) header.classList.remove('header-hidden');
            });
        }
    });

    // Botones ATRAS (Inyectados dinámicamente si no existen)
    setupBackButtons();
}

// Configurar botones "Atrás" para navegación entre modales
function setupBackButtons() {
    function addBack(modalEl, onClick) {
        if (!modalEl) return;
        const cont = modalEl.querySelector('.detalle-contenido');
        if (!cont || cont.querySelector('.btn-back-custom')) return;

        const btn = document.createElement('button');
        btn.textContent = '← Atrás';
        btn.className = 'btn-agregar btn-back-custom';
        btn.style.position = 'absolute';
        btn.style.left = '15px';
        btn.style.top = '15px';
        btn.style.padding = '5px 10px';
        btn.style.fontSize = '0.9em';
        btn.style.zIndex = '10';

        btn.addEventListener('click', onClick);
        cont.insertBefore(btn, cont.firstChild);
    }

    addBack(modalFactura, () => {
        modalFactura.classList.add("hidden");
        // Si venimos de paquete directo, cerramos todo. Si es carrito, volvemos a carrito.
        if (!window.paqueteUnicoParaFactura && detalleCarrito) {
            detalleCarrito.classList.remove("hidden");
        }
    });

    addBack(modalMetodoPago, () => {
        modalMetodoPago.classList.add("hidden");
        if (modalFactura) modalFactura.classList.remove("hidden");
    });

    addBack(modalTipoServicio, () => {
        modalTipoServicio.classList.add("hidden");
        if (modalMetodoPago) modalMetodoPago.classList.remove("hidden");
    });

    addBack(modalPagoMovil, () => {
        modalPagoMovil.classList.add("hidden");
        if (modalTipoServicio) modalTipoServicio.classList.remove("hidden");
    });
    addBack(modalTransferencia, () => {
        modalTransferencia.classList.add("hidden");
        if (modalTipoServicio) modalTipoServicio.classList.remove("hidden");
    });
}

// ==============================
// LÓGICA DE PAGOS Y SERVICIOS
// ==============================

function initPaymentListeners() {
    // Selección de Método: Pago Movil
    document.getElementById("btn-ir-pago-movil")?.addEventListener("click", () => {
        SELECTED_PAYMENT_METHOD_TEMP = "pago_movil";
        if (modalMetodoPago) modalMetodoPago.classList.add("hidden");
        if (modalTipoServicio) modalTipoServicio.classList.remove("hidden");
    });

    // Selección de Método: Transferencia
    document.getElementById("btn-ir-transferencia")?.addEventListener("click", () => {
        SELECTED_PAYMENT_METHOD_TEMP = "transferencia";
        if (modalMetodoPago) modalMetodoPago.classList.add("hidden");
        if (modalTipoServicio) modalTipoServicio.classList.remove("hidden");
    });

    // Selección de Servicio: Local
    document.getElementById("btn-servicio-local")?.addEventListener("click", () => {
        SELECTED_SERVICE_TYPE = "Comer en el lugar";
        DELIVERY_COST = 0;
        continuarAlFormularioPago();
    });

    // Selección de Servicio: Delivery
    document.getElementById("btn-servicio-delivery")?.addEventListener("click", () => {
        SELECTED_SERVICE_TYPE = "Delivery";
        if (modalTipoServicio) modalTipoServicio.classList.add("hidden");
        iniciarMapaDelivery(); // Abre modal mapa
    });

    // Acciones Finales de Pago ("Ya pagué")
    document.getElementById("btn-submit-pago-movil")?.addEventListener("click", () => {
        const ref = document.getElementById("pago-movil-ref");
        const cap = document.getElementById("pago-movil-capture");
        enviarPedidoConPago('pago_movil', ref, cap);
    });

    document.getElementById("btn-submit-transfer")?.addEventListener("click", () => {
        const ref = document.getElementById("transfer-ref");
        const cap = document.getElementById("transfer-capture");
        enviarPedidoConPago('transferencia', ref, cap);
    });
}

function continuarAlFormularioPago() {
    if (modalTipoServicio) modalTipoServicio.classList.add("hidden");
    if (modalDeliveryMap) modalDeliveryMap.classList.add("hidden");

    // Abrir formulario correspondiente
    if (SELECTED_PAYMENT_METHOD_TEMP === "pago_movil") {
        abrirModalPagoMovil();
    } else if (SELECTED_PAYMENT_METHOD_TEMP === "transferencia") {
        abrirModalTransferencia();
    }
}

// Abrir UI Pago Móvil con totales calculados
function abrirModalPagoMovil() {
    const items = window.paqueteUnicoParaFactura ? [window.paqueteUnicoParaFactura] : carrito;
    let total = calcularTotal(items);

    if (SELECTED_SERVICE_TYPE === "Delivery" && DELIVERY_COST > 0) {
        total += DELIVERY_COST;
    }

    const totalBs = total * TASA_BCV;
    let label = `Total a Pagar: $${total.toFixed(2)}`;
    if (DELIVERY_COST > 0) label += ` (+Envío)`;

    const display = document.getElementById("pm-total-display");
    const bsDisplay = document.getElementById("pm-total-bs");

    if (display) display.textContent = label;
    if (bsDisplay) bsDisplay.textContent = totalBs.toFixed(2);

    if (modalPagoMovil) modalPagoMovil.classList.remove("hidden");
}

// Abrir UI Transferencia con totales calculados
function abrirModalTransferencia() {
    const items = window.paqueteUnicoParaFactura ? [window.paqueteUnicoParaFactura] : carrito;
    let total = calcularTotal(items);

    if (SELECTED_SERVICE_TYPE === "Delivery" && DELIVERY_COST > 0) {
        total += DELIVERY_COST;
    }

    const totalBs = total * TASA_BCV;
    let label = `Total a Pagar: $${total.toFixed(2)}`;
    if (DELIVERY_COST > 0) label += ` (+Envío)`;

    const display = document.getElementById("trans-total-display");
    const bsDisplay = document.getElementById("trans-total-bs");

    if (display) display.textContent = label;
    if (bsDisplay) bsDisplay.textContent = totalBs.toFixed(2);

    if (modalTransferencia) modalTransferencia.classList.remove("hidden");
}

// ==============================
// MAPA Y DELIVERY
// ==============================
function iniciarMapaDelivery() {
    if (modalDeliveryMap) modalDeliveryMap.classList.remove("hidden");

    // Inicializar Leaflet con delay para rendering correcto
    setTimeout(() => {
        if (!mapDelivery) {
            mapDelivery = L.map('mapa-delivery').setView([userLat, userLng], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CARTO',
                maxZoom: 20
            }).addTo(mapDelivery);

            markerDelivery = L.marker([userLat, userLng], { draggable: true }).addTo(mapDelivery);

            markerDelivery.on('dragend', (e) => {
                const pos = markerDelivery.getLatLng();
                userLat = pos.lat; userLng = pos.lng;
                calcularCostoDelivery();
            });

            mapDelivery.on('click', (e) => {
                markerDelivery.setLatLng(e.latlng);
                userLat = e.latlng.lat; userLng = e.latlng.lng;
                calcularCostoDelivery();
            });
            calcularCostoDelivery();
        }
        mapDelivery.invalidateSize();
    }, 200);

    // Botón Confirmar del Mapa
    const btnConfMap = document.getElementById("btn-confirmar-delivery");
    if (btnConfMap) {
        // Clonar para limpiar listeners previos si hubieran
        const newBtn = btnConfMap.cloneNode(true);
        btnConfMap.parentNode.replaceChild(newBtn, btnConfMap);
        newBtn.addEventListener("click", () => {
            continuarAlFormularioPago();
        });
    }

    // Botón Geolocalización
    const btnGeo = document.getElementById("btn-geo-nav");
    if (btnGeo) {
        btnGeo.onclick = () => {
            if (!navigator.geolocation) { alert("Geolocalización no soportada"); return; }
            btnGeo.textContent = "⌛ ...";
            navigator.geolocation.getCurrentPosition(pos => {
                userLat = pos.coords.latitude;
                userLng = pos.coords.longitude;
                if (mapDelivery) {
                    mapDelivery.setView([userLat, userLng], 15);
                    markerDelivery.setLatLng([userLat, userLng]);
                    calcularCostoDelivery();
                }
                btnGeo.textContent = "📍 Mi Ubicación";
            }, () => {
                alert("Error obteniendo ubicación");
                btnGeo.textContent = "📍 Mi Ubicación";
            });
        };
    }
}

async function calcularCostoDelivery() {
    const statusText = document.getElementById("del-status-text");
    const btnConf = document.getElementById("btn-confirmar-delivery");
    if (statusText) statusText.textContent = "Calculando...";
    if (btnConf) btnConf.disabled = true;

    try {
        const res = await fetch(`${API_URL_BASE}/config/delivery`);
        const config = await res.json();
        const dist = getDistanceKm(ORIGIN_LAT, ORIGIN_LNG, userLat, userLng);

        if (dist > Number(config.distancia_max)) {
            if (statusText) statusText.innerHTML = `<span style="color:red">Fuera de rango (${dist.toFixed(2)}km)</span>`;
            document.getElementById("del-costo").textContent = "-";
            DELIVERY_COST = 0;
            return;
        }

        let costo = Number(config.precio_base);
        if (dist > Number(config.km_base)) {
            costo += (dist - Number(config.km_base)) * Number(config.precio_km);
        }

        DELIVERY_COST = Math.ceil(costo * 100) / 100;
        DELIVERY_INFO_STR = `${dist.toFixed(2)} km`;

        document.getElementById("del-distancia").textContent = dist.toFixed(2);
        document.getElementById("del-costo").textContent = DELIVERY_COST.toFixed(2);
        if (statusText) statusText.textContent = "";

        // Mostrar contenedor de info
        const infoCont = document.getElementById("delivery-info-container");
        if (infoCont) infoCont.classList.remove("hidden");

        if (btnConf) btnConf.disabled = false;

    } catch (err) {
        console.error("Error calc delivery", err);
    }
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ==============================
// ENVÍO DE DATOS AL BACKEND
// ==============================
async function enviarPedidoConPago(metodo, refInput, captureInput) {
    const ref = refInput.value;
    const file = captureInput.files[0];

    if (!ref || !file) {
        alert("Faltan datos de pago (referencia o capture)");
        return;
    }

    const userId = window.currentUserId;
    if (!userId) {
        alert("Sesión perdida. Recarga la página.");
        return;
    }

    alert("Procesando pedido... Por favor espera.");

    let itemsReserva = [];
    let itemsComida = [];

    // Separar lo que se va a enviar
    if (window.paqueteUnicoParaFactura) {
        itemsReserva.push(window.paqueteUnicoParaFactura);
    } else {
        itemsReserva = carrito.filter(i => i.type === 'reservation');
        itemsComida = carrito.filter(i => i.type !== 'reservation');
    }

    const errores = [];
    let exito = false;

    // 1. Enviar Reservas
    if (itemsReserva.length > 0) {
        // Nota: Actualmente el backend parece soportar 1 reserva por request, iteramos si hay varias
        for (const resItem of itemsReserva) {
            try {
                const meta = resItem.meta_data || {};
                const fd = new FormData();
                fd.append('user_id', userId);
                fd.append('payment_method', metodo);
                fd.append('payment_reference', ref);
                fd.append('payment_capture', file);

                // Datos reserva
                fd.append('package_id', meta.package_id);
                fd.append('date', meta.date);
                fd.append('time', meta.time);
                fd.append('people_count', meta.people_count);
                fd.append('lane_id', meta.lane_id);
                fd.append('duration', resItem.duration || meta.duration || 1);
                if (resItem.shoe_sizes) fd.append('shoe_sizes', resItem.shoe_sizes);

                const resp = await fetch(`${API_URL_BASE}/reservations/checkout`, { method: 'POST', body: fd });
                if (!resp.ok) throw new Error(await resp.text());
                exito = true;
            } catch (e) {
                errores.push("Fallo reserva: " + e.message);
            }
        }
    }

    // 2. Enviar Comida
    if (itemsComida.length > 0) {
        try {
            const fd = new FormData();
            const cartData = itemsComida.map(item => ({
                food_id: Number(item.food_id),
                size_id: Number(item.size_id || 0),
                extras: item.extras || [],
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                subtotal: Number(item.subtotal)
            }));

            const totalComida = itemsComida.reduce((acc, i) => acc + Number(i.subtotal), 0) + DELIVERY_COST;

            // Info Servicio
            let serviceInfo = SELECTED_SERVICE_TYPE;
            if (DELIVERY_COST > 0) serviceInfo += ` | ${DELIVERY_INFO_STR} | Costo: $${DELIVERY_COST}`;
            if (SELECTED_SERVICE_TYPE === "Delivery" && userLat) {
                serviceInfo += ` | https://maps.google.com/?q=${userLat},${userLng}`;
            }

            fd.append('usuario_id', userId);
            fd.append('cart', JSON.stringify(cartData));
            fd.append('total', totalComida);
            fd.append('payment_method', metodo);
            fd.append('payment_reference', ref);
            fd.append('payment_capture', file);
            fd.append('service_type', serviceInfo);

            const resp = await fetch(`${API_URL_BASE}/orders/checkout`, { method: 'POST', body: fd });
            if (!resp.ok) throw new Error(await resp.text());
            exito = true;

        } catch (e) {
            errores.push("Fallo comida: " + e.message);
        }
    }

    if (errores.length > 0) {
        alert("Hubo errores:\n" + errores.join("\n"));
    } else if (exito) {
        alert("¡Pedido realizado con éxito!");
        finalizarPedido();
    }
}

function finalizarPedido() {
    // Limpiar si no era directo
    if (!window.paqueteUnicoParaFactura) {
        carrito = [];
        localStorage.removeItem("carrito");
        actualizarCarrito();
    }
    window.paqueteUnicoParaFactura = null;

    // Cerrar todo y mostrar éxito
    if (modalPagoMovil) modalPagoMovil.classList.add("hidden");
    if (modalTransferencia) modalTransferencia.classList.add("hidden");
    if (modalVerificacion) modalVerificacion.classList.remove("hidden");
}

// Utilidad
function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
