// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { URLSearchParams } = require('url');
const crypto = require('crypto');
const { randomBytes } = crypto; 

// Imports locales
const { pool } = require('../db');
const transporter = require('../utils/email');
const emailTemplate = require('../utils/emailTemplate'); // Asegúrate que la ruta sea correcta
const { ipLoginLimiter, registerLimiter, forgotLimiter } = require('../middleware/security');
const { authRequired, adminOnly } = require('../middleware/auth');
const { 
  signAccessToken, signRefreshToken, generateSessionId, hashToken, 
  cookieOptionsFromExp, generateCsrf 
} = require('../utils/helpers');

// Variables en memoria para 2FA
const pending2FA = new Map(); 
const resend2FAData = new Map();

// Configuración: cuántos intentos y cuánto tiempo de bloqueo
const MAX_FAILED_ATTEMPTS = 4; // número de intentos fallidos permitidos
const LOCK_TIME_MINUTES = 5;  // minutos de bloqueo

async function resetLockForUser(userId) {
  try {
    await pool.query('UPDATE usuarios SET failed_attempts = 0, locked_until = NULL WHERE id = ?', [userId]);
  } catch (e) {
    console.warn('No se pudo resetear lock para usuario', userId, e.message);
  }
}

async function recordFailedLogin(userIdOrName) {
  try {
    let user = null;

    if (typeof userIdOrName === 'number') {
      const [[row]] = await pool.query('SELECT id, failed_attempts, block_count FROM usuarios WHERE id=?', [userIdOrName]);
      user = row;
    } else {
      const [[row]] = await pool.query('SELECT id, failed_attempts, block_count FROM usuarios WHERE usuario=?', [userIdOrName]);
      user = row;
    }

    if (!user) return;

    const attempts = (user.failed_attempts || 0) + 1;

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const newBlockCount = (user.block_count || 0) + 1;

      if (newBlockCount >= 3) {
        // Bloqueo permanente
        await pool.query(
          'UPDATE usuarios SET permanently_blocked=1, failed_attempts=?, block_count=? WHERE id=?',
          [attempts, newBlockCount, user.id]
        );
        console.warn(`Usuario ${user.id} bloqueado PERMANENTEMENTE tras 3 bloqueos consecutivos`);
      } else {
        // Bloqueo temporal
        const lockUntil = new Date(Date.now() + LOCK_TIME_MINUTES * 60 * 1000);
        await pool.query(
          'UPDATE usuarios SET failed_attempts=?, locked_until=?, block_count=? WHERE id=?',
          [attempts, lockUntil, newBlockCount, user.id]
        );
        console.warn(`Usuario ${user.id} bloqueado hasta ${lockUntil}`);
      }
    } else {
      await pool.query(
        'UPDATE usuarios SET failed_attempts=? WHERE id=?',
        [attempts, user.id]
      );
    }
  } catch (e) {
    console.warn('No se pudo actualizar intentos fallidos', e.message);
  }
}

//vERIFICACIÓN DE ADMIN
router.get('/admin-check', authRequired, adminOnly, (req, res) => {
    res.status(200).json({ isAdmin: true });
});

//registro de usuarios

router.post('/register', registerLimiter, async (req, res) => {
  const { name, last_name, usuario, email, password } = req.body;
  if (!name || !last_name || !usuario || !email || !password) return res.status(400).json({ msg: 'Faltan datos' });

  // validación básica
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ msg: 'Email inválido' });
  if (typeof usuario !== 'string' || usuario.length < 3) return res.status(400).json({ msg: 'Usuario demasiado corto' });

  // comprobación de fuerza mínima de password
  if (password.length < 8 || !/[0-9]/.test(password) || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
    return res.status(400).json({ msg: 'La contraseña debe tener al menos 8 caracteres, con mayúsculas, minúsculas y números' });
  }

  try {
    // evitar duplicados
    const [exists] = await pool.query('SELECT id FROM usuarios WHERE usuario = ? OR email = ?', [usuario, email]);
    if (exists.length) return res.status(409).json({ msg: 'Usuario o email ya registrado' });

    const hashed = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO usuarios (name, last_name, usuario, password, email, failed_attempts, block_count, permanently_blocked) VALUES (?, ?, ?, ?, ?, 0, 0, 0)',
      [name, last_name, usuario, hashed, email]
    );
    const userId = result.insertId;

    // token para confirmación por email
    const token = jwt.sign({ id: userId, email }, process.env.EMAIL_TOKEN_SECRET, { expiresIn: '1d' });
    const verifyLink = `${process.env.FRONTEND_ORIGIN}/confirm.html?token=${token}`;

    await transporter.sendMail({
    from: `"Pitts Bowling" <${process.env.EMAIL_USER}>`,
    to: email,  
    subject: 'Confirma tu correo - Pitts Bowling',
    html: emailTemplate(
    usuario,               
    "",                     
    "Confirma tu cuenta",   
    "Gracias por registrarte en Pitts Bowling. Haz clic en el botón para confirmar tu cuenta:", 
    "link",                 
    "Confirmar mi correo",  
    verifyLink              
  )
});



    res.status(201).json({ msg: 'Registro exitoso. Revisa tu correo para confirmar la cuenta.' });
  } catch (err) {
    console.error('Register error', err);
    res.status(500).json({ msg: 'Error en registro' });
  }
});

