// routes/user_settings.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { authRequired } = require('../middleware/auth');

// OBTENER DATOS COMPLETOS DEL PERFIL
router.get('/profile-data', authRequired, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, last_name, usuario, email FROM usuarios WHERE id = ?', 
            [req.user.id]
        );
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ msg: 'Usuario no encontrado' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error del servidor' });
    }
});

// ACTUALIZAR INFORMACIÓN PERSONAL
router.put('/update-info', authRequired, async (req, res) => {
    const { name, last_name, usuario } = req.body;

    if (!name || !last_name || !usuario) {
        return res.status(400).json({ msg: 'Todos los campos son obligatorios' });
    }

    try {
        // Verificar que el nombre de usuario no esté tomado por OTRA persona
        const [exists] = await pool.query(
            'SELECT id FROM usuarios WHERE usuario = ? AND id != ?', 
            [usuario, req.user.id]
        );
        
        if (exists.length > 0) {
            return res.status(409).json({ msg: 'Este nombre de usuario ya está en uso' });
        }

        await pool.query(
            'UPDATE usuarios SET name = ?, last_name = ?, usuario = ? WHERE id = ?',
            [name, last_name, usuario, req.user.id]
        );

        res.json({ msg: 'Información actualizada correctamente' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al actualizar perfil' });
    }
});

// CAMBIAR CONTRASEÑA
router.put('/change-password', authRequired, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ msg: 'Faltan datos' });
    }

    // Validar fuerza de contraseña (Mismas reglas que en el registro)
    if (newPassword.length < 8 || !/[0-9]/.test(newPassword) || !/[A-Z]/.test(newPassword)) {
        return res.status(400).json({ msg: 'La nueva contraseña debe tener mayúsculas, minúsculas y números (min 8 caracteres)' });
    }

    try {
        // 1. Obtener la contraseña actual de la BD
        const [rows] = await pool.query('SELECT password FROM usuarios WHERE id = ?', [req.user.id]);
        const user = rows[0];

        // 2. Verificar la contraseña actual
        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) {
            return res.status(401).json({ msg: 'La contraseña actual es incorrecta' });
        }

        // 3. Hashear la nueva y guardar
        const hashed = await bcrypt.hash(newPassword, 12);
        await pool.query('UPDATE usuarios SET password = ? WHERE id = ?', [hashed, req.user.id]);

        res.json({ msg: 'Contraseña actualizada con éxito' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al cambiar contraseña' });
    }
});

module.exports = router;