// server.js
require('dotenv').config();
// Server restarted at request
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const categoriesRoutes = require("./routes/categories");
const extrasRoutes = require("./routes/extras");

const app = express();

// --- CONFIGURACIÓN DE SEGURIDAD ---
const cspDirectives = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/", "https://unpkg.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
    imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org", "https://*.basemaps.cartocdn.com", "https://unpkg.com"],
    frameSrc: ["'self'", "https://www.google.com/recaptcha/"],
    connectSrc: ["'self'", process.env.FRONTEND_ORIGIN || "*", "https://www.google.com"],
  }
};

app.use(helmet({
  contentSecurityPolicy: cspDirectives,
  crossOriginEmbedderPolicy: false
}));


app.use(cors({
  origin: process.env.FRONTEND_ORIGIN,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Servir imágenes subidas (si usas multer)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas
app.use('/api/foods', require('./routes/foods'));
app.use("/api/categories", categoriesRoutes);
app.use("/api/extras", extrasRoutes);
app.use('/uploads', express.static('uploads'));
app.use("/api/orders", require("./routes/orders"));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/packages', require('./routes/packages'));
app.use('/api/lanes', require('./routes/lanes'));
app.use('/api/posts', require('./routes/posts'));
app.use('/', require('./routes/auth'));       // Login, Register, Auth
app.use('/api/user', require('./routes/user_data'));
app.use('/api/settings', require('./routes/user_settings'));
app.use('/api/config', require('./routes/config')); // New Config Route
app.use('/auth', require('./routes/auth'));   // Para rutas tipo /auth/google (opcional si ya están en /)




// Health Check
app.get('/', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor modular corriendo en http://localhost:${PORT}`);
});