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
         v.id, v.placa, v.nombre, v.tipo_vehiculo, v.combustible, v.anio,
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

// Lote offline (zonas rurales): recibe hasta 5000 lecturas guardadas sin conexion.
// Inserta en una transaccion y genera UNA alerta si el maximo ECT la amerita.
router.get('/quien-soy', deviceAuth, (req, res) => {
  res.json({ id: req.vehiculo.id, placa: req.vehiculo.placa });
});

router.post('/lote', deviceAuth, async (req, res, next) => {
  try {
    const lecturas = req.body && req.body.lecturas;
    if (!Array.isArray(lecturas) || !lecturas.length || lecturas.length > 5000) {
      return res.status(400).json({ error: 'Envia { lecturas: [...] } con 1..5000 elementos' });
    }
    const validas = [];
    for (const l of lecturas) {
      const ectNum = Number(l && l.ect);
      const rpmNum = Number(l && l.rpm);
      if (!l || l.vehiculo_id !== req.vehiculo.id) {
        return res.status(403).json({ error: 'El lote contiene lecturas de otro vehiculo' });
      }
      if (!Number.isFinite(ectNum) || !Number.isFinite(rpmNum) ||
          ectNum < -40 || ectNum > 150 || rpmNum < 0 || rpmNum > 9000) {
        return res.status(400).json({ error: 'El lote contiene lecturas fuera de rango' });
      }
      let ts = (l && l.timestamp) || null;
      if (ts && isNaN(Date.parse(ts))) ts = null;
      validas.push([req.vehiculo.id, ectNum, rpmNum, ts]);
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const v of validas) {
        await client.query(
          `INSERT INTO telemetria_lectura (vehiculo_id, ect_temperatura, rpm, fecha_registro)
           VALUES ($1, $2, $3, COALESCE($4, now()))`,
          v
        );
      }
      let alerta = null;
      const maxEct = Math.max(...validas.map((v) => v[1]));
      if (maxEct > config.umbralEct) {
        const ya = await client.query(
          `SELECT id FROM alerta_mantenimiento
           WHERE vehiculo_id = $1 AND estado IN ('PENDIENTE', 'ACTIVA')`,
          [req.vehiculo.id]
        );
        if (!ya.rows.length) {
          const ins = await client.query(
            `INSERT INTO alerta_mantenimiento (vehiculo_id, tipo_alerta, severidad, estado)
             VALUES ($1, 'SOBRECALENTAMIENTO', $2, 'ACTIVA') RETURNING *`,
            [req.vehiculo.id, config.severidadAlerta]
          );
          alerta = ins.rows[0];
          const io = req.app.get('io');
          const evento = {
            alertaId: alerta.id, vehiculoId: req.vehiculo.id, placa: req.vehiculo.placa,
            ect: maxEct, severidad: alerta.severidad, timestamp: alerta.fecha_generacion,
          };
          io.emit('alerta:nueva', evento);
          io.to(`vehiculo:${req.vehiculo.id}`).emit('alerta:nueva', evento);
        }
      }
      await client.query('COMMIT');
      res.status(201).json({ recibidas: validas.length, alerta });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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