require('dotenv').config();
const { Client } = require('pg');

const url = new URL(
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ecodrive'
);

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function usage() {
  console.log(
    'Uso: node scripts/simulator.js --placa ABC-123 --ect 108 --rpm 3000 ' +
      '[--count 1] [--interval 5] [--invalid]'
  );
}

async function main() {
  if (process.argv.includes('--help')) return usage();

  const placa = arg('placa', 'ABC-123');
  const ect = parseFloat(arg('ect', '88'));
  const rpm = parseInt(arg('rpm', '2500'), 10);
  const count = parseInt(arg('count', '1'), 10);
  const interval = parseInt(arg('interval', '5'), 10);
  const invalid = process.argv.includes('--invalid');

  const client = new Client({
    host: url.hostname,
    port: url.port,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
  });
  await client.connect();

  const { rows } = await client.query(
    'SELECT id, placa, api_key FROM vehiculos WHERE placa = $1',
    [placa]
  );
  await client.end();

  if (!rows.length) {
    console.error(`Vehículo '${placa}' no encontrado. Ejecuta: npm run db:init`);
    process.exit(1);
  }
  const veh = rows[0];

  for (let i = 0; i < count; i++) {
    const payload = JSON.stringify({
      vehiculo_id: veh.id,
      ect,
      rpm,
      timestamp: new Date().toISOString(),
    });

    const headers = invalid
      ? { Authorization: 'Bearer TOKEN_EXPIRADO_O_INVALIDO', 'Content-Type': 'application/json' }
      : { 'X-API-Key': veh.api_key, 'Content-Type': 'application/json' };

    try {
      const resp = await fetch('http://localhost:3000/api/v1/telemetry', {
        method: 'POST',
        headers,
        body: payload,
      });
      const body = await resp.json();
      console.log(
        `[${new Date().toISOString()}] ${veh.placa} ECT=${ect} -> HTTP ${resp.status}`
      );
      console.log(JSON.stringify(body));
    } catch (err) {
      console.error(`Fallo de red en el envío ${i + 1}:`, err.message);
    }

    if (i < count - 1) {
      await new Promise((r) => setTimeout(r, interval * 1000));
    }
  }
}

main().catch((err) => {
  console.error('Error del simulador:', err.message);
  process.exit(1);
});