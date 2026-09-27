const router = require('express').Router();
const pool = require('../db');
const config = require('../config');
const deviceAuth = require('../middleware/deviceAuth');
const adminAuth = require('../middleware/adminAuth');
const { registraLectura } = require('../services/alertService');

router.post('/demo', adminAuth, async (req, res, next) => {
  try {
    const { placa, ect, rpm } = req.body || {};
    const ectNum = Number(ect);

    if (!placa || !Number.isFinite(ectNum)) {
      return res.status(400).json({ error: 'Faltan datos de la placa o la temperatura' });
    }

    const { rows } = await pool.query(
      'SELECT id, placa FROM vehiculos WHERE placa = $1 AND activo = true',
      [placa]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const resultado = await registraLectura({
      vehiculo: rows[0],
      ect: ectNum,
      rpm: rpm || 2500,
      timestamp: new Date().toISOString(),
    });

    if (resultado.excede) {
      const io = req.app.get('io');
      const evento = {
        alertaId: resultado.alerta ? resultado.alerta.id : null,
        vehiculoId: rows[0].id,
        placa: rows[0].placa,
        ect: ectNum,
        rpm: rpm || 2500,
        severidad: config.severidadAlerta,
        timestamp: new Date().toISOString(),
      };
      io.emit('alerta:nueva', evento);
      io.to(`vehiculo:${rows[0].id}`).emit('alerta:nueva', evento);
      console.log(`[ALERTA] Vehículo ${rows[0].placa} en sobrecalentamiento (${ectNum}°C) [demo]`);
    }

    res.status(201).json({ message: 'Lectura registrada', alerta: resultado.alerta || null });
  } catch (err) {
    next(err);
  }
});

router.get('/resumen', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         v.id, v.placa, v.nombre,
         (SELECT t.ect_temperatura FROM telemetria_lectura t
          WHERE t.vehiculo_id = v.id ORDER BY t.fecha_registro DESC LIMIT 1) AS ect,
         (SELECT t.rpm FROM telemetria_lectura t
          WHERE t.vehiculo_id = v.id ORDER BY t.fecha_registro DESC LIMIT 1) AS rpm,
         (SELECT t.fecha_registro FROM telemetria_lectura t
          WHERE t.vehiculo_id = v.id ORDER BY t.fecha_registro DESC LIMIT 1) AS ultima_lectura,
         (SELECT COUNT(*) FROM alerta_mantenimiento a
          WHERE a.vehiculo_id = v.id AND a.estado IN ('PENDIENTE', 'ACTIVA')) AS alertas_activas
       FROM vehiculos v
       ORDER BY v.placa`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', deviceAuth, async (req, res, next) => {
  try {
    const { vehiculo_id, ect, rpm, timestamp } = req.body || {};
    const ectNum = Number(ect);
    const rpmNum = Number(rpm);

    if (!vehiculo_id || !Number.isFinite(ectNum) || !Number.isFinite(rpmNum)) {
      return res.status(400).json({ error: 'Payload JSON invǭlido' });
    }

    // Rangos fisicamente plausibles: descarta basura de adaptadores desincronizados
    // ECT: -40..150 °C | RPM: 0..9000
    if (ectNum < -40 || ectNum > 150 || rpmNum < 0 || rpmNum > 9000) {
      return res.status(400).json({ error: 'Lectura fuera de rango plausible (ECT -40..150, RPM 0..9000)' });
    }

    if (vehiculo_id !== req.vehiculo.id) {
      return res
        .status(403)
        .json({ error: 'El dispositivo no pertenece al vehículo indicado' });
    }

    const resultado = await registraLectura({
      vehiculo: req.vehiculo,
      ect: ectNum,
      rpm: rpmNum,
      timestamp,
    });

    if (resultado.alerta) {
      const io = req.app.get('io');
      const evento = {
        alertaId: resultado.alerta.id,
        vehiculoId: req.vehiculo.id,
        placa: req.vehiculo.placa,
        ect: ectNum,
        rpm: rpmNum,
        severidad: resultado.alerta.severidad,
        timestamp: resultado.alerta.fecha_generacion,
      };
      io.emit('alerta:nueva', evento);
      io.to(`vehiculo:${req.vehiculo.id}`).emit('alerta:nueva', evento);
      console.log(`[ALERTA] Vehículo ${req.vehiculo.placa} en sobrecalentamiento (${ectNum}°C)`);
    }

    res.status(201).json({
      message: 'Lectura registrada',
      lectura: resultado.lectura,
      alerta: resultado.alerta || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;