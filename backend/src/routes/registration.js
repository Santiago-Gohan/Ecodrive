const router = require('express').Router();
const pool = require('../db');
const { generarApiKey } = require('../utils/apiKey');

const COMBUSTIBLES = { gasolina: 'GASOLINA', diesel: 'DIESEL', 'diésel': 'DIESEL' };

function evaluarCompatibilidad({ combustible, anio, tipo }) {
  const a = Number(anio);
  const comb = COMBUSTIBLES[String(combustible || '').toLowerCase().trim()];

  if (!Number.isFinite(a) || a < 1950 || a > 2030) {
    return {
      compatible: false,
      motivo: 'Ingresa un año válido del vehículo (1950–2030).',
      sugerencia: null,
    };
  }

  if (!comb) {
    return {
      compatible: false,
      motivo: 'Falta el tipo de combustible (gasolina o diésel).',
      sugerencia: null,
    };
  }

  const esMoto = String(tipo || '').trim().toUpperCase() === 'MOTO';
  if (esMoto) {
    return {
      compatible: false,
      motivo: 'Las motos no tienen puerto OBD-II.'
        + ' Solo se integra GPS/localización (línea futura).',
      sugerencia: null,
    };
  }

  const esBusPesado = ['BUS', 'CAMION'].includes(String(tipo || '').trim().toUpperCase());

  if (comb === 'DIESEL') {
    if (a >= 2010) {
      return {
        compatible: true,
        motivo: 'Diésel 2010+ (Euro 4) con OBD-II estándar.'
          + (esBusPesado ? ' Recuerda: buses/camiones suelen usar conexión J1939 de 9 pines (kit).' : ''),
        sugerencia: esBusPesado ? 'Requiere kit J1939 (MCP2551) para buses/camiones.' : null,
      };
    }
    return {
      compatible: false,
      motivo: 'Diésel anterior a 2010 sin puerto OBD estandarizado en la mayoría.'
        + ' Solo GPS/localización.',
      sugerencia: 'Considerar kit J1939 si es bus/camión y requiere telemetría de motor.',
    };
  }

  // GASOLINA
  if (a >= 2013) {
    return {
      compatible: true,
      motivo: 'Gasolina 2013+ con OBD-II estándar (obligatorio en Colombia). Telemetría completa.',
      sugerencia: null,
    };
  }
  if (a >= 2004) {
    return {
      compatible: true,
      motivo: 'Gasolina 2004–2012: compatible, validar PIDs propietarios por modelo.'
        + ' Telemetría general.',
      sugerencia: 'Validar por modelo (algunos PIDs pueden no responder).',
    };
  }
  return {
    compatible: false,
    motivo: 'Gasolina anterior a 2004 sin OBD estándar en el país. Solo GPS/localización.',
    sugerencia: null,
  };
}

router.get('/', (req, res) => {
  const { combustible, anio, tipo } = req.query || {};
  res.json(evaluarCompatibilidad({ combustible, anio, tipo }));
});

router.post('/', async (req, res, next) => {
  try {
    const { placa, nombre, combustible, anio, tipo } = req.body || {};
    const placaFinal = String(placa || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');

    if (!placaFinal) {
      return res.status(400).json({ error: 'La placa es obligatoria' });
    }

    const veredicto = evaluarCompatibilidad({ combustible, anio, tipo });

    if (!veredicto.compatible) {
      return res.status(409).json({
        error: veredicto.motivo,
        compatible: false,
        motivo: veredicto.motivo,
        sugerencia: veredicto.sugerencia,
      });
    }

    const apiKey = generarApiKey();
    const { rows } = await pool.query(
      `INSERT INTO vehiculos (placa, api_key, nombre, anio, combustible, tipo_vehiculo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, placa, nombre`,
      [
        placaFinal,
        apiKey,
        nombre || null,
        Number(anio) || null,
        COMBUSTIBLES[String(combustible || '').toLowerCase().trim()] || null,
        String(tipo || 'CARRO').trim().toUpperCase(),
      ]
    );

    res.status(201).json({
      vehiculo: rows[0],
      api_key: apiKey,
      compatible: true,
      motivo: veredicto.motivo,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'La placa ya está registrada', compatible: false });
    }
    next(err);
  }
});

module.exports = router;
