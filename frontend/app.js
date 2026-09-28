const API = '/api/v1';
let token = localStorage.getItem('ecodrive_token') || null;
let socket = null;

const $login = document.getElementById('vista-login');
const $dash = document.getElementById('vista-dashboard');
const $flota = document.getElementById('vista-flota');
const $historial = document.getElementById('vista-historial');
const $header = document.getElementById('header');
const $banner = document.getElementById('banner-alerta');
const $bannerTexto = document.getElementById('banner-texto');
const $tabla = document.getElementById('cuerpo-flota');
const $conexion = document.getElementById('conexion');
const $errorLogin = document.getElementById('error-login');

const VISTAS = { dashboard: $dash, flota: $flota, historial: $historial };

function conectarSocket() {
  socket = io();
  socket.on('connect', () => {
    console.log('WebSocket conectado');
    setConexion(true);
  });
  socket.on('disconnect', () => {
    console.log('WebSocket desconectado');
    setConexion(false);
  });
  socket.on('alerta:nueva', (evento) => {
    mostrarAlerta(evento);
    cargarFlota();
  });
}

function setConexion(conectado) {
  $conexion.classList.toggle('on', conectado);
  $conexion.innerHTML = conectado
    ? '<span class="punto"></span> En tiempo real'
    : '<span class="punto"></span> Reconectando...';
}

function mostrarAlerta(evento) {
  $bannerTexto.textContent =
    `¡Advertencia! Vehículo ${evento.placa} en sobrecalentamiento (${evento.ect}°C) ` +
    `- Severidad ${evento.severidad}`;
  $banner.classList.remove('oculto');
  $banner.classList.add('visible');
  setTimeout(ocultarAlerta, 8000);
}

function ocultarAlerta() {
  $banner.classList.add('oculto');
  $banner.classList.remove('visible');
}

async function login(ev) {
  ev.preventDefault();
  const username = document.getElementById('usuario').value.trim();
  const password = document.getElementById('password').value;

  const resp = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!resp.ok) {
    $errorLogin.classList.remove('oculto');
    return;
  }

  const data = await resp.json();
  token = data.token;
  localStorage.setItem('ecodrive_token', token);
  $errorLogin.classList.add('oculto');
  mostrarDashboard();
}

function mostrarDashboard() {
  $login.classList.add('oculto');
  $header.classList.remove('oculto');
  cambiarVista('dashboard');
  cargarFlota();
}

function cambiarVista(nombre) {
  Object.entries(VISTAS).forEach(([clave, el]) => {
    el.classList.toggle('oculto', clave !== nombre);
  });
  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('activo', b.dataset.vista === nombre);
  });
  if (nombre === 'flota') cargarVehiculos();
  if (nombre === 'historial') cargarHistorial();
}

