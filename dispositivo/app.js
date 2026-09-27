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

function statusOk(textoTexto = 'Adaptador conectado') {
  $punto.style.background = '#22c55e';
  $textoEstado.textContent = textoTexto;
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

    // Si se apaga el carro o se pierde el Bluetooth, detener en vez de fallar cada 5 s
    dispositivoBT.addEventListener('gattserverdisconnected', () => {
      detener();
      statusOff();
      $btnConectar.disabled = false;
      log('Adaptador desconectado (¿apagaste el vehículo?). Vuelve a conectar para seguir.');
    });

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
  await cmd('ATH0', true); // sin cabeceras: respuestas limpias en clones ELM327
  await cmd('ATSP0', true);
}

function limpiarBuffer() {
  bufferRespuesta = '';
}

async function cmd(comando, silencioso = false) {
  if (modoVirtual) {
    await sleep(60);
    const resp = virtualEcu(comando);
    if (!silencioso) log(`${comando} -> ${resp}`);
    return resp;
  }

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

function lecturaPlausible(ect, rpm) {
  return ect !== null && rpm !== null && ect >= -40 && ect <= 150 && rpm >= 0 && rpm <= 9000;
}

async function leerConReintento(leerFn) {
  let v = await leerFn();
  if (v === null) {
    await sleep(300);
    v = await leerFn(); // los clones baratos suelen fallar el primer intento
  }
  return v;
}

async function ciclodeLectura() {
  const ect = await leerConReintento(leerEct);
  const rpm = await leerConReintento(leerRpm);
  if (ect !== null) $valEct.textContent = ect.toFixed(0);
  if (rpm !== null) $valRpm.textContent = Math.round(rpm);
  if (!lecturaPlausible(ect, rpm)) {
    log(`Lectura descartada (fuera de rango o sin respuesta): ECT=${ect} RPM=${rpm}. Revisa el adaptador.`);
    return; // no se envia basura ni se llena la cola offline
  }
  await enviarTelemetria({ vehiculo_id: vehiculoActual.id, ect, rpm, timestamp: new Date().toISOString() });
}

async function postLectura(payload, apiKey) {
  const resp = await fetch(`${API}/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${err}`);
  }
}

// Al volver la señal, envia la cola guardada (con su timestamp original) una por una.
// Si falla a mitad de camino, lo no enviado se conserva para el proximo intento.
async function reenviarCola(apiKey) {
  let cola = getCola();
  let enviadas = 0;
  while (cola.length) {
    try {
      await postLectura(cola[0], apiKey);
    } catch {
      break;
    }
    cola = cola.slice(1);
    enviadas++;
    localStorage.setItem('ecodrive_offline', JSON.stringify(cola));
  }
  actualizarCola(cola.length);
  return { enviadas, pendientes: cola.length };
}

