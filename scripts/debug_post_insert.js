const { pool } = require('../src/db');

async function debugInsert() {
    console.log("Iniciando prueba de inserción en DB...");
    let conn;
    try {
        conn = await pool.getConnection();
        console.log("Conexión exitosa. Intentando INSERT...");

        const sql = `
            INSERT INTO posts (slug, title, subtitle, author_name, author_avatar_url, category, content_html, main_image_url, published_at, is_featured, status, external_link)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        // Simulating the values sent by the controller
        const params = [
            'test-slug-' + Date.now(), // slug
            'Test Title',              // title
            '',                        // subtitle (empty)
            'Admin',                   // author_name
            '',                        // author_avatar_url (empty)
            'noticias',                // category
            '<p>Content</p>',          // content_html
            '/images/default-news.jpg',// main_image_url
            new Date(),                // published_at
            0,                         // is_featured
            'published',               // status
            'https://google.com'       // external_link
        ];

        await conn.query(sql, params);
        console.log("¡Inserción EXITOSA! El problema NO está en la query de base de datos.");

        // Cleanup
        // await conn.query("DELETE FROM posts WHERE title = 'Test Title'");

    } catch (error) {
        console.error("❌ ERROR AL INSERTAR EN DB:");
        console.error(error);
        console.error("Código SQL State:", error.sqlState);
        console.error("Mensaje:", error.message);
    } finally {
        if (conn) conn.release();
        process.exit();
    }
}

debugInsert();
