require('dotenv').config();

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('ADVERTENCIA: usando JWT_SECRET por defecto en producción. Define JWT_SECRET.');
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/ecodrive',
  jwtSecret: process.env.JWT_SECRET || 'ecodrive_dev_secret_2026',
  loginMaxIntentos: parseInt(process.env.LOGIN_MAX_INTENTOS || '10', 10),
  loginVentanaMin: parseInt(process.env.LOGIN_VENTANA_MIN || '5', 10),
  umbralEct: parseFloat(process.env.THRESHOLD_ECT || '105'),
  severidadAlerta: process.env.SEVERIDAD_ALERTA || 'ALTA',
  telemetriaRetencionDias: parseInt(process.env.TELEMETRIA_RETENCION_DIAS || '30', 10),
  purgaIntervaloMin: parseInt(process.env.PURGA_INTERVALO_MIN || '60', 10),
  limiteLecturasMinuto: parseInt(process.env.LIMITE_LECTURAS_MINUTO || '2400', 10),
  limiteVinculosMinuto: parseInt(process.env.LIMITE_VINCULOS_MINUTO || '10', 10),
  limiteOpinionesMinuto: parseInt(process.env.LIMITE_OPINIONES_MINUTO || '5', 10),
  limiteEventosMinuto: parseInt(process.env.LIMITE_EVENTOS_MINUTO || '10', 10),
  eventosRetencionHoras: parseInt(process.env.EVENTOS_RETENCION_HORAS || '3', 10),
};