async function enviarTelemetria(payload) {
  const config = JSON.parse(localStorage.getItem('ecodrive_dispositivo') || '{}');
  if (!config.apiKey) {
    log('Falta la API Key. Configúrala en el paso 1.');
    return;
  }

  try {
    await postLectura(payload, config.apiKey);
    const { enviadas, pendientes } = await reenviarCola(config.apiKey);
    log(`Enviado: ECT=${payload.ect}°C RPM=${payload.rpm}` +
      (enviadas ? ` (+${enviadas} lectura(s) sincronizada(s) de zona sin cobertura)` : '') +
      (pendientes ? ` [quedan ${pendientes} pendientes]` : ''));
  } catch (err) {
    console.error(err);
    guardarOffline(payload);
    actualizarCola();
    log(`Sin conexión al servidor. ${getCola().length} lectura(s) en buffer local. Se enviarán solas al volver la señal.`);
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
  if (!modoVirtual && !caracteristicaEscritura) {
    log('Conecta el adaptador ELM327 o activa la ECU virtual.');
    return;
  }

  limpiarBuffer();
  monitoreoActivo = true;
  $btnIniciar.disabled = true;
  $btnDetener.disabled = false;
  log(modoVirtual
    ? 'Monitoreo con ECU virtual iniciado cada 5 s (RN-03).'
    : 'Monitoreo iniciado cada 5 segundos (RN-03).');
  ciclodeLectura();
  intervalo = setInterval(ciclodeLectura, 5000);
}

let modoVirtual = null;
let vEct = 88;
let vPaso = 0;

const PERFILES = {
  gasolina2013: { compatible: true, base: 88, pico: 108 },
  bus2015:      { compatible: true, base: 90, pico: 109 },
  camion2018:   { compatible: true, base: 87, pico: 107 },
  gasolina2010: { compatible: true, base: 86, pico: 108 },
  diesel2008:   { compatible: false, base: 0,  pico: 0 },
  moto:         { compatible: false, base: 0,  pico: 0 },
};

function virtualEcu(comando) {
  const perfil = PERFILES[modoVirtual] || PERFILES.gasolina2013;
  const c = (comando || '').trim().toUpperCase();

  if (c.startsWith('AT')) return 'OK';

  if (c === '0100') {
    if (!perfil.compatible) return '410000000000';
    return '410098080000';
  }

  if (c === '0105') {
    vPaso++;
    let ect = perfil.base + Math.floor(Math.random() * 4);
    if (vPaso % 10 === 0) ect = perfil.pico + Math.floor(Math.random() * 2);
    vEct = Math.max(0, Math.min(130, ect));
    return '4105' + (vEct + 40).toString(16).toUpperCase().padStart(2, '0');
  }

  if (c === '010C') {
    const rpm = 1400 + Math.floor(Math.random() * 1800);
    return '410C' + Math.round(rpm * 4).toString(16).toUpperCase().padStart(4, '0');
  }

  return 'NODATA';
}

function perfilLabel(perfil) {
  const sel = document.getElementById('select-perfil');
  const opt = Array.from(sel.options).find((o) => o.value === perfil);
  return opt ? opt.textContent : perfil;
}

function conectarVirtual() {
  modoVirtual = document.getElementById('select-perfil').value;
  $valEct.textContent = '--';
  $valRpm.textContent = '--';
  statusOk('ECU virtual: ' + perfilLabel(modoVirtual));
  log('ECU virtual conectada. Consultando compatibilidad (PID 0100)...');
  probarCompatibilidad();
}

function reconectarVirtual() {
  const chk = document.getElementById('chk-simulacion');
  if (!chk.checked) return;
  conectarVirtual();
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

document.getElementById('chk-simulacion').addEventListener('change', (e) => {
  const bloque = document.getElementById('bloque-perfil');
  if (e.target.checked) {
    bloque.classList.remove('oculto');
    conectarVirtual();
  } else {
    bloque.classList.add('oculto');
    modoVirtual = null;
    $btnIniciar.disabled = !caracteristicaEscritura;
    statusOff();
    log('ECU virtual desactivada.');
  }
});

document.getElementById('select-perfil').addEventListener('change', reconectarVirtual);

document.getElementById('btn-registrar').addEventListener('click', registrarVehiculo);

async function registrarVehiculo() {
  const $msj = document.getElementById('msj-reg');
  const placa = document.getElementById('reg-placa').value;
  const nombre = document.getElementById('reg-nombre').value;
  const combustible = document.getElementById('reg-combustible').value;
  const anio = document.getElementById('reg-anio').value;
  const tipo = document.getElementById('reg-tipo').value;

  if (!placa.trim()) {
    $msj.textContent = 'Escribe la placa.';
    $msj.className = 'veredicto no';
    return;
  }

  try {
    const resp = await fetch(`${API}/registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placa, nombre, combustible, anio, tipo }),
    });
    const datos = await resp.json();

    if (!resp.ok || datos.compatible !== true) {
      $msj.textContent = (datos.motivo || datos.sugerencia || datos.error || 'No compatible.')
        + (datos.compatible ? '' : '');
      $msj.className = 'veredicto no';
      return;
    }

    $msj.textContent = `Compatible: ${datos.motivo}. API Key asignada: ${datos.api_key}`;
    $msj.className = 'veredicto si';

    localStorage.setItem(
      'ecodrive_dispositivo',
      JSON.stringify({
        vehiculoId: datos.vehiculo.id,
        placa,
        apiKey: datos.api_key,
      })
    );
    log(`Vehículo ${placa} registrado y guardado (compatible).`);
    $selectVehiculo.innerHTML = '<option value="">Cargando…</option>';
    cargarVehiculos();
  } catch (err) {
    $msj.textContent = 'No se pudo registrar. ¿El servidor está encendido?';
    $msj.className = 'veredicto no';
    log('Error al registrar:', err);
  }
}

cargarVehiculos();
actualizarCola();