// Confirm email
router.get('/confirm-email', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).json({ msg: 'Token faltante' });

  try {
    const decoded = jwt.verify(token, process.env.EMAIL_TOKEN_SECRET);
    await pool.query('UPDATE usuarios SET email_verified=1 WHERE id=?', [decoded.id]);
    return res.json({ msg: 'Cuenta confirmada con éxito ✅' });
  } catch (err) {
    console.error('Confirm email err', err);
    return res.status(400).json({ msg: 'Token inválido o expirado' });
  }
});

router.post('/login', ipLoginLimiter, async (req, res) => {
  const { usuario, password, recaptcha } = req.body;
  if (!usuario || !password || !recaptcha) {
    return res.status(400).json({ msg: 'Faltan datos o reCAPTCHA' });
  }

  try {
    // verificar reCAPTCHA
    const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptcha}`;
    const googleRes = await fetch(verifyURL, { method: 'POST' });
    const googleData = await googleRes.json();

    if (!googleData.success) {
      return res.status(400).json({ msg: 'Fallo en reCAPTCHA, inténtalo de nuevo' });
    }

    const [rows] = await pool.query('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
    if (!rows.length) {
      await recordFailedLogin(usuario);
      // no revelar existencia
      return res.status(401).json({ msg: 'Usuario o contraseña incorrectos' });
    }
    const user = rows[0];

    // si no está verificado el email, impedir login y reenviar verificación
    if (user.email_verified === 0) {
    const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.EMAIL_TOKEN_SECRET,
    { expiresIn: '1d' }
  );
    const verifyLink = `${process.env.FRONTEND_ORIGIN}/confirm.html?token=${token}`;

    try {

    await transporter.sendMail({
    from: `"Pitts Bowling" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: "Confirma tu correo - Pitts Bowling",
    html: emailTemplate(
    user.usuario,            // usuario
    null,                    // content no se usa aquí
    "Confirma tu cuenta",    // título
    "Gracias por registrarte en Pitts Bowling. Haz clic en el botón:", // subtítulo
    "link",                  // 👈 tipo de contenido (link)
    "Confirmar mi correo",   // texto del botón
    verifyLink               // enlace
  )
});

  } catch (err) {
    console.error("Error reenviando email de confirmación:", err);
  }

    return res.status(403).json({
    msg: 'Confirma tu correo antes de iniciar sesión. Te reenviamos el enlace a tu email.'
  });
}
// Si el usuario estaba bloqueado temporalmente, verificar si el bloqueo expiró

    if (user.locked_until && new Date(user.locked_until).getTime() <= Date.now()) {
  // El bloqueo expiró: reseteamos para que no sigan acumulando viejos intentos
  await resetLockForUser(user.id);
  user.failed_attempts = 0;
  user.locked_until = null;
}

