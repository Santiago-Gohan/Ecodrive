const API = '/api/v1';

const SERVICIOS_OBLIGATORIOS = [
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

const $selectVehiculo = document.getElementById('select-vehiculo');
const $inputApikey = document.getElementById('input-apikey');
const $btnGuardar = document.getElementById('btn-guardar');
const $btnConectar = document.getElementById('btn-conectar');
const $btnIniciar = document.getElementById('btn-iniciar');
const $btnDetener = document.getElementById('btn-detener');
const $log = document.getElementById('log-obd');
const $punto = document.getElementById('punto-estado');
const $textoEstado = document.getElementById('texto-estado');
const $valEct = document.getElementById('val-ect');
const $valRpm = document.getElementById('val-rpm');
const $colaOffline = document.getElementById('cola-offline');

let vehiculoActual = null;
let dispositivoBT = null;
let servidorGATT = null;
let caracteristicaEscritura = null;
let monitoreoActivo = false;
let bufferRespuesta = '';
let intervalo = null;

const configLocal = JSON.parse(localStorage.getItem('ecodrive_dispositivo') || '{}');

async function cargarVehiculos() {
  try {
    const resp = await fetch(`${API}/telemetry/resumen`);
    const filas = await resp.json();
    filas.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.placa} - ${v.nombre || 'Vehiculo'}`;
      opt.dataset.placa = v.placa;
      $selectVehiculo.appendChild(opt);
    });
    if (configLocal.vehiculoId) $selectVehiculo.value = configLocal.vehiculoId;
    if (configLocal.apiKey) $inputApikey.value = configLocal.apiKey;
    definirVehiculo();
  } catch (err) {
    log('No se pudo cargar la lista de vehículos:', err);
    $selectVehiculo.innerHTML =
      '<option value="">Cargar la página de nuevo</option>';
  }
}

function definirVehiculo() {
  const opt = $selectVehiculo.selectedOptions[0];
  vehSeleccionado(opt ? opt.value : null, opt ? opt.dataset.placa : null);
}

$selectVehiculo.addEventListener('change', definirVehiculo);

function vehSeleccionado(id, placa) {
  vehiculoActual = { id, placa };
}

$btnGuardar.addEventListener('click', () => {
  const apiKey = $inputApikey.value.trim();
  if (!vehiculoActual || !vehiculoActual.id || !apiKey) {
    log('Guarda primero el vehículo y su API Key.');
    return;
  }
  localStorage.setItem(
    'ecodrive_dispositivo',
    JSON.stringify({ vehiculoId: vehiculoActual.id, placa: vehiculoActual.placa, apiKey })
  );
  log(`Vehículo ${vehiculoActual.placa} guardado.`);
});

function log(texto) {
  $log.textContent = texto;
  console.log('[OBD]', texto);
}

function statusOk() {
  $punto.style.background = '#22c55e';
  $textoEstado.textContent = 'Adaptador conectado';
}

function statusOff() {
  $punto.style.background = '#64748b';
  $textoEstado.textContent = 'Sin conexión';
}

async function conectarObd() {
  if (!navigator.bluetooth) {
    log('Este navegador no soporta Web Bluetooth. Usa Chrome (escritorio o Android).');
    return;
  }

  try {
    $btnConectar.disabled = true;
    log('Solicitando adaptador Bluetooth...');

    dispositivoBT = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: SERVICIOS_OBLIGATORIOS,
    });

    servidorGATT = await dispositivoBT.gatt.connect();
    log('Buscando servicio OBD (0xFFE0 / REDIOTLAB)...');

    let servicio = await buscarServicio(servidorGATT);
    if (!servicio) throw new Error('No se encontró el servicio OBD-II en el adaptador');

    caracteristicaEscritura = await obtenerCaracteristica(servicio);
    log('Canal de datos encontrado. Inicializando ELM327...');

    await inicializarElm327();
    statusOk();
    await probarCompatibilidad();
  } catch (err) {
    log('Error: ' + err.message);
    statusOff();
    $btnConectar.disabled = false;
  }
}

async function probarCompatibilidad() {
  log('Consultando PIDs soportados (PID 0100)...');
  const resp = await cmd('0100');
  const m = resp.match(/4100([0-9A-Fa-f]{8})/);

  if (!m) {
    log('No se pudo leer la lista de PIDs. Vehículo no compatible o puerto sin respuesta.');
    $btnIniciar.disabled = true;
    return null;
  }

  const bytes = [0, 1, 2, 3].map((i) => parseInt(m[1].substr(i * 2, 2), 16));
  const ect = (bytes[0] & 0x08) !== 0;
  const rpm = (bytes[1] & 0x08) !== 0;

  if (!ect || !rpm) {
    log(`Vehículo NO compatible. ECT soportado: ${ect ? 'sí' : 'no'} - RPM soportado: ${rpm ? 'sí' : 'no'}.`);
    $btnIniciar.disabled = true;
    return { ect, rpm };
  }

  $btnIniciar.disabled = false;
  log('Vehículo compatible: ECT y RPM soportados. Puede iniciar el envío.');
  return { ect, rpm };
}

async function buscarServicio(server) {
  for (const uuid of SERVICIOS_OBLIGATORIOS) {
    try {
      const s = await server.getPrimaryService(uuid);
      if (s) return s;
    } catch {
      /* intentar el siguiente */
    }
  }
  return null;
}

async function obtenerCaracteristica(servicio) {
  const uuids = [
    '0000ffe1-0000-1000-8000-00805f9b34fb',
    '49535343-8841-43f4-a8d4-ecbe34729bb3',
  ];
  for (const uuid of uuids) {
    try {
      const c = await servicio.getCharacteristic(uuid);
      if (c) return c;
    } catch {
      /* intentar la siguiente */
    }
  }
  return null;
}

async function inicializarElm327() {
  caracteristicaEscritura.addEventListener('characteristicvaluechanged', (e) => {
    bufferRespuesta += new TextDecoder().decode(e.target.value);
  });
  await caracteristicaEscritura.startNotifications();
  await sleep(200);

  await cmd('ATZ');
  await sleep(300);
  await cmd('ATE0', true);
  await cmd('ATL0', true);
  await cmd('ATS0', true);
  await cmd('ATSP0', true);
}

function limpiarBuffer() {
  bufferRespuesta = '';
}

async function cmd(comando, silencioso = false) {
  limpiarBuffer();
  const bytes = new TextEncoder().encode(comando + '\r');
  try {
    await caracteristicaEscritura.writeValueWithResponse(bytes);
  } catch {
    await caracteristicaEscritura.writeValueWithoutResponse(bytes);
  }
  await sleep(400);
  const resp = bufferRespuesta.replace(/[^0-9A-Fa-f]/g, '');
  if (!silencioso) log(`${comando} -> ${resp || '(sin respuesta)'}`);
  return resp;
}

async function leerEct() {
  const resp = await cmd('0105');
  const m = resp.match(/4105([0-9A-Fa-f]{2})/);
  if (!m) return null;
  return parseInt(m[1], 16) - 40;
}

async function leerRpm() {
  const resp = await cmd('010C');
  const m = resp.match(/410C([0-9A-Fa-f]{4})/);
  if (!m) return null;
  return parseInt(m[1], 16) / 4;
}

async function ciclodeLectura() {
  const ect = await leerEct();
  const rpm = await leerRpm();
  if (ect !== null) $valEct.textContent = ect.toFixed(0);
  if (rpm !== null) $valRpm.textContent = Math.round(rpm);
  if (ect !== null) {
    await enviarTelemetria({ vehiculo_id: vehiculoActual.id, ect, rpm, timestamp: new Date().toISOString() });
  }
}

async function enviarTelemetria(payload) {
  const config = JSON.parse(localStorage.getItem('ecodrive_dispositivo') || '{}');
  if (!config.apiKey) {
    log('Falta la API Key. Configúrala en el paso 1.');
    return;
  }

  try {
    const resp = await fetch(`${API}/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${err}`);
    }
    actualizarCola(0);
    log(`Enviado: ECT=${payload.ect}°C RPM=${payload.rpm}`);
  } catch (err) {
    console.error(err);
    guardarOffline(payload);
    actualizarCola();
    log(`Sin conexión al servidor. ${getCola().length} lectura(s) en buffer local.`);
  }
}

function getCola() {
  return JSON.parse(localStorage.getItem('ecodrive_offline') || '[]');
}

function guardarOffline(lectura) {
  const cola = getCola();
  cola.push(lectura);
  const recortada = cola.slice(-100);
  localStorage.setItem('ecodrive_offline', JSON.stringify(recortada));
}

function actualizarCola(mostrar = getCola().length) {
  $colaOffline.textContent = mostrar > 0
    ? `Buffer sin cobertura: ${mostrar} lectura(s) pendiente(s) de enviar.`
    : '';
}

function iniciar() {
  if (!caracteristicaEscritura) {
    log('Conecta primero el adaptador OBD-II.');
    return;
  }
  limpiarBuffer();
  monitoreoActivo = true;
  $btnIniciar.disabled = true;
  $btnDetener.disabled = false;
  log('Monitoreo iniciado cada 5 segundos (RN-03).');
  ciclodeLectura();
  intervalo = setInterval(ciclodeLectura, 5000);
}

function detener() {
  monitoreoActivo = false;
  clearInterval(intervalo);
  $btnIniciar.disabled = false;
  $btnDetener.disabled = true;
  log('Envío detenido.');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

$btnConectar.addEventListener('click', conectarObd);
$btnIniciar.addEventListener('click', iniciar);
$btnDetener.addEventListener('click', detener);

cargarVehiculos();
actualizarCola();