document.addEventListener('DOMContentLoaded', () => {
    const postTitle = document.getElementById('post-title');
    const postAuthor = document.getElementById('post-author');
    const postDate = document.getElementById('post-date');
    const mainPostImage = document.getElementById('main-post-image');
    const postContent = document.getElementById('post-content');
    const carouselInner = document.getElementById('carousel-inner');
    const carouselDots = document.getElementById('carousel-dots');

    const postsData = {
        'strike-consejos': {
            title: '10 Consejos para Mejorar tu Strike',
            author: '👨‍🦰 Carlos Martínez',
            date: '14/02/2024',
            image: 'images/b1.jpg',
            content: `
                <p>Dominar el arte del strike en el bowling requiere más que solo fuerza; implica técnica, precisión y consistencia. Si buscas mejorar tu juego y ver caer esos pinos una y otra vez, has venido al lugar correcto. Aquí te presentamos 10 consejos de nivel profesional que te ayudarán a perfeccionar tu lanzamiento y aumentar tu puntuación.</p>
                <p>Desde la selección de la bola adecuada hasta la postura y el seguimiento del brazo, cada detalle cuenta. Analizaremos la importancia de encontrar tu punto de mira, mantener un ritmo constante en tu aproximación y liberar la bola con el giro correcto para maximizar el impacto. ¡Prepárate para convertirte en el rey o la reina de la pista!</p>
            `,
            carouselImages: ['images/b1.jpg', 'images/b2.jpg', 'images/b3.jpg']
        },
        'san-valentin': {
            title: 'Gran Torneo de San Valentín',
            author: '👩‍🦰 Ana García',
            date: '13/02/2024',
            image: 'images/1.jpeg',
            content: `
                <p>Parejas compitieron en nuestro torneo romántico con premios increíbles. La noche estuvo llena de amor, risas y, por supuesto, muchos strikes y spares. ¡Felicidades a todas las parejas participantes!</p>
                <p>El ambiente fue inmejorable, con música en vivo y sorpresas para todos los asistentes. Esperamos verlos en nuestro próximo evento especial.</p>
            `,
            carouselImages: ['images/1.jpeg', 'images/2.jpeg', 'images/3.jpeg']
        },
        'pistas-led': {
            title: 'Nuevas Pistas LED Instaladas',
            author: '👨‍🦱 Miguel Torres',
            date: '9/02/2024',
            image: 'images/4.jpeg',
            content: `
                <p>Hemos renovado 6 pistas con la tecnología LED más avanzada del mercado, ofreciendo una experiencia de juego inmersiva y vibrante. Las nuevas luces reaccionan a cada lanzamiento, creando un espectáculo visual único.</p>
                <p>Ven y experimenta el bowling como nunca antes. ¡Te esperamos para que pruebes nuestras nuevas pistas!</p>
            `,
            carouselImages: ['images/4.jpeg', 'images/5.png', 'images/6.jpeg']
        },
        'elegir-bola': {
            title: 'Cómo Elegir la Bola Perfecta',
            author: '👨‍🦰 Carlos Martínez',
            date: '7/02/2024',
            image: 'images/7.jpeg',
            content: `
                <p>Guía completa para seleccionar el peso y tipo de bola según tu estilo de juego. Elegir la bola adecuada es crucial para mejorar tu rendimiento y evitar lesiones. Considera tu fuerza, velocidad y técnica al hacer tu elección.</p>
                <p>Nuestros expertos están disponibles para asesorarte y ayudarte a encontrar la bola perfecta para ti. ¡No subestimes la importancia de este paso!</p>
            `,
            carouselImages: ['images/7.jpeg', 'images/8.jpeg', 'images/9.jpeg']
        },
        'liga-enero': {
            title: 'Resultados Liga Mensual Enero',
            author: '👩‍🦰 Ana García',
            date: '31/01/2024',
            image: 'images/10.jpeg',
            content: `
                <p>Conoce a los ganadores de nuestra competencia mensual y sus impresionantes puntuaciones. La liga de enero fue un éxito rotundo, con una participación masiva y un nivel de competencia muy alto.</p>
                <p>¡Felicidades a todos los participantes y especialmente a los campeones! Prepárense para la próxima liga, que promete ser aún más emocionante.</p>
            `,
            carouselImages: ['images/10.jpeg', 'images/11.jpeg', 'images/12.jpeg']
        },
        'karaoke-bowling': {
            title: 'Noche de Karaoke y Bowling',
            author: '👨‍🦱 Miguel Torres',
            date: '27/01/2024',
            image: 'images/b3.jpg',
            content: `
                <p>Una noche épica combinando bowling con karaoke que todos los asistentes recordarán. La combinación de música, diversión y bowling resultó en una experiencia inolvidable para todos.</p>
                <p>¡No te pierdas nuestras próximas noches temáticas! Siempre estamos buscando nuevas formas de hacer que tu visita sea especial.</p>
            `,
            carouselImages: ['images/b3.jpg', 'images/b1.jpg', 'images/b2.jpg']
        }
    };

    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');

    if (postId && postsData[postId]) {
        const post = postsData[postId];
        postTitle.textContent = post.title;
        postAuthor.textContent = post.author;
        postDate.textContent = post.date;
        mainPostImage.src = post.image;
        postContent.innerHTML = post.content;

        if (post.carouselImages && carouselInner && carouselDots) {
            carouselInner.innerHTML = '';
            carouselDots.innerHTML = '';

            post.carouselImages.forEach((imageSrc, index) => {
                const carouselItem = document.createElement('div');
                carouselItem.classList.add('carousel-item');
                const img = document.createElement('img');
                img.src = imageSrc;
                img.alt = post.title + ' - Galería ' + (index + 1);
                carouselItem.appendChild(img);
                carouselInner.appendChild(carouselItem);

                const dot = document.createElement('span');
                dot.classList.add('dot');
                dot.dataset.index = index;
                carouselDots.appendChild(dot);
            });

            initializeCarousel(carouselInner, carouselDots);
        }

    } else {
        window.location.href = 'blog.html';
    }

    function initializeCarousel(innerContainer, dotsContainer) {
        let currentIndex = 0;
        const items = innerContainer.querySelectorAll('.carousel-item');
        const dots = dotsContainer.querySelectorAll('.dot');
        const totalItems = items.length;

        if (totalItems === 0) return;

        // Clonar el primer y último elemento para un bucle infinito suave
        const firstItemClone = items[0].cloneNode(true);
        const lastItemClone = items[totalItems - 1].cloneNode(true);
        innerContainer.appendChild(firstItemClone);
        innerContainer.insertBefore(lastItemClone, items[0]);

        // Ajustar el índice inicial para el clon del último elemento
        currentIndex = 1;
        innerContainer.style.transition = 'none';
        innerContainer.style.transform = `translateX(-${currentIndex * 100}%)`;
        void innerContainer.offsetWidth; // Forzar reflow

        function updateCarousel() {
            innerContainer.style.transition = 'transform 0.5s ease-in-out';
            currentIndex++;
            innerContainer.style.transform = `translateX(-${currentIndex * 100}%)`;

            if (currentIndex === totalItems + 1) { // Si llegamos al clon del primer elemento
                setTimeout(() => {
                    innerContainer.style.transition = 'none';
                    currentIndex = 1; // Volver al primer elemento real
                    innerContainer.style.transform = `translateX(-${currentIndex * 100}%)`;
                }, 500); // Esperar a que termine la transición antes de saltar
            }
            updateDots();
        }

        function updateDots() {
            dots.forEach((dot, idx) => {
                dot.classList.remove('active');
                if (idx === (currentIndex - 1 + totalItems) % totalItems) {
                    dot.classList.add('active');
                }
            });
        }

        dots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                innerContainer.style.transition = 'transform 0.5s ease-in-out';
                currentIndex = parseInt(e.target.dataset.index) + 1;
                innerContainer.style.transform = `translateX(-${currentIndex * 100}%)`;
                updateDots();
            });
        });

        updateDots(); // Inicializar los puntos
        setInterval(updateCarousel, 3000); // Cambiar imagen cada 3 segundos
    }
});