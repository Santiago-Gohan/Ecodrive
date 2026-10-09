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
const usuariosRoute = require('./routes/usuarios');
const notificacionesRoute = require('./routes/notificaciones');
const tallerRoute = require('./routes/taller');
const webhooksRoute = require('./routes/webhooks');
const dispositivosRoute = require('./routes/dispositivos');
const privacidadRoute = require('./routes/privacidad');
const openapi = require('./openapi');
const { iniciarRetencion } = require('./services/retention');
const { asegurarAdminInicial } = require('./services/usuarios');
const { reintentarPendientes } = require('./services/webhooks');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const EPSILON_PROD = process.env.NODE_ENV === 'production';

// Detrás de proxy (Render/Cloudflare): confía en X-Forwarded-* para req.secure.
app.set('trust proxy', 1);

// Swagger UI (carga desde CDN permitido en la CSP).
const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>EcoDrive API - Documentación</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/>
</head><body style="margin:0">
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
window.onload = () => SwaggerUIBundle({ url: '/api/v1/openapi.json', dom_id: '#swagger-ui', deepLinking: true });
</script>
</body></html>`;

const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
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
      "frame-ancestors 'self'; " +
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

// Fase 5: forzar HTTPS en producción (excepto el health check interno del proveedor).
if (EPSILON_PROD) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/v1/health')) return next();
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    if (proto === 'https') return next();
    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.redirect(308, 'https://' + req.headers.host + req.originalUrl);
    }
    return res.status(403).json({ error: 'Se requiere HTTPS' });
  });
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization,X-API-Key,X-Api-Token,X-Usuario'
  );
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
app.use('/api/v1/usuarios', usuariosRoute);
app.use('/api/v1/notificaciones', notificacionesRoute);
app.use('/api/v1/taller', tallerRoute);
app.use('/api/v1/webhooks', webhooksRoute);
app.use('/api/v1/dispositivos', dispositivosRoute);
app.use('/api/v1/privacidad', privacidadRoute);

app.get('/api/v1/openapi.json', (req, res) => res.json(openapi));
app.get('/api-docs', (req, res) => res.type('html').send(SWAGGER_HTML));

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
  await asegurarAdminInicial();
  server.listen(config.port, () => {
    console.log(`EcoDrive backend en http://localhost:${config.port}`);
    console.log(`Endpoint telemétrica: POST /api/v1/telemetry`);
    console.log(`Documentación API: http://localhost:${config.port}/api-docs`);
    iniciarRetencion();
    // Reintento de webhooks fallidos cada 10 minutos.
    setInterval(() => reintentarPendientes(), 10 * 60 * 1000).unref();
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