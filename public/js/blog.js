(() => {
    const API_URL = "/api"; // Relative path to work on any port/host

    document.addEventListener('DOMContentLoaded', async () => {
        const filterButtons = document.querySelectorAll('.filter-btn');
        const featuredPostContainer = document.getElementById('featured-post-container');
        const postsGridContainer = document.getElementById('posts-grid-container');

        let allPosts = [];
        let currentFilter = 'all';

        // Cargar posts desde la API
        async function loadPosts() {
            // console.log("Iniciando loadPosts...");
            try {
                // console.log("Haciendo fetch a:", `${API_URL}/posts?limit=50`);
                const response = await fetch(`${API_URL}/posts?limit=50`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const data = await response.json();
                allPosts = data.items || [];
                // console.log("Posts cargados:", allPosts.length);

                if (allPosts.length === 0) {
                    if (postsGridContainer) postsGridContainer.innerHTML = '<p style="text-align:center; padding: 20px;">No hay noticias publicadas aún.</p>';
                    return;
                }

                renderPosts(allPosts);
            } catch (error) {
                console.error('Error cargando posts:', error);
                if (postsGridContainer) postsGridContainer.innerHTML = '<div style="text-align:center; padding:20px; color:red;">Error al cargar las noticias. Por favor intenta más tarde.</div>';
            }
        }

        // Renderizar posts
        function renderPosts(posts) {
            if (!featuredPostContainer || !postsGridContainer) return;

            featuredPostContainer.innerHTML = '';
            postsGridContainer.innerHTML = '';

            if (!posts || posts.length === 0) {
                return; // handled by filter logic
            }

            // Separar posts destacados y normales
            const featuredPosts = posts.filter(p => p.is_featured);
            const regularPosts = posts.filter(p => !p.is_featured);

            // Renderizar posts destacados
            if (featuredPosts.length > 0) {
                featuredPostContainer.innerHTML = createFeaturedPostHTML(featuredPosts[0]); // Solo el primer destacado
            }

            // Renderizar posts normales
            if (regularPosts.length > 0) {
                regularPosts.forEach(post => {
                    postsGridContainer.innerHTML += createRegularPostHTML(post);
                });
            }
        }

        // Crear HTML para post destacado
        function createFeaturedPostHTML(post) {
            const categoryLabels = {
                'tecnicas': 'Tips & Técnicas',
                'eventos': 'Eventos',
                'noticias': 'Noticias',
                'torneos': 'Torneos'
            };

            const formattedDate = formatDate(post.published_at);
            const linkHref = post.external_link ? post.external_link : `post-detail.html?post=${post.slug}`;
            const targetAttr = post.external_link ? 'target="_blank" rel="noopener noreferrer"' : '';

            return `
                <a href="${linkHref}" class="post-link featured-post" data-category="${post.category}" data-date="${post.published_at}" ${targetAttr}>
                    <div class="featured-post-image">
                        <img src="${post.main_image_url}" alt="${post.title}">
                    </div>
                    <div class="featured-post-content">
                        <div class="post-meta">
                            <span class="tag tag-blue">Destacado</span>
                            <span>${categoryLabels[post.category] || post.category}</span>
                        </div>
                        <h2>${post.title}</h2>
                        ${post.subtitle ? `<p>${post.subtitle}</p>` : ''}
                        <div class="author-info">
                            <span>${post.author_name}</span>
                            <span>${formattedDate}</span>
                        </div>
                    </div>
                </a>
            `;
        }

        // Crear HTML para post regular
        function createRegularPostHTML(post) {
            const categoryLabels = {
                'tecnicas': 'Tips & Técnicas',
                'eventos': 'Eventos',
                'noticias': 'Noticias',
                'torneos': 'Torneos'
            };

            const categoryColors = {
                'tecnicas': 'tag-blue',
                'eventos': 'tag-green',
                'noticias': 'tag-orange',
                'torneos': 'tag-purple'
            };

            const formattedDate = formatDate(post.published_at);
            const linkHref = post.external_link ? post.external_link : `post-detail.html?post=${post.slug}`;
            const targetAttr = post.external_link ? 'target="_blank" rel="noopener noreferrer"' : '';

            return `
                <a href="${linkHref}" class="post-link post-card" data-category="${post.category}" data-date="${post.published_at}" ${targetAttr}>
                    <div class="post-card-image">
                        <img src="${post.main_image_url}" alt="${post.title}">
                    </div>
                    <div class="post-card-content">
                        <div class="post-meta">
                            <span class="tag ${categoryColors[post.category] || 'tag-blue'}">${categoryLabels[post.category] || post.category}</span>
                            <span>${post.author_name}</span>
                        </div>
                        <h3>${post.title}</h3>
                        ${post.subtitle ? `<p>${post.subtitle}</p>` : ''}
                        <div class="author-info">
                            <span>${formattedDate}</span>
                        </div>
                    </div>
                </a>
            `;
        }

        // Formatear fecha
        function formatDate(dateString) {
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }

        // Filtrado por categoría
        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();

                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                const filter = button.dataset.filter;
                currentFilter = filter;

                // console.log(`Filtrando por: ${filter}`); // Debug

                let filtered = [];
                if (filter === 'all') {
                    filtered = allPosts;
                } else {
                    // Usar comparación estricta pero asegurando que tenemos datos
                    filtered = allPosts.filter(post => post.category === filter);
                }

                // console.log(`Resultados encontrados: ${filtered.length}`); // Debug

                if (filtered.length === 0) {
                    // Limpiar contenedores y mostrar mensaje
                    if (featuredPostContainer) featuredPostContainer.innerHTML = '';
                    if (postsGridContainer) {
                        postsGridContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;">
                            <p style="font-size: 1.2rem;">🔍 No hay noticias en esta categoría.</p>
                         </div>`;
                    }
                } else {
                    renderPosts(filtered);
                }
            });
        });

        // Calendar / Archive Logic
        function renderCalendar(posts) {
            const archiveLinksContainer = document.querySelector('.archive-links');
            if (!archiveLinksContainer) return;

            archiveLinksContainer.innerHTML = '';

            // Group posts by YYYY-MM
            const groups = {};
            posts.forEach(post => {
                const date = new Date(post.published_at);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const key = `${year}-${month}`;

                if (!groups[key]) {
                    groups[key] = {
                        count: 0,
                        year: year,
                        monthName: date.toLocaleString('es-ES', { month: 'long' }),
                        key: key
                    };
                }
                groups[key].count++;
            });

            // Sort keys descending (newest first)
            const sortedKeys = Object.keys(groups).sort().reverse();

            if (sortedKeys.length === 0) {
                archiveLinksContainer.innerHTML = '<span style="color:#888; font-size:0.9rem;">No hay fechas disponibles</span>';
                return;
            }

            sortedKeys.forEach(key => {
                const g = groups[key];
                const link = document.createElement('a');
                link.href = '#';
                // Capitalize month name
                const monthCapitalized = g.monthName.charAt(0).toUpperCase() + g.monthName.slice(1);
                link.textContent = `${monthCapitalized} ${g.year} (${g.count})`;
                link.dataset.dateFilter = key; // yyyy-mm

                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Filter by this date
                    // Update active state in calendar? (Optional)
                    document.querySelectorAll('.archive-links a').forEach(a => a.style.fontWeight = 'normal');
                    link.style.fontWeight = 'bold';

                    // Remove category active
                    filterButtons.forEach(btn => btn.classList.remove('active'));

                    const filtered = allPosts.filter(p => p.published_at.startsWith(key));
                    renderPosts(filtered);

                    // Scroll to posts
                    if (postsGridContainer) postsGridContainer.scrollIntoView({ behavior: 'smooth' });
                });

                archiveLinksContainer.appendChild(link);
            });
        }

        // Cargar posts al iniciar
        // console.log("Llamando a loadPosts desde main...");
        await loadPosts();
        // console.log("loadPosts finalizado. Llamando a renderCalendar...");
        // Only render calendar once properly loaded
        renderCalendar(allPosts);
        // console.log("renderCalendar finalizado.");
    });
})();