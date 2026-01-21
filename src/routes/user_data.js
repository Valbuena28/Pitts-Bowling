// src/routes/user_data.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const { authRequired } = require("../middleware/auth"); 

// Helper para obtener notas
async function getNotesForRef(userId, refId, refType) {
    const [rows] = await pool.query(
        `SELECT id, message, created_at, is_read 
         FROM order_notes 
         WHERE user_id = ? AND ref_id = ? AND ref_type = ? 
         ORDER BY created_at ASC`, // Orden cronológico (chat)
        [userId, refId, refType]
    );
    return rows;
}

// 1. Obtener MIS Reservas (Con Notificaciones)
router.get("/reservations", authRequired, async (req, res) => {
    const userId = req.user.id; 
    try {
        const query = `
            SELECT 
                r.*, 
                p.name as package_name,
                l.name as lane_name,
                l.lane_number
            FROM reservations r
            LEFT JOIN packages p ON r.package_id = p.id
            LEFT JOIN reservation_lanes rl ON r.id = rl.reservation_id
            LEFT JOIN lanes l ON rl.lane_id = l.id
            WHERE r.user_id = ?
            ORDER BY r.start_time DESC
        `;
        const [rows] = await pool.query(query, [userId]);

        // Inyectar notificaciones
        for (let row of rows) {
            const notes = await getNotesForRef(userId, row.id, 'reservation');
            row.notes_history = notes;
            // Contar no leídas
            row.unread_count = notes.filter(n => n.is_read === 0).length;
        }

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al obtener reservas" });
    }
});

// 2. Obtener MIS Pedidos (Con Notificaciones)
router.get("/orders", authRequired, async (req, res) => {
    const userId = req.user.id;
    try {
        const [rows] = await pool.query(`
            SELECT DISTINCT i.* FROM invoices i
            JOIN details_invoice di ON i.id = di.invoice_id
            WHERE i.usuario_id = ?
            ORDER BY i.date DESC
        `, [userId]);
        
        for (let order of rows) {
            // Detalles de comida
            const [details] = await pool.query(`
                SELECT di.quantity, di.subtotal, di.size_name, f.name as food_name
                FROM details_invoice di
                JOIN foods f ON di.food_id = f.id
                WHERE di.invoice_id = ?
            `, [order.id]);
            order.items = details; 

            // Notificaciones
            const notes = await getNotesForRef(userId, order.id, 'invoice');
            order.notes_history = notes;
            order.unread_count = notes.filter(n => n.is_read === 0).length;
        }

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al obtener pedidos" });
    }
});

// 3. Marcar mensajes como LEÍDOS
router.put("/mark-read", authRequired, async (req, res) => {
    const { ref_id, ref_type } = req.body;
    const userId = req.user.id;

    if (!ref_id || !ref_type) return res.status(400).json({ msg: "Datos faltantes" });

    try {
        await pool.query(
            `UPDATE order_notes SET is_read = 1 
             WHERE user_id = ? AND ref_id = ? AND ref_type = ?`,
            [userId, ref_id, ref_type]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Error DB" });
    }
});

// 4. Obtener CONTEO TOTAL de mensajes no leídos (Para el Header Global)
router.get("/notifications/unread-count", authRequired, async (req, res) => {
    const userId = req.user.id;
    try {
        const [rows] = await pool.query(
            "SELECT COUNT(*) as total FROM order_notes WHERE user_id = ? AND is_read = 0",
            [userId]
        );
        res.json({ total: rows[0].total });
    } catch (err) {
        console.error(err);
        res.status(500).json({ total: 0 });
    }
});

module.exports = router;