// src/routes/categories.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authRequired, adminOnly } = require('../middleware/auth');

// =======================
// CONFIG MULTER
// =======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, `cat_${Date.now()}${path.extname(file.originalname)}`); // Prefijo cat_ para diferenciar
  },
});
const upload = multer({ storage });

// Obtener todas las categorías (PÚBLICO)
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name, image_url, COALESCE(is_featured,0) AS is_featured FROM categories ORDER BY COALESCE(is_featured,0) DESC, name ASC");
    res.json(rows);
  } catch (err) {
    console.error("Error obteniendo categorías:", err);
    res.status(500).json({ error: "Error al obtener categorías" });
  }
});

// RUTAS PROTEGIDAS (SOLO ADMIN)

// Crear categoría
router.post("/", authRequired, adminOnly, upload.single("image"), async (req, res) => {
  try {
    const { name } = req.body;
    const is_featured = req.body.is_featured === '1' || req.body.is_featured === 1 ? 1 : 0;

    if (!name) return res.status(400).json({ error: "Nombre requerido" });

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const [result] = await pool.query(
      "INSERT INTO categories (name, is_featured, image_url) VALUES (?, ?, ?)",
      [name, is_featured, image_url]
    );
    res.json({ id: result.insertId, name, is_featured, image_url });
  } catch (err) {
    console.error("Error creando categoría:", err);
    res.status(500).json({ error: "Error al crear categoría" });
  }
});

// Editar categoría
router.put("/:id", authRequired, adminOnly, upload.single("image"), async (req, res) => {
  const conn = await pool.getConnection(); // Usar transacción por seguridad con archivos
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Si viene is_featured en el body (puede venir o no dependiendo del form)
    // El frontend original tenía ruta separada para feature, pero podemos soportarlo aquí también
    // Sin embargo, mantendremos la lógica simple: si viene name, actualizamos.

    if (!name) return res.status(400).json({ error: "Nombre requerido" });

    // Obtener info actual para borrar imagen vieja si hay nueva
    const [current] = await conn.query("SELECT image_url FROM categories WHERE id = ?", [id]);
    if (current.length === 0) return res.status(404).json({ error: "Categoría no encontrada" });

    let image_url = current[0].image_url;

    if (req.file) {
      // Borrar anterior
      if (image_url) {
        const oldPath = path.join(__dirname, "..", image_url.replace(/^\//, ""));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      image_url = `/uploads/${req.file.filename}`;
    }

    await conn.query("UPDATE categories SET name = ?, image_url = ? WHERE id = ?", [name, image_url, id]);

    res.json({ success: true, image_url });
  } catch (err) {
    console.error("Error PUT /categories/:id", err);
    res.status(500).json({ error: "Error actualizando categoría" });
  } finally {
    conn.release();
  }
});

// Destacar/Des-destacar (Mantenemos esta ruta específica)
router.put("/:id/feature", authRequired, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { is_featured } = req.body;
  try {
    await pool.query("UPDATE categories SET is_featured = ? WHERE id = ?", [is_featured ? 1 : 0, id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error PUT /categories/:id/feature", err);
    res.status(500).json({ error: "Error actualizando featured" });
  }
});

// Eliminar categoría
router.delete("/:id", authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener imagen para borrar
    const [current] = await pool.query("SELECT image_url FROM categories WHERE id = ?", [id]);
    if (current.length > 0 && current[0].image_url) {
      const oldPath = path.join(__dirname, "..", current[0].image_url.replace(/^\//, ""));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await pool.query("DELETE FROM categories WHERE id = ?", [id]);
    res.json({ message: "Categoría eliminada" });
  } catch (err) {
    console.error("Error eliminando categoría:", err);
    res.status(500).json({ error: "Error al eliminar categoría" });
  }
});

module.exports = router;