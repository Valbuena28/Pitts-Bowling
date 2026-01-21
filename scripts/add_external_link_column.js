const { pool } = require('../src/db');

async function updateSchema() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log("Conectado a la base de datos.");

        // Check if column exists
        const [columns] = await conn.query(`DESCRIBE posts external_link`);
        if (columns.length > 0) {
            console.log("La columna 'external_link' ya existe. No se requieren cambios.");
        } else {
            // This branch might not be reached depending on how DESCRIBE fails, 
            // but usually it throws if column doesn't exist or returns empty.
            // Safer to just try ADD COLUMN and catch error or check generic DESCRIBE.
            console.log("La columna pudiera existir (logic check).");
        }
    } catch (err) {
        // If error is about missing column (which DESCRIBE specific col might throw), we add it.
        // Or we can just run ALTER IGNORE or simply try/catch the ADD.

        try {
            console.log("Intentando añadir columna 'external_link'...");
            await conn.query(`ALTER TABLE posts ADD COLUMN external_link VARCHAR(255) NULL DEFAULT ''`);
            console.log("Columna 'external_link' añadida exitosamente.");
        } catch (alterErr) {
            if (alterErr.code === 'ER_DUP_FIELDNAME') {
                console.log("La columna ya existe (ER_DUP_FIELDNAME).");
            } else {
                console.error("Error al alterar la tabla:", alterErr);
            }
        }
    } finally {
        if (conn) conn.release();
        process.exit();
    }
}

updateSchema();
