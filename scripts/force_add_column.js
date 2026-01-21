const { pool } = require('../src/db');

async function forceUpdate() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log("Attempting to add column 'external_link'...");

        // Use a direct ALTER TABLE. If it exists, it will error, which we catch.
        await conn.query(`ALTER TABLE posts ADD COLUMN external_link VARCHAR(255) NULL DEFAULT ''`);

        console.log("✅ Columna 'external_link' añadida correctamente.");
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log("⚠️ La columna ya existe (ER_DUP_FIELDNAME).");
        } else {
            console.error("❌ Error FATAL al alterar tabla:");
            console.error(err);
        }
    } finally {
        if (conn) conn.release();
        process.exit();
    }
}

forceUpdate();
