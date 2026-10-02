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
const $btnEscanear = document.getElementById('btn-escanear');
const $cajaCamara = document.getElementById('caja-camara');
const $video = document.getElementById('camara');
const $estadoEscaneo = document.getElementById('estado-escaneo');
const $selectIntervalo = document.getElementById('select-intervalo');

// Frecuencia de envío configurable (se guarda en el navegador del dispositivo).
const RANGOS_INTERVALO = [2000, 5000, 10000, 30000];
function intervaloLecturaMs() {
  const v = parseInt(localStorage.getItem('ecodrive_intervalo_ms') || '5000', 10);
  return RANGOS_INTERVALO.includes(v) ? v : 5000;
}
if ($selectIntervalo) {
  $selectIntervalo.value = String(intervaloLecturaMs());
  $selectIntervalo.addEventListener('change', () => {
    localStorage.setItem('ecodrive_intervalo_ms', $selectIntervalo.value);
    if (monitoreoActivo) {
      log('Frecuencia cambiada. Detén y vuelve a iniciar para aplicarla.');
    }
  });
}

let flujoCamara = null;
let decodificando = false;

let vehiculoActual = null;
let dispositivoBT = null;
let servidorGATT = null;
let caracteristicaEscritura = null;
let monitoreoActivo = false;
let bufferRespuesta = '';
let intervalo = null;
let posicionGps = null;      // { lat, lng, accuracy }
let watchGps = null;         // id del watchPosition

let jornada = null;          // estadísticas de la jornada en curso
let ultimoAviso = { estado: 'normal', ts: 0 };
let ctxAudio = null;         // AudioContext (se desbloquea con un gesto del usuario)

const configLocal = JSON.parse(localStorage.getItem('ecodrive_dispositivo') || '{}');

