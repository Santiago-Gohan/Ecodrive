const router = require('express').Router();
const pool = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { consumirPorIp } = require('../middleware/rateLimiter');
const config = require('../config');

const ESTADOS = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];

function ipDe(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.ip || 'anon';
}

function limpiar(v, max) {
  const s = String(v == null ? '' : v).trim();
  return s ? s.slice(0, max) : null;
}

/* ---------- Público: enviar una opinión ---------- */
router.post('/', async (req, res, next) => {
  try {
    const r = consumirPorIp('op:' + ipDe(req), config.limiteOpinionesMinuto);
    if (!r.ok) {
      res.setHeader('Retry-After', String(r.retrySe));
      return res.status(429).json({ error: 'Demasiados envíos seguidos. Intenta de nuevo en un momento.' });
    }

    const b = req.body || {};
    const rol = limpiar(b.rol, 60);
    const temas = limpiar(b.temas, 200);
    const comentario = limpiar(b.comentario, 1200);
    const nombre = limpiar(b.nombre, 80);
    const contacto = limpiar(b.contacto, 120);

    if (!rol && !temas && !comentario) {
      return res.status(400).json({ error: 'Cuéntanos algo antes de enviar' });
    }

    const { rows } = await pool.query(
      `INSERT INTO opiniones (rol, temas, comentario, nombre, contacto)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, creado_en`,
      [rol, temas, comentario, nombre, contacto]
    );
    res.status(201).json({ ok: true, id: rows[0].id, creado_en: rows[0].creado_en });
  } catch (err) {
    next(err);
  }
});

/* ---------- Público: opiniones aprobadas (se muestran en la web) ---------- */
router.get('/publicas', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, rol, temas, comentario, nombre, creado_en
       FROM opiniones
       WHERE estado = 'APROBADA'
       ORDER BY revisado_en DESC NULLS LAST, creado_en DESC
       LIMIT 30`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/* ---------- A partir de aquí solo administradores ---------- */
router.use(adminAuth);

router.get('/', async (req, res, next) => {
  try {
    const estado = limpiar(req.query.estado, 20);
    const filtro = estado && ESTADOS.includes(estado.toUpperCase()) ? estado.toUpperCase() : null;
    const { rows } = await pool.query(
      `SELECT id, rol, temas, comentario, nombre, contacto, estado, creado_en, revisado_en
       FROM opiniones
       ${filtro ? 'WHERE estado = $1' : ''}
       ORDER BY CASE estado WHEN 'PENDIENTE' THEN 0 ELSE 1 END, creado_en DESC
       LIMIT 500`,
      filtro ? [filtro] : []
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const estado = limpiar(req.body && req.body.estado, 20);
    if (!estado || !ESTADOS.includes(estado.toUpperCase())) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const { rows } = await pool.query(
      `UPDATE opiniones SET estado = $2, revisado_en = now()
       WHERE id = $1
       RETURNING id, estado, revisado_en`,
      [req.params.id, estado.toUpperCase()]
    );
    if (!rows.length) return res.status(404).json({ error: 'Opinión no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('DELETE FROM opiniones WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Opinión no encontrada' });
    res.json({ message: 'Opinión eliminada' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
