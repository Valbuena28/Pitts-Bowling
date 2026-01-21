// routes/foods.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 1. IMPORTAR SEGURIDAD
const { authRequired, adminOnly } = require('../middleware/auth');

// =======================
// CONFIG MULTER
// =======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads")); // uploads en la raíz del proyecto
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// =======================
// ===== GET FOODS ======
// =======================
// ESTA RUTA SE QUEDA PÚBLICA (El menú lo ve todo el mundo)
router.get("/", async (req, res) => {
  try {
    const { category } = req.query;

    let query = `
      SELECT f.id, f.name, f.description, f.image_url, f.category_id, f.is_featured, c.name AS category_name
      FROM foods f
      LEFT JOIN categories c ON f.category_id = c.id
    `;
    let params = [];

    if (category) {
      query += " WHERE f.category_id = ?";
      params.push(category);
    }

    query += " ORDER BY f.id DESC";

    const [foods] = await pool.query(query, params);

    // traer tamaños con calorías y precio y extras para cada size (por comida)
    for (let food of foods) {
      const [sizes] = await pool.query(
        "SELECT id, size_name, calories, price FROM food_sizes WHERE food_id = ?",
        [food.id]
      );

      // Para cada size, traer los extras asignados a ese tamaño (si existen)
      for (let size of sizes) {
        const [sizeExtras] = await pool.query(
          `SELECT e.id, e.name, e.price
           FROM extras e
           INNER JOIN food_size_extras fse ON fse.extra_id = e.id
           WHERE fse.food_size_id = ?`,
          [size.id]
        );
        size.extras = sizeExtras || [];
      }

      food.sizes = sizes;
    }

    res.json(foods);
  } catch (err) {
    console.error("Error obteniendo comidas:", err);
    res.status(500).json({ error: "Error al obtener comidas" });
  }
});

// =======================
// RUTAS PROTEGIDAS (SOLO ADMIN)
// =======================

// =======================
// ===== POST FOOD =======
// =======================
router.post("/", authRequired, adminOnly, upload.single("image"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { name, description, category_id } = req.body;
    const is_featured = Number(req.body.is_featured) === 1 ? 1 : 0;

    let { size_name = [], calories = [], prices = [], extras = [] } = req.body;
    const sizes_json = req.body.sizes_json;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name || !description || !category_id) {
      return res.status(400).json({ success: false, error: "Todos los campos son obligatorios" });
    }

    await conn.beginTransaction();

    const [result] = await conn.query(
      "INSERT INTO foods (name, description, image_url, category_id, is_featured) VALUES (?, ?, ?, ?, ?)",
      [name, description, image_url, category_id, is_featured]
    );

    const foodId = result.insertId;

    let sizesMeta = [];
    if (sizes_json) {
      try {
        sizesMeta = JSON.parse(sizes_json);
        if (!Array.isArray(sizesMeta)) sizesMeta = [];
      } catch (err) {
        sizesMeta = [];
      }
    } else {
      if (Array.isArray(size_name)) {
        for (let i = 0; i < size_name.length; i++) {
          sizesMeta.push({
            size_name: size_name[i],
            calories: calories[i] || 0,
            price: prices[i] || 0,
            extras: [] 
          });
        }
      } else if (size_name) {
        sizesMeta.push({
          size_name,
          calories: calories || 0,
          price: prices || 0,
          extras: []
        });
      }
    }

    for (let s of sizesMeta) {
      const [resSize] = await conn.query(
        "INSERT INTO food_sizes (food_id, size_name, calories, price) VALUES (?, ?, ?, ?)",
        [foodId, s.size_name, s.calories || 0, s.price || 0]
      );
      const newSizeId = resSize.insertId;

      const extrasArr = Array.isArray(s.extras) ? s.extras.map(x => Number(x)).filter(n => !isNaN(n)) : [];
      if (extrasArr.length > 0) {
        const vals = extrasArr.map(exId => [newSizeId, exId]);
        await conn.query("INSERT INTO food_size_extras (food_size_id, extra_id) VALUES ?", [vals]);
      }
    }

    await conn.commit();

    res.json({
      success: true,
      message: "Comida creada",
      data: { id: foodId, name, description, image_url, category_id, is_featured }
    });
  } catch (err) {
    await conn.rollback();
    console.error("Error creando comida:", err);
    res.status(500).json({ success: false, error: "Error al crear comida" });
  } finally {
    conn.release();
  }
});

