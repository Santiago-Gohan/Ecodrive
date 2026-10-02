const router = require('express').Router();
const pool = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { consumirPorIp } = require('../middleware/rateLimiter');
const config = require('../config');

const TIPOS = ['POLICIA', 'ACCIDENTE', 'RETEN', 'OBRA', 'OTRO'];

function ipDe(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.ip || 'anon';
}

function limpiar(v, max) {
  const s = String(v == null ? '' : v).trim();
  return s ? s.slice(0, max) : null;
}

/* ---------- Público: reportar un evento en la vía ---------- */
router.post('/', async (req, res, next) => {
  try {
    const r = consumirPorIp('ev:' + ipDe(req), config.limiteEventosMinuto);
    if (!r.ok) {
      res.setHeader('Retry-After', String(r.retrySe));
      return res.status(429).json({ error: 'Demasiados reportes seguidos. Espera un momento.' });
    }

    const b = req.body || {};
    const tipo = String(b.tipo || '').trim().toUpperCase();
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    const descripcion = limpiar(b.descripcion, 300);
    const placa = limpiar(b.placa, 20);

    if (!TIPOS.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de evento no válido' });
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Ubicación no válida' });
    }

    let vehiculoId = null;
    if (placa) {
      const { rows } = await pool.query(
        `SELECT id FROM vehiculos
         WHERE regexp_replace(UPPER(placa), '[^A-Z0-9]', '', 'g') = $1
         LIMIT 1`,
        [placa.replace(/[^A-Z0-9]/gi, '').toUpperCase()]
      );
      if (rows.length) vehiculoId = rows[0].id;
    }

    const { rows } = await pool.query(
      `INSERT INTO eventos_viales (tipo, lat, lng, descripcion, placa, vehiculo_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tipo, lat, lng, descripcion, placa, creado_en`,
      [tipo, lat, lng, descripcion, placa, vehiculoId]
    );

    const evento = rows[0];
    const io = req.app.get('io');
    if (io) io.emit('evento:nuevo', evento);

    res.status(201).json({ ok: true, ...evento });
  } catch (err) {
    next(err);
  }
});

/* ---------- Público: eventos activos recientes (para el mapa) ---------- */
router.get('/', async (req, res, next) => {
  try {
    const pedidas = parseInt(req.query.horas, 10);
    const horas = Number.isFinite(pedidas)
      ? Math.min(Math.max(pedidas, 1), 48)
      : config.eventosRetencionHoras;

    const { rows } = await pool.query(
      `SELECT id, tipo, lat, lng, descripcion, placa, creado_en
       FROM eventos_viales
       WHERE creado_en > now() - make_interval(hours => $1::int)
       ORDER BY creado_en DESC
       LIMIT 200`,
      [horas]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/* ---------- A partir de aquí solo administradores ---------- */
router.use(adminAuth);

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('DELETE FROM eventos_viales WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json({ message: 'Evento eliminado' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
