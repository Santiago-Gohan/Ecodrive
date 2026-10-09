const router = require('express').Router();
const pool = require('../db');
const adminAuth = require('../middleware/adminAuth');
const requierePermiso = require('../middleware/permAuth');
const { registrar } = require('../services/audit');

const VERSION_PRIVACIDAD = '1.0';

/* ---------- Público ---------- */

// Registro de consentimiento de tratamiento de datos personales.
router.post('/consentimiento', async (req, res, next) => {
  try {
    const { tipo, identificador, aceptado } = req.body || {};
    if (!identificador) {
      return res.status(400).json({ error: 'El identificador (correo/teléfono/placa) es obligatorio' });
    }
    const t = ['PRIVACIDAD', 'MARKETING', 'TERMINOS'].includes(tipo) ? tipo : 'PRIVACIDAD';
    const { rows } = await pool.query(
      `INSERT INTO consentimientos (tipo, version, identificador, aceptado, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, tipo, version, aceptado, created_at`,
      [t, VERSION_PRIVACIDAD, String(identificador).slice(0, 150), aceptado !== false,
       req.ip, String(req.headers['user-agent'] || '').slice(0, 300)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Solicitud de datos (ARCO: acceso, rectificación, cancelación, oposición).
router.post('/solicitud', async (req, res, next) => {
  try {
    const { tipo, identificador, descripcion } = req.body || {};
    const TIPOS = ['ACCESO', 'RECTIFICACION', 'ELIMINACION', 'OPOSICION'];
    if (!TIPOS.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de solicitud inválido' });
    }
    if (!identificador) {
      return res.status(400).json({ error: 'El identificador es obligatorio' });
    }
    const { rows } = await pool.query(
      `INSERT INTO solicitudes_datos (tipo, identificador, descripcion)
       VALUES ($1,$2,$3) RETURNING id, tipo, estado, created_at`,
      [tipo, String(identificador).slice(0, 150), String(descripcion || '').slice(0, 2000) || null]
    );
    res.status(201).json({ ok: true, ...rows[0] });
  } catch (err) {
    next(err);
  }
});

/* ---------- Administración ---------- */

router.use(adminAuth);

router.get('/consentimientos', requierePermiso('configuracion:ver'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, tipo, version, identificador, aceptado, ip, created_at
       FROM consentimientos ORDER BY created_at DESC LIMIT 500`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/solicitudes', requierePermiso('configuracion:ver'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM solicitudes_datos ORDER BY created_at DESC LIMIT 500'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.put('/solicitudes/:id', requierePermiso('configuracion:editar'), async (req, res, next) => {
  try {
    const { estado } = req.body || {};
    const ESTADOS = ['PENDIENTE', 'EN_PROCESO', 'RESUELTA', 'RECHAZADA'];
    if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    const { rows } = await pool.query(
      `UPDATE solicitudes_datos
       SET estado = $2::text, resuelto_en = CASE WHEN $2::text IN ('RESUELTA','RECHAZADA') THEN now() ELSE resuelto_en END
       WHERE id = $1 RETURNING *`,
      [req.params.id, estado]
    );
    if (!rows.length) return res.status(404).json({ error: 'Solicitud no encontrada' });
    registrar({ usuario: req.usuario.sub, ip: req.ip, recurso: 'privacidad', accion: 'resolver_solicitud', detalles: { id: req.params.id, estado } });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