// =======================
// ===== PUT FOOD ========
// =======================
router.put("/:id", authRequired, adminOnly, upload.single("image"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { name, description, category_id } = req.body;
    const is_featured = Number(req.body.is_featured) === 1 ? 1 : 0;

    let { size_name = [], calories = [], prices = [], extras = [] } = req.body;
    const sizes_json = req.body.sizes_json;

    const [currentFood] = await conn.query("SELECT * FROM foods WHERE id = ?", [id]);
    if (!currentFood.length) {
      return res.status(404).json({ success: false, error: "Comida no encontrada" });
    }

    let image_url = currentFood[0].image_url;

    if (req.file) {
      if (image_url) {
        const oldPath = path.join(__dirname, "..", image_url.replace(/^\//, ""));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      image_url = `/uploads/${req.file.filename}`;
    }

    await conn.beginTransaction();

    await conn.query(
      "UPDATE foods SET name = ?, description = ?, image_url = ?, category_id = ?, is_featured = ? WHERE id = ?",
      [name, description, image_url, category_id, is_featured, id]
    );

    const [prevSizes] = await conn.query("SELECT id FROM food_sizes WHERE food_id = ?", [id]);
    const prevSizeIds = prevSizes.map(s => s.id);
    if (prevSizeIds.length > 0) {
      await conn.query("DELETE FROM food_size_extras WHERE food_size_id IN (?)", [prevSizeIds]);
      await conn.query("DELETE FROM food_sizes WHERE food_id = ?", [id]);
    }

    let sizesMeta = [];
    if (sizes_json) {
      try {
        sizesMeta = JSON.parse(sizes_json);
        if (!Array.isArray(sizesMeta)) sizesMeta = [];
      } catch (err) {
        sizesMeta = [];
      }
    } else {
      if (Array.isArray(size_name)) {
        for (let i = 0; i < size_name.length; i++) {
          sizesMeta.push({
            size_name: size_name[i],
            calories: calories[i] || 0,
            price: prices[i] || 0,
            extras: []
          });
        }
      } else if (size_name) {
        sizesMeta.push({
          size_name,
          calories: calories || 0,
          price: prices || 0,
          extras: []
        });
      }
    }

    for (let s of sizesMeta) {
      const [resSize] = await conn.query(
        "INSERT INTO food_sizes (food_id, size_name, calories, price) VALUES (?, ?, ?, ?)",
        [id, s.size_name, s.calories || 0, s.price || 0]
      );
      const newSizeId = resSize.insertId;

      const extrasArr = Array.isArray(s.extras) ? s.extras.map(x => Number(x)).filter(n => !isNaN(n)) : [];
      if (extrasArr.length > 0) {
        const vals = extrasArr.map(exId => [newSizeId, exId]);
        await conn.query("INSERT INTO food_size_extras (food_size_id, extra_id) VALUES ?", [vals]);
      }
    }

    await conn.commit();

    res.json({
      success: true,
      message: "Comida actualizada",
      data: { id, name, description, image_url, category_id, is_featured }
    });
  } catch (err) {
    await conn.rollback();
    console.error("Error editando comida:", err);
    res.status(500).json({ success: false, error: "Error al editar comida" });
  } finally {
    conn.release();
  }
});

// =======================
// ===== DELETE FOOD =====
// =======================
router.delete("/:id", authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const [currentFood] = await pool.query("SELECT * FROM foods WHERE id = ?", [id]);

    if (!currentFood.length) {
      return res.status(404).json({ success: false, error: "Comida no encontrada" });
    }

    if (currentFood[0].image_url) {
      const oldPath = path.join(__dirname, "..", currentFood[0].image_url.replace(/^\//, ""));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await pool.query("DELETE FROM foods WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "Comida eliminada",
      data: { id }
    });
  } catch (err) {
    console.error("Error eliminando comida:", err);
    res.status(500).json({ success: false, error: "Error al eliminar comida" });
  }
});

module.exports = router;