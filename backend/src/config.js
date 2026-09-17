require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/ecodrive',
  jwtSecret: process.env.JWT_SECRET || 'ecodrive_dev_secret_2026',
  umbralEct: parseFloat(process.env.THRESHOLD_ECT || '105'),
  severidadAlerta: process.env.SEVERIDAD_ALERTA || 'ALTA',
};