/* ---------- GPS del celular ---------- */
function iniciarGps() {
  if (watchGps !== null) return;
  if (!navigator.geolocation) {
    log('Este navegador no ofrece GPS. Los puntos se enviarán sin ubicación.');
    return;
  }
  watchGps = navigator.geolocation.watchPosition(
    (pos) => {
      posicionGps = {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        accuracy: Math.round(pos.coords.accuracy),
      };
      const gpsEl = document.getElementById('gps-estado');
      if (gpsEl) gpsEl.textContent = `📍 ${posicionGps.lat}, ${posicionGps.lng} (±${posicionGps.accuracy} m)`;
    },
    (err) => {
      console.error('GPS:', err.code, err.message);
      posicionGps = null;
      log('Sin permiso/senal de GPS. Se envía sin ubicación (prueba y mapa sin punto).');
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
}

function detenerGps() {
  if (watchGps !== null) {
    navigator.geolocation.clearWatch(watchGps);
    watchGps = null;
  }
}

/* ---------- Reportar evento en la vía ---------- */
let tipoEventoSeleccionado = null;

function mostrarMsjEvento(texto, esError) {
  const el = document.getElementById('msj-evento');
  if (!el) return;
  el.textContent = texto;
  el.className = 'pista ' + (esError ? 'error' : 'ok');
}

async function reportarEvento() {
  if (!tipoEventoSeleccionado) {
    mostrarMsjEvento('Elige primero qué viste (policía, accidente…).', true);
    return;
  }
  if (!posicionGps) {
    mostrarMsjEvento('Esperando GPS… activa la ubicación para reportar.', true);
    return;
  }
  const btn = document.getElementById('btn-reportar-evento');
  if (btn) btn.disabled = true;
  mostrarMsjEvento('Enviando reporte…', false);
  try {
    const descripcion = (document.getElementById('ev-descripcion').value || '').trim();
    const resp = await fetch(`${API}/eventos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: tipoEventoSeleccionado,
        lat: posicionGps.lat,
        lng: posicionGps.lng,
        descripcion,
        placa: vehiculoActual ? vehiculoActual.placa : null,
      }),
    });
    if (resp.status === 429) {
      mostrarMsjEvento('Demasiados reportes seguidos. Espera un momento.', true);
    } else if (!resp.ok) {
      mostrarMsjEvento('No se pudo enviar el reporte.', true);
    } else {
      mostrarMsjEvento('✅ Reporte enviado a tu flota. ¡Gracias!', false);
      const d = document.getElementById('ev-descripcion');
      if (d) d.value = '';
      log('Evento en la vía reportado.');
    }
  } catch (err) {
    mostrarMsjEvento('Sin conexión: el reporte no se envió.', true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function iniciarChipsEvento() {
  const cont = document.getElementById('ev-chips-tipo');
  if (cont) {
    cont.querySelectorAll('.chip').forEach((c) => {
      c.addEventListener('click', () => {
        cont.querySelectorAll('.chip').forEach((x) => x.classList.remove('activo'));
        c.classList.add('activo');
        tipoEventoSeleccionado = c.getAttribute('data-tipo');
      });
    });
  }
  const btn = document.getElementById('btn-reportar-evento');
  if (btn) btn.addEventListener('click', reportarEvento);
}

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

/* ---------- Vinculación: código corto, placa, API Key, QR o VIN ---------- */

function esApiKey(texto) {
  return /^ECDV-|^key_/i.test(texto);
}

function seleccionarEnLista(placa) {
  if (!$selectVehiculo) return;
  const opcion = [...$selectVehiculo.options].find((o) => o.dataset.placa === placa);
  if (opcion) $selectVehiculo.value = opcion.value;
}

function guardarVinculo(vehiculoId, placa, apiKey) {
  vehiculoActual = { id: vehiculoId, placa };
  localStorage.setItem(
    'ecodrive_dispositivo',
    JSON.stringify({ vehiculoId, placa, apiKey })
  );
  seleccionarEnLista(placa);
}

// Consulta el backend para resolver código / placa / VIN en la API Key del vehículo.
async function resolverVinculo(datos, alternativa) {
  const msj = document.getElementById('msj-vinculo');
  try {
    const resp = await fetch(`${API}/telemetry/vincular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    const data = await resp.json();
    if (!resp.ok) {
      // "ABC123" puede ser placa o código: si el primer intento falla, prueba el otro.
      if (alternativa) return resolverVinculo(alternativa);
      if (msj) msj.textContent = data.error || 'No encontramos ese vehículo.';
      log(data.error || 'No encontramos ese vehículo.');
      return false;
    }
    guardarVinculo(data.vehiculo_id, data.placa, data.api_key);
    $inputApikey.value = '';
    if (msj) msj.textContent = `Vehículo ${data.placa} vinculado. Ya puedes iniciar el envío.`;
    log(`Vehículo ${data.placa} vinculado correctamente.`);
    return true;
  } catch {
    if (msj) msj.textContent = 'Sin conexión con el servidor. Intenta de nuevo con señal.';
    log('No se pudo contactar al servidor para vincular.');
    return false;
  }
}

function vincularPorTexto() {
  const texto = $inputApikey.value.trim();
  if (!texto) {
    log('Escribe el código de 6 caracteres o tu placa.');
    return;
  }
  if (esApiKey(texto)) {
    if (!vehiculoActual || !vehiculoActual.id) {
      log('Elige el vehículo de la lista antes de pegar la API Key.');
      return;
    }
    guardarVinculo(vehiculoActual.id, vehiculoActual.placa, texto);
    const msj = document.getElementById('msj-vinculo');
    if (msj) msj.textContent = `Vehículo ${vehiculoActual.placa} vinculado.`;
    log(`Vehículo ${vehiculoActual.placa} guardado.`);
    return;
  }
  const esPlaca = /^[A-Z]{3}-?\d{3}$/i.test(texto);
  if (esPlaca) {
    resolverVinculo({ placa: texto }, { codigo: texto });
    return;
  }
  if (/^[A-Z0-9]{5,8}$/i.test(texto)) {
    resolverVinculo({ codigo: texto }, { placa: texto });
    return;
  }
  log('Formato no reconocido. Usa el código de 6 caracteres, la placa o la API Key.');
}

$btnGuardar.addEventListener('click', () => {
  if (monitoreoActivo) {
    log('Detén el monitoreo antes de cambiar de vehículo.');
    return;
  }
  vincularPorTexto();
});

$inputApikey.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    $btnGuardar.click();
  }
});