if (user.permanently_blocked) {
  return res.status(403).json({
    msg: 'Cuenta bloqueada permanentemente. Debe cambiar su contraseña para desbloquearla.'
  });
}


    // verificar si la cuenta está bloqueada por demasiados intentos
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
  const lockedUntil = new Date(user.locked_until);
  return res.status(403).json({
    msg: `Cuenta temporalmente bloqueada hasta ${lockedUntil.toLocaleTimeString('es-VE', { timeZone: 'America/Caracas' })}`
  });
}


    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      await recordFailedLogin(user.id);
      return res.status(401).json({ msg: 'Usuario o contraseña incorrectos' });
    }

    // Generar código
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    pending2FA.set(user.id, { code, exp: Date.now() + 5 * 60 * 1000 });
    resend2FAData.delete(user.id); 


    // Enviar email
    await transporter.sendMail({
    from: `"Pitts Bowling" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Tu código de verificación',
    html: emailTemplate(
    user.usuario,         // 👤 usuario
    code,                 // 🔢 aquí va el código
    "Verificación en 2 pasos", 
    "Usa este código para completar tu inicio de sesión. Expira en 5 minutos:",
    "code"                // 👈 tipo especial para mostrar el bloque
  )
});

    return res.json({ msg: 'Código enviado al correo', fase: '2fa', userId: user.id });



  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error de servidor' });
  }
});

router.post('/verify-2fa', async (req, res) => {
  const { userId, code } = req.body;
  const data = pending2FA.get(userId);

  if (!data || Date.now() > data.exp) {
    return res.status(400).json({ msg: 'Código expirado o inválido' });
  }

  if (data.code !== code) {
    return res.status(400).json({ msg: 'Código incorrecto' });
  }

  // Eliminar código usado
  pending2FA.delete(userId);


  // Generar tokens ahora sí
  const [rows] = await pool.query('SELECT id, usuario FROM usuarios WHERE id=?', [userId]);
  const user = rows[0];

// Generar session id única para esta sesión
const sessionId = generateSessionId();

// Access token incluye sid
const payload = { id: user.id, usuario: user.usuario, sid: sessionId };
const access = signAccessToken(payload);

// Refresh token también lleva sid
const refresh = signRefreshToken({ id: user.id, sid: sessionId });
const hash = hashToken(refresh);
const decoded = jwt.decode(refresh);
const expDate = new Date(decoded.exp * 1000);

// Revocar (marcar) otros refresh tokens del usuario ANTES de insertar el nuevo
await pool.query('UPDATE refresh_tokens SET revoked=1 WHERE user_id=?', [user.id]);

// Insertar el refresh token NUEVO indicando session_id
await pool.query(
  'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked, ip, user_agent, session_id) VALUES (?, ?, ?, 0, ?, ?, ?)',
  [user.id, hash, expDate, req.ip || null, req.get('User-Agent') || null, sessionId]
);

// Guardar la session actual en la tabla usuarios
await pool.query('UPDATE usuarios SET current_session=? WHERE id=?', [sessionId, user.id]);
//refrescamos los contadores de bloqueo por login exitoso
await pool.query('UPDATE usuarios SET failed_attempts=0, locked_until=NULL, block_count=0 WHERE id=?', [user.id]);

// Setear cookies igual que antes
const accessExpMs = jwt.decode(access).exp * 1000 - Date.now();
const refreshExpMs = decoded.exp * 1000 - Date.now();
const csrf = generateCsrf();

res
  .cookie('accessToken', access, cookieOptionsFromExp(accessExpMs))
  .cookie('refreshToken', refresh, cookieOptionsFromExp(refreshExpMs, { long: true }))
  .cookie('csrfToken', csrf, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/',
    maxAge: refreshExpMs,
  })
  .json({ msg: 'Login exitoso' });



});

router.post('/resend-2fa', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: 'Falta userId' });

  const now = Date.now();
  const resendInfo = resend2FAData.get(userId) || { lastSent: 0, count: 0 };

  // Tiempo restante si aún está en cooldown
  const cooldown = 60_000; // 60 segundos
  const timeSinceLast = now - resendInfo.lastSent;

  if (timeSinceLast < cooldown) {
    const remaining = Math.ceil((cooldown - timeSinceLast) / 1000);
    return res.status(429).json({
      msg: `Espera ${remaining}s antes de reenviar`,
      remaining
    });
  }

  // Límite de 5 reenvíos por sesión
  if (resendInfo.count >= 5) {
    return res.status(429).json({ msg: 'Has alcanzado el límite de reenvíos para esta sesión', remaining: null });
  }

  // Generar nuevo código 2FA
  const newCode = Math.floor(100000 + Math.random() * 900000).toString();
  pending2FA.set(userId, { code: newCode, exp: now + 5 * 60 * 1000 });

  try {
    const [[userRow]] = await pool.query('SELECT email, usuario FROM usuarios WHERE id=?', [userId]);
    if (!userRow) return res.status(404).json({ msg: 'Usuario no encontrado' });

    await transporter.sendMail({
      from: `"Pitts Bowling" <${process.env.EMAIL_USER}>`,
      to: userRow.email,
      subject: 'Nuevo código de verificación 2FA',
      html: emailTemplate(
        userRow.usuario,
        newCode,
        "Verificación en 2 pasos",
        "Usa este código para completar tu inicio de sesión. Expira en 5 minutos:",
        "code"
      )
    });

    // Actualizar reenvíos
    resend2FAData.set(userId, { lastSent: now, count: resendInfo.count + 1 });

    return res.json({ msg: 'Nuevo código enviado al correo', remaining: 60 });
  } catch (err) {
    console.error('Error reenviando 2FA', err);
    return res.status(500).json({ msg: 'Error enviando código', remaining: null });
  }
});

router.post('/refresh', async (req, res) => {
  // CSRF check
  const csrfHeader = req.get('X-CSRF-Token');
  const csrfCookie = req.cookies?.csrfToken;
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    return res.status(403).json({ msg: 'CSRF token missing or invalid' });
  }

  const refresh = req.cookies?.refreshToken;
  if (!refresh) return res.status(401).json({ msg: 'Refresh requerido' });

  try {
    const decoded = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET);
    const hash = hashToken(refresh);

    // Buscar refresh token en BD
    const [rows] = await pool.query(
      'SELECT * FROM refresh_tokens WHERE user_id=? AND token_hash=?',
      [decoded.id, hash]
    );

    if (!rows.length) {
      // posible reuse — revocamos todo y forzamos re-login
      await pool.query('UPDATE refresh_tokens SET revoked=1 WHERE user_id=?', [decoded.id]);
      console.warn(`Refresh token reuse detected for user ${decoded.id}`);
      return res.status(401).json({ msg: 'Refresh token no reconocido — re-autentícate' });
    }

    const tokenRow = rows[0];
    if (tokenRow.revoked) {
      return res.status(401).json({ msg: 'Refresh revocado' });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return res.status(401).json({ msg: 'Refresh expirado' });
    }

    // Mantener mismo sessionId
    const sessionId = tokenRow.session_id || decoded.sid || null;

    // Generar solo nuevo access token (NO nuevo refresh)
    const [userRows] = await pool.query('SELECT id, usuario FROM usuarios WHERE id=?', [decoded.id]);
    if (!userRows.length) return res.status(401).json({ msg: 'Usuario no existe' });

    const user = userRows[0];
    const newAccess = signAccessToken({ id: user.id, usuario: user.usuario, sid: sessionId });

    const accessExpMs = jwt.decode(newAccess).exp * 1000 - Date.now();
    const refreshExpMs = new Date(tokenRow.expires_at).getTime() - Date.now(); // usa exp original
    const csrf = generateCsrf();

    res
      .cookie('accessToken', newAccess, cookieOptionsFromExp(accessExpMs))
      .cookie('refreshToken', refresh, cookieOptionsFromExp(refreshExpMs, { long: true }))
      .cookie('csrfToken', csrf, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        path: '/',
        maxAge: refreshExpMs,
      })
      .json({ msg: 'Access renovado' });

  } catch (err) {
    console.error(err);
    res.clearCookie('accessToken', cookieOptionsFromExp(0));
    res.clearCookie('refreshToken', cookieOptionsFromExp(0, { long: true }));
    res.status(401).json({ msg: 'Refresh inválido' });
  }
});

//logout con revocación de refresh token
router.post('/logout', async (req, res) => {
  const csrfHeader = req.get('X-CSRF-Token');
  const csrfCookie = req.cookies?.csrfToken;
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    return res.status(403).json({ msg: 'CSRF token missing or invalid' });
  }

  const refresh = req.cookies?.refreshToken;
  if (refresh) {
    try {
      const decoded = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET);
      const hash = hashToken(refresh);
      await pool.query('UPDATE refresh_tokens SET revoked=1 WHERE user_id=? AND token_hash=?', [decoded.id, hash]);
    } catch (_) {}
  }
  res
    .clearCookie('accessToken', cookieOptionsFromExp(0))
    .clearCookie('refreshToken', cookieOptionsFromExp(0, { long: true }))
    .clearCookie('csrfToken', { path: '/', sameSite: 'Strict', secure: process.env.NODE_ENV === 'production' })
    .json({ msg: 'Sesión cerrada' });
});

// Perfil
router.get('/me', authRequired, (req, res) => {
  res.json({ loggedIn: true, id: req.user.id, usuario: req.user.usuario });
});

router.get('/perfil', authRequired, (req, res) => {
  const { usuario, exp } = req.user;
  res.json({ usuario, exp });
});

// Session Status

router.get('/session-status', async (req, res) => {
  const token = req.cookies?.accessToken;
  if (!token) return res.status(401).json({ active: false, msg: 'No token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const [[row]] = await pool.query('SELECT current_session FROM usuarios WHERE id=?', [payload.id]);
    if (!row || row.current_session !== payload.sid) {
      return res.status(401).json({ active: false, msg: 'session_replaced' });
    }
    return res.json({ active: true });
  } catch (e) {
    return res.status(401).json({ active: false, msg: 'Token inválido' });
  }
});

// Forgot Password
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ msg: 'Falta email' });

  try {
    const [rows] = await pool.query('SELECT id, usuario, email_verified FROM usuarios WHERE email=?', [email]);
    if (rows.length) {
      const user = rows[0];
      // opcional: solo enviar si email_verified = 1
      const token = jwt.sign({ id: user.id }, process.env.EMAIL_TOKEN_SECRET, { expiresIn: '3min' });
      const link = `${process.env.FRONTEND_ORIGIN}/reset.html?token=${token}`;

      await transporter.sendMail({
      from: `"Pitts Bowling" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset de contraseña - Pitts Bowling",
      html: emailTemplate(
      user.usuario,                   // 👤 usuario
      null,                           // no usamos content
      "Reestablece tu contraseña",    // título grande
      "Has solicitado resetear tu contraseña. Haz clic en el botón de abajo para continuar:", // subtítulo
      "link",                         // tipo de contenido → botón
      "Reestablecer contraseña",      // texto del botón
      link                            // enlace al reset
  )
});

    }
    // respuesta genérica (para evitar enumeración de emails)
    res.json({ msg: 'Si el correo existe, hemos enviado instrucciones para reestablecer la contraseña' });
  } catch (err) {
    console.error('forgot-password err', err);
    res.status(500).json({ msg: 'Error interno' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ msg: 'Faltan datos' });

  try {
    const decoded = jwt.verify(token, process.env.EMAIL_TOKEN_SECRET);
    // validar fuerza de password
    if (password.length < 8 || !/[0-9]/.test(password) || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
      return res.status(400).json({ msg: 'Contraseña no cumple requisitos' });
    }
    const hashed = await bcrypt.hash(password, 12);
    await pool.query('UPDATE usuarios SET password=? WHERE id=?', [hashed, decoded.id]);

    // invalidar refresh tokens para forzar relogin
    await pool.query('UPDATE refresh_tokens SET revoked=1 WHERE user_id=?', [decoded.id]);
    
    // eliminar cualquier bloqueo previo
    await pool.query('UPDATE usuarios SET failed_attempts=0, locked_until=NULL, block_count=0, permanently_blocked=0 WHERE id=?', [decoded.id]);

    res.json({ msg: 'Contraseña reestablecida. Ahora puedes iniciar sesión' });

  } catch (err) {
    console.error('reset-password err', err);
    res.status(400).json({ msg: 'Token inválido o expirado' });
  }
});

