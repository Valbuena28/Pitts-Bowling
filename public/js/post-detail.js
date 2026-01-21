const API_URL = "http://localhost:3000/api";

document.addEventListener('DOMContentLoaded', async () => {
    const postTitle = document.getElementById('post-title');
    const postAuthor = document.getElementById('post-author');
    const postDate = document.getElementById('post-date');
    const mainPostImage = document.getElementById('main-post-image');
    const postContent = document.getElementById('post-content');
    const carouselInner = document.getElementById('carousel-inner');
    const carouselDots = document.getElementById('carousel-dots');

    const urlParams = new URLSearchParams(window.location.search);
    const postSlug = urlParams.get('post');

    if (!postSlug) {
        window.location.href = 'blog.html';
        return;
    }

    try {
        // Cargar post desde la API
        const response = await fetch(`${API_URL}/posts/${postSlug}`);
        
        if (!response.ok) {
            throw new Error('Post no encontrado');
        }

        const post = await response.json();

        // Llenar contenido
        postTitle.textContent = post.title;
        postAuthor.textContent = `👤 ${post.author_name}`;
        postDate.textContent = formatDate(post.published_at);
        mainPostImage.src = post.main_image_url;
        mainPostImage.alt = post.title;
        postContent.innerHTML = post.content_html;

        // Mostrar link de redes sociales si existe
        if (post.social_link) {
            const socialLinkContainer = document.getElementById('post-social-link-container');
            const socialLink = document.getElementById('post-social-link');
            
            if (socialLinkContainer && socialLink) {
                socialLink.href = post.social_link;
                
                // Cambiar el texto y el icono según la red social
                if (post.social_link.includes('instagram')) {
                    socialLink.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                        Ver en Instagram
                    `;
                    socialLink.style.background = '#E1306C';
                } else if (post.social_link.includes('facebook')) {
                    socialLink.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        Ver en Facebook
                    `;
                    socialLink.style.background = '#1877F2';
                } else if (post.social_link.includes('twitter') || post.social_link.includes('x.com')) {
                    socialLink.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Ver en X (Twitter)
                    `;
                    socialLink.style.background = '#000000';
                } else {
                    socialLink.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                        </svg>
                        Ver publicación
                    `;
                    socialLink.style.background = '#6366F1';
                }
                
                socialLinkContainer.style.display = 'block';
            }
        }

        // Cargar galería de imágenes
        if (post.images && post.images.length > 0 && carouselInner && carouselDots) {
            carouselInner.innerHTML = '';
            carouselDots.innerHTML = '';

            post.images.forEach((img, index) => {
                const imageSrc = typeof img === 'string' ? img : img.image_url;
                
                // Crear item del carrusel
                const carouselItem = document.createElement('div');
                carouselItem.classList.add('carousel-item');
                const imgElement = document.createElement('img');
                imgElement.src = imageSrc;
                imgElement.alt = `${post.title} - Galería ${index + 1}`;
                carouselItem.appendChild(imgElement);
                carouselInner.appendChild(carouselItem);

                // Crear dot
                const dot = document.createElement('span');
                dot.classList.add('dot');
                dot.dataset.index = index;
                carouselDots.appendChild(dot);
            });

            initializeCarousel(carouselInner, carouselDots);
        }

    } catch (error) {
        console.error('Error cargando post:', error);
        alert('No se pudo cargar la noticia');
        window.location.href = 'blog.html';
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
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