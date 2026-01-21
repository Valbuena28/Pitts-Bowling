// src/routes/reservations.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 1. IMPORTAR SEGURIDAD
const { authRequired, adminOnly } = require('../middleware/auth');

// ==========================================
// CONFIGURACIÓN MULTER (Subida de imágenes)
// ==========================================
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

// ==========================================
// 1. RUTAS PARA USUARIO (CHECKOUT)
// ==========================================

// POST /checkout - Crear reserva (Usuario)
router.post("/checkout", authRequired, upload.single('payment_capture'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        let body = req.body;

        // Desempaquetar meta_data
        if (body.meta_data) {
            try {
                const meta = typeof body.meta_data === 'string' ? JSON.parse(body.meta_data) : body.meta_data;
                
                if (!body.duration) body.duration = meta.duration;
                if (!body.lane_id) body.lane_id = meta.lane_id;
                if (!body.date) body.date = meta.date;
                if (!body.time) body.time = meta.time;
                if (!body.people_count) body.people_count = meta.people_count;
                if (!body.package_id) body.package_id = meta.package_id; // corregido undefined check
                
            } catch (e) {
                console.log("Aviso: No se pudo leer meta_data, usando datos directos.");
            }
        }

        let { 
            user_id, // NOTA: Podrías usar req.user.id (del token) para más seguridad, pero mantenemos tu lógica actual
            package_id, 
            date, 
            time, 
            payment_method, 
            payment_reference,
            people_count, 
            lane_id,
            duration,
            shoe_sizes, 
        } = body;

        // Validación extra de seguridad: Verificar que el user_id del body coincida con el del token
        // Esto evita que un usuario A haga una reserva a nombre del usuario B
        if (req.user.id !== parseInt(user_id)) {
             return res.status(403).json({ message: "No puedes hacer reservas a nombre de otro usuario." });
        }

        if (!user_id || !date || !time || !lane_id) {
            return res.status(400).json({ message: "Faltan datos obligatorios (usuario, fecha, hora o pista)" });
        }

        if (package_id === 'null' || package_id === 'undefined' || package_id === '' || package_id == 0) {
            package_id = null;
        }

        let shoeSizesStr = null;
        if (shoe_sizes) {
            if (Array.isArray(shoe_sizes)) {
                shoeSizesStr = shoe_sizes.join(", "); 
            } else {
                shoeSizesStr = String(shoe_sizes);
            }
        }

        let finalPriceCents = 0;
        let finalDurationHours = 0;
        let finalPackageId = null;
        let maxPeopleAllowed = 6; 

        // Lógica de Precios
        if (package_id) {
            const [pkgRows] = await conn.query("SELECT * FROM packages WHERE id = ?", [package_id]);
            if (pkgRows.length === 0) return res.status(404).json({ message: "Paquete no encontrado en BD" });
            
            const pkg = pkgRows[0];
            finalPriceCents = pkg.price_cents;
            finalDurationHours = parseFloat(pkg.duration_hours);
            finalPackageId = pkg.id;
            maxPeopleAllowed = pkg.max_people;

        } else {
            const [laneRows] = await conn.query("SELECT * FROM lanes WHERE id = ?", [lane_id]);
            if (laneRows.length === 0) return res.status(404).json({ message: "Pista no encontrada en BD" });
            
            const lane = laneRows[0];
            finalDurationHours = parseFloat(duration) || 1; 
            finalPriceCents = lane.price_per_hour_cents * finalDurationHours;
            finalPackageId = null; 
            maxPeopleAllowed = lane.max_players;
        }

        const personas = parseInt(people_count) || 1;
        if (personas > maxPeopleAllowed) {
             return res.status(400).json({ message: `El máximo de personas permitido es ${maxPeopleAllowed}` });
        }

        const startTimeStr = `${date}T${time}:00`;
        const startTime = new Date(startTimeStr);
        const endTime = new Date(startTime.getTime() + (finalDurationHours * 60 * 60 * 1000));
        
        const captureUrl = req.file ? `/uploads/${req.file.filename}` : null;

        await conn.beginTransaction();

        const [resResult] = await conn.query(
            `INSERT INTO reservations 
            (user_id, package_id, start_time, end_time, number_of_people, total_price_cents, 
             status, payment_method, payment_reference, payment_capture_url, shoe_sizes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user_id,
                finalPackageId,
                startTime,
                endTime,
                personas,
                finalPriceCents,
                'pending',    
                payment_method || 'pago_movil',
                payment_reference || null,
                captureUrl,
                shoeSizesStr 
            ]
        );

        const reservationId = resResult.insertId;

        await conn.query(
            `INSERT INTO reservation_lanes (reservation_id, lane_id, booked_from, booked_until)
             VALUES (?, ?, ?, ?)`,
            [reservationId, lane_id, startTime, endTime]
        );

        await conn.commit();
        res.json({ success: true, message: "Reserva realizada con éxito" });

    } catch (err) {
        if (conn) await conn.rollback();
        console.error("SQL Error Reservation:", err);
        res.status(500).json({ message: "Error al guardar la reserva: " + err.message });
    } finally {
        if (conn) conn.release();
    }
});

// ==========================================
// 2. RUTAS PARA ADMIN (GESTIÓN DE RESERVAS)
// ==========================================
// Estas rutas ahora están protegidas. Solo usuarios con role='admin' pueden entrar.

// GET / - Obtener lista de reservas (con filtros)
router.get("/", authRequired, adminOnly, async (req, res) => {
    const { status, search } = req.query;
    try {
        let query = `
            SELECT 
                r.*, 
                u.name as user_name, 
                u.last_name as user_lastname, 
                p.name as package_name,
                l.lane_number,
                l.name as lane_name
            FROM reservations r
            LEFT JOIN usuarios u ON r.user_id = u.id
            LEFT JOIN packages p ON r.package_id = p.id
            LEFT JOIN reservation_lanes rl ON r.id = rl.reservation_id
            LEFT JOIN lanes l ON rl.lane_id = l.id
        `;
        
        const params = [];
        const conditions = [];

        if (status && status !== 'todas') {
            conditions.push("r.status = ?");
            params.push(status);
        }

        if (search) {
            conditions.push("(r.payment_reference LIKE ? OR u.name LIKE ? OR r.id = ?)");
            params.push(`%${search}%`, `%${search}%`, search);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY r.created_at DESC";

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error obteniendo reservas" });
    }
});

// GET /admin-pending-count - Contar reservas pendientes (Solo Admin)
router.get("/admin-pending-count", authRequired, adminOnly, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const [result] = await conn.query(
            "SELECT COUNT(id) AS pending_count FROM reservations WHERE status = 'pending'"
        );
        const count = result.length > 0 ? result[0].pending_count : 0;
        res.json({ count });
    } catch (err) {
        console.error("Error GET /admin-pending-count:", err);
        res.status(500).json({ message: "Error al obtener conteo de reservas pendientes" });
    } finally {
        conn.release();
    }
});

// GET /:id - Obtener detalle de una reserva específica
router.get("/:id", authRequired, adminOnly, async (req, res) => {
    const { id } = req.params;
    try {
       const [reserva] = await pool.query(`
            SELECT r.*, u.name as user_name, u.last_name as user_lastname, u.email, p.name as package_name
            FROM reservations r
            LEFT JOIN usuarios u ON r.user_id = u.id
            LEFT JOIN packages p ON r.package_id = p.id
            WHERE r.id = ?
        `, [id]);

        if (reserva.length === 0) return res.status(404).json({ message: "Reserva no encontrada" });

        // === MAGIA NUEVA: Buscar el último mensaje del historial ===
        const [lastNote] = await pool.query(
            "SELECT message FROM order_notes WHERE ref_id = ? AND ref_type = 'reservation' ORDER BY created_at DESC LIMIT 1",
            [id]
        );
        
        // Si hay un mensaje nuevo, lo usamos para que el admin lo vea en el campo de notas
        if (lastNote.length > 0) {
            reserva[0].notes = lastNote[0].message;
        }
        // ===========================================================

        const [lanes] = await pool.query(`
            SELECT l.lane_number, l.name 
            FROM reservation_lanes rl
            JOIN lanes l ON rl.lane_id = l.id
            WHERE rl.reservation_id = ?
        `, [id]);

        res.json({ reservation: reserva[0], lanes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error obteniendo detalle de reserva" });
    }
});


// PUT /:id - Actualizar estado de reserva (Con notificación automática)
router.put("/:id", authRequired, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body; 

    
    if (!status) {
        return res.status(400).json({ message: "El estado es obligatorio" });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Actualizar el estado en la BD
        await conn.query(
            "UPDATE reservations SET status = ? WHERE id = ?",
            [status, id]
        );

        // ==============================================================
        // LOGICA DE MENSAJE AUTOMÁTICO
        // ==============================================================
        let messageToSend = notes ? notes.trim() : "";

        // Si el admin NO escribió nota, generamos una automática según el estado
        if (!messageToSend) {
            switch (status) {
                case 'confirmed':
                    messageToSend = "¡Buenas noticias! Tu reserva ha sido CONFIRMADA. Te esperamos.";
                    break;
                case 'cancelled':
                    messageToSend = "Tu reserva ha sido CANCELADA. Si tienes dudas, contáctanos.";
                    break;
                case 'completed':
                    messageToSend = "Tu reserva ha sido marcada como COMPLETADA. ¡Gracias por visitarnos!";
                    break;
                case 'pending':
                    messageToSend = "El estado de tu reserva ha cambiado a PENDIENTE.";
                    break;
            }
        }

        // 2. Si hay mensaje (escrito o automático), guardamos y notificamos
        if (messageToSend) {
            // A. Obtener datos del usuario
            const [resData] = await conn.query(
                `SELECT r.user_id, u.email, u.usuario, u.name 
                 FROM reservations r 
                 JOIN usuarios u ON r.user_id = u.id 
                 WHERE r.id = ?`, 
                [id]
            );

            if (resData.length > 0) {
                const user = resData[0];

                // B. Insertar en Dashboard (Campanita)
                await conn.query(
                    `INSERT INTO order_notes (user_id, ref_id, ref_type, message, is_read) 
                     VALUES (?, ?, 'reservation', ?, 0)`,
                    [user.user_id, id, messageToSend]
                );

                // C. Enviar Correo
                try {
                    const transporter = require('../utils/email');
                    const emailTemplate = require('../utils/emailTemplate');
                    
                    await transporter.sendMail({
                        from: `"Pitts Bowling" <${process.env.EMAIL_USER}>`,
                        to: user.email,
                        subject: `Actualización de Reserva #${id} - ${status.toUpperCase()}`,
                        html: emailTemplate(
                            user.usuario,
                            messageToSend, // Usamos el mensaje (manual o automático)
                            "Estado de Reserva Actualizado",
                            `El estado de tu reserva #${id} ahora es: <strong>${status.toUpperCase()}</strong>.`,
                            "note" // Usamos tu diseño bonito de nota
                        )
                    });
                } catch (emailErr) {
                    console.error("Error enviando email:", emailErr);
                }
            }
        }

        await conn.commit();
        res.json({ success: true, message: "Estado actualizado y notificación enviada." });

    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ message: "Error actualizando reserva" });
    } finally {
        conn.release();
    }
});

// DELETE /:id - Eliminar reserva
router.delete("/:id", authRequired, adminOnly, async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query("DELETE FROM reservation_lanes WHERE reservation_id = ?", [id]);
        await conn.query("DELETE FROM reservations WHERE id = ?", [id]);
        
        await conn.commit();
        res.json({ success: true, message: "Reserva eliminada" });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ message: "Error eliminando reserva" });
    } finally {
        conn.release();
    }
});




module.exports = router;