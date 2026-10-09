const router = require('express').Router();
const jwt = require('jsonwebtoken');
const config = require('../config');
const pool = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { registrar } = require('../services/audit');
const {
  verifyPassword,
  hashPassword,
  obtenerPermisos,
  getUsuarioPorUsername,
} = require('../services/usuarios');

// Anti fuerza bruta: por IP, X intentos por ventana antes de responder 429.
const intentos = new Map();
const MAX_INTENTOS = config.loginMaxIntentos;
const VENTANA_MS = config.loginVentanaMin * 60 * 1000;

function limpiarVentanas() {
  const ahora = Date.now();
  for (const [ip, d] of intentos) {
    if (ahora > d.resetAt) intentos.delete(ip);
  }
}
setInterval(limpiarVentanas, 60 * 1000).unref();

function firmar(usuario) {
  return jwt.sign(
    {
      sub: usuario.username,
      role: usuario.role,
      uid: usuario.uid,
      sede: usuario.sede || null,
      nombre: usuario.nombre || usuario.username,
    },
    config.jwtSecret,
    { expiresIn: '8h' }
  );
}

router.post('/login', async (req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress || 'desconocida';
  const ahora = Date.now();
  const actual = intentos.get(ip);

  if (actual && ahora < actual.resetAt && actual.count >= MAX_INTENTOS) {
    const retrySe = Math.ceil((actual.resetAt - ahora) / 1000);
    res.set('Retry-After', String(retrySe));
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Intenta en ${retrySe}s.`,
    });
  }

  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
    }

    let usuario = null;
    const fila = await getUsuarioPorUsername(username);
    if (fila && fila.activo) {
      const ok = await verifyPassword(password, fila.password_hash);
      if (ok) {
        usuario = {
          username: fila.username,
          role: fila.rol || 'admin',
          uid: fila.id,
          sede: fila.sede,
          nombre: fila.nombre,
        };
      }
    }

    // Fallback de arranque: si la tabla aún no tiene usuarios, aceptar el admin de ENV.
    if (!usuario && !fila) {
      const envUser = process.env.ADMIN_USER || 'admin';
      const envPass = process.env.ADMIN_PASS || 'admin123';
      if (username === envUser && password === envPass) {
        usuario = { username: envUser, role: 'admin', uid: null, sede: null, nombre: 'Administrador' };
      }
    }

    if (!usuario) {
      if (!actual || ahora >= actual.resetAt) {
        intentos.set(ip, { count: 1, resetAt: ahora + VENTANA_MS });
      } else {
        actual.count += 1;
      }
      registrar({ usuario: username, ip, recurso: 'auth', accion: 'login_fallido' });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    intentos.delete(ip);
    if (usuario.uid) {
      await pool.query('UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1', [usuario.uid]);
    }
    const permisos = usuario.role === 'admin' ? ['*'] : await obtenerPermisos(usuario.username);
    registrar({ usuario: usuario.username, ip, recurso: 'auth', accion: 'login_ok' });

    const token = firmar(usuario);
    res.json({
      token,
      role: usuario.role,
      nombre: usuario.nombre,
      sede: usuario.sede,
      permisos,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', adminAuth, async (req, res, next) => {
  try {
    const username = req.usuario.sub;
    const fila = await getUsuarioPorUsername(username);
    const permisos = req.usuario.role === 'admin' ? ['*'] : await obtenerPermisos(username);
    res.json({
      username,
      role: req.usuario.role,
      nombre: req.usuario.nombre || fila?.nombre || username,
      sede: req.usuario.sede || fila?.sede || null,
      email: fila?.email || null,
      telefono: fila?.telefono || null,
      permisos,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/password', adminAuth, async (req, res, next) => {
  try {
    const { actual, nueva } = req.body || {};
    if (!nueva || String(nueva).length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }
    const username = req.usuario.sub;
    const fila = await getUsuarioPorUsername(username);
    if (!fila) return res.status(404).json({ error: 'Usuario no encontrado' });

    const ok = await verifyPassword(actual, fila.password_hash);
    if (!ok) return res.status(401).json({ error: 'La contraseña actual no es correcta' });

    const hash = await hashPassword(nueva);
    await pool.query(
      'UPDATE usuarios SET password_hash = $2, debe_cambiar_password = false WHERE id = $1',
      [fila.id, hash]
    );
    registrar({ usuario: username, ip: req.ip, recurso: 'usuarios', accion: 'cambio_password' });
    res.json({ message: 'Contraseña actualizada' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
