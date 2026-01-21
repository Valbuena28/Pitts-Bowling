// src/routes/extras.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");
// 1. IMPORTAMOS SEGURIDAD
const { authRequired, adminOnly } = require('../middleware/auth');

// Obtener todos los extras (PÚBLICO - Para armar pedidos)
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name, price FROM extras");
    res.json(rows);
  } catch (err) {
    console.error("Error obteniendo extras:", err);
    res.status(500).json({ error: "Error al obtener extras" });
  }
});

// RUTAS PROTEGIDAS (SOLO ADMIN)

// Crear extra
router.post("/", authRequired, adminOnly, async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ error: "Nombre y precio requeridos" });
    }

    const [result] = await pool.query(
      "INSERT INTO extras (name, price) VALUES (?, ?)",
      [name, price]
    );

    res.json({ id: result.insertId, name, price });
  } catch (err) {
    console.error("Error creando extra:", err);
    res.status(500).json({ error: "Error al crear extra" });
  }
});

// Editar extra
router.put("/:id", authRequired, adminOnly, async (req, res) => {
  try {
    const { name, price } = req.body;
    const { id } = req.params;

    await pool.query("UPDATE extras SET name = ?, price = ? WHERE id = ?", [
      name,
      price,
      id,
    ]);

    res.json({ id, name, price });
  } catch (err) {
    console.error("Error editando extra:", err);
    res.status(500).json({ error: "Error al editar extra" });
  }
});

// Eliminar extra
router.delete("/:id", authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM extras WHERE id = ?", [id]);
    res.json({ message: "Extra eliminado" });
  } catch (err) {
    console.error("Error eliminando extra:", err);
    res.status(500).json({ error: "Error al eliminar extra" });
  }
});

module.exports = router;