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

/* ---------- Toasts ---------- */
function toast(mensaje, tipo = 'info') {
  const cont = document.getElementById('toasts');
  if (!cont) return;
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  const ico = tipo === 'ok' ? '✅' : tipo === 'err' ? '❌' : 'ℹ️';
  el.innerHTML = `<span>${ico}</span><span class="toast-txt"></span>`;
  el.querySelector('.toast-txt').textContent = mensaje;
  cont.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 320);
  }, 4200);
}

function mostrarDashboard() {
  $login.classList.add('oculto');
  $header.classList.remove('oculto');
  cambiarVista('dashboard');
  inicializarMapa();
  cargarFlota();
  iniciarPollingGrafica();
  setTimeout(dibujarGrafica, 80);
  setTimeout(() => mapaEco && mapaEco.invalidateSize(), 150);
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
  if (nombre === 'dashboard' && mapaEco) {
    setTimeout(() => mapaEco.invalidateSize(), 60);
    cargarFlota();
  }
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
    registrarPuntoGraficas(filas);
    actualizarMarcadores(filas);
  } catch (err) {
    console.error('Error al cargar flota:', err);
  }
}

function clasePillAlertas(n) {
  return n > 0 ? 'rojo' : 'gris';
}

function saludVehiculo(f) {
  const ect = f.ect === null || f.ect === undefined ? null : Number(f.ect);
  const alertas = Number(f.alertas_activas || 0);
  const nivel = f.nivel_combustible === null || f.nivel_combustible === undefined ? null : Number(f.nivel_combustible);
  const dias = diasHasta(f.proximo_mantenimiento);
  const critico = alertas > 0 || (ect !== null && ect >= 105) || (dias !== null && dias < 0);
  const riesgo =
    (ect !== null && ect >= 95) ||
    (nivel !== null && nivel <= 15) ||
    (dias !== null && dias <= 15);
  if (critico) return { clase: 'rojo', texto: 'Crítico' };
  if (riesgo) return { clase: 'ambar', texto: 'Riesgo' };
  return { clase: 'verde', texto: 'Óptimo' };
}

function renderFlota(filas) {
  // Tarjetas resumen
  const enLinea = filas.filter((f) => f.ultima_lectura).length;
  const alertas = filas.reduce((n, f) => n + Number(f.alertas_activas || 0), 0);
  const ects = filas.map((f) => Number(f.ect)).filter((v) => Number.isFinite(v));
  document.getElementById('kpi-flota').textContent = filas.length;
  document.getElementById('kpi-linea').textContent = enLinea;
  document.getElementById('kpi-alertas').textContent = alertas;
  document.getElementById('kpi-ect').textContent = ects.length ? `${Math.round(Math.max(...ects))} °C` : '--';
  if (!filas.length) {
    $tabla.innerHTML = '<tr><td colspan="8" class="vacio">Sin vehículos registrados todavía</td></tr>';
    return;
  }
  renderProximosMantenimientos(filas);
  $tabla.innerHTML = filas
    .map((f) => {
      const ect = f.ect === null ? null : Number(f.ect);
      const rpm = f.rpm === null ? '--' : String(f.rpm);
      const fecha = f.ultima_lectura
        ? new Date(f.ultima_lectura).toLocaleString('es-CO')
        : 'Sin lecturas';
      const numAlertas = Number(f.alertas_activas);
      const enLineaAuto = f.ultima_lectura ? 'on' : 'off';
      const anios = f.anio ? ` · ${f.anio}` : '';
      const detalle = [f.tipo_vehiculo, f.combustible].filter(Boolean).join(' · ');
      let valorEct = '--';
      let relleno = '<div class="relleno" style="width:0%"></div>';
      if (ect !== null) {
        // Escala visual: 0 °C -> 0 %, 115 °C -> 100 %
        const pct = Math.min(100, Math.max(0, ((ect + 30) / 145) * 100));
        const extra = pct >= 85 ? 'alto' : pct >= 70 ? 'medio' : '';
        const claseValor = ect > 105 ? 'hot' : ect >= 95 ? 'calido' : '';
        valorEct = `<span class="valor ${claseValor}">${ect} °C</span>`;
        relleno = `<div class="relleno ${extra}" style="width:${pct.toFixed(1)}%"></div>`;
      }
      const nivel = f.nivel_combustible === null || f.nivel_combustible === undefined ? null : Number(f.nivel_combustible);
      let valorComb = '<span class="valor vacio">--</span><div class="barra-comb"><div class="relleno" style="width:0%"></div></div>';
      if (nivel !== null) {
        const bajo = nivel <= 15 ? 'bajo' : '';
        valorComb = `<span class="valor">${Math.round(nivel)}%</span><div class="barra-comb"><div class="relleno ${bajo}" style="width:${Math.min(100, Math.max(0, nivel))}%"></div></div>`;
      }
return `<tr>
        <td><span class="punto-linea ${enLineaAuto}"></span><strong>${f.nombre || '—'}</strong></td>
        <td><strong>${f.placa}</strong></td>
        <td><div class="medio-ect">${valorEct}<div class="barra-termica">${relleno}</div></div></td>
        <td><div class="medio-comb">${valorComb}</div></td>
        <td>${rpm}</td>
        <td>${fecha} ${enLineaAuto === 'on' ? '<span class="pill cyan">ACTIVO</span>' : '<span class="pill gris">SIN SEÑAL</span>'}</td>
        <td><span class="pill ${saludVehiculo(f).clase}">${saludVehiculo(f).texto}</span></td>
        <td><span class="pill ${clasePillAlertas(numAlertas)}">${numAlertas}</span> <small style="color:var(--muted)">${detalle}${anios}</small></td>
      </tr>`;
    })
    .join('');
}

