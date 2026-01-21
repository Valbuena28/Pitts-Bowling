// src/routes/orders.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 1. IMPORTAR SEGURIDAD
const { authRequired, adminOnly } = require('../middleware/auth');

// =======================
// CONFIGURACIÓN MULTER
// =======================
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// ==============================
// 📌 CHECKOUT (Solo usuarios logueados)
// ==============================
router.post("/checkout", authRequired, upload.single('payment_capture'), async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ message: "Sin datos" });

    // Tomamos el usuario ID del token seguro, NO del body (más seguro)
    const usuario_id = req.user.id;

    const { total, payment_method, payment_reference, service_type } = req.body;
    let cart = [];

    let descriptionToSave = null;
    if (service_type) {
      descriptionToSave = `Servicio: ${service_type}`;
    }

    try {
      if (req.body.cart) cart = JSON.parse(req.body.cart);
    } catch (e) {
      return res.status(400).json({ message: "Formato carrito inválido" });
    }

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ message: "Carrito vacío" });
    }

    const captureUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [invoiceResult] = await conn.query(
        `INSERT INTO invoices 
         (usuario_id, date, total, payment_method, payment_reference, capture_url, status, payment_description)
         VALUES (?, NOW(), ?, ?, ?, ?, ?, ?)`,
        [usuario_id, total, payment_method || "pago_movil", payment_reference || null, captureUrl, "pendiente", descriptionToSave]
      );

      const invoiceId = invoiceResult.insertId;

      for (const item of cart) {
        const foodId = Number(item.food_id);
        const sizeId = item.size_id ? Number(item.size_id) : null;
        const sizeName = item.size_name || item.tamano || null;

        let extrasJson = "[]";
        let extrasDetailArray = item.extras_detail || item.extras || [];
        if (Array.isArray(extrasDetailArray)) extrasJson = JSON.stringify(extrasDetailArray);

        let extrasTotal = 0;
        if (Array.isArray(extrasDetailArray)) {
          extrasTotal = extrasDetailArray.reduce((s, e) => s + (Number(e.price) || 0), 0);
        }

        const quantity = Number(item.quantity) || 1;
        const unitPrice = Number(item.unit_price) || 0;
        const subtotal = Number(item.subtotal) || quantity * (unitPrice + extrasTotal);

        await conn.query(
          `INSERT INTO details_invoice
            (invoice_id, food_id, size_id, size_name, extras_json, extras_total, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [invoiceId, foodId, sizeId, sizeName, extrasJson, extrasTotal, quantity, unitPrice, subtotal]
        );
      }

      await conn.commit();
      res.json({ success: true, invoiceId, message: "Pedido registrado" });

    } catch (err) {
      await conn.rollback();
      console.error("Error SQL checkout:", err);
      res.status(500).json({ message: "Error DB" });
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error("Error checkout:", err);
    res.status(500).json({ message: "Error interno" });
  }
});

// ==============================
// RUTAS DE GESTIÓN (SOLO ADMIN)
// ==============================

// GET lista de invoices (Para Admin)
router.get("/invoices", authRequired, adminOnly, async (req, res) => {
  const { status, search } = req.query;
  try {
    let base = `SELECT i.id, i.usuario_id, i.date, i.total, i.payment_method, i.payment_reference, i.capture_url, i.status, i.payment_description, 
                u.name as user_name, u.last_name as user_lastname 
                FROM invoices i
                LEFT JOIN usuarios u ON i.usuario_id = u.id`;
    const params = [];
    const where = [];

    if (status) { where.push("i.status = ?"); params.push(status); }

    if (search) {
      if (/^\d+$/.test(search)) {
        where.push("(i.id = ? OR i.payment_reference LIKE ?)");
        params.push(Number(search), `%${search}%`);
      } else {
        where.push("(i.payment_reference LIKE ? OR i.payment_method LIKE ? OR u.name LIKE ? OR u.last_name LIKE ?)");
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }
    }

    if (where.length) base += " WHERE " + where.join(" AND ");
    base += " ORDER BY i.date DESC";

    const [rows] = await pool.query(base, params);
    res.json(rows);
  } catch (err) {
    console.error("Error GET /invoices:", err);
    res.status(500).json({ message: "Error al obtener facturas" });
  }
});

// GET /invoices/admin-pending-count - Contar facturas pendientes (Solo Admin)
router.get("/invoices/admin-pending-count", authRequired, adminOnly, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query(
      "SELECT COUNT(id) AS pending_count FROM invoices WHERE status = 'pendiente'"
    );
    const count = result.length > 0 ? result[0].pending_count : 0;
    res.json({ count });
  } catch (err) {
    console.error("Error GET /invoices/admin-pending-count:", err);
    res.status(500).json({ message: "Error al obtener conteo de facturas pendientes" });
  } finally {
    conn.release();
  }
});


// GET detalle de invoice (Para Admin)
router.get("/invoices/:id", authRequired, adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const [invoices] = await pool.query(`
      SELECT i.*, u.name as user_name, u.last_name as user_lastname, u.email as user_email
      FROM invoices i 
      LEFT JOIN usuarios u ON i.usuario_id = u.id
      WHERE i.id = ?`,
      [id]
    );
    if (!invoices.length) return res.status(404).json({ message: "Invoice no encontrada" });
    const invoice = invoices[0];

    const [lastNote] = await pool.query(
      "SELECT message FROM order_notes WHERE ref_id = ? AND ref_type = 'invoice' ORDER BY created_at DESC LIMIT 1",
      [id]
    );

    // Sobrescribimos payment_description con el último mensaje real para que el admin lo vea
    if (lastNote.length > 0) {
      invoice.payment_description = lastNote[0].message;
    }
    // ===========================================================

    const [details] = await pool.query(
      `SELECT di.*, f.name AS food_name
       FROM details_invoice di
       LEFT JOIN foods f ON f.id = di.food_id
       WHERE di.invoice_id = ?`,
      [id]
    );

    res.json({ invoice, details });
  } catch (err) {
    console.error("Error GET /invoices/:id", err);
    res.status(500).json({ message: "Error al obtener detalle" });
  }
});


// PUT Actualizar Invoice (Con notificación automática)
// PUT Actualizar Invoice (Con notificación automática)
router.put("/invoices/:id", authRequired, adminOnly, async (req, res) => {
  const { id } = req.params;
  let { status, payment_method, payment_description } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Normalizar status (si no envían status, se queda como null)
    if (typeof status === "string") {
      status = status.trim().toLowerCase();
      if (status === "finalizada" || status === "pagada") status = "pagada";
      else if (status === "cancelada" || status === "anulada") status = "anulada";
      else if (status !== "pendiente") status = null;
    } else {
      status = null;
    }

    // 1. Actualizar la factura en BD
    // COALESCE hace que si 'status' es null, no toque el valor que ya existe en la BD
    await conn.query(
      `UPDATE invoices
         SET status = COALESCE(?, status),
             payment_method = COALESCE(?, payment_method)
       WHERE id = ?`,
      [status, payment_method, id]
    );

    // ==============================================================
    // LOGICA DE MENSAJE AUTOMÁTICO
    // ==============================================================
    let messageToSend = payment_description ? payment_description.trim() : "";

    // Si admin no escribió nota, generamos mensaje según status (SOLO SI CAMBIÓ EL STATUS)
    if (!messageToSend && status) {
      if (status === 'pagada') {
        messageToSend = "Tu pago ha sido VERIFICADO y aprobado exitosamente.";
      } else if (status === 'anulada') {
        messageToSend = "Tu pedido ha sido ANULADO. Por favor contacta soporte si crees que es un error.";
      } else if (status === 'pendiente') {
        messageToSend = "El estado de tu pedido ha vuelto a PENDIENTE.";
      }
    }

    // 2. Si hay mensaje, guardar en historial y enviar correo
    if (messageToSend) {
      // === AQUÍ ESTÁ EL TRUCO ===
      // Seleccionamos "i.status" (que SI existe en tu BD) y le decimos "llámalo current_status solo por ahora"
      const [invData] = await conn.query(
        `SELECT i.usuario_id, i.status as current_status, u.email, u.usuario 
             FROM invoices i 
             JOIN usuarios u ON i.usuario_id = u.id 
             WHERE i.id = ?`,
        [id]
      );

      if (invData.length > 0) {
        const user = invData[0];

        // Definimos qué estado mostrar en el correo:
        // Si tú enviaste un status nuevo, usamos ese.
        // Si no enviaste status (es null), usamos el que trajimos de la BD (user.current_status).
        const displayStatus = status ? status : user.current_status;

        // Dashboard
        await conn.query(
          `INSERT INTO order_notes (user_id, ref_id, ref_type, message, is_read) 
                 VALUES (?, ?, 'invoice', ?, 0)`,
          [user.usuario_id, id, messageToSend]
        );

        // Email
        try {
          const transporter = require('../utils/email');
          const emailTemplate = require('../utils/emailTemplate');

          await transporter.sendMail({
            from: `"Pitts Bowling" <${process.env.EMAIL_USER}>`,
            to: user.email,
            // Usamos displayStatus para asegurar que nunca sea null
            subject: `Actualización de Pedido #${id} - ${displayStatus.toUpperCase()}`,
            html: emailTemplate(
              user.usuario,
              messageToSend,
              "Estado de Pedido Actualizado",
              `El estado de tu factura #${id} es: <strong>${displayStatus.toUpperCase()}</strong>.`,
              "note"
            )
          });
        } catch (e) { console.error("Email error:", e); }
      }
    }

    await conn.commit();
    res.json({ success: true, message: "Invoice actualizada y notificado" });
  } catch (err) {
    await conn.rollback();
    console.error("Error PUT /invoices/:id", err);
    res.status(500).json({ message: "Error al actualizar invoice" });
  } finally {
    conn.release();
  }
});

// DELETE Invoice (Para Admin)
router.delete("/invoices/:id", authRequired, adminOnly, async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [inv] = await conn.query("SELECT * FROM invoices WHERE id = ?", [id]);
    if (!inv.length) {
      await conn.rollback();
      return res.status(404).json({ message: "Invoice no encontrada" });
    }

    if (inv[0].status !== "pendiente") {
      await conn.rollback();
      return res.status(400).json({ message: "Solo se pueden eliminar facturas pendientes" });
    }

    await conn.query("DELETE FROM details_invoice WHERE invoice_id = ?", [id]);
    await conn.query("DELETE FROM invoices WHERE id = ?", [id]);

    await conn.commit();
    res.json({ success: true, message: "Invoice eliminada" });
  } catch (err) {
    await conn.rollback();
    console.error("Error DELETE /invoices/:id", err);
    res.status(500).json({ message: "Error al eliminar invoice" });
  } finally {
    conn.release();
  }
});




module.exports = router;