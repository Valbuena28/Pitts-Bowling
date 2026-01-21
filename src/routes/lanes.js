// routes/lanes.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// IMPORTAR SEGURIDAD
const { authRequired, adminOnly } = require('../middleware/auth');

// ==========================================
// RUTAS PÚBLICAS (Disponibilidad para reservas)
// ==========================================

// GET /available (Público)
router.get("/available", async (req, res) => {
    try {
        const { date, time, duration } = req.query;
        if (!date || !time || !duration) return res.status(400).json({ message: "Faltan parámetros" });

        const startSQL = `${date} ${time}:00`;
        const startDate = new Date(`${date}T${time}:00`);
        const durationMs = parseFloat(duration) * 60 * 60 * 1000;
        const endDate = new Date(startDate.getTime() + durationMs);

        const endY = endDate.getFullYear();
        const endM = String(endDate.getMonth() + 1).padStart(2, '0');
        const endD = String(endDate.getDate()).padStart(2, '0');
        const endH = String(endDate.getHours()).padStart(2, '0');
        const endMin = String(endDate.getMinutes()).padStart(2, '0');
        const endSec = String(endDate.getSeconds()).padStart(2, '0');
        const endSQL = `${endY}-${endM}-${endD} ${endH}:${endMin}:${endSec}`;

        const query = `
            SELECT l.* FROM lanes l
            WHERE l.active = 1 
            AND l.id NOT IN (
                SELECT rl.lane_id FROM reservation_lanes rl
                JOIN reservations r ON rl.reservation_id = r.id
                WHERE r.status IN ('pending', 'confirmed', 'paid')
                AND (rl.booked_from < ? AND rl.booked_until > ?)
            )
            ORDER BY l.lane_number ASC
        `;
        const [lanes] = await pool.query(query, [endSQL, startSQL]);
        res.json(lanes);
    } catch (err) {
        console.error("Error lanes/available:", err);
        res.status(500).json({ message: "Error" });
    }
});

// GET /check-capacity (Público)
router.get("/check-capacity", async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ message: "Fecha requerida" });
        const [totalLanesRows] = await pool.query("SELECT COUNT(*) as total FROM lanes WHERE active = 1");
        const totalLanes = totalLanesRows[0].total;
        const query = `
            SELECT EXTRACT(HOUR FROM rl.booked_from) as hour_start, EXTRACT(HOUR FROM rl.booked_until) as hour_end, COUNT(rl.lane_id) as reserved_count
            FROM reservation_lanes rl JOIN reservations r ON rl.reservation_id = r.id
            WHERE DATE(rl.booked_from) = ? AND r.status IN ('pending', 'confirmed', 'paid')
            GROUP BY hour_start, hour_end
        `;
        const [reservations] = await pool.query(query, [date]);
        const busyHours = [];
        reservations.forEach(res => {
            for (let h = res.hour_start; h < res.hour_end; h++) {
                if (res.reserved_count >= totalLanes) if (!busyHours.includes(h)) busyHours.push(h);
            }
        });
        res.json({ busyHours, totalLanes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error" });
    }
});

// ==========================================
// RUTAS PROTEGIDAS (SOLO ADMIN)
// ==========================================

// GET / (Listar todas para admin) - Podría ser protegida
router.get("/", authRequired, adminOnly, async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM lanes ORDER BY lane_number ASC");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error obteniendo pistas" });
    }
});

// POST / (Crear Pista)
router.post("/", authRequired, adminOnly, async (req, res) => {
    try {
        const { lane_number, name, description, max_players, price, active } = req.body;
        const priceCents = Math.round(parseFloat(price));

        await pool.query(
            "INSERT INTO lanes (lane_number, name, description, max_players, price_per_hour_cents, active) VALUES (?, ?, ?, ?, ?, ?)",
            [lane_number, name, description, max_players, priceCents, active ? 1 : 0]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error creando pista" });
    }
});

// PUT /:id (Editar Pista)
router.put("/:id", authRequired, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { lane_number, name, description, max_players, price, active } = req.body;
        const priceCents = Math.round(parseFloat(price));

        await pool.query(
            "UPDATE lanes SET lane_number=?, name=?, description=?, max_players=?, price_per_hour_cents=?, active=? WHERE id=?",
            [lane_number, name, description, max_players, priceCents, active ? 1 : 0, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error actualizando pista" });
    }
});

// DELETE /:id (Eliminar Pista)
router.delete("/:id", authRequired, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM lanes WHERE id=?", [id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error eliminando pista" });
    }
});

module.exports = router;