/* ---------- Próximos mantenimientos ---------- */
function diasHasta(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d)) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function formatearFecha(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  return isNaN(d) ? null : d.toLocaleDateString('es-CO');
}

function renderProximosMantenimientos(filas) {
  const cont = document.getElementById('lista-mantenimientos');
  if (!cont || !filas.length) {
    if (cont) cont.innerHTML = '<p class="vacio-ligero">Sin vehículos registrados</p>';
    return;
  }
  const items = filas
    .map((f) => ({ ...f, dias: diasHasta(f.proximo_mantenimiento) }))
    .filter((f) => f.dias !== null && f.dias <= 15)
    .sort((a, b) => a.dias - b.dias);
  if (!items.length) {
    cont.innerHTML = '<p class="vacio-ligero">No hay mantenimientos por vencer en los próximos 15 días.</p>';
    return;
  }
  cont.innerHTML = items
    .map((f) => {
      const vencido = f.dias < 0;
      const hoy = f.dias === 0;
      const dias = vencido ? `${-f.dias} día(s) de retraso` : hoy ? '¡Hoy!' : `en ${f.dias} día(s)`;
      const ico = vencido ? '⛔' : f.dias <= 3 ? '🚨' : '🛠️';
      const detalle = `Último: ${formatearFecha(f.ultimo_mantenimiento) || '—'}`;
      return `<div class="mant-item">
        <div class="mant-ico">${ico}</div>
        <div class="mant-info">
          <span class="mant-placa">${f.placa}</span> · ${f.nombre || '—'}<br>
          <span class="mant-detalle">${detalle} → Próximo: ${formatearFecha(f.proximo_mantenimiento)} · <b>${dias}</b></span>
        </div>
        <div class="mant-plan">${f.plan_mantenimiento ? ('📋 ' + f.plan_mantenimiento) : 'Sin plan registrado'}</div>
      </div>`;
    })
    .join('');
}

/* ---------- Mapa en vivo (Leaflet) ---------- */
let mapaEco = null;
let capaMarcadores = null;
let primeraCargaMapa = true;

function inicializarMapa() {
  const cont = document.getElementById('mapa-eco');
  if (!cont || mapaEco) return;
  mapaEco = L.map('mapa-eco', { zoomControl: true }).setView([4.711, -74.072], 5); // Colombia
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(mapaEco);
  capaMarcadores = L.layerGroup().addTo(mapaEco);
}

function colorMarcador(ect) {
  if (ect === null) return '#64748b';
  if (ect > 105) return '#ef4444';
  if (ect >= 95) return '#f59e0b';
  return '#22d3ee';
}

