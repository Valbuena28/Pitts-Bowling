// Funcionalidad principal de la página de inicio

// Animación para los contadores al hacer scroll
document.addEventListener('DOMContentLoaded', () => {
    const stats = document.querySelectorAll('.stats-banner .stat h3, .hero-stats .stat p strong');

    const animateValue = (element, start, end, duration) => {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            element.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    };
 
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const endValue = parseInt(el.textContent.replace(/[^0-9]/g, ''));
                animateValue(el, 0, endValue, 1500);
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    stats.forEach(stat => {
        observer.observe(stat);
    });

    // Bowling ball 3D hover effect
    const ball = document.querySelector('.bowling-ball');
    if (ball) {
        ball.addEventListener('mousemove', (e) => {
            const rect = ball.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            const rotateY = (x / rect.width) * 30; // Max rotation 15deg
            const rotateX = (-y / rect.height) * 30; // Max rotation 15deg
            
            ball.style.transform = `perspective(500px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
        });

        ball.addEventListener('mouseleave', () => {
            ball.style.transform = 'perspective(500px) rotateX(0) rotateY(0) scale(1)';
        });
    }
});
