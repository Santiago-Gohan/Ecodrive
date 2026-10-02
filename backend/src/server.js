const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const config = require('./config');
const pool = require('./db');
const telemetryRoute = require('./routes/telemetry');
const authRoute = require('./routes/auth');
const vehiculosRoute = require('./routes/vehiculos');
const historialRoute = require('./routes/historial');
const registrationRoute = require('./routes/registration');
const opinionesRoute = require('./routes/opiniones');
const eventosRoute = require('./routes/eventos');
const { iniciarRetencion } = require('./services/retention');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const EPSILON_PROD = process.env.NODE_ENV === 'production';

const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
"script-src 'self' 'unsafe-inline' https://unpkg.com; " +
      "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; " +
      "img-src 'self' data: blob: https:; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "connect-src 'self' ws: wss: https:; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "frame-ancestors 'none'; " +
      "form-action 'self'"
  );
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
};

app.use(securityHeaders);
app.use(express.json({ limit: '1mb' }));
app.set('io', io);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-API-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api/v1/telemetry', telemetryRoute);
app.use('/api/v1/auth', authRoute);
app.use('/api/v1/vehiculos', vehiculosRoute);
app.use('/api/v1/historial', historialRoute);
app.use('/api/v1/registration', registrationRoute);
app.use('/api/v1/opiniones', opinionesRoute);
app.use('/api/v1/eventos', eventosRoute);

app.get('/api/v1/health', async (req, res) => {
  const base = {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    hora: new Date().toISOString(),
  };
  try {
    await pool.query('SELECT 1');
    res.json({ ...base, db: 'ok' });
  } catch (err) {
    res.status(503).json({ ...base, status: 'degradado', db: 'error: ' + err.message });
  }
});

app.use(express.static(path.join(__dirname, '../../pagina-web')));
app.use('/panel', express.static(path.join(__dirname, '../../frontend')));
app.use('/dispositivo', express.static(path.join(__dirname, '../../dispositivo')));
app.use('/apk', express.static(path.join(__dirname, '../public')));

app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.message);
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'JSON inválido en el cuerpo de la petición' });
  }
  if (EPSILON_PROD) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
  res.status(500).json({ error: 'Error interno del servidor', detalle: err.message });
});

io.on('connection', (socket) => {
  console.log('Cliente UI conectado:', socket.id);

  socket.on('suscribir:vehiculo', (vehiculoId) => {
    socket.join(`vehiculo:${vehiculoId}`);
    console.log(`Socket ${socket.id} suscrito al vehículo ${vehiculoId}`);
  });

  socket.on('disconnect', () => {
    console.log('Cliente UI desconectado:', socket.id);
  });
});

async function start() {
  await pool.initDb();
  server.listen(config.port, () => {
    console.log(`EcoDrive backend en http://localhost:${config.port}`);
    console.log(`Endpoint telemétrica: POST /api/v1/telemetry`);
    iniciarRetencion();
  });
}

start().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err.message);
  process.exit(1);
});

async function shutdown() {
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);