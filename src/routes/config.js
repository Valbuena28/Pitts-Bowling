const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Ensure config table exists (Lazy migration)
const initConfigTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS config (
                id INT AUTO_INCREMENT PRIMARY KEY,
                key_name VARCHAR(50) UNIQUE NOT NULL,
                value VARCHAR(255) NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        // Insert default if not exists
        await pool.query(`
            INSERT IGNORE INTO config (key_name, value) VALUES ('tasa_bcv', '60.00')
        `);
    } catch (err) {
        console.error("Error initializing config table:", err);
    }
};

// Run init
initConfigTable();

// GET /api/config/tasa
router.get('/tasa', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT value FROM config WHERE key_name = 'tasa_bcv'");
        const tasa = rows.length > 0 ? parseFloat(rows[0].value) : 60.00;
        res.json({ tasa });
    } catch (error) {
        console.error("Error fetching tasa:", error);
        res.status(500).json({ error: "Error fetching tasa" });
    }
});

// POST /api/config/tasa (Admin only - basic protection via session should be added if not global)
router.post('/tasa', async (req, res) => {
    const { tasa } = req.body;
    if (!tasa || isNaN(tasa)) {
        return res.status(400).json({ error: "Invalid rate" });
    }

    try {
        await pool.query(
            "INSERT INTO config (key_name, value) VALUES ('tasa_bcv', ?) ON DUPLICATE KEY UPDATE value = ?",
            [tasa, tasa]
        );
        res.json({ message: "Tasa actualizada", tasa });
    } catch (error) {
        console.error("Error updating tasa:", error);
        res.status(500).json({ error: "Error updating tasa" });
    }
});

// GET /api/config/delivery
router.get('/delivery', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT value FROM config WHERE key_name = 'delivery_config'");
        const defaultConfig = {
            km_base: 5,        // 5km gratis
            precio_base: 2.00, // $2 minimo
            precio_km: 0.50,   // $0.50 por km adicional
            distancia_max: 20  // 20km max
        };
        const config = rows.length > 0 ? JSON.parse(rows[0].value) : defaultConfig;
        res.json(config);
    } catch (error) {
        console.error("Error fetching delivery config:", error);
        res.status(500).json({ error: "Error fetching config" });
    }
});

// POST /api/config/delivery (Admin only)
router.post('/delivery', async (req, res) => {
    const { km_base, precio_base, precio_km, distancia_max } = req.body;

    // Validaciones básicas
    if ([km_base, precio_base, precio_km, distancia_max].some(v => v === undefined || v === null || isNaN(v))) {
        return res.status(400).json({ error: "Datos inválidos" });
    }

    const config = JSON.stringify({
        km_base: Number(km_base),
        precio_base: Number(precio_base),
        precio_km: Number(precio_km),
        distancia_max: Number(distancia_max)
    });

    try {
        await pool.query(
            "INSERT INTO config (key_name, value) VALUES ('delivery_config', ?) ON DUPLICATE KEY UPDATE value = ?",
            [config, config]
        );
        res.json({ message: "Configuración actualizada", config: JSON.parse(config) });
    } catch (error) {
        console.error("Error updating delivery config:", error);
        res.status(500).json({ error: "Error updating config" });
    }
});

module.exports = router;
