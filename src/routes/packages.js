// src/routes/packages.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// IMPORTAR SEGURIDAD
const { authRequired, adminOnly } = require('../middleware/auth');

// Configuración de subida de imágenes
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ==========================================
// RUTAS PÚBLICAS (Cualquiera puede ver los paquetes)
// ==========================================
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM packages ORDER BY active DESC, price_cents ASC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error obteniendo paquetes' });
    }
});

// ==========================================
// RUTAS PROTEGIDAS (SOLO ADMIN)
// Se aplican los middlewares: authRequired (Logueado) -> adminOnly (Rol Admin)
// ==========================================

// POST / (Crear Paquete)
router.post('/', authRequired, adminOnly, upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, duration, max_people, active } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const priceCents = Math.round(parseFloat(price));

        await pool.query(
            `INSERT INTO packages (name, description, price_cents, duration_hours, max_people, image_url, active) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, description, priceCents, duration, max_people, imageUrl, active ? 1 : 0]
        );
        res.json({ success: true, message: "Paquete creado" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error creando paquete' });
    }
});

// PUT /:id (Editar Paquete)
router.put('/:id', authRequired, adminOnly, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, duration, max_people, active } = req.body;
        
        const priceCents = Math.round(parseFloat(price));
        let query = `UPDATE packages SET name=?, description=?, price_cents=?, duration_hours=?, max_people=?, active=?`;
        let params = [name, description, priceCents, duration, max_people, active ? 1 : 0];

        if (req.file) {
            query += `, image_url=?`;
            params.push(`/uploads/${req.file.filename}`);
        }

        query += ` WHERE id=?`;
        params.push(id);

        await pool.query(query, params);
        res.json({ success: true, message: "Paquete actualizado" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error actualizando paquete' });
    }
});

// DELETE /:id (Eliminar Paquete)
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM packages WHERE id = ?', [id]);
        res.json({ success: true, message: "Paquete eliminado" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error eliminando paquete' });
    }
});

module.exports = router;