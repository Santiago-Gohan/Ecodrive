require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/ecodrive',
  jwtSecret: process.env.JWT_SECRET || 'ecodrive_dev_secret_2026',
  umbralEct: parseFloat(process.env.THRESHOLD_ECT || '105'),
  severidadAlerta: process.env.SEVERIDAD_ALERTA || 'ALTA',
  telemetriaRetencionDias: parseInt(process.env.TELEMETRIA_RETENCION_DIAS || '30', 10),
  purgaIntervaloMin: parseInt(process.env.PURGA_INTERVALO_MIN || '60', 10),
  limiteLecturasMinuto: parseInt(process.env.LIMITE_LECTURAS_MINUTO || '2400', 10),
};