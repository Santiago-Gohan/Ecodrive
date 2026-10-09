const router = require('express').Router();
const pool = require('../db');
const adminAuth = require('../middleware/adminAuth');
const requierePermiso = require('../middleware/permAuth');
const { registrar } = require('../services/audit');
const { generarApiKey } = require('../utils/apiKey');

router.use(adminAuth);

router.get('/', requierePermiso('flota:ver'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.id, d.vehiculo_id, v.placa, d.tipo, d.imei, d.modelo, d.fabricante,
              d.protocolo, d.sim_msisdn, d.ultimo_ping, d.activo, d.created_at
       FROM dispositivos d
       LEFT JOIN vehiculos v ON v.id = d.vehiculo_id
       ORDER BY d.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requierePermiso('flota:editar'), async (req, res, next) => {
  try {
    const { vehiculo_id, tipo, imei, modelo, fabricante, protocolo, sim_msisdn } = req.body || {};
    if (!vehiculo_id) return res.status(400).json({ error: 'El vehículo es obligatorio' });
    const apiKey = generarApiKey();
    const { rows } = await pool.query(
      `INSERT INTO dispositivos (vehiculo_id, tipo, imei, modelo, fabricante, protocolo, sim_msisdn, api_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, vehiculo_id, tipo, imei, modelo, fabricante, protocolo, sim_msisdn, api_key, activo`,
      [vehiculo_id, tipo || 'GPS_FIJO', imei || null, modelo || null, fabricante || null,
       protocolo || 'HTTP_GENERICO', sim_msisdn || null, apiKey]
    );
    if (tipo === 'GPS_FIJO') {
      await pool.query(
        `UPDATE vehiculos SET tipo_conexion = 'GPS_FIJO', origen_datos = 'GPS_FIJO' WHERE id = $1`,
        [vehiculo_id]
      );
    }
    registrar({ usuario: req.usuario.sub, ip: req.ip, recurso: 'dispositivos', accion: 'crear', detalles: { imei } });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese IMEI ya está registrado' });
    next(err);
  }
});

router.put('/:id', requierePermiso('flota:editar'), async (req, res, next) => {
  try {
    const b = req.body || {};
    const cols = ['modelo', 'fabricante', 'protocolo', 'sim_msisdn', 'activo', 'vehiculo_id', 'imei'];
    const campos = [];
    const params = [req.params.id];
    for (const c of cols) {
      if (c in b) { campos.push(`${c} = $${params.length + 1}`); params.push(b[c]); }
    }
    if (!campos.length) return res.status(400).json({ error: 'No hay campos para actualizar' });
    const { rows } = await pool.query(`UPDATE dispositivos SET ${campos.join(', ')} WHERE id = $1 RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Dispositivo no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requierePermiso('flota:editar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('DELETE FROM dispositivos WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Dispositivo no encontrado' });
    res.json({ message: 'Dispositivo eliminado' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/regenerar-key', requierePermiso('flota:editar'), async (req, res, next) => {
  try {
    const apiKey = generarApiKey();
    const { rows } = await pool.query(
      'UPDATE dispositivos SET api_key = $2 WHERE id = $1 RETURNING id, vehiculo_id, api_key',
      [req.params.id, apiKey]
    );
    if (!rows.length) return res.status(404).json({ error: 'Dispositivo no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
