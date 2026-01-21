document.addEventListener('DOMContentLoaded', () => {

    window.paqueteUnicoParaFactura = null;

    // === SELECTORES DEL DOM ===
    const modalPaquete = document.getElementById('modal-paquete');
    const modalFase1 = document.getElementById('modal-paquete-fase1');
    const modalFase2 = document.getElementById('modal-paquete-fase2');
    const btnCerrarModal = document.getElementById('cerrar-modal-paquete');
    const btnCerrarConfirmacion = document.getElementById('cerrar-modal-confirmacion');

    // Elementos del formulario
    const nombrePaqueteEl = document.getElementById('paquete-nombre');
    const detallesPaqueteEl = document.getElementById('paquete-detalles');
    const precioPaqueteEl = document.getElementById('paquete-precio');
    const inputFecha = document.getElementById('paquete-fecha');
    const inputHora = document.getElementById('paquete-hora');
    const inputPersonas = document.getElementById('paquete-personas');
    const selectPista = document.getElementById('paquete-pista');
    const msgMaxPersonas = document.getElementById('max-personas-msg');
    const btnReservar = document.getElementById('btn-reservar-paquete');
    const containerTallasPaquete = document.getElementById('paquete-tallas-container');

    let planSeleccionado = null;

    // Configurar fecha mínima a hoy
    const hoy = new Date().toISOString().split('T')[0];
    if (inputFecha) inputFecha.setAttribute('min', hoy);

    function renderTallasPaquete(n) {
        if (!containerTallasPaquete) return;
        containerTallasPaquete.innerHTML = '';
        for (let i = 1; i <= n; i++) {
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.placeholder = `Talla ${i}`;
            inp.className = 'shoe-size-input';
            containerTallasPaquete.appendChild(inp);
        }
    }

    // === FUNCIÓN PARA ABRIR EL MODAL ===
    async function abrirModalPaquete(planData) {
        planSeleccionado = planData;

        // UI básica
        nombrePaqueteEl.textContent = `Paquete ${planData.plan}`;
        detallesPaqueteEl.innerHTML = `<ul>${planData.detalles}</ul>`;
        precioPaqueteEl.textContent = `Precio: $${planData.precio}`;

        // Reset inputs
        inputFecha.value = '';
        inputHora.value = '';
        inputPersonas.value = 1;
        selectPista.innerHTML = '<option value="">-- Selecciona Fecha y Hora primero --</option>';
        selectPista.disabled = true;
        const maxP = planData.maxpeople || 6;
        inputPersonas.setAttribute('max', maxP);
        msgMaxPersonas.textContent = `Máximo ${maxP} personas`;
        renderTallasPaquete(1);

        // Mostrar modal
        modalFase1.classList.remove('hidden');
        modalFase2.classList.add('hidden');
        modalPaquete.classList.remove('hidden');
    }

    function cerrarModal() {
        modalPaquete.classList.add('hidden');
        planSeleccionado = null;
    }

    // === LÓGICA DE PISTAS DISPONIBLES ===
    async function cargarPistasDisponibles() {
        const fecha = inputFecha.value;
        const hora = inputHora.value;

        if (!fecha || !hora || !planSeleccionado) return;

        let duracion = 2; // Default
        if (planSeleccionado.duration) {
            duracion = parseFloat(planSeleccionado.duration);
        } else {

            const match = planSeleccionado.detalles.match(/(\d+)\s*horas?/);
            if (match) duracion = parseFloat(match[1]);
        }

        selectPista.innerHTML = '<option>Cargando pistas...</option>';
        selectPista.disabled = true;

        try {
            const res = await fetch(`/api/lanes/available?date=${fecha}&time=${hora}&duration=${duracion}`);
            const pistas = await res.json();

            selectPista.innerHTML = '';

            if (pistas.length === 0) {
                selectPista.innerHTML = '<option value="">No hay pistas disponibles en este horario</option>';
            } else {
                selectPista.disabled = false;
                // Opción por defecto
                const defaultOp = document.createElement('option');
                defaultOp.text = "Seleccione una pista";
                defaultOp.value = "";
                selectPista.add(defaultOp);

                pistas.forEach(pista => {
                    const option = document.createElement('option');
                    option.value = pista.id;
                    option.textContent = `${pista.name} (Máx: ${pista.max_players})`;
                    selectPista.appendChild(option);
                });
            }
        } catch (error) {
            console.error(error);
            selectPista.innerHTML = '<option value="">Error cargando pistas</option>';
        }
    }

    // Listeners para recargar pistas
    inputFecha.addEventListener('change', cargarPistasDisponibles);
    inputHora.addEventListener('change', cargarPistasDisponibles);



    // Listener para validación de personas en tiempo real

    inputPersonas.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        const max = parseInt(inputPersonas.getAttribute('max'));
        if (val > max) { val = max; e.target.value = max; alert(`Máximo ${max} personas.`); }
        if (val < 1 || isNaN(val)) val = 1;
        renderTallasPaquete(val);
    });

    // === LÓGICA DE RESERVA Y CHECKOUT DIRECTO ===
    btnReservar.addEventListener('click', () => {
        const fecha = inputFecha.value;
        const hora = inputHora.value;
        const pistaId = selectPista.value;
        const personas = inputPersonas.value;
        const inputsTallas = containerTallasPaquete.querySelectorAll('input');
        const tallasArr = [];
        inputsTallas.forEach(inp => {
            if (inp.value.trim() !== "") tallasArr.push(inp.value);
        });
        const tallasStr = tallasArr.join(", ");

        // 1. Validaciones (Igual que antes)
        if (!fecha || !hora) {
            alert('Selecciona fecha y hora.');
            return;
        }
        if (!pistaId) {
            alert('Debes seleccionar una pista disponible.');
            return;
        }

        // 2. Crear objeto del paquete (Idéntico a como lo tenías, compatible con la factura)
        const itemReserva = {
            food_id: planSeleccionado.id_bd,
            nombre: `Reserva: ${planSeleccionado.plan}`,
            tamano: `Pista ${selectPista.options[selectPista.selectedIndex].text} | ${fecha} - ${hora} | ${personas} Pers.`,
            size_id: 0,
            extras: [],
            extras_detail: [], // Necesario para que el script de factura no falle
            quantity: 1,
            unit_price: parseFloat(planSeleccionado.precio),
            subtotal: parseFloat(planSeleccionado.precio),
            img: 'images/logo.jpg',
            type: 'reservation',
            shoe_sizes: tallasStr,

            // DATOS CRÍTICOS PARA LA BASE DE DATOS
            meta_data: {
                date: fecha,
                time: hora,
                lane_id: pistaId,
                people_count: personas,
                package_id: planSeleccionado.id_bd,
                shoe_sizes: tallasStr
            }
        };

        // 3. LÓGICA NUEVA: Checkout Directo
        // Guardamos el paquete en la variable global para que script.js lo lea
        window.paqueteUnicoParaFactura = itemReserva;

        // Ocultamos el modal de los paquetes
        modalFase1.classList.add('hidden');
        modalPaquete.classList.add('hidden');

        // Ejecutamos la función de mostrar factura que está en script.js
        if (typeof mostrarFactura === 'function') {
            mostrarFactura();
        } else {
            console.error("Error: La función mostrarFactura() no está disponible en script.js");
            alert("Ocurrió un error al intentar abrir el pago. Revisa la consola.");
        }
    });

    // Eventos de apertura y cierre
    document.addEventListener('click', async (e) => {
        if (e.target && e.target.classList.contains('btn-reservar-plan')) {
            e.preventDefault();

            // Verificación de sesión rápida
            const usuario = await verificarSesionActiva();
            if (usuario) {
                // Extraer datos del dataset del botón (ver paso 6)
                const ds = e.target.dataset;
                const data = {
                    id_bd: ds.idbd,   // ID numérico de la BD
                    plan: ds.plan,
                    precio: ds.precio,
                    detalles: ds.detalles,
                    maxpeople: ds.maxpeople, // Nuevo
                    duration: ds.duration    // Nuevo
                };
                abrirModalPaquete(data);
            } else {
                window.location.href = 'login.html';
            }
        }
    });

    btnCerrarModal.addEventListener('click', cerrarModal);
    if (btnCerrarConfirmacion) btnCerrarConfirmacion.addEventListener('click', cerrarModal);
});