//google

router.get('/google', (req, res) => {
  try {
    const state = randomBytes(16).toString('hex');
    // Guardar state en cookie para validar en callback (httpOnly)
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 10 * 60 * 1000 // 10 min
    });

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline', // opcional (si quieres refresh token desde google)
      prompt: 'consent',
      state
    });

    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (err) {
    console.error('auth/google error', err);
    return res.status(500).send('Error iniciando OAuth');
  }
});

// Callback de Google
router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;
  const cookieState = req.cookies?.oauth_state;
  // Validar state (previene CSRF)
  if (!state || !cookieState || state !== cookieState) {
    return res.status(400).send('Estado inválido en OAuth');
  }
  // limpiar cookie de state
  res.clearCookie('oauth_state');

  if (!code) return res.status(400).send('Código OAuth faltante');

  try {
    // Intercambio de código por tokens (servidor -> Google)
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code'
      })
    });

    const tokenJson = await tokenResp.json();
    if (tokenJson.error) {
      console.error('Token exchange error', tokenJson);
      return res.status(400).send('Error al intercambiar código con Google');
    }

    const idToken = tokenJson.id_token;
    if (!idToken) {
      console.error('Sin id_token en respuesta de Google', tokenJson);
      return res.status(400).send('id_token faltante de Google');
    }

    // Verificar id_token en tokeninfo (Google). También comprobamos 'aud'
    const verifyResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    const profile = await verifyResp.json();
    if (profile.error_description || profile.error) {
      console.error('Tokeninfo error', profile);
      return res.status(400).send('Token inválido');
    }
    if (profile.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(400).send('Token no destinado a este cliente');
    }
    if (!profile.email) return res.status(400).send('Email no disponible en perfil Google');

    // Buscar usuario por email
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [profile.email]);
    let user;
    if (rows.length) {
      user = rows[0];
    } else {
      // Crear nuevo usuario en tu tabla 'usuarios'
      const name = profile.given_name || (profile.name ? profile.name.split(' ')[0] : 'Usuario');
      const last_name = profile.family_name || (profile.name ? profile.name.split(' ').slice(1).join(' ') : '');
      // Generar usuario único a partir del local part del email
      let baseUser = profile.email.split('@')[0].replace(/[^\w.-]/g, '').toLowerCase().slice(0, 20) || 'user';
      let usuario = baseUser;
      let attempt = 0;
      while (true) {
        const [existsRows] = await pool.query('SELECT id FROM usuarios WHERE usuario = ?', [usuario]);
        if (!existsRows.length) break;
        attempt++;
        usuario = `${baseUser}${attempt}`;
      }
      // Como password es NOT NULL en tu esquema, guardamos una contraseña aleatoria hasheada
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const hashed = await bcrypt.hash(randomPassword, 12);
      const [result] = await pool.query(
        'INSERT INTO usuarios (name, last_name, usuario, password, email_verified, email) VALUES (?, ?, ?, ?, 1, ?)',
        [name, last_name, usuario, hashed, profile.email]
      );
      const userId = result.insertId;
      const [[newUserRow]] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [userId]);
      user = newUserRow;
    }

