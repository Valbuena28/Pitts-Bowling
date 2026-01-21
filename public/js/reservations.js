document.addEventListener('DOMContentLoaded', () => {

    // === 1. CONFIGURACIÓN ===
    const OPENING_HOUR = 16; // 4:00 PM
    const CLOSING_HOUR = 23; // 11:00 PM

    // === 2. ELEMENTOS DOM ===
    const fechaInput = document.getElementById('fecha');
    const timeContainer = document.querySelector('.time-slots'); 
    const selectedTimeInput = document.getElementById('selectedTime');
    const durationSelect = document.getElementById('duracion');
    const laneSelect = document.getElementById('laneSelect');
    const laneContainer = document.getElementById('laneSelectionContainer');
    const btnReserve = document.getElementById('btnCheckAndReserve');
    
    // Resumen
    const summaryDate = document.getElementById('summaryDate');
    const summaryTime = document.getElementById('summaryTime');
    const summaryPlayers = document.getElementById('summaryPlayers');
    const summaryDuration = document.getElementById('summaryDuration');
    const summaryTotal = document.getElementById('summaryTotal');
    const btnTotalLabel = document.getElementById('totalPrice');
    const summaryLane = document.getElementById('summaryLane');
    
    // Contadores
    const playerCountSpan = document.getElementById('playerCount');
    const btnDecrease = document.getElementById('decreasePlayers');
    const btnIncrease = document.getElementById('increasePlayers');
    const containerTallas = document.getElementById('shoe-sizes-inputs');

    // === 3. ESTADO GLOBAL ===
    let state = {
        date: new Date().toISOString().split('T')[0], 
        time24: null,       // Hora formato 24h (ej: 14)
        timeString: null,   // Hora formato string (ej: "14:00")
        players: 2,
        duration: 1,
        price: 0,           
        laneId: null,       
        lanesData: []       // Cache de pistas
    };

    // Inicialización
    fechaInput.setAttribute('min', state.date);
    fechaInput.value = state.date;
    
    limitarOpcionesDuracion();
    generarHoras();

    renderShoeInputs(state.players);

    // === 4. EVENTOS ===
    fechaInput.addEventListener('change', (e) => {
        state.date = e.target.value;
        resetTimeAndLane();
        verificarCapacidadDiaria(); 
        actualizarResumen();
    });

    durationSelect.addEventListener('change', (e) => {
        state.duration = parseInt(e.target.value);
        if (state.laneId) calcularPrecio(); 
        actualizarResumen();
        // Si cambia la duración, verificamos disponibilidad de nuevo (ej: de 1h a 3h podría chocar)
        if (state.timeString) consultarPistasDisponibles();
    });

    if(laneSelect) {
        laneSelect.addEventListener('change', (e) => {
            state.laneId = e.target.value;
            calcularPrecio(); 
            actualizarResumen();
        });
        
        laneSelect.addEventListener('change', () => {
            const opt = laneSelect.options[laneSelect.selectedIndex];
            if (summaryLane) summaryLane.textContent = opt && opt.text ? opt.text.split(' - ')[0] : 'No seleccionada';
        });
    }

    if(btnDecrease && btnIncrease) {
        btnDecrease.addEventListener('click', () => {
            if (state.players > 1) {
                state.players--;
                playerCountSpan.textContent = state.players;
                renderShoeInputs(state.players);
                if(state.timeString) consultarPistasDisponibles();
                actualizarResumen();
            }
        });

        btnIncrease.addEventListener('click', () => {
            if (state.players < 8) { 
                state.players++;
                playerCountSpan.textContent = state.players;
                renderShoeInputs(state.players);
                if(state.timeString) consultarPistasDisponibles();
                actualizarResumen();
            } else {
                alert("Máximo permitido de jugadores alcanzado.");
            }
        });
    }

    // === 5. FUNCIONES ===

    function renderShoeInputs(count) {
        if(!containerTallas) return;
        containerTallas.innerHTML = ''; // Limpiar
        for (let i = 1; i <= count; i++) {
            const input = document.createElement('input');
            input.type = 'number';
            input.placeholder = `Talla J.${i}`;
            input.className = 'shoe-size-input';
            containerTallas.appendChild(input);
        }
    }

    function resetTimeAndLane() {
        state.time24 = null;
        state.timeString = null;
        state.laneId = null;
        state.price = 0;
        state.lanesData = [];
        document.querySelectorAll('.time-slot').forEach(b => b.classList.remove('selected'));
        if(laneSelect) {
            laneSelect.innerHTML = '<option value="">-- Selecciona hora primero --</option>';
            laneSelect.disabled = true;
        }
        // Bloquear visualmente el selector de pistas
        if(laneContainer) {
            laneContainer.style.opacity = '0.5';
            laneContainer.style.pointerEvents = 'none';
        }
    }

    function limitarOpcionesDuracion() {
        durationSelect.innerHTML = '';
        for(let i=1; i<=4; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.text = `${i} hora${i>1?'s':''}`;
            durationSelect.appendChild(opt);
        }
    }

    function generarHoras() {
        timeContainer.innerHTML = ''; 
        for (let i = OPENING_HOUR; i <= CLOSING_HOUR; i++) {
            const btn = document.createElement('button');
            btn.classList.add('time-slot');
            const ampm = i >= 12 ? 'PM' : 'AM';
            const hora12 = i % 12 || 12; 
            const etiqueta = `${hora12}:00 ${ampm}`;
            
            btn.textContent = etiqueta;
            btn.dataset.hour24 = i; 

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                seleccionarHora(btn, i);
            });
            timeContainer.appendChild(btn);
        }
        verificarCapacidadDiaria();
    }

    async function verificarCapacidadDiaria() {
        document.querySelectorAll('.time-slot').forEach(b => {
            b.classList.remove('occupied', 'selected');
            b.disabled = false;
            b.title = "";
        });

        try {
            const res = await fetch(`/api/lanes/check-capacity?date=${state.date}`);
            const data = await res.json();
            if (data.busyHours && Array.isArray(data.busyHours)) {
                data.busyHours.forEach(busyHour => {
                    const btn = document.querySelector(`.time-slot[data-hour24="${busyHour}"]`);
                    if (btn) {
                        btn.classList.add('occupied');
                        btn.title = "Hora completa";
                    }
                });
            }
        } catch (error) { console.error(error); }
    }

    function seleccionarHora(btn, hora24) {
        if (btn.classList.contains('occupied')) return; 

        document.querySelectorAll('.time-slot').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        state.time24 = hora24;
        state.timeString = `${hora24}:00`; 
        if(selectedTimeInput) selectedTimeInput.value = state.timeString;

        actualizarResumen();
        consultarPistasDisponibles();
    }

    async function consultarPistasDisponibles() {
        if (!state.date || !state.timeString) return;

        // Feedback visual de carga
        if(laneContainer) laneContainer.style.opacity = '0.5';
        if(laneSelect) {
            laneSelect.disabled = true;
            laneSelect.innerHTML = '<option>Buscando pista...</option>';
        }

        try {
            const url = `/api/lanes/available?date=${state.date}&time=${state.timeString}&duration=${state.duration}`;
            const response = await fetch(url);
            const pistas = await response.json();
            state.lanesData = pistas; 

            if(laneSelect) {
                laneSelect.innerHTML = ''; 
                state.laneId = null;

                if (pistas.length === 0) {
                    laneSelect.innerHTML = '<option value="">⛔ Sin pistas disponibles</option>';
                    // Mantener bloqueado si no hay pistas
                    if(laneContainer) laneContainer.style.pointerEvents = 'none';
                } else {
                    let foundValid = false;
                    pistas.forEach((pista) => {
                        if(pista.max_players >= state.players) {
                            const opt = document.createElement('option');
                            opt.value = pista.id;
                            const precioHora = pista.price_per_hour_cents ? (pista.price_per_hour_cents) : 0;
                            opt.text = `${pista.name} - $${precioHora}/h`;
                            laneSelect.appendChild(opt);
                            if (!foundValid) {
                                state.laneId = pista.id;
                                foundValid = true;
                            }
                        }
                    });

                    if (!foundValid) {
                        laneSelect.innerHTML = '<option value="">⚠️ Aumenta la capacidad</option>';
                        if(laneContainer) laneContainer.style.pointerEvents = 'none';
                    } else {
                        laneSelect.disabled = false;
                        
                        // === SOLUCIÓN AL PROBLEMA DE DESPLIEGUE ===
                        // Reactivamos los clicks en el contenedor
                        if(laneContainer) {
                            laneContainer.style.opacity = '1';
                            laneContainer.style.pointerEvents = 'auto'; // <--- ESTA LINEA FALTABA
                        }

                        calcularPrecio(); 
                        actualizarResumen();
                        // Actualizar nombre de pista por defecto
                        const opt = laneSelect.options[laneSelect.selectedIndex];
                        if (summaryLane) summaryLane.textContent = opt && opt.text ? opt.text.split(' - ')[0] : 'No seleccionada';
                    }
                }
            }

        } catch (error) { 
            console.error(error);
            if(laneSelect) laneSelect.innerHTML = '<option>Error de conexión</option>';
        }
    }

    function calcularPrecio() {
        if (!state.laneId || state.lanesData.length === 0) {
            state.price = 0;
            return;
        }
        const pistaSeleccionada = state.lanesData.find(p => p.id == state.laneId);
        if (pistaSeleccionada) {
            const precioHora = pistaSeleccionada.price_per_hour_cents;
            state.price = precioHora * state.duration;
        }
    }

    function actualizarResumen() {
        if (summaryDate) summaryDate.textContent = state.date;
        if (summaryTime) summaryTime.textContent = state.timeString || '--:--';
        if (summaryPlayers) summaryPlayers.textContent = state.players;
        if (summaryDuration) summaryDuration.textContent = `${state.duration}h`;
        if (summaryTotal) summaryTotal.textContent = `${state.price.toFixed(2)}`;
        if (btnTotalLabel) btnTotalLabel.textContent = `${state.price.toFixed(2)}`;
        if (summaryLane) {
            if (state.laneId && laneSelect && laneSelect.selectedIndex >= 0) {
                const opt = laneSelect.options[laneSelect.selectedIndex];
                summaryLane.textContent = opt && opt.text ? opt.text.split(' - ')[0] : 'No seleccionada';
            } else {
                summaryLane.textContent = 'No seleccionada';
            }
        }
    }

    // === 6. RESERVAR (CHECKOUT) ===
    if(btnReserve) {
        btnReserve.addEventListener('click', async (e) => {
            e.preventDefault();

            if (!state.timeString || !state.laneId) {
                alert("Selecciona hora y pista válida.");
                return;
            }

            if (typeof verificarSesionActiva === 'function') {
                const usuario = await verificarSesionActiva();
                if (!usuario) {
                    window.location.href = 'login.html';
                    return;
                }
            }
            // Recopilar tallas de zapatos
            const inputsTallas = document.querySelectorAll('#shoe-sizes-inputs input');
            const tallasArr = [];
            let faltan = false;
            inputsTallas.forEach(inp => {
                if(inp.value.trim() !== "") tallasArr.push(inp.value);
                else faltan = true;
            });
            if(faltan && !confirm("Algunas tallas están vacías. ¿Continuar?")) return;
            const tallasStr = tallasArr.join(", ");

        
            const itemReserva = {
                nombre: `Alquiler de Pista (${state.duration}h)`,
                tamano: `${state.date} ${state.timeString} | ${state.players} Personas`,
                quantity: 1,
                unit_price: parseFloat(state.price),
                subtotal: parseFloat(state.price),
                img: 'images/logo.jpg', 
                type: 'reservation', 
                extras: [], // Necesario para evitar crash en frontend
                shoe_sizes: tallasStr,

                // DATA PARA EL BACKEND
                meta_data: {
                    date: state.date,
                    time: state.timeString, 
                    lane_id: state.laneId,
                    people_count: state.players,
                    package_id: null,
                    duration: state.duration,
                    shoe_sizes: tallasStr
                }
            };

            window.paqueteUnicoParaFactura = itemReserva;

            if (typeof mostrarFactura === 'function') {
                mostrarFactura();
            } else {
                alert("Error cargando el módulo de pago.");
            }
        });
    }
});