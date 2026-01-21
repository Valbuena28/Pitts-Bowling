// utils/helpers.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_TTL,
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_TTL,
  });
}

function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cookieOptionsFromExp(expMs, { long = false } = {}) {
  const secure = process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
  const opts = {
    httpOnly: true,
    secure,
    sameSite: process.env.COOKIE_SAMESITE || 'Strict',
    path: '/',
    maxAge: typeof expMs === 'number' && expMs > 0 ? expMs : (long ? 7 * 24 * 60 * 60 * 1000 : 5 * 60 * 1000),
  };
  if (process.env.COOKIE_DOMAIN) opts.domain = process.env.COOKIE_DOMAIN;
  return opts;
}

function generateCsrf() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  generateSessionId,
  hashToken,
  cookieOptionsFromExp,
  generateCsrf
};