async function fetchApi(url, opciones = {}) {
  const headers = { ...(opciones.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opciones.body) headers['Content-Type'] = 'application/json';
  const resp = await fetch(url, { ...opciones, headers });
  if (resp.status === 401 && token) {
    token = null;
    localStorage.removeItem('ecodrive_token');
    salir();
    throw new Error('Sesión expirada');
  }
  return resp;
}

async function cargarFlota() {
  try {
    const resp = await fetchApi(`${API}/telemetry/resumen`);
    const filas = await resp.json();
    renderFlota(filas);
  } catch (err) {
    console.error('Error al cargar flota:', err);
  }
}

function renderFlota(filas) {
  // Tarjetas resumen
  const enLinea = filas.filter((f) => f.ultima_lectura).length;
  const alertas = filas.reduce((n, f) => n + Number(f.alertas_activas || 0), 0);
  const ects = filas.map((f) => Number(f.ect)).filter((v) => Number.isFinite(v));
  document.getElementById('kpi-flota').textContent = filas.length;
  document.getElementById('kpi-linea').textContent = enLinea;
  document.getElementById('kpi-alertas').textContent = alertas;
  document.getElementById('kpi-ect').textContent = ects.length ? `${Math.max(...ects)} °C` : '--';
  if (!filas.length) {
    $tabla.innerHTML = '<tr><td colspan="6" class="vacio">Sin vehículos registrados</td></tr>';
    return;
  }
  $tabla.innerHTML = filas
    .map((f) => {
      const ect = f.ect === null ? '--' : `${f.ect} °C`;
      const rpm = f.rpm === null ? '--' : String(f.rpm);
      const fecha = f.ultima_lectura
        ? new Date(f.ultima_lectura).toLocaleString('es-CO')
        : 'Sin lecturas';
      const numAlertas = Number(f.alertas_activas);
      const clase = numAlertas > 0 ? 'celda-alerta' : '';
      return `<tr>
        <td><strong>${f.placa}</strong></td>
        <td>${f.nombre || '--'}</td>
        <td class="${Number(f.ect) > 105 ? 'caliente' : ''}">${ect}</td>
        <td>${rpm}</td>
        <td>${fecha}</td>
        <td class="${clase}">${numAlertas}</td>
      </tr>`;
    })
    .join('');
}

async function cargarVehiculos() {
  try {
    const resp = await fetchApi(`${API}/vehiculos`);
    const filas = await resp.json();
    renderVehiculos(filas);
  } catch (err) {
    console.error('Error al cargar vehículos:', err);
  }
}

function renderVehiculos(filas) {
  const cuerpo = document.getElementById('cuerpo-vehiculos');
  if (!filas.length) {
    cuerpo.innerHTML = '<tr><td colspan="7" class="vacio">No hay vehículos registrados</td></tr>';
    return;
  }
  cuerpo.innerHTML = filas
    .map(
      (v) => `<tr>
        <td><strong>${v.placa}</strong></td>
        <td>${v.nombre || '--'}</td>
        <td><button class="btn-ver-key" data-id="${v.id}" data-placa="${v.placa}">Ver API Key</button></td>
        <td>${v.total_lecturas}</td>
        <td class="${v.alertas_activas > 0 ? 'celda-alerta' : ''}">${v.alertas_activas}</td>
        <td class="${v.activo ? 'ok' : 'off'}">${v.activo ? 'Activo' : 'Inactivo'}</td>
        <td class="acciones">
          <button class="btn-mini ${v.activo ? '' : 'ok'}" data-toggle="${v.id}" data-activo="${v.activo}">
            ${v.activo ? 'Desactivar' : 'Activar'}
          </button>
          <button class="btn-mini" data-regen="${v.id}">Regen. Key</button>
          <button class="btn-mini peligro" data-del="${v.id}" data-placa="${v.placa}">Eliminar</button>
        </td>
      </tr>`
    )
    .join('');

  cuerpo.querySelectorAll('.btn-ver-key').forEach((btn) =>
    btn.addEventListener('click', () => verApiKey(btn.dataset.id, btn.dataset.placa))
  );
  cuerpo.querySelectorAll('[data-toggle]').forEach((btn) =>
    btn.addEventListener('click', () => alternarActivo(btn.dataset.toggle, btn.dataset.activo === 'true'))
  );
  cuerpo.querySelectorAll('[data-regen]').forEach((btn) =>
    btn.addEventListener('click', () => regenerarKey(btn.dataset.regen))
  );
  cuerpo.querySelectorAll('[data-del]').forEach((btn) =>
    btn.addEventListener('click', () => eliminarVehiculo(btn.dataset.del, btn.dataset.placa))
  );
}

async function crearVehiculo() {
  const placa = document.getElementById('nueva-placa').value.trim();
  const nombre = document.getElementById('nuevo-nombre').value.trim();
  const msg = document.getElementById('msg-flota');

  if (!placa) {
    msg.textContent = 'La placa es obligatoria';
    msg.classList.remove('oculto');
    return;
  }

  try {
    const resp = await fetchApi(`${API}/vehiculos`, {
      method: 'POST',
      body: JSON.stringify({ placa, nombre }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      msg.textContent = data.error || 'Error al registrar';
      msg.classList.remove('oculto');
      return;
    }
    msg.classList.add('oculto');
    document.getElementById('nueva-placa').value = '';
    document.getElementById('nuevo-nombre').value = '';
    cargarVehiculos();
    cargarFlota();
  } catch (err) {
    console.error(err);
  }
}

async function verApiKey(id, placa) {
  try {
    const resp = await fetchApi(`${API}/vehiculos/${id}/apikey`);
    const data = await resp.json();
    if (!resp.ok) return alert(data.error || 'Error');
    const copiar = confirm(`API Key de ${placa}: ${data.api_key}\n\nPresionar Aceptar para copiar al portapapeles.`);
    if (copiar && navigator.clipboard) {
      await navigator.clipboard.writeText(data.api_key);
      alert('API Key copiada al portapapeles');
    }
  } catch (err) {
    console.error(err);
  }
}

async function alternarActivo(id, estadoActual) {
  try {
    await fetchApi(`${API}/vehiculos/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ activo: !estadoActual }),
    });
    cargarVehiculos();
  } catch (err) {
    console.error(err);
  }
}

async function regenerarKey(id) {
  if (!confirm('¿Regenerar la API Key? El dispositivo con la key anterior dejará de funcionar.')) return;
  try {
    const resp = await fetchApi(`${API}/vehiculos/${id}/apikey/regenerar`, { method: 'POST' });
    const data = await resp.json();
    alert(`Nueva API Key: ${data.api_key}`);
    cargarVehiculos();
  } catch (err) {
    console.error(err);
  }
}

async function eliminarVehiculo(id, placa) {
  if (!confirm(`¿Eliminar el vehículo ${placa}? Se borrarán sus lecturas y alertas.`)) return;
  try {
    await fetchApi(`${API}/vehiculos/${id}`, { method: 'DELETE' });
    cargarVehiculos();
    cargarFlota();
  } catch (err) {
    console.error(err);
  }
}

async function cargarHistorial() {
  cargarAlertas();
  cargarTelemetria();
}

async function cargarAlertas() {
  const estado = document.getElementById('filtro-alerta-estado').value || null;
  const params = estado ? `?estado=${estado}` : '';
  try {
    const resp = await fetchApi(`${API}/historial/alertas${params}`);
    const filas = await resp.json();
    renderAlertas(filas);
  } catch (err) {
    console.error('Error al cargar alertas:', err);
  }
}

function renderAlertas(filas) {
  const cuerpo = document.getElementById('cuerpo-alertas');
  if (!filas.length) {
    cuerpo.innerHTML = '<tr><td colspan="6" class="vacio">Sin alertas</td></tr>';
    return;
  }
  cuerpo.innerHTML = filas
    .map((a) => `<tr>
      <td><strong>${a.placa}</strong></td>
      <td>${a.tipo_alerta}</td>
      <td class="${a.severidad === 'ALTA' ? 'caliente' : ''}">${a.severidad}</td>
      <td>${a.estado}</td>
      <td>${new Date(a.fecha_generacion).toLocaleString('es-CO')}</td>
      <td class="acciones">
        ${a.estado !== 'ATENDIDA'
          ? `<button class="btn-mini" data-atender="${a.id}">Atender</button>`
          : '--'}
      </td>
    </tr>`)
    .join('');
  cuerpo.querySelectorAll('[data-atender]').forEach((btn) =>
    btn.addEventListener('click', () => atenderAlerta(btn.dataset.atender))
  );
}

async function atenderAlerta(id) {
  try {
    await fetchApi(`${API}/historial/alertas/${id}/atender`, { method: 'POST' });
    cargarAlertas();
    cargarFlota();
  } catch (err) {
    console.error(err);
  }
}

async function cargarTelemetria() {
  try {
    const resp = await fetchApi(`${API}/historial/telemetria?limite=20`);
    const filas = await resp.json();
    renderTelemetria(filas);
  } catch (err) {
    console.error('Error al cargar telemetría:', err);
  }
}

function renderTelemetria(filas) {
  const cuerpo = document.getElementById('cuerpo-telemetria');
  if (!filas.length) {
    cuerpo.innerHTML = '<tr><td colspan="4" class="vacio">Sin lecturas</td></tr>';
    return;
  }
  cuerpo.innerHTML = filas
    .map((t) => `<tr>
      <td><strong>${t.placa}</strong></td>
      <td class="${Number(t.ect_temperatura) > 105 ? 'caliente' : ''}">${t.ect_temperatura} °C</td>
      <td>${t.rpm}</td>
      <td>${new Date(t.fecha_registro).toLocaleString('es-CO')}</td>
    </tr>`)
    .join('');
}

function salir() {
  token = null;
  localStorage.removeItem('ecodrive_token');
  $header.classList.add('oculto');
  $login.classList.remove('oculto');
  VISTAS.dashboard.classList.add('oculto');
  VISTAS.flota.classList.add('oculto');
  VISTAS.historial.classList.add('oculto');
}

async function simularAlerta() {
  const boton = document.getElementById('btn-simular');
  boton.disabled = true;
  boton.textContent = 'Enviando telemetría...';

  try {
    await fetchApi(`${API}/telemetry/demo`, {
      method: 'POST',
      body: JSON.stringify({ placa: 'ABC-123', ect: 109, rpm: 3000 }),
    });
  } catch (err) {
    console.error('Error al simular:', err);
  } finally {
    setTimeout(() => {
      boton.disabled = false;
      boton.textContent = 'Simular alerta (ECT 109°C)';
    }, 1500);
  }
}

document.getElementById('form-login').addEventListener('submit', login);
document.getElementById('btn-salir').addEventListener('click', salir);
document.getElementById('banner-cerrar').addEventListener('click', ocultarAlerta);
document.getElementById('btn-simular').addEventListener('click', simularAlerta);
document.getElementById('btn-crear').addEventListener('click', crearVehiculo);
document.getElementById('btn-cargar-alertas').addEventListener('click', cargarAlertas);
document.querySelectorAll('.nav-btn').forEach((btn) => {
  if (!btn.dataset.vista) return; // enlaces externos (ej. /dispositivo/)
  btn.addEventListener('click', () => cambiarVista(btn.dataset.vista));
});

conectarSocket();

if (token) {
  mostrarDashboard();
}