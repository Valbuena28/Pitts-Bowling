// ==============================
// ==== POSTS (NOTICIAS) ========
// ==============================

// Variables globales para este módulo (pueden encapsularse mejor si se usara ES Modules)
const postForm = document.getElementById("postForm");
const postsTableBody = document.getElementById("postsTableBody");
const postMainImageFile = document.getElementById("post-main-image-file");
const postMainImagePreview = document.getElementById("post-main-image-preview");
const postGalleryFiles = document.getElementById("post-gallery-files");
const postGalleryPreview = document.getElementById("post-gallery-preview");
const postMainImageWrapper = document.getElementById("main-image-wrapper");
const postGalleryWrapper = document.getElementById("gallery-wrapper");

// Variables para almacenar info de edición
let existingMainImageUrl = null;
let existingCarouselImageUrls = [];
let existingSlug = null;

// Función para mostrar preview de imagen/video
function displayFilePreview(file, container) {
    container.innerHTML = '';
    const reader = new FileReader();
    reader.onload = (e) => {
        // Detectar tipo
        if (file.type.startsWith('image/')) {
            container.innerHTML = `<img src="${e.target.result}" style="max-width:200px; max-height:150px; border-radius:4px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">`;
        } else if (file.type.startsWith('video/')) {
            container.innerHTML = `<video src="${e.target.result}" style="max-width:200px; max-height:150px; border-radius:4px;" controls></video>`;
        }
    };
    reader.readAsDataURL(file);
}

// Inicialización de Listeners al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    // Cargar posts al iniciar
    loadPosts();

    // Listeners de preview de imagenes
    if (postMainImageFile) {
        postMainImageFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                displayFilePreview(file, postMainImagePreview);
                // Add class to hide placeholder if needed or style via CSS using :has or sibling
                postMainImageWrapper.classList.add('has-file');
            } else {
                postMainImagePreview.innerHTML = '';
                postMainImageWrapper.classList.remove('has-file');
            }
        });
    }

    if (postGalleryFiles) {
        postGalleryFiles.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            postGalleryPreview.innerHTML = '';
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const preview = document.createElement('div');
                    preview.className = 'gallery-preview-item';
                    if (file.type.startsWith('image/')) {
                        preview.innerHTML = `<img src="${ev.target.result}">`;
                    } else if (file.type.startsWith('video/')) {
                        preview.innerHTML = `<video src="${ev.target.result}"></video>`;
                    }
                    postGalleryPreview.appendChild(preview);
                };
                reader.readAsDataURL(file);
            });
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const preview = document.createElement('div');
                    preview.className = 'gallery-preview-item';
                    if (file.type.startsWith('image/')) {
                        preview.innerHTML = `<img src="${ev.target.result}">`;
                    } else if (file.type.startsWith('video/')) {
                        preview.innerHTML = `<video src="${ev.target.result}"></video>`;
                    }
                    postGalleryPreview.appendChild(preview);
                };
                reader.readAsDataURL(file);
            });
            if (files.length > 0) postGalleryWrapper.classList.add('has-files');
        });
    }

    // Botón reset/nuevo
    const postResetBtn = document.getElementById("post-reset");
    if (postResetBtn) {
        postResetBtn.addEventListener("click", resetPostForm);
    }

    // Form Submit
    if (postForm) {
        postForm.addEventListener("submit", handlePostSubmit);
    }
});

