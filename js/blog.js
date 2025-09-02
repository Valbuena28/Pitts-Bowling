document.addEventListener('DOMContentLoaded', () => {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const archiveLinks = document.querySelectorAll('.archive-links a');
    const posts = document.querySelectorAll('.post-link');

    // Filtrado por categoría
    filterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();

            // Manejar clase activa en botones de filtro
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const filter = button.dataset.filter;

            // Filtrar posts
            posts.forEach(post => {
                if (filter === 'all' || post.dataset.category === filter) {
                    post.style.display = 'block';
                } else {
                    post.style.display = 'none';
                }
            });
        });
    });

    // Filtrado por fecha
    archiveLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // Manejar clase activa (si se desea)
            // archiveLinks.forEach(l => l.classList.remove('active'));
            // link.classList.add('active');

            const dateFilter = link.dataset.dateFilter; // e.g., "2024-01"

            posts.forEach(post => {
                const postDate = post.dataset.date; // e.g., "2024-01-31"
                if (postDate.startsWith(dateFilter)) {
                    post.style.display = 'block';
                } else {
                    post.style.display = 'none';
                }
            });
        });
    });
});
