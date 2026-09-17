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

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
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

app.get('/api/v1/health', (req, res) => res.json({ status: 'ok' }));

app.use(express.static(path.join(__dirname, '../../frontend')));
app.use('/dispositivo', express.static(path.join(__dirname, '../../dispositivo')));

app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
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