// Verificar si el usuario está bloqueado permanente o temporalmente
  if (user.permanently_blocked) {
  return res.redirect(`${process.env.FRONTEND_ORIGIN}/index.html?error=permanent`);
}

if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
  const until = new Date(user.locked_until).getTime();
  return res.redirect(`${process.env.FRONTEND_ORIGIN}/index.html?error=locked&until=${until}`);
}

// Resetear counters de bloqueo por login exitoso
    await pool.query('UPDATE usuarios SET failed_attempts = 0, locked_until = NULL, block_count = 0 WHERE id=?', [user.id]);
// Asegurar que email_verified está a 1
    await pool.query('UPDATE usuarios SET email_verified = 1 WHERE id=? AND email_verified = 0', [user.id]);


// Generar session id única para esta sesión
    const sessionId = generateSessionId();

// Access token incluye sid
    const payload = { id: user.id, usuario: user.usuario, sid: sessionId };
    const access = signAccessToken(payload);

// Refresh token también lleva sid
    const refresh = signRefreshToken({ id: user.id, sid: sessionId });
    const hash = hashToken(refresh);
    const decoded = jwt.decode(refresh);
    const expDate = new Date(decoded.exp * 1000);

// Revocar (marcar) otros refresh tokens del usuario ANTES de insertar el nuevo
    await pool.query('UPDATE refresh_tokens SET revoked=1 WHERE user_id=?', [user.id]);

// Insertar el refresh token NUEVO indicando session_id
    await pool.query(
  'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked, ip, user_agent, session_id) VALUES (?, ?, ?, 0, ?, ?, ?)',
  [user.id, hash, expDate, req.ip || null, req.get('User-Agent') || null, sessionId]
);

// Guardar la session actual en la tabla usuarios
await pool.query('UPDATE usuarios SET current_session=? WHERE id=?', [sessionId, user.id]);


    const accessExpMs = jwt.decode(access).exp * 1000 - Date.now();
    const refreshExpMs = decoded.exp * 1000 - Date.now();
    const csrf = generateCsrf();

    // Setear cookies idénticas al flujo normal y redirigir al frontend
    return res
      .cookie('accessToken', access, cookieOptionsFromExp(accessExpMs))
      .cookie('refreshToken', refresh, cookieOptionsFromExp(refreshExpMs, { long: true }))
      .cookie('csrfToken', csrf, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        path: '/',
        maxAge: refreshExpMs,
      })
      .redirect(`${process.env.FRONTEND_ORIGIN}/index.html`);
  } catch (err) {
    console.error('Error en callback Google OAuth', err);
    return res.status(500).send('Error interno en OAuth');
  }
});

module.exports = router;