$inputApikey.addEventListener('paste', () => {
  setTimeout(() => {
    if (esApiKey($inputApikey.value.trim())) {
      $btnGuardar.click();
    }
  }, 0);
});

function detenerCamara() {
  decodificando = false;
  if (flujoCamara) {
    flujoCamara.getTracks().forEach((t) => t.stop());
    flujoCamara = null;
  }
  $video.srcObject = null;
  $cajaCamara.classList.add('oculto');
  $btnEscanear.textContent = '📷 Escanear código QR';
}

async function escanearQR() {
  if (flujoCamara) {
    detenerCamara();
    return;
  }
  if (typeof jsQR === 'undefined') {
    log('El escáner QR no está disponible en este navegador. Escribe la API Key manualmente.');
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    log('Este navegador no permite la cámara. Escribe la API Key manualmente.');
    return;
  }
  try {
    flujoCamara = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
  } catch (err) {
    log(`No se pudo abrir la cámara (${err.name || 'desconocido'}). Escribe la API Key manualmente.`);
    return;
  }
  $cajaCamara.classList.remove('oculto');
  $btnEscanear.textContent = '✖ Detener escaneo';
  $video.srcObject = flujoCamara;
  try {
    await $video.play();
  } catch (err) {
    log('No se pudo reproducir la cámara. Escribe la API Key manualmente.');
    detenerCamara();
    return;
  }
  decodificando = true;
  leerFrameQR();
}

