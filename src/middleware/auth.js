// middleware/auth.js
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

async function authRequired(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) return res.status(401).json({ msg: 'No autenticado' });
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload; 

    const [[row]] = await pool.query('SELECT current_session FROM usuarios WHERE id=?', [payload.id]);
    const currentSession = row?.current_session || null;

    if (!currentSession || payload.sid !== currentSession) {
      return res.status(401).json({ msg: 'session_replaced' });
    }
    next();
  } catch (e) {
    return res.status(401).json({ msg: 'Token inválido o expirado' });
  }
}

async function adminOnly(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ msg: 'No autenticado' });

    const [[user]] = await pool.query('SELECT role FROM usuarios WHERE id=?', [userId]);
    if (!user) return res.status(404).json({ msg: 'Usuario no encontrado' });
    
    if (user.role !== 'admin') return res.status(403).json({ msg: 'Acceso denegado' });

    next();
  } catch (err) {
    console.error('Error en adminOnly:', err);
    res.status(500).json({ msg: 'Error interno' });
  }
}

module.exports = { authRequired, adminOnly };