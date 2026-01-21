const { pool } = require('../db');

async function addImageColumn() {
    try {
        console.log("Verificando columna image_url en categories...");
        const [columns] = await pool.query(`SHOW COLUMNS FROM categories LIKE 'image_url'`);

        if (columns.length > 0) {
            console.log("La columna image_url YA EXISTE en categories.");
        } else {
            console.log("Añadiendo columna image_url a categories...");
            await pool.query(`ALTER TABLE categories ADD COLUMN image_url VARCHAR(255) DEFAULT NULL`);
            console.log("Columna añadida con éxito.");
        }
    } catch (err) {
        console.error("Error en la migración:", err);
    } finally {
        process.exit();
    }
}

addImageColumn();
