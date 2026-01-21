const { pool: db } = require('../db');
const path = require('path');
const fs = require('fs');

// Helper para eliminar archivos subidos si hay un error
const deleteUploadedFiles = (files) => {
    if (files) {
        if (files.main_image && files.main_image[0]) {
            fs.unlink(files.main_image[0].path, (err) => {
                if (err) console.error("Error al eliminar main_image:", err);
            });
        }
        if (files.carousel_images) {
            files.carousel_images.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error("Error al eliminar carousel_image:", err);
                });
            });
        }
    }
};

// Obtener todas las noticias (público)
exports.getPosts = async (req, res) => {
    const { category, featured, limit, offset, search } = req.query;
    let sql = `
        SELECT id, slug, title, subtitle, author_name, category, main_image_url, published_at, is_featured, external_link
        FROM posts
        WHERE status = 'published'
    `;
    const params = [];

    if (category) {
        sql += ` AND category = ?`;
        params.push(category);
    }
    if (featured === '1') {
        sql += ` AND is_featured = 1`;
    }
    if (search) {
        sql += ` AND (title LIKE ? OR subtitle LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY published_at DESC`;

    if (limit) {
        sql += ` LIMIT ?`;
        params.push(parseInt(limit));
    }
    if (offset) {
        sql += ` OFFSET ?`;
        params.push(parseInt(offset));
    }

    try {
        const [rows] = await db.query(sql, params);
        const [totalRows] = await db.query(`SELECT COUNT(*) AS total FROM posts WHERE status = 'published' ${category ? `AND category = '${category}'` : ''}`);
        res.json({ items: rows, total: totalRows[0].total });
    } catch (error) {
        console.error('Error al obtener posts:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// Obtener una noticia por slug (público)
exports.getPostBySlug = async (req, res) => {
    const { slug } = req.params;
    try {
        const [postRows] = await db.query(`
            SELECT id, slug, title, subtitle, author_name, author_avatar_url, category, content_html, main_image_url, published_at, is_featured, external_link
            FROM posts
            WHERE slug = ? AND status = 'published'
            LIMIT 1
        `, [slug]);

        if (postRows.length === 0) {
            return res.status(404).json({ message: 'Noticia no encontrada' });
        }

        const post = postRows[0];

        const [imageRows] = await db.query(`
            SELECT image_url, sort_order
            FROM post_images
            WHERE post_id = ?
            ORDER BY sort_order ASC, id ASC
        `, [post.id]);

        const [tagRows] = await db.query(`
            SELECT tag
            FROM post_tags
            WHERE post_id = ?
            ORDER BY id ASC
        `, [post.id]);

        post.images = imageRows;
        post.tags = tagRows.map(row => row.tag);

        res.json(post);
    } catch (error) {
        console.error('Error al obtener post por slug:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// Obtener una noticia por ID (para administración)
exports.getPostById = async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch basic post data
        const [postRows] = await db.query(`
            SELECT id, slug, title, subtitle, author_name, author_avatar_url, category, content_html, main_image_url, published_at, is_featured, external_link, status
            FROM posts
            WHERE id = ?
            LIMIT 1
        `, [id]);

        if (postRows.length === 0) {
            return res.status(404).json({ message: 'Noticia no encontrada' });
        }

        const post = postRows[0];

        // Fetch images
        const [imageRows] = await db.query(`
            SELECT image_url, sort_order
            FROM post_images
            WHERE post_id = ?
            ORDER BY sort_order ASC, id ASC
        `, [id]);

        // Fetch tags
        const [tagRows] = await db.query(`
            SELECT tag
            FROM post_tags
            WHERE post_id = ?
            ORDER BY id ASC
        `, [id]);

        post.images = imageRows;
        post.tags = tagRows.map(row => row.tag);

        res.json(post);
    } catch (error) {
        console.error('Error al obtener post por ID:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// Obtener todas las noticias para el panel de administración
exports.getAdminPosts = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, slug, title, category, published_at, is_featured, status
            FROM posts
            ORDER BY published_at DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener posts para admin:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// Crear una nueva noticia (ROBUST)
exports.createPost = async (req, res) => {
    let {
        slug, title, subtitle, author_name, author_avatar_url, category,
        content_html, published_at, is_featured, status, tags, external_link,
        main_image_url
    } = req.body;

    const mainImageFile = req.files['main_image'] ? req.files['main_image'][0] : null;
    const carouselImageFiles = req.files['carousel_images'] || [];

    // 1. Imagen Principal: Archivo > URL Manual > URL en cuerpo > Default
    let finalMainImageUrl = '/images/default-news.jpg';
    if (mainImageFile) {
        finalMainImageUrl = `/uploads/${mainImageFile.filename}`;
    } else if (main_image_url) {
        finalMainImageUrl = main_image_url;
    }

    // 2. Valores por defecto (Robustez)
    if (!title) {
        deleteUploadedFiles(req.files);
        return res.status(400).json({ message: 'El Título es obligatorio.' });
    }

    // Generar Slug si falta
    if (!slug) {
        slug = title.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
        // Añadir sufijo timestamp para unicidad
        slug += `-${Date.now()}`;
    }

    if (!author_name) author_name = "Admin";
    if (!published_at) published_at = new Date();
    if (!category) category = 'noticias';

    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const [result] = await conn.query(`
            INSERT INTO posts (slug, title, subtitle, author_name, author_avatar_url, category, content_html, main_image_url, published_at, is_featured, status, external_link)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            slug, title, subtitle || '', author_name, author_avatar_url || '', category,
            content_html || '', finalMainImageUrl, published_at, is_featured || 0, status || 'published', external_link || ''
        ]);

        const postId = result.insertId;

        // Imágenes Carrusel
        if (carouselImageFiles.length > 0) {
            const imageValues = carouselImageFiles.map((file, index) => [
                postId,
                `/uploads/${file.filename}`,
                index
            ]);
            await conn.query(`INSERT INTO post_images (post_id, image_url, sort_order) VALUES ?`, [imageValues]);
        }

        // Tags
        if (tags && tags.length > 0) {
            const tagValues = tags.split(',').map(tag => [postId, tag.trim()]);
            await conn.query(`INSERT INTO post_tags (post_id, tag) VALUES ?`, [tagValues]);
        }

        await conn.commit();
        res.status(201).json({ message: 'Noticia creada exitosamente', postId });
    } catch (error) {
        if (conn) await conn.rollback();
        deleteUploadedFiles(req.files);
        console.error('Error createPost:', error);

        let msg = 'Error al crear la noticia';
        if (error.code === 'ER_DUP_ENTRY') msg = 'Ya existe una noticia con ese título autogenerado o slug. Intente cambiar el título levemente.';
        if (error.code === 'ER_TRUNCATED_WRONG_VALUE') msg = 'Valor incorrecto en uno de los campos.';

        res.status(500).json({ message: msg, debug: error.message });
    } finally {
        if (conn) conn.release();
    }
};

// Actualizar noticia (ROBUST)
exports.updatePost = async (req, res) => {
    const { id } = req.params;
    let {
        slug, title, subtitle, author_name, author_avatar_url, category,
        content_html, published_at, is_featured, status, tags, external_link,
        main_image_url, existing_main_image_url, existing_carousel_images
    } = req.body;

    const mainImageFile = req.files['main_image'] ? req.files['main_image'][0] : null;
    const carouselImageFiles = req.files['carousel_images'] || [];

    // 1. Determinar imagen principal final
    let finalMainImageUrl = existing_main_image_url;
    if (mainImageFile) {
        finalMainImageUrl = `/uploads/${mainImageFile.filename}`;
    } else if (main_image_url) {
        finalMainImageUrl = main_image_url;
    }

    // Si sigue nulo/vacio y no había existente, poner default
    if (!finalMainImageUrl) finalMainImageUrl = '/images/default-news.jpg';

    // 2. Validar mínimos
    if (!title) {
        deleteUploadedFiles(req.files);
        return res.status(400).json({ message: 'El Título es obligatorio.' });
    }

    // Defaults si se enviaron vacíos
    if (!slug) {
        slug = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
        // No añadimos timestamp al update para no cambiar URLs existentes innecesariamente salvo que se pida
    }
    if (!author_name) author_name = "Admin";
    if (!published_at) published_at = new Date();

    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        await conn.query(`
            UPDATE posts
            SET slug = ?, title = ?, subtitle = ?, author_name = ?, author_avatar_url = ?, category = ?,
                content_html = ?, main_image_url = ?, published_at = ?, is_featured = ?, status = ?, external_link = ?
            WHERE id = ?
        `, [
            slug, title, subtitle || '', author_name, author_avatar_url || '', category,
            content_html || '', finalMainImageUrl, published_at, is_featured || 0, status || 'published', external_link || '', id
        ]);

        // Carrusel: Borrar y reinsertar
        await conn.query(`DELETE FROM post_images WHERE post_id = ?`, [id]);

        let newCarouselImages = [];
        try {
            if (existing_carousel_images) {
                newCarouselImages = JSON.parse(existing_carousel_images);
            }
        } catch (e) { }

        // Añadir nuevas subidas
        const newUploaded = carouselImageFiles.map((file) => ({
            image_url: `/uploads/${file.filename}`
        }));

        const allCarousel = [...newCarouselImages, ...newUploaded];

        if (allCarousel.length > 0) {
            const imageValues = allCarousel.map((img, index) => {
                const url = typeof img === 'string' ? img : img.image_url;
                return [id, url, index];
            });
            await conn.query(`INSERT INTO post_images (post_id, image_url, sort_order) VALUES ?`, [imageValues]);
        }

        // Tags
        await conn.query(`DELETE FROM post_tags WHERE post_id = ?`, [id]);
        if (tags && tags.length > 0) {
            const tagValues = tags.split(',').map(tag => [id, tag.trim()]);
            await conn.query(`INSERT INTO post_tags (post_id, tag) VALUES ?`, [tagValues]);
        }

        await conn.commit();
        res.json({ message: 'Noticia actualizada exitosamente' });
    } catch (error) {
        if (conn) await conn.rollback();
        deleteUploadedFiles(req.files);
        console.error('Error updatePost:', error);
        res.status(500).json({ message: 'Error al actualizar la noticia', debug: error.message });
    } finally {
        if (conn) conn.release();
    }
};

// Eliminar una noticia
exports.deletePost = async (req, res) => {
    const { id } = req.params;
    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        // Obtener URLs de imágenes para eliminarlas del sistema de archivos
        const [imageRows] = await conn.query(`SELECT image_url FROM post_images WHERE post_id = ?`, [id]);
        const [postRow] = await conn.query(`SELECT main_image_url FROM posts WHERE id = ?`, [id]);

        await conn.query(`DELETE FROM posts WHERE id = ?`, [id]);

        await conn.commit();

        // Eliminar archivos del sistema de archivos después de la confirmación de la DB
        if (postRow.length > 0 && postRow[0].main_image_url && postRow[0].main_image_url.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '..', postRow[0].main_image_url); // path relative to src/..
            fs.unlink(filePath, (err) => {
                // ignorar error si no existe
            });
        }
        imageRows.forEach(row => {
            if (row.image_url.startsWith('/uploads/')) {
                const filePath = path.join(__dirname, '..', row.image_url);
                fs.unlink(filePath, (err) => { });
            }
        });

        res.json({ message: 'Noticia eliminada exitosamente' });
    } catch (error) {
        if (conn) await conn.rollback();
        console.error('Error al eliminar post:', error);
        res.status(500).json({ message: 'Error interno del servidor al eliminar la noticia' });
    } finally {
        if (conn) conn.release();
    }
};