async function loadPosts() {
    try {
        const posts = await fetchData(`${API_URL}/posts/admin`);
        postsTableBody.innerHTML = "";

        posts.forEach((post) => {
            const featuredLabel = post.is_featured ? `<span class="badge badge-featured">Destacado</span>` : "";
            const publishedDate = formatDateTime12h(post.published_at);

            const categoryLabels = {
                'tecnicas': 'Tips & Técnicas',
                'eventos': 'Eventos',
                'noticias': 'Noticias',
                'torneos': 'Torneos'
            };

            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td style="font-weight:600;">${escapeHtml(post.title)}</td>
        <td><span class="badge badge-category">${categoryLabels[post.category] || post.category}</span></td>
        <td>${publishedDate}</td>
        <td>${featuredLabel}</td>
        <td>
          <div class="action-buttons">
            <button type="button" class="btn-edit" data-id="${post.id}" title="Editar">✏️</button>
            <button type="button" class="btn-delete" data-id="${post.id}" title="Eliminar">🗑️</button>
          </div>
        </td>
      `;
            postsTableBody.appendChild(tr);
        });

        // Event Delegation for Edit/Delete buttons
        postsTableBody.onclick = (e) => {
            const editBtn = e.target.closest('.btn-edit');
            const deleteBtn = e.target.closest('.btn-delete');

            if (editBtn) {
                const id = editBtn.getAttribute('data-id');
                editPost(id);
            } else if (deleteBtn) {
                const id = deleteBtn.getAttribute('data-id');
                deletePost(id);
            }
        };
    } catch (err) {
        console.error("Error cargando posts:", err);
    }
}

async function handlePostSubmit(e) {
    e.preventDefault();

    const postId = document.getElementById("post-id").value;
    const formData = new FormData();
    if (existingSlug) {
        formData.append("slug", existingSlug);
    }


    formData.append("title", document.getElementById("post-title").value.trim());
    formData.append("subtitle", ""); // Removed from UI
    formData.append("author_name", "Admin"); // Default
    formData.append("author_avatar_url", ""); // Removed
    formData.append("category", document.getElementById("post-category").value);
    formData.append("content_html", document.getElementById("post-content").value.trim());
    formData.append("published_at", document.getElementById("post-published").value);
    formData.append("is_featured", document.getElementById("post-featured").checked ? "1" : "0");
    formData.append("external_link", document.getElementById("post-social-link").value.trim());
    formData.append("status", "published");

    // Imagen principal
    const mainImageFile = postMainImageFile.files[0];


    // Simplified Validation: Only Title is strictly required by frontend alert
    // Backend will handle defaults for others.
    if (!formData.get("title")) {
        alert("El Título es obligatorio.");
        return;
    }

    // Imagen principal
    if (mainImageFile) {
        formData.append("main_image", mainImageFile);
    } else if (existingMainImageUrl) {
        formData.append("existing_main_image_url", existingMainImageUrl);
    }

    // Galería
    const galleryFiles = Array.from(postGalleryFiles.files);
    galleryFiles.forEach(file => {
        formData.append("carousel_images", file);
    });

    if (galleryFiles.length === 0 && existingCarouselImageUrls.length > 0) {
        formData.append("existing_carousel_images", JSON.stringify(existingCarouselImageUrls));
    }

    // Tags
    const tagsText = document.getElementById("post-tags").value.trim();
    if (tagsText) {
        formData.append("tags", tagsText);
    }

    try {
        if (postId) {
            await fetchData(`${API_URL}/posts/${postId}`, {
                method: "PUT",
                body: formData,
                credentials: "include"
            });
            alert("¡Noticia actualizada exitosamente!");
        } else {
            await fetchData(`${API_URL}/posts`, {
                method: "POST",
                body: formData,
                credentials: "include"
            });
            alert("¡Noticia creada exitosamente!");
        }

        resetPostForm();
        await loadPosts();
    } catch (err) {
        console.error("Error guardando noticia:", err);
        alert("Error al guardar la noticia. Revisa la consola.");
    }
}

function resetPostForm() {
    postForm.reset();
    document.getElementById("post-id").value = "";
    postMainImagePreview.innerHTML = '';
    postGalleryPreview.innerHTML = '';
    existingMainImageUrl = null;
    existingCarouselImageUrls = [];
    existingSlug = null;
    if (postMainImageWrapper) postMainImageWrapper.classList.remove('has-file');
    if (postGalleryWrapper) postGalleryWrapper.classList.remove('has-files');
}

window.editPost = async function (id) {
    try {
        const post = await fetchData(`${API_URL}/posts/admin/${id}`);

        if (!post) {
            alert("Noticia no encontrada");
            return;
        }

        document.getElementById("post-id").value = post.id;
        existingSlug = post.slug;

        document.getElementById("post-title").value = post.title;
        // Subtitle removed
        // Author removed
        // Author Avatar removed
        document.getElementById("post-category").value = post.category;
        // Main Image URL input removed

        existingMainImageUrl = post.main_image_url;

        // Preview Main Image
        if (post.main_image_url) {
            const isVideo = post.main_image_url.match(/\.(mp4|mov|avi|wmv|flv|webm)$/i);
            if (isVideo) {
                postMainImagePreview.innerHTML = `<video src="${post.main_image_url}" style="max-width:200px; max-height:150px; border-radius:4px;" controls></video>`;
            } else {
                postMainImagePreview.innerHTML = `<img src="${post.main_image_url}" style="max-width:100%; max-height:100%; object-fit:cover; border-radius:4px;">`;
            }
            postMainImageWrapper.classList.add('has-file');
        } else {
            postMainImagePreview.innerHTML = '';
            postMainImageWrapper.classList.remove('has-file');
        }

        // Date
        const date = new Date(post.published_at);
        const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        document.getElementById("post-published").value = localDateTime;

        document.getElementById("post-featured").checked = post.is_featured === 1;
        document.getElementById("post-social-link").value = post.external_link || "";
        document.getElementById("post-content").value = post.content_html;

        // Carousel
        existingCarouselImageUrls = post.images.map(img => img.image_url);
        // Post images text area removed

        postGalleryPreview.innerHTML = '';
        existingCarouselImageUrls.forEach(url => {
            const preview = document.createElement('div');
            preview.className = 'gallery-preview-item';
            const isVideo = url.match(/\.(mp4|mov|avi|wmv|flv|webm)$/i);
            if (isVideo) {
                preview.innerHTML = `<video src="${url}"></video>`;
            } else {
                preview.innerHTML = `<img src="${url}">`;
            }
            postGalleryPreview.appendChild(preview);
        });

        document.getElementById("post-tags").value = post.tags.join(', ');

        postMainImageFile.value = '';
        postGalleryFiles.value = '';

        // Switch tab to posts if not already active (although button is in posts tab)
        // Scroll to top of form
        postForm.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
        console.error("Error cargando noticia para editar:", err);
        alert("Error al cargar la noticia");
    }
};

window.deletePost = async function (id) {
    if (!confirm("¿Estás seguro de eliminar esta noticia?")) return;

    try {
        await fetchData(`${API_URL}/posts/${id}`, {
            method: "DELETE",
            credentials: "include"
        });
        alert("Noticia eliminada");
        await loadPosts();
    } catch (err) {
        console.error("Error eliminando noticia:", err);
        alert("Error al eliminar la noticia");
    }
};
