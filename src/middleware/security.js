// middleware/security.js
const rateLimit = require('express-rate-limit');

const ipLoginLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 20,
  message: { msg: 'Demasiados intentos desde esta IP' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 500,
  message: { msg: 'Demasiados registros desde esta IP, intenta más tarde' },
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 500,
  message: { msg: 'Demasiados intentos desde esta IP, intenta más tarde' },
});

module.exports = { ipLoginLimiter, registerLimiter, forgotLimiter };