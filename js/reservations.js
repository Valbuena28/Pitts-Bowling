// Lógica específica para la página de reservaciones

document.addEventListener('DOMContentLoaded', () => {
    // Lógica para la selección de fecha (ej. integración con un datepicker)
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) {
        // Aquí se podría integrar una librería de datepicker como flatpickr o jQuery UI Datepicker
        // Por ahora, solo un placeholder
        fechaInput.addEventListener('focus', () => {
            console.log('Campo de fecha enfocado. Aquí se abriría un calendario.');
        });
    }

    // Lógica para la selección de hora
    const timeSlots = document.querySelectorAll('.time-slot');
    timeSlots.forEach(slot => {
        slot.addEventListener('click', () => {
            timeSlots.forEach(s => s.classList.remove('selected'));
            slot.classList.add('selected');
            console.log(`Hora seleccionada: ${slot.textContent}`);
        });
    });

    // Lógica para el contador de jugadores
    const playerCounter = document.querySelector('.player-counter');
    if (playerCounter) {
        const decrementBtn = playerCounter.querySelector('button:first-child');
        const incrementBtn = playerCounter.querySelector('button:last-child');
        const playerCountSpan = playerCounter.querySelector('span');

        let playerCount = parseInt(playerCountSpan.textContent);

        decrementBtn.addEventListener('click', () => {
            if (playerCount > 1) { // Asumiendo un mínimo de 1 jugador
                playerCount--;
                playerCountSpan.textContent = playerCount;
                console.log(`Número de jugadores: ${playerCount}`);
            }
        });

        incrementBtn.addEventListener('click', () => {
            playerCount++;
            playerCountSpan.textContent = playerCount;
            console.log(`Número de jugadores: ${playerCount}`);
        });
    }

    // Lógica para el botón de reservar
    const reservarBtn = document.querySelector('.btn-block');
    if (reservarBtn) {
        reservarBtn.addEventListener('click', () => {
            console.log('Botón "Reservar por $25" clickeado.');
            // Aquí se podría añadir la lógica para procesar la reserva
            alert('Reserva simulada. ¡Gracias por tu reserva!');
        });
    }
});