function actualizarMarcadores(filas) {
  if (!mapaEco || !capaMarcadores) return;
  capaMarcadores.clearLayers();
  const conPosicion = filas.filter((f) => f.lat !== null && f.lng !== null);
  if (!conPosicion.length) {
    if (primeraCargaMapa) mapaEco.setView([4.711, -74.072], 5);
    primeraCargaMapa = false;
    return;
  }
  conPosicion.forEach((f) => {
    const ect = f.ect === null ? null : Number(f.ect);
    const icono = L.divIcon({
      className: '',
      html: `<div class="marcador-flota" style="--mcolor:${colorMarcador(ect)}">${String(f.placa).slice(0, 2).toUpperCase()}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -34],
    });
    const nivel = f.nivel_combustible === null ? '--' : Math.round(Number(f.nivel_combustible)) + '%';
    const html = `<strong>${f.placa}</strong> · ${f.nombre || 'sin nombre'}<br>
      🌡️ ECT: <b>${ect === null ? '--' : ect + ' °C'}</b> ·
      ⛽ <b>${nivel}</b><br>
      🔄 RPM: ${f.rpm === null ? '--' : f.rpm}<br>
      <small>⏱️ ${f.ultima_lectura ? new Date(f.ultima_lectura).toLocaleTimeString('es-CO') : 'sin lecturas'}</small>`;
    L.marker([Number(f.lat), Number(f.lng)], { icon: icono }).bindPopup(html).addTo(capaMarcadores);
  });
  if (primeraCargaMapa) {
    const limites = L.latLngBounds(conPosicion.map((f) => [Number(f.lat), Number(f.lng)]));
    mapaEco.fitBounds(limites.pad(0.2), { maxZoom: 14 });
    primeraCargaMapa = false;
  }
}

/* ---------- Gráfica en vivo de ECT ---------- */
const GRAFICA_MAX_PUNTOS = 40;
const almacenGrafica = new Map(); // placa -> [{ t, ect }]
const COLORES_PLACA = ['#22d3ee', '#34d399', '#f59e0b', '#a78bfa', '#f472b6', '#fb923c'];

function registrarPuntoGraficas(filas) {
  const t = Date.now();
  filas.forEach((f) => {
    if (!f.ultima_lectura || f.ect === null) return;
    const ser = almacenGrafica.get(f.placa) || [];
    ser.push({ t, ect: Number(f.ect) });
    almacenGrafica.set(f.placa, ser.slice(-GRAFICA_MAX_PUNTOS));
  });
  dibujarGrafica();
}

let graficaRedibuja = null;

function dibujarGrafica() {
  const canvas = document.getElementById('grafica-ect');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const cssW = canvas.clientWidth || 960;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== 220 * dpr) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = 220 * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cssW;
  const H = 220;
  const padL = 40;
  const padR = 14;
  const padT = 18;
  const padB = 28;

  ctx.clearRect(0, 0, W, H);

  // Ejes Y: 50..115 °C
  const yMin = 50;
  const yMax = 115;
  const Y = (ect) => padT + ((yMax - ect) / (yMax - yMin)) * (H - padT - padB);

  // Rejilla y etiquetas Y
  for (let v = yMin; v <= yMax; v += 5) {
    const y = Y(v);
    ctx.strokeStyle = 'rgba(148,163,184,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.fillStyle = '#8fa0b8';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${v}°`, padL - 8, y + 4);
  }

  // Umbral crítico 105 °C (línea roja punteada)
  const y105 = Y(105);
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = 'rgba(239,68,68,0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padL, y105);
  ctx.lineTo(W - padR, y105);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ef4444';
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px Segoe UI, sans-serif';
  ctx.fillText('Límite 105 °C', W - padR - 88, y105 - 6);

  if (!almacenGrafica.size) {
    ctx.fillStyle = '#64748b';
    ctx.font = '13px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Esperando lecturas de telemetría…', W / 2, H / 2);
    return;
  }

  // Rango de tiempo: últimas N muestras (o todas desde el inicio)
  let tMin = Infinity;
  let tMax = -Infinity;
  almacenGrafica.forEach((ser) => {
    ser.forEach((p) => {
      if (p.t < tMin) tMin = p.t;
      if (p.t > tMax) tMax = p.t;
    });
  });
  if (tMax === tMin) tMax = tMin + 1;

  const xPix = (t) => padL + ((t - tMin) / (tMax - tMin)) * (W - padL - padR);

  // Etiquetas de hora (mín y máx)
  ctx.fillStyle = '#64748b';
  ctx.font = '11px Segoe UI, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(new Date(tMin).toLocaleTimeString('es-CO'), padL, H - 8);
  ctx.textAlign = 'right';
  ctx.fillText(new Date(tMax).toLocaleTimeString('es-CO'), W - padR, H - 8);

  // Dibujar serie de cada vehículo
  let i = 0;
  almacenGrafica.forEach((ser, placa) => {
    if (ser.length < 2) return;
    const color = COLORES_PLACA[i % COLORES_PLACA.length];
    i++;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ser.forEach((p, idx) => {
      const x = xPix(p.t);
      const y = Y(p.ect);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Último punto + etiqueta con placa
    const ult = ser[ser.length - 1];
    const x = xPix(ult.t);
    const y = Y(ult.ect);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.fillText(placa, x + 7, y - 6);
  });
}

function iniciarPollingGrafica() {
  setInterval(() => cargarFlota(), 5000);
}

window.addEventListener('resize', () => {
  clearTimeout(graficaRedibuja);
  graficaRedibuja = setTimeout(dibujarGrafica, 150);
});

async function cargarVehiculos() {
  try {
    const [rv, rr] = await Promise.all([
      fetchApi(`${API}/vehiculos`),
      fetchApi(`${API}/telemetry/resumen`),
    ]);
    const filas = await rv.json();
    const resumen = await rr.json();
    const porId = new Map(resumen.map((r) => [r.id, r]));
    filas.forEach((v) => {
      const r = porId.get(v.id);
      v.ect = r ? r.ect ?? null : null;
      v.nivel_combustible = r ? r.nivel_combustible ?? null : null;
    });
    renderVehiculos(filas);
  } catch (err) {
    console.error('Error al cargar vehículos:', err);
  }
}

function renderVehiculos(filas) {
  const cuerpo = document.getElementById('cuerpo-vehiculos');
  vehiculosCache = {};
  filas.forEach((v) => { vehiculosCache[v.id] = v; });
  if (!filas.length) {
    cuerpo.innerHTML = '<tr><td colspan="13" class="vacio">No hay vehículos registrados</td></tr>';
    return;
  }
  cuerpo.innerHTML = filas
    .map(
      (v) => `<tr>
        <td><strong>${v.placa}</strong></td>
        <td>${v.nombre || '--'}</td>
        <td><span class="pill cyan">${v.tipo_vehiculo || 'CARRO'}</span></td>
        <td>${v.combustible ? v.combustible.charAt(0) + v.combustible.slice(1).toLowerCase() : '--'}</td>
        <td>${v.anio || '--'}</td>
        <td><button class="btn-ver-key" data-id="${v.id}" data-placa="${v.placa}">Ver API Key</button></td>
        <td>${v.total_lecturas}</td>
        <td><span class="pill ${clasePillAlertas(v.alertas_activas)}">${v.alertas_activas}</span></td>
        <td><span class="pill ${saludVehiculo(v).clase}">${saludVehiculo(v).texto}</span></td>
        <td>${v.activo ? '<span class="pill verde">Activo</span>' : '<span class="pill rojo">Inactivo</span>'}</td>
        <td>${formatearFecha(v.ultimo_mantenimiento) || '—'}</td>
        <td>${pillProximoMnt(v.proximo_mantenimiento)}</td>
        <td class="acciones">
          <button class="btn-mini" data-mant="${v.id}" data-placa="${v.placa}" data-nombre="${v.nombre || ''}">Mant.</button>
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
  cuerpo.querySelectorAll('[data-mant]').forEach((btn) =>
    btn.addEventListener('click', () => abrirModalMant(btn.dataset.mant, btn.dataset.placa, btn.dataset.nombre))
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

function pillProximoMnt(proximo) {
  const dias = diasHasta(proximo);
  if (dias === null) return '—';
  const f = formatearFecha(proximo);
  if (dias < 0) return `<span class="pill rojo">${f} · vencido</span>`;
  if (dias === 0) return `<span class="pill ambar">${f} · hoy</span>`;
  return `<span class="pill gris">${f}</span>`;
}

/* ---------- Modal de mantenimiento completo ---------- */
let mantActivo = null;
let vehiculosCache = {};

function formatearDinero(n) {
  const v = Number(n);
  if (n === null || n === undefined || !Number.isFinite(v)) return '';
  return '$ ' + v.toLocaleString('es-CO');
}

function estadoServicio(dias, intervalo) {
  if (dias === null) return { texto: 'Sin programar', clase: 'gris', frase: 'Define el próximo servicio', prog: 0 };
  if (dias < 0) return { texto: 'Vencido', clase: 'rojo', frase: `Hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`, prog: 100 };
  if (dias === 0) return { texto: 'Vence hoy', clase: 'ambar', frase: 'Agenda el servicio', prog: 100 };
  const int = Number(intervalo) > 0 ? Number(intervalo) : 180;
  const prog = Math.round(Math.min(100, Math.max(0, (100 * (int - dias)) / int)));
  const frase = `En ${dias} día${dias === 1 ? '' : 's'}`;
  if (dias <= 15) return { texto: 'Por vencer', clase: 'ambar', frase, prog };
  return { texto: 'En orden', clase: 'verde', frase, prog };
}

function renderResumenMnt(v, hist) {
  const estado = estadoServicio(diasHasta(v.proximo_mantenimiento), v.intervalo_mantenimiento);

  document.getElementById('mant-placa').textContent = v.placa || '—';
  document.getElementById('mant-nombre').textContent = v.nombre || '';
  document.getElementById('mant-tipo').textContent = v.tipo_vehiculo || 'CARRO';
  const est = document.getElementById('mant-estado');
  est.textContent = v.activo ? 'Activo' : 'Inactivo';
  est.className = 'pill ' + (v.activo ? 'verde' : 'rojo');
  const salud = saludVehiculo(v);
  const saludEl = document.getElementById('mant-salud');
  saludEl.textContent = salud.texto;
  saludEl.className = 'pill mant-veh-salud ' + salud.clase;

  document.getElementById('kpi-proximo').textContent = formatearFecha(v.proximo_mantenimiento) || '—';
  document.getElementById('kpi-proximo-sub').textContent = estado.frase;
  const barra = document.getElementById('barra-proximo');
  barra.style.width = estado.prog + '%';
  barra.className = 'mant-barra-relleno ' + estado.clase;

  const ultimo = hist.length ? hist[0].fecha : null;
  document.getElementById('kpi-ultimo').textContent = formatearFecha(ultimo) || '—';
  const diasUlt = ultimo ? Math.max(0, Math.floor((Date.now() - new Date(ultimo).getTime()) / 86400000)) : null;
  document.getElementById('kpi-ultimo-sub').textContent = diasUlt === null ? 'Sin servicios' : `Hace ~${diasUlt} día${diasUlt === 1 ? '' : 's'}`;

  const total = hist.reduce((s, m) => s + (Number(m.costo) || 0), 0);
  document.getElementById('kpi-costo').textContent = total ? formatearDinero(total) : '$ 0';
  document.getElementById('kpi-costo-sub').textContent = `${hist.length} servicio${hist.length === 1 ? '' : 's'} registrado${hist.length === 1 ? '' : 's'}`;

  document.getElementById('kpi-servicios').textContent = hist.length;
  const km = ultimo && hist[0].odometro !== null && hist[0].odometro !== undefined
    ? `${Number(hist[0].odometro).toLocaleString('es-CO')} km` : '—';
  document.getElementById('kpi-servicios-sub').textContent = `Último: ${km}`;

  document.getElementById('mant-total').textContent = total ? `Total ${formatearDinero(total)}` : '';
}

async function abrirModalMant(id, placa, nombre) {
  mantActivo = id;
  const v = vehiculosCache[id] || { placa, nombre, activo: true, tipo_vehiculo: 'CARRO' };
  const resp = await fetchApi(`${API}/vehiculos/${id}/mantenimientos`).catch(() => null);
  const hist = resp && resp.ok ? await resp.json() : [];
  document.getElementById('mant-proximo').value = v.proximo_mantenimiento ? String(v.proximo_mantenimiento).slice(0, 10) : '';
  document.getElementById('mant-intervalo').value = v.intervalo_mantenimiento || '';
  document.getElementById('mant-plan').value = v.plan_mantenimiento || '';
  document.getElementById('mnt-fecha').value = new Date().toISOString().slice(0, 10);
  document.getElementById('mnt-odometro').value = '';
  document.getElementById('mnt-desc').value = '';
  document.getElementById('mnt-costo').value = '';
  renderResumenMnt(v, hist);
  renderHistorialMant(hist);
  document.getElementById('modal-mant').classList.remove('oculto');
}

function cerrarModalMant() {
  document.getElementById('modal-mant').classList.add('oculto');
  mantActivo = null;
}

async function guardarModalMant() {
  if (!mantActivo) return;
  const intervalo = Number(document.getElementById('mant-intervalo').value);
  const plan = document.getElementById('mant-plan').value.trim();
  const proxio = document.getElementById('mant-proximo').value || '';
  try {
    const resp = await fetchApi(`${API}/vehiculos/${mantActivo}`, {
      method: 'PUT',
      body: JSON.stringify({
        intervalo_mantenimiento: Number.isFinite(intervalo) && intervalo > 0 ? intervalo : null,
        plan_mantenimiento: plan,
        proximo_mantenimiento: proxio,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) return toast(data.error || 'Error al guardar', 'err');
    toast('Configuración de mantenimiento guardada', 'ok');
    cerrarModalMant();
    cargarVehiculos();
    cargarFlota();
  } catch (err) {
    console.error(err);
    toast('Error al guardar', 'err');
  }
}

function renderHistorialMant(lista) {
  const cont = document.getElementById('hist-mantenimientos');
  if (!lista || !lista.length) {
    cont.innerHTML = '<div class="mant-vacio">Sin servicios registrados todavía.</div>';
    return;
  }
  cont.innerHTML = lista
    .map((m) => {
      const km = m.odometro !== null && m.odometro !== undefined
        ? `${Number(m.odometro).toLocaleString('es-CO')} km` : '';
      const costo = formatearDinero(m.costo);
      return `<div class="mant-hist-item">
        <span class="mant-hist-dot"></span>
        <div class="mant-hist-cuerpo">
          <div class="mant-hist-cab">
            <span class="mant-hist-fecha">${formatearFecha(m.fecha) || '—'}</span>
            ${costo ? `<span class="mant-hist-costo">${costo}</span>` : ''}
            <button class="btn-mini peligro" data-mnt-del="${m.id}" title="Eliminar este servicio">Eliminar</button>
          </div>
          <p class="mant-hist-desc">${m.descripcion || 'Servicio general'}</p>
          ${km ? `<small class="mant-hist-km">Odómetro ${km}</small>` : ''}
        </div>
      </div>`;
    })
    .join('');
  cont.querySelectorAll('[data-mnt-del]').forEach((btn) =>
    btn.addEventListener('click', () => eliminarMantenimiento(btn.dataset.mntDel))
  );
}

async function refrescarModalMant() {
  if (!mantActivo) return;
  try {
    const [rv, rh] = await Promise.all([
      fetchApi(`${API}/vehiculos`).then((r) => r.json()),
      fetchApi(`${API}/vehiculos/${mantActivo}/mantenimientos`).then((r) => r.json()),
    ]);
    const v = rv.find((x) => x.id === mantActivo) || {};
    v.ect = vehiculosCache[mantActivo]?.ect ?? null;
    v.nivel_combustible = vehiculosCache[mantActivo]?.nivel_combustible ?? null;
    vehiculosCache[mantActivo] = v;
    document.getElementById('mant-proximo').value = v.proximo_mantenimiento ? String(v.proximo_mantenimiento).slice(0, 10) : '';
    document.getElementById('mant-intervalo').value = v.intervalo_mantenimiento || '';
    document.getElementById('mant-plan').value = v.plan_mantenimiento || '';
    renderResumenMnt(v, rh);
    renderHistorialMant(rh);
  } catch (err) {
    console.error(err);
  }
}

async function registrarMantenimiento() {
  if (!mantActivo) return;
  const fecha = document.getElementById('mnt-fecha').value || '';
  const descripcion = document.getElementById('mnt-desc').value.trim();
  const costo = document.getElementById('mnt-costo').value || null;
  const odometro = document.getElementById('mnt-odometro').value || null;
  if (!fecha) return toast('Indica la fecha del mantenimiento', 'err');
  try {
    const resp = await fetchApi(`${API}/vehiculos/${mantActivo}/mantenimientos`, {
      method: 'POST',
      body: JSON.stringify({
        fecha,
        descripcion,
        costo: costo === null ? null : Number(costo),
        odometro: odometro === null ? null : Number(odometro),
        intervalo_mantenimiento: Number(document.getElementById('mant-intervalo').value) || null,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) return toast(data.error || 'Error al registrar', 'err');
    toast('Mantenimiento registrado', 'ok');
    document.getElementById('mnt-fecha').value = new Date().toISOString().slice(0, 10);
    document.getElementById('mnt-odometro').value = '';
    document.getElementById('mnt-desc').value = '';
    document.getElementById('mnt-costo').value = '';
    await refrescarModalMant();
    cargarVehiculos();
    cargarFlota();
  } catch (err) {
    console.error(err);
    toast('Error al registrar el mantenimiento', 'err');
  }
}

async function eliminarMantenimiento(id) {
  if (!mantActivo) return;
  if (!confirm('¿Eliminar este mantenimiento del historial?')) return;
  try {
    const resp = await fetchApi(`${API}/vehiculos/${mantActivo}/mantenimientos/${id}`, { method: 'DELETE' });
    if (!resp.ok) return toast('No se pudo eliminar', 'err');
    toast('Mantenimiento eliminado', 'ok');
    await refrescarModalMant();
    cargarVehiculos();
    cargarFlota();
  } catch (err) {
    console.error(err);
  }
}

async function crearVehiculo() {
  const placa = document.getElementById('nueva-placa').value.trim();
  const nombre = document.getElementById('nuevo-nombre').value.trim();
  const tipo = document.getElementById('nuevo-tipo').value || 'CARRO';
  const combustible = document.getElementById('nuevo-combustible').value || null;
  const anio = document.getElementById('nuevo-anio').value || null;
  const msg = document.getElementById('msg-flota');

  if (!placa) {
    msg.textContent = 'La placa es obligatoria';
    msg.classList.remove('oculto');
    return;
  }

  try {
    const resp = await fetchApi(`${API}/vehiculos`, {
      method: 'POST',
      body: JSON.stringify({ placa, nombre, tipo, combustible, anio }),
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
    document.getElementById('nuevo-anio').value = '';
    document.getElementById('nuevo-combustible').value = '';
    cargarVehiculos();
    cargarFlota();
    toast(`Vehículo ${placa} registrado. API Key: ${data.api_key}`, 'ok');
  } catch (err) {
    console.error(err);
  }
}

let keyVehiculoId = null;

function abrirModalKey(data) {
  keyVehiculoId = data.id;
  document.getElementById('key-titulo').textContent = `Vehículo: ${data.placa}`;
  document.getElementById('key-valor').textContent = data.api_key;
  document.getElementById('modal-key').classList.remove('oculto');
}

function cerrarModalKey() {
  document.getElementById('modal-key').classList.add('oculto');
  keyVehiculoId = null;
}

async function verApiKey(id, placa) {
  try {
    const resp = await fetchApi(`${API}/vehiculos/${id}/apikey`);
    const data = await resp.json();
    if (!resp.ok) return toast(data.error || 'Error', 'err');
    abrirModalKey(data);
  } catch (err) {
    console.error(err);
  }
}

async function copiarKey() {
  const key = document.getElementById('key-valor').textContent;
  if (!key) return;
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(key);
    }
    toast('API Key copiada al portapapeles', 'ok');
  } catch (err) {
    toast('No se pudo copiar, selecciona el texto manualmente', 'info');
  }
}

async function regenerarKey(id) {
  keyVehiculoId = id || keyVehiculoId;
  if (!keyVehiculoId) return;
  if (!confirm('¿Regenerar la API Key? El dispositivo con la key anterior dejará de funcionar.')) return;
  try {
    const resp = await fetchApi(`${API}/vehiculos/${keyVehiculoId}/apikey/regenerar`, { method: 'POST' });
    const data = await resp.json();
    if (!resp.ok) return toast(data.error || 'Error', 'err');
    toast('API Key regenerada', 'ok');
    abrirModalKey(data);
    cargarVehiculos();
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
    if (!resp.ok) return toast(data.error || 'Error', 'err');
    toast(`Nueva API Key: ${data.api_key}`, 'ok');
    cargarVehiculos();
  } catch (err) {
    console.error(err);
  }
}

async function eliminarVehiculo(id, placa) {
  if (!confirm(`¿Eliminar el vehículo ${placa}? Se borrarán sus lecturas y alertas.`)) return;
  try {
    await fetchApi(`${API}/vehiculos/${id}`, { method: 'DELETE' });
    toast(`Vehículo ${placa} eliminado`, 'ok');
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
    cuerpo.innerHTML = '<tr><td colspan="6" class="vacio">Sin alertas registradas</td></tr>';
    return;
  }
  const pillSev = (s) => (s === 'ALTA' ? 'rojo' : s === 'MEDIA' ? 'ambar' : 'gris');
  const pillEst = (e) => (e === 'ATENDIDA' ? 'verde' : e === 'ACTIVA' ? 'ambar' : 'gris');
  cuerpo.innerHTML = filas
    .map((a) => `<tr>
      <td><strong>${a.placa}</strong></td>
      <td>${a.tipo_alerta}</td>
      <td><span class="pill ${pillSev(a.severidad)}">${a.severidad}</span></td>
      <td><span class="pill ${pillEst(a.estado)}">${a.estado}</span></td>
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
    const resp = await fetchApi(`${API}/historial/alertas/${id}/atender`, { method: 'POST' });
    if (!resp.ok) return toast('Error al atender la alerta', 'err');
    toast('Alerta atendida', 'ok');
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
    cuerpo.innerHTML = '<tr><td colspan="5" class="vacio">Sin lecturas</td></tr>';
    return;
  }
  cuerpo.innerHTML = filas
    .map((t) => `<tr>
      <td><strong>${t.placa}</strong></td>
      <td class="${Number(t.ect_temperatura) > 105 ? 'caliente' : ''}">${t.ect_temperatura} °C</td>
      <td>${t.rpm}</td>
      <td>${t.nivel_combustible === null || t.nivel_combustible === undefined ? '--' : Math.round(Number(t.nivel_combustible)) + '%'}</td>
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

/* ---------- Demo en vivo ---------- */
let demoIntervalo = null;
const estadoDemo = new Map();

async function tickDemo() {
  try {
    const resp = await fetchApi(`${API}/telemetry/resumen`);
    const filas = await resp.json();
    if (!filas.length) {
      toast('Registra al menos un vehículo para la demo', 'info');
      pararDemo();
      return;
    }
    for (const f of filas) {
      const prev = estadoDemo.get(f.placa) || {};
      let ect = (prev.ect ?? 88 + Math.random() * 8) + (Math.random() * 4 - 2);
      if (Math.random() < 0.08) ect = 106 + Math.random() * 6; // alerta ocasional
      ect = Math.min(118, Math.max(60, Math.round(ect * 10) / 10));
      const rpm = Math.round(Math.max(1200, Math.min(3800, (prev.rpm ?? 2000 + Math.random() * 800) + Math.round(Math.random() * 300 - 150))));
      const nivel = Math.max(2, Math.min(100, (prev.nivel ?? 60 + Math.random() * 20) - 0.4 + Math.random() * 0.4));
      const lat = (Number(f.lat) || 4.6 + Math.random()) + (Math.random() * 0.02 - 0.01);
      const lng = (Number(f.lng) || -74.1 + Math.random()) + (Math.random() * 0.02 - 0.01);
      estadoDemo.set(f.placa, { ect, rpm, nivel, lat, lng });
      await fetchApi(`${API}/telemetry/demo`, {
        method: 'POST',
        body: JSON.stringify({
          placa: f.placa,
          ect,
          rpm,
          nivel_combustible: Math.round(nivel * 10) / 10,
          lat: +lat.toFixed(5),
          lng: +lng.toFixed(5),
        }),
      });
    }
    cargarFlota();
  } catch (err) {
    console.error('Error en demo:', err);
  }
}

function iniciarDemo() {
  if (demoIntervalo) return;
  tickDemo();
  demoIntervalo = setInterval(tickDemo, 5000);
  const b = document.getElementById('btn-demo');
  if (b) {
    b.textContent = '⏸️ Detener demo';
    b.classList.add('activo');
  }
}

function pararDemo() {
  if (demoIntervalo) {
    clearInterval(demoIntervalo);
    demoIntervalo = null;
  }
  const b = document.getElementById('btn-demo');
  if (b) {
    b.textContent = '▶️ Demo en vivo';
    b.classList.remove('activo');
  }
}

/* ---------- Exportar CSV ---------- */
function descargarCSV(nombre, columnas, filas) {
  const escapar = (v) => {
    const s = String(v ?? '');
    return /[;",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const contenido =
    '\uFEFF' +
    [columnas.map(escapar).join(';'), ...filas.map((r) => r.map(escapar).join(';'))].join('\r\n');
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function exportarCSVAlertas() {
  try {
    const estado = document.getElementById('filtro-alerta-estado').value || null;
    const params = estado ? `?estado=${estado}` : '';
    const resp = await fetchApi(`${API}/historial/alertas${params}`);
    const filas = await resp.json();
    descargarCSV(`alertas_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Placa', 'Tipo', 'Severidad', 'Estado', 'Fecha'],
      filas.map((a) => [a.placa, a.tipo_alerta, a.severidad, a.estado, new Date(a.fecha_generacion).toLocaleString('es-CO')]));
    toast('Alertas exportadas', 'ok');
  } catch (err) {
    console.error(err);
  }
}

async function exportarCSVTelemetria() {
  try {
    const resp = await fetchApi(`${API}/historial/telemetria?limite=20`);
    const filas = await resp.json();
    descargarCSV(`telemetria_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Placa', 'ECT (°C)', 'RPM', 'Combustible (%)', 'Fecha'],
      filas.map((t) => [t.placa, t.ect_temperatura, t.rpm, t.nivel_combustible == null ? '--' : Math.round(Number(t.nivel_combustible)), new Date(t.fecha_registro).toLocaleString('es-CO')]));
    toast('Telemetría exportada', 'ok');
  } catch (err) {
    console.error(err);
  }
}

/* ---------- Informe de flota (imprimir / PDF) ---------- */
async function abrirInforme() {
  try {
    const resp = await fetchApi(`${API}/telemetry/resumen`);
    const filas = await resp.json();
    const enLinea = filas.filter((f) => f.ultima_lectura).length;
    const alertas = filas.reduce((n, f) => n + Number(f.alertas_activas || 0), 0);
    const ects = filas.map((f) => Number(f.ect)).filter((v) => Number.isFinite(v));
    const conteo = { verde: 0, ambar: 0, rojo: 0 };
    filas.forEach((f) => { conteo[saludVehiculo(f).clase]++; });

    document.getElementById('info-fecha').textContent = 'Generado: ' + new Date().toLocaleString('es-CO');
    document.getElementById('info-kpis').innerHTML = `
      <div><b>${filas.length}</b> vehículos</div>
      <div><b>${enLinea}</b> en línea</div>
      <div><b>${alertas}</b> alertas activas</div>
      <div><b>${ects.length ? Math.round(Math.max(...ects)) + ' °C' : '--'}</b> ECT máx. de flota</div>`;
    document.getElementById('info-salud').innerHTML = `
      <span class="pill verde">${conteo.verde} óptimo(s)</span>
      <span class="pill ambar">${conteo.ambar} en riesgo</span>
      <span class="pill rojo">${conteo.rojo} crítico(s)</span>`;
    document.getElementById('info-tabla').innerHTML = `
      <thead><tr>
        <th>Placa</th><th>Nombre</th><th>Tipo</th><th>Salud</th><th>ECT (°C)</th>
        <th>RPM</th><th>Combustible</th><th>Última lectura</th><th>Próximo mnt</th>
      </tr></thead>
      <tbody>${filas.map((f) => {
        const s = saludVehiculo(f);
        return `<tr>
          <td><b>${f.placa}</b></td>
          <td>${f.nombre || '—'}</td>
          <td>${f.tipo_vehiculo || '—'}</td>
          <td><span class="pill ${s.clase}">${s.texto}</span></td>
          <td>${f.ect === null ? '--' : f.ect + ' °C'}</td>
          <td>${f.rpm === null ? '--' : f.rpm}</td>
          <td>${f.nivel_combustible === null || f.nivel_combustible === undefined ? '--' : Math.round(Number(f.nivel_combustible)) + '%'}</td>
          <td>${f.ultima_lectura ? new Date(f.ultima_lectura).toLocaleString('es-CO') : 'Sin lecturas'}</td>
          <td>${formatearFecha(f.proximo_mantenimiento) || '—'}</td>
        </tr>`;
      }).join('')}</tbody>`;
    await new Promise((r) => setTimeout(r, 60));
    window.print();
  } catch (err) {
    console.error('Error al generar el informe:', err);
  }
}

document.getElementById('form-login').addEventListener('submit', login);
document.getElementById('btn-salir').addEventListener('click', salir);
document.getElementById('banner-cerrar').addEventListener('click', ocultarAlerta);
document.getElementById('btn-simular').addEventListener('click', simularAlerta);
document.getElementById('btn-demo').addEventListener('click', () => (demoIntervalo ? pararDemo() : iniciarDemo()));
document.getElementById('btn-informe').addEventListener('click', abrirInforme);
document.getElementById('btn-exportar-alertas').addEventListener('click', exportarCSVAlertas);
document.getElementById('btn-exportar-telemetria').addEventListener('click', exportarCSVTelemetria);
document.getElementById('btn-crear').addEventListener('click', crearVehiculo);
document.getElementById('btn-cargar-alertas').addEventListener('click', cargarAlertas);
document.getElementById('mant-guardar').addEventListener('click', guardarModalMant);
document.getElementById('mnt-registrar').addEventListener('click', registrarMantenimiento);
document.getElementById('mant-cancelar').addEventListener('click', cerrarModalMant);
document.getElementById('modal-cerrar').addEventListener('click', cerrarModalMant);
document.getElementById('modal-mant').addEventListener('click', (ev) => {
  if (ev.target === ev.currentTarget) cerrarModalMant();
});
document.getElementById('key-copiar').addEventListener('click', copiarKey);
document.getElementById('key-regenerar').addEventListener('click', regenerarKey);
document.getElementById('key-cancelar').addEventListener('click', cerrarModalKey);
document.getElementById('key-cerrar').addEventListener('click', cerrarModalKey);
document.getElementById('modal-key').addEventListener('click', (ev) => {
  if (ev.target === ev.currentTarget) cerrarModalKey();
});
document.querySelectorAll('.nav-btn').forEach((btn) => {
  if (!btn.dataset.vista) return; // enlaces externos (ej. /dispositivo/)
  btn.addEventListener('click', () => cambiarVista(btn.dataset.vista));
});

conectarSocket();

if (token) {
  mostrarDashboard();
}