function leerFrameQR() {
  if (!decodificando) return;
  if ($video.readyState < 2) {
    requestAnimationFrame(leerFrameQR);
    return;
  }
  const canvas = document.createElement('canvas');
  const escala = Math.min(1, 480 / Math.max($video.videoWidth, $video.videoHeight || 1));
  canvas.width = Math.max(1, Math.round($video.videoWidth * escala));
  canvas.height = Math.max(1, Math.round($video.videoHeight * escala));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage($video, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
  if (code && code.data) {
    const m = /^ecodrive:\/\/vincular\?([\s\S]*)$/.exec(String(code.data).trim());
    const params = m ? new URLSearchParams(m[1]) : null;
    const placa = params ? params.get('placa') : null;
    const key = params ? params.get('key') : null;
    const codigo = params ? params.get('codigo') : null;
    if (placa && key) {
      vincularPorQr(placa.toUpperCase(), key);
      return;
    }
    if (codigo) {
      $inputApikey.value = codigo.toUpperCase();
      $btnGuardar.click();
      $estadoEscaneo.textContent = `Código ${codigo} leído.`;
      detenerCamara();
      return;
    }
    $estadoEscaneo.textContent = 'Ese QR no es de EcoDrive. Usa el de Flota → 🔑 Key.';
  }
  requestAnimationFrame(leerFrameQR);
}

function vincularPorQr(placa, key) {
  const opt = [...$selectVehiculo.options].find(
    (o) => (o.dataset.placa || '').toUpperCase() === placa
  );
  if (!opt) {
    $estadoEscaneo.textContent = `El vehículo ${placa} no está en tu flota. Regístralo primero o pide al admin que lo agregue.`;
    return;
  }
  guardarVinculo(opt.value, opt.dataset.placa, key);
  $estadoEscaneo.textContent = `✅ Vehículo ${placa} vinculado con su API Key.`;
  log(`Vehículo ${placa} vinculado por QR y guardado.`);
  detenerCamara();
}

$btnEscanear.addEventListener('click', escanearQR);

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

/* ---------- Alertas térmicas (vibración + sonido + banner) ---------- */

function sonidoActivado() {
  return localStorage.getItem('ecodrive_sonido') !== '0';
}

function bipAviso(tipo) {
  if (!sonidoActivado()) return;
  try {
    if (!ctxAudio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctxAudio = new AC();
    }
    const t0 = ctxAudio.currentTime;
    const tonos = tipo === 'alert'
      ? [[880, 0.14, 0], [660, 0.12, 0.18], [880, 0.14, 0.32]]
      : [[660, 0.12, 0]];
    for (const [freq, dur, off] of tonos) {
      const osc = ctxAudio.createOscillator();
      const gan = ctxAudio.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(gan);
      gan.connect(ctxAudio.destination);
      gan.gain.setValueAtTime(0.0001, t0 + off);
      gan.gain.exponentialRampToValueAtTime(0.3, t0 + off + 0.02);
      gan.gain.exponentialRampToValueAtTime(0.0001, t0 + off + dur);
      osc.start(t0 + off);
      osc.stop(t0 + off + dur + 0.05);
    }
  } catch (e) {
    console.error('Audio:', e.message);
  }
}

function vibra(esAlerta) {
  if (!sonidoActivado() || !navigator.vibrate) return;
  navigator.vibrate(esAlerta ? [300, 150, 300, 150, 300] : [120]);
}

function mostrarAlertaBanner(esAlerta, ect, placa) {
  const el = document.getElementById('alerta-aviso');
  if (!el) return;
  el.textContent = esAlerta
    ? `🔥 ${placa ? placa + ' · ' : ''}ECT ${ect}°C — SOBRECALENTAMIENTO. Reduce carga o revisa el motor.`
    : `⚠️ ${placa ? placa + ' · ' : ''}ECT ${ect}°C — temperatura alta, vigila el motor.`;
  el.className = 'alerta-aviso ' + (esAlerta ? 'peligro' : 'aviso');
}

function ocultarAlertaBanner() {
  const el = document.getElementById('alerta-aviso');
  if (el) el.className = 'alerta-aviso oculto';
}

// Umbrales alineados con el backend (THRESHOLD_ECT = 105 °C).
function evaluarAlertaLocal(ect, placa) {
  const estado = ect >= 105 ? 'alert' : ect >= 95 ? 'warn' : 'normal';
  const ahora = Date.now();
  if (estado === 'normal') {
    if (ultimoAviso.estado !== 'normal') ocultarAlertaBanner();
    ultimoAviso = { estado: 'normal', ts: ahora };
    return;
  }
  const subio = (estado === 'alert' && ultimoAviso.estado !== 'alert')
    || (estado === 'warn' && ultimoAviso.estado === 'normal');
  const cooldown = ahora - ultimoAviso.ts > 20000;
  if (subio || cooldown) {
    mostrarAlertaBanner(estado === 'alert', ect, placa);
    bipAviso(estado);
    vibra(estado === 'alert');
    if (estado === 'alert') asegurarJornada().alertas++;
    ultimoAviso = { estado, ts: ahora };
  }
}

/* ---------- Estadísticas de la jornada ---------- */

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function asegurarJornada() {
  if (!jornada) {
    jornada = {
      inicio: Date.now(),
      lecturas: 0,
      offline: 0,
      ectMin: null,
      ectMax: null,
      ectSum: 0,
      rpmMax: 0,
      rpmSum: 0,
      combSum: 0,
      combN: 0,
      lat: null,
      lng: null,
      distanciaM: 0,
      alertas: 0,
    };
  }
  return jornada;
}

function registrarJornada(payload, online) {
  const j = asegurarJornada();
  j.lecturas++;
  if (!online) j.offline++;
  if (j.ectMin === null || payload.ect < j.ectMin) j.ectMin = payload.ect;
  if (payload.ect > j.ectMax) j.ectMax = payload.ect;
  j.ectSum += payload.ect;
  if (payload.rpm > j.rpmMax) j.rpmMax = payload.rpm;
  j.rpmSum += payload.rpm;
  if (payload.nivel_combustible !== null && payload.nivel_combustible !== undefined) {
    j.combSum += payload.nivel_combustible;
    j.combN++;
  }
  if (payload.lat !== null && payload.lat !== undefined &&
      payload.lng !== null && payload.lng !== undefined) {
    if (j.lat !== null && j.lng !== null) {
      j.distanciaM += haversine(j.lat, j.lng, payload.lat, payload.lng);
    }
    j.lat = payload.lat;
    j.lng = payload.lng;
  }
  actualizarChipsJornada();
}

function actualizarChipsJornada() {
  const el = document.getElementById('stats-jornada');
  if (!el || !jornada) return;
  const durMin = Math.round((Date.now() - jornada.inicio) / 60000);
  el.textContent = `Jornada: ${durMin} min · 🔥 ${jornada.ectMax ?? '--'}°C máx · 📍 ${(jornada.distanciaM / 1000).toFixed(1)} km · # ${jornada.lecturas} lecturas`;
}

function reiniciarChipsJornada() {
  const el = document.getElementById('stats-jornada');
  if (el) el.textContent = 'Jornada: 0 min · 🔥 -- · 📍 0.0 km · # 0';
}

function mostrarResumenJornada(j) {
  const durMin = Math.max(0, Math.round((Date.now() - j.inicio) / 60000));
  const ectProm = j.lecturas ? (j.ectSum / j.lecturas).toFixed(1) : '--';
  const rpmProm = j.lecturas ? Math.round(j.rpmSum / j.lecturas) : '--';
  const combProm = j.combN ? Math.round(j.combSum / j.combN) : '--';
  const filas = [
    ['⏱ Duración de la jornada', durMin + ' min'],
    ['Lecturas registradas', String(j.lecturas)],
    ['Sin cobertura (cola local)', String(j.offline)],
    ['🔥 ECT mín / máx / prom', `${j.ectMin ?? '--'} / ${j.ectMax ?? '--'} / ${ectProm} °C`],
    ['⚙️ RPM máx / prom', `${j.rpmMax ?? 0} / ${rpmProm}`],
    ['⛽ Combustible promedio', combProm + '%'],
    ['📍 Recorrido estimado', (j.distanciaM / 1000).toFixed(1) + ' km'],
    ['🚨 Alertas térmicas', String(j.alertas)],
  ];
  const grid = document.getElementById('resumen-grid');
  if (grid) {
    grid.innerHTML = filas
      .map(([k, v]) => `<div class="resumen-fila"><span>${k}</span><strong>${v}</strong></div>`)
      .join('');
  }
  const overlay = document.getElementById('resumen-jornada');
  if (overlay) overlay.classList.remove('oculto');
}

function cerrarResumen() {
  const overlay = document.getElementById('resumen-jornada');
  if (overlay) overlay.classList.add('oculto');
  reiniciarChipsJornada();
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
  await vincularPorVin();
  return { ect, rpm };
}

// Con adaptador real: lee el VIN (PID 0900) y vincula el vehículo sin escribir nada.
async function vincularPorVin() {
  try {
    const resp = await cmd('0900');
    const m = resp.match(/^4902 0?1([0-9A-Fa-f]{2})/);
    if (!m) return false;
    let hex = m[1];
    if (hex.length === 2) hex += '';
    // Respuesta multilínea: 49 02 01 <17 bytes> -> reconstruye los caracteres.
    const crudos = resp.replace(/^4902\s*/, '').replace(/\r/g, ' ').trim().split(/\s+/);
    let vin = '';
    for (const b of crudos) {
      const n = parseInt(b, 16);
      if (!Number.isFinite(n)) break;
      if (n >= 0x21 && n <= 0x7a) vin += String.fromCharCode(n);
      else if (vin.length) break;
    }
    vin = vin.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (vin.length < 6) return false;
    log(`VIN detectado: ${vin}. Buscando vehículo...`);
    return await resolverVinculo({ vin });
  } catch {
    return false;
  }
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

async function leerNivelCombustible() {
  const resp = await cmd('012F');
  const m = resp.match(/412F([0-9A-Fa-f]{2})/);
  if (!m) return null;
  const pct = Math.round((parseInt(m[1], 16) * 100) / 255);
  return Math.max(0, Math.min(100, pct));
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
  const nivel = await leerConReintento(leerNivelCombustible);
  if (ect !== null) $valEct.textContent = ect.toFixed(0);
  if (rpm !== null) $valRpm.textContent = Math.round(rpm);
  actualizarMedidores(ect, rpm, nivel);
  if (!lecturaPlausible(ect, rpm)) {
    log(`Lectura descartada (fuera de rango o sin respuesta): ECT=${ect} RPM=${rpm}. Revisa el adaptador.`);
    return; // no se envia basura ni se llena la cola offline
  }
  evaluarAlertaLocal(ect, vehiculoActual && vehiculoActual.placa);
  await enviarTelemetria({
    vehiculo_id: vehiculoActual.id,
    ect,
    rpm,
    nivel_combustible: nivel,
    lat: posicionGps ? posicionGps.lat : null,
    lng: posicionGps ? posicionGps.lng : null,
    timestamp: new Date().toISOString(),
  });
}

// Medidores semicirculares (fraccion 0..1)
function llenarMedidor(id, frac, color) {
  const el = document.getElementById(id);
  if (!el) return;
  const f = Math.max(0, Math.min(1, frac || 0));
  el.style.strokeDashoffset = String(100 - f * 100);
  el.style.stroke = color;
}

function actualizarMedidores(ect, rpm, nivel) {
  if (ect !== null) {
    const frac = Math.max(0, Math.min(1, (ect - 20) / 100)); // 20 °C -> 0, 120 °C -> 1
    const color = ect > 105 ? '#ef4444' : ect >= 95 ? '#f59e0b' : '#22d3ee';
    llenarMedidor('fill-ect', frac, color);
  }
  if (rpm !== null) {
    llenarMedidor('fill-rpm', rpm / 9000, '#34d399');
  }
  if (nivel !== null) {
    const barra = document.getElementById('barra-combustible');
    if (barra) {
      barra.style.width = nivel + '%';
      barra.classList.toggle('bajo', nivel <= 15);
    }
    const val = document.getElementById('val-combustible');
    if (val) val.textContent = nivel + '%';
  }
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

// Al volver la señal, envia la cola guardada en lotes de 200 (hasta 5000 lecturas
// ≈ 7 h sin conexion). Si falla, aplica backoff exponencial (5 s → 5 min) para no
// golpear el servidor mientras está caído o cuando limita el caudal (429 / Retry-After).
const LOTE_MAX = 200;
const BACKOFF_MAX = 300000; // 5 minutos
let reintentosCola = 0;
let proximoIntentoCola = 0;

async function reenviarCola(apiKey) {
  let cola = getCola();
  if (!cola.length) {
    reintentosCola = 0;
    proximoIntentoCola = 0;
    actualizarCola(0);
    return { enviadas: 0, pendientes: 0 };
  }
  if (Date.now() < proximoIntentoCola) {
    actualizarCola(cola.length);
    return { enviadas: 0, pendientes: cola.length, diferido: true };
  }
  let enviadas = 0;
  while (cola.length) {
    const lote = cola.slice(0, LOTE_MAX);
    try {
      const resp = await fetch(`${API}/telemetry/lote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ lecturas: lote }),
      });
      if (!resp.ok) {
        reintentosCola++;
        const retryAfter = parseInt(resp.headers.get('Retry-After') || '0', 10);
        const demora = retryAfter > 0
          ? retryAfter * 1000
          : Math.min(BACKOFF_MAX, 5000 * Math.pow(2, reintentosCola - 1));
        proximoIntentoCola = Date.now() + demora;
        break;
      }
    } catch {
      reintentosCola++;
      proximoIntentoCola = Date.now() + Math.min(BACKOFF_MAX, 5000 * Math.pow(2, reintentosCola - 1));
      break; // sin conexion: se conserva el resto para el proximo intento
    }
    cola = cola.slice(lote.length);
    enviadas += lote.length;
    localStorage.setItem('ecodrive_offline', JSON.stringify(cola));
  }
  if (!cola.length || enviadas > 0) {
    reintentosCola = 0;
    proximoIntentoCola = 0;
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
    registrarJornada(payload, true);
    const { enviadas, pendientes } = await reenviarCola(config.apiKey);
    log(`Enviado: ECT=${payload.ect}°C RPM=${payload.rpm}` +
      (enviadas ? ` (+${enviadas} lectura(s) sincronizada(s) de zona sin cobertura)` : '') +
      (pendientes ? ` [quedan ${pendientes} pendientes]` : ''));
  } catch (err) {
    console.error(err);
    registrarJornada(payload, false);
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
  const recortada = cola.slice(-5000); // ~7 h sin conexion (1 lectura / 5 s)
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
  jornada = null;
  ultimoAviso = { estado: 'normal', ts: 0 };
  ocultarAlertaBanner();
  reiniciarChipsJornada();
  monitoreoActivo = true;
  iniciarGps();
  $btnIniciar.disabled = true;
  $btnDetener.disabled = false;
  const periodo = intervaloLecturaMs();
  log(modoVirtual
    ? `Monitoreo con ECU virtual iniciado cada ${Math.round(periodo / 1000)} s.`
    : `Monitoreo iniciado cada ${Math.round(periodo / 1000)} segundos.`);
  ciclodeLectura();
  intervalo = setInterval(ciclodeLectura, periodo);
}

let modoVirtual = null;
let vEct = 88;
let vPaso = 0;

const PERFILES = {
  gasolina2013: { compatible: true, base: 88, pico: 108, combustible: 0.62 },
  bus2015:      { compatible: true, base: 90, pico: 109, combustible: 0.55 },
  camion2018:   { compatible: true, base: 87, pico: 107, combustible: 0.45 },
  gasolina2010: { compatible: true, base: 86, pico: 108, combustible: 0.38 },
  diesel2008:   { compatible: false, base: 0,  pico: 0,   combustible: 0 },
  moto:         { compatible: false, base: 0,  pico: 0,   combustible: 0 },
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

  if (c === '012F') {
    // Nivel de combustible: baja muy lento (~1 % cada 12 ciclos)
    let nivel = Math.round(perfil.combustible * 255);
    if (vPaso % 12 === 0 && nivel > 10) {
      perfil.combustible = Math.max(0.05, perfil.combustible - 0.01);
      nivel = Math.round(perfil.combustible * 255);
    }
    return '412F' + nivel.toString(16).toUpperCase().padStart(2, '0');
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
  reiniciarMedidores();
  statusOk('ECU virtual: ' + perfilLabel(modoVirtual));
  log('ECU virtual conectada. Consultando compatibilidad (PID 0100)...');
  probarCompatibilidad();
}

function reiniciarMedidores() {
  $valEct.textContent = '--';
  $valRpm.textContent = '--';
  llenarMedidor('fill-ect', 0, '#22d3ee');
  llenarMedidor('fill-rpm', 0, '#34d399');
  const barra = document.getElementById('barra-combustible');
  if (barra) barra.style.width = '0%';
  const val = document.getElementById('val-combustible');
  if (val) val.textContent = '--';
}

function reconectarVirtual() {
  const chk = document.getElementById('chk-simulacion');
  if (!chk.checked) return;
  conectarVirtual();
}

function detener() {
  monitoreoActivo = false;
  clearInterval(intervalo);
  detenerGps();
  $btnIniciar.disabled = false;
  $btnDetener.disabled = true;
  ocultarAlertaBanner();
  if (jornada && jornada.lecturas > 0) mostrarResumenJornada(jornada);
  jornada = null;
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

const chkSonido = document.getElementById('chk-sonido');
if (chkSonido) {
  chkSonido.checked = sonidoActivado();
  chkSonido.addEventListener('change', () => {
    localStorage.setItem('ecodrive_sonido', chkSonido.checked ? '1' : '0');
  });
}

const btnCerrarResumen = document.getElementById('btn-cerrar-resumen');
if (btnCerrarResumen) btnCerrarResumen.addEventListener('click', cerrarResumen);

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
iniciarChipsEvento();
iniciarGps();