/* EcoDrive · Consola de gestión (módulos de las 6 fases) */
const API = '/api/v1';
const getToken = () => localStorage.getItem('ecodrive_token');
const EMBED = new URLSearchParams(location.search).has('embed');
if (EMBED) document.body.classList.add('embed');
if (!EMBED && !getToken()) window.location.href = '/panel/';

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const money = (n) =>
  '$ ' + Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });
const fecha = (s) => (s ? new Date(s).toLocaleString('es-CO') : '—');

let ROLES = [];
let VEHICULOS = [];
let REPUESTOS = [];

function toast(msg, tipo = 'info') {
  const cont = $('g-toasts');
  const el = document.createElement('div');
  el.className = 'g-toast' + (tipo === 'ok' ? ' ok' : tipo === 'err' ? ' err' : '');
  el.textContent = (tipo === 'ok' ? '✅ ' : tipo === 'err' ? '❌ ' : 'ℹ️ ') + msg;
  cont.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

async function api(path, opciones = {}) {
  const headers = { ...(opciones.headers || {}) };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (opciones.body) headers['Content-Type'] = 'application/json';
  const resp = await fetch(API + path, { ...opciones, headers });
  if (resp.status === 401) {
    localStorage.removeItem('ecodrive_token');
    (window.top || window).location.href = '/panel/';
    throw new Error('Sesión expirada');
  }
  return resp;
}

async function json(path, opciones) {
  const r = await api(path, opciones);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || data.detalle || `HTTP ${r.status}`);
  return data;
}

function pill(estado) {
  const e = String(estado || '').toUpperCase();
  const cls =
    ['CERRADA', 'ACTIVO', 'ENVIADO', 'APROBADA', 'RESUELTA', 'ENTRADA'].includes(e)
      ? 'verde'
      : ['ERROR', 'RECHAZADA', 'URGENTE', 'ALTA', 'PENDIENTE', 'SALIDA'].includes(e)
      ? 'rojo'
      : ['EN_PROCESO', 'MEDIA', 'PENDIENTE'].includes(e)
      ? 'ambar'
      : 'gris';
  return `<span class="g-pill ${cls}">${esc(estado)}</span>`;
}

/* ---------------- Modal ---------------- */
function modal(html) {
  $('g-modal-caja').innerHTML = html;
  $('g-modal').classList.remove('oculto');
}
function cerrarModal() {
  $('g-modal').classList.add('oculto');
  $('g-modal-caja').innerHTML = '';
}
$('g-modal').addEventListener('click', (e) => {
  if (e.target.id === 'g-modal') cerrarModal();
});

/* ---------------- Tabs ---------------- */
const CARGADORES = {};
document.querySelectorAll('.g-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.g-tab').forEach((t) => t.classList.remove('activo'));
    document.querySelectorAll('.g-panel').forEach((p) => p.classList.remove('activo'));
    tab.classList.add('activo');
    document.querySelector(`.g-panel[data-panel="${tab.dataset.panel}"]`).classList.add('activo');
    if (CARGADORES[tab.dataset.panel]) CARGADORES[tab.dataset.panel]();
  });
});

/* ================================================================
 * USUARIOS
 * ================================================================ */
async function cargarRolesCache() {
  if (ROLES.length) return ROLES;
  ROLES = await json('/usuarios/roles');
  const sel = $('u-rol');
  sel.innerHTML = ROLES.map((r) => `<option value="${esc(r.nombre)}">${esc(r.nombre)}</option>`).join('');
  return ROLES;
}

async function cargarUsuarios() {
  await cargarRolesCache();
  const usuarios = await json('/usuarios');
  const tb = $('tb-usuarios');
  if (!usuarios.length) {
    tb.innerHTML = '<tr><td colspan="7" class="g-vacio">Sin usuarios.</td></tr>';
    return;
  }
  tb.innerHTML = usuarios
    .map(
      (u) => `<tr>
      <td>${esc(u.username)}</td>
      <td>${esc(u.nombre || '—')}</td>
      <td>${pill(u.rol || '—')}</td>
      <td>${esc(u.sede || '—')}</td>
      <td>${u.activo ? pill('ACTIVO') : pill('INACTIVO')}</td>
      <td class="g-log">${fecha(u.ultimo_acceso)}</td>
      <td><div class="g-acciones">
        <button class="g-btn sec chico" data-edit="${u.id}">Editar</button>
        <button class="g-btn peligro chico" data-del="${u.id}" data-user="${esc(u.username)}">Eliminar</button>
      </div></td></tr>`
    )
    .join('');
  tb.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => editarUsuario(usuarios.find((x) => x.id === b.dataset.edit)))
  );
  tb.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => eliminarUsuario(b.dataset.del, b.dataset.user))
  );
}

function editarUsuario(u) {
  modal(`<h3>Editar usuario · ${esc(u.username)}</h3>
    <div class="g-form" style="flex-direction:column;align-items:stretch">
      <div class="g-campo"><label>Nombre</label><input id="eu-nombre" value="${esc(u.nombre || '')}" /></div>
      <div class="g-campo"><label>Correo</label><input id="eu-email" value="${esc(u.email || '')}" /></div>
      <div class="g-campo"><label>Teléfono</label><input id="eu-telefono" value="${esc(u.telefono || '')}" /></div>
      <div class="g-campo"><label>Sede</label><input id="eu-sede" value="${esc(u.sede || '')}" /></div>
      <div class="g-campo"><label>Rol</label><select id="eu-rol">${ROLES.map(
        (r) => `<option value="${esc(r.nombre)}" ${r.nombre === u.rol ? 'selected' : ''}>${esc(r.nombre)}</option>`
      ).join('')}</select></div>
      <div class="g-campo"><label>Nueva contraseña (opcional)</label><input id="eu-pass" type="password" placeholder="Dejar vacío para no cambiar" /></div>
      <label class="g-check"><input type="checkbox" id="eu-activo" ${u.activo ? 'checked' : ''}/> Usuario activo</label>
    </div>
    <div class="g-modal-acciones">
      <button class="g-btn sec" onclick="cerrarModal()">Cancelar</button>
      <button class="g-btn" id="eu-guardar">Guardar</button>
    </div>`);
  $('eu-guardar').addEventListener('click', async () => {
    const body = {
      nombre: $('eu-nombre').value,
      email: $('eu-email').value,
      telefono: $('eu-telefono').value,
      sede: $('eu-sede').value,
      rol: $('eu-rol').value,
      activo: $('eu-activo').checked,
    };
    if ($('eu-pass').value) body.password = $('eu-pass').value;
    try {
      await json('/usuarios/' + u.id, { method: 'PUT', body: JSON.stringify(body) });
      toast('Usuario actualizado', 'ok');
      cerrarModal();
      cargarUsuarios();
    } catch (e) {
      toast(e.message, 'err');
    }
  });
}

async function eliminarUsuario(id, user) {
  if (!confirm(`¿Eliminar al usuario "${user}"?`)) return;
  try {
    await json('/usuarios/' + id, { method: 'DELETE' });
    toast('Usuario eliminado', 'ok');
    cargarUsuarios();
  } catch (e) {
    toast(e.message, 'err');
  }
}

$('f-usuario').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await json('/usuarios', {
      method: 'POST',
      body: JSON.stringify({
        username: $('u-username').value,
        password: $('u-password').value,
        nombre: $('u-nombre').value,
        email: $('u-email').value,
        telefono: $('u-telefono').value,
        sede: $('u-sede').value,
        rol: $('u-rol').value,
      }),
    });
    toast('Usuario creado', 'ok');
    e.target.reset();
    cargarUsuarios();
  } catch (err) {
    toast(err.message, 'err');
  }
});

/* ================================================================
 * ROLES
 * ================================================================ */
async function cargarRoles() {
  const [roles, permisos] = await Promise.all([json('/usuarios/roles'), json('/usuarios/permisos')]);
  ROLES = roles;
  const tb = $('tb-roles');
  tb.innerHTML = roles
    .map(
      (r) => `<tr>
      <td><b>${esc(r.nombre)}</b></td>
      <td>${esc(r.descripcion || '—')}</td>
      <td><div class="g-chips">${
        r.nombre === 'admin'
          ? '<span class="g-pill cyan">todos (*)</span>'
          : (r.permisos || []).length
          ? r.permisos.map((p) => `<span class="g-pill gris">${esc(p)}</span>`).join('')
          : '<span class="g-vacio">sin permisos</span>'
      }</div></td>
      <td>${
        r.nombre === 'admin'
          ? '<span class="g-vacio">—</span>'
          : `<button class="g-btn sec chico" data-perm="${r.id}">Editar permisos</button>`
      }</td></tr>`
    )
    .join('');
  tb.querySelectorAll('[data-perm]').forEach((b) =>
    b.addEventListener('click', () => editarPermisos(roles.find((x) => x.id === b.dataset.perm), permisos))
  );
}

function editarPermisos(rol, permisos) {
  const porRecurso = {};
  permisos.forEach((p) => {
    (porRecurso[p.recurso] = porRecurso[p.recurso] || []).push(p);
  });
  const grupos = Object.entries(porRecurso)
    .map(
      ([recurso, items]) =>
        `<div style="margin-bottom:10px"><div class="g-sub" style="text-transform:uppercase">${esc(recurso)}</div>
        <div class="g-check-grid">${items
          .map(
            (p) => `<label class="g-check"><input type="checkbox" value="${esc(p.clave_permiso)}" ${
              (rol.permisos || []).includes(p.clave_permiso) ? 'checked' : ''
            }/> ${esc(p.accion)}</label>`
          )
          .join('')}</div></div>`
    )
    .join('');
  modal(`<h3>Permisos · ${esc(rol.nombre)}</h3>${grupos}
    <div class="g-modal-acciones">
      <button class="g-btn sec" onclick="cerrarModal()">Cancelar</button>
      <button class="g-btn" id="rp-guardar">Guardar permisos</button>
    </div>`);
  $('rp-guardar').addEventListener('click', async () => {
    const claves = [...$('g-modal-caja').querySelectorAll('input[type=checkbox]:checked')].map((c) => c.value);
    try {
      await json('/usuarios/roles/' + rol.id + '/permisos', { method: 'PUT', body: JSON.stringify({ permisos: claves }) });
      toast('Permisos actualizados', 'ok');
      cerrarModal();
      cargarRoles();
    } catch (e) {
      toast(e.message, 'err');
    }
  });
}

/* ================================================================
 * ORDENES
 * ================================================================ */
async function cargarVehiculosCache() {
  if (VEHICULOS.length) return VEHICULOS;
  VEHICULOS = await json('/vehiculos');
  const opts = VEHICULOS.map((v) => `<option value="${v.id}">${esc(v.placa)} · ${esc(v.nombre || '')}</option>`).join('');
  $('o-vehiculo').innerHTML = opts || '<option value="">Sin vehículos</option>';
  $('d-vehiculo').innerHTML = opts || '<option value="">Sin vehículos</option>';
  return VEHICULOS;
}

async function cargarOrdenes() {
  await cargarVehiculosCache();
  const estado = $('o-filtro-estado').value;
  const ordenes = await json('/taller/ordenes' + (estado ? `?estado=${estado}` : ''));
  const tb = $('tb-ordenes');
  if (!ordenes.length) {
    tb.innerHTML = '<tr><td colspan="9" class="g-vacio">Sin órdenes.</td></tr>';
    return;
  }
  tb.innerHTML = ordenes
    .map(
      (o) => `<tr>
      <td class="g-log">${esc(o.codigo)}</td>
      <td>${esc(o.placa)}</td>
      <td>${esc(o.tipo)}</td>
      <td>${pill(o.estado)}</td>
      <td>${pill(o.prioridad)}</td>
      <td>${esc(o.mecanico || '—')}</td>
      <td>${o.items}</td>
      <td>${money(o.costo_total)}</td>
      <td><div class="g-acciones">
        <button class="g-btn sec chico" data-ver="${o.id}">Abrir</button>
        ${o.estado !== 'CERRADA' ? `<button class="g-btn chico" data-cerrar="${o.id}">Cerrar</button>` : ''}
        <button class="g-btn peligro chico" data-delot="${o.id}">Eliminar</button>
      </div></td></tr>`
    )
    .join('');
  tb.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => abrirOrden(b.dataset.ver)));
  tb.querySelectorAll('[data-cerrar]').forEach((b) =>
    b.addEventListener('click', () => cerrarOrden(b.dataset.cerrar))
  );
  tb.querySelectorAll('[data-delot]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta orden?')) return;
      try {
        await json('/taller/ordenes/' + b.dataset.delot, { method: 'DELETE' });
        toast('Orden eliminada', 'ok');
        cargarOrdenes();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );
}

async function abrirOrden(id) {
  try {
    const o = await json('/taller/ordenes/' + id);
    const filas = (o.repuestos || [])
      .map(
        (r) => `<tr>
        <td>${esc(r.repuesto_codigo || '—')}</td>
        <td>${esc(r.descripcion)}</td>
        <td>${r.cantidad}</td>
        <td>${money(r.costo_unitario)}</td>
        <td>${money(r.subtotal)}</td>
        <td>${o.estado !== 'CERRADA' ? `<button class="g-btn peligro chico" data-delitem="${r.id}">×</button>` : ''}</td>
      </tr>`
      )
      .join('') || '<tr><td colspan="6" class="g-vacio">Sin repuestos.</td></tr>';
    modal(`<h3>Orden ${esc(o.codigo)} · ${esc(o.placa)}</h3>
      <p class="g-sub">${esc(o.tipo)} · ${esc(o.estado)} · ${esc(o.descripcion || 'sin descripción')}</p>
      <div class="g-tabla-wrap"><table class="g-tabla">
        <thead><tr><th>Código</th><th>Descripción</th><th>Cant.</th><th>Unit.</th><th>Subtotal</th><th></th></tr></thead>
        <tbody id="ot-items">${filas}</tbody>
      </table></div>
      <div class="g-form" style="margin-top:14px">
        <select id="ot-repuesto">${REPUESTOS.map((r) => `<option value="${r.id}">${esc(r.codigo)} · ${esc(r.nombre)} (stock ${r.stock_actual})</option>`).join('')}</select>
        <input id="ot-cantidad" type="number" value="1" min="1" style="width:90px" />
        <button class="g-btn" id="ot-add">Agregar repuesto</button>
      </div>
      <p class="g-sub" style="margin-top:12px">Mano de obra: ${money(o.costo_mano_obra)} · Repuestos: ${money(o.costo_repuestos)} · <b>Total: ${money(o.costo_total)}</b></p>
      <div class="g-modal-acciones">
        <button class="g-btn sec" onclick="cerrarModal()">Cerrar</button>
        ${o.estado !== 'CERRADA' ? `<button class="g-btn" id="ot-cerrar">Finalizar orden</button>` : ''}
      </div>`);
    $('ot-add').addEventListener('click', async () => {
      try {
        await json(`/taller/ordenes/${id}/repuestos`, {
          method: 'POST',
          body: JSON.stringify({ repuesto_id: $('ot-repuesto').value, cantidad: Number($('ot-cantidad').value) }),
        });
        toast('Repuesto agregado', 'ok');
        REPUESTOS = await json('/taller/repuestos');
        abrirOrden(id);
      } catch (e) {
        toast(e.message, 'err');
      }
    });
    $('g-modal-caja').querySelectorAll('[data-delitem]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await json(`/taller/ordenes/${id}/repuestos/${b.dataset.delitem}`, { method: 'DELETE' });
          REPUESTOS = await json('/taller/repuestos');
          abrirOrden(id);
          toast('Ítem eliminado', 'ok');
        } catch (e) {
          toast(e.message, 'err');
        }
      })
    );
    if ($('ot-cerrar')) $('ot-cerrar').addEventListener('click', () => cerrarOrden(id, true));
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function cerrarOrden(id, enModal) {
  if (enModal || confirm('¿Finalizar la orden? Se registrará en el historial de mantenimiento del vehículo.')) {
    try {
      const r = await json(`/taller/ordenes/${id}/cerrar`, { method: 'POST', body: JSON.stringify({}) });
      toast(`Orden cerrada · total ${money(r.costo_total)}`, 'ok');
      cerrarModal();
      cargarOrdenes();
    } catch (e) {
      toast(e.message, 'err');
    }
  }
}

$('f-orden').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await json('/taller/ordenes', {
      method: 'POST',
      body: JSON.stringify({
        vehiculo_id: $('o-vehiculo').value,
        tipo: $('o-tipo').value,
        prioridad: $('o-prioridad').value,
        mecanico: $('o-mecanico').value,
        sede: $('o-sede').value,
        odometro: $('o-odometro').value || null,
        costo_mano_obra: $('o-mano').value || 0,
        descripcion: $('o-desc').value,
      }),
    });
    toast('Orden creada', 'ok');
    e.target.reset();
    cargarOrdenes();
  } catch (err) {
    toast(err.message, 'err');
  }
});
$('o-filtrar').addEventListener('click', cargarOrdenes);

/* ================================================================
 * INVENTARIO
 * ================================================================ */
async function cargarInventario() {
  const bajo = $('r-bajo').checked;
  REPUESTOS = await json('/taller/repuestos' + (bajo ? '?bajo_stock=1' : ''));
  const tb = $('tb-repuestos');
  if (!REPUESTOS.length) {
    tb.innerHTML = '<tr><td colspan="8" class="g-vacio">Sin repuestos.</td></tr>';
    return;
  }
  tb.innerHTML = REPUESTOS.map(
    (r) => `<tr>
      <td class="g-log">${esc(r.codigo)}</td>
      <td>${esc(r.nombre)}</td>
      <td>${Number(r.stock_actual)}</td>
      <td>${Number(r.stock_minimo)}</td>
      <td>${money(r.costo_unitario)}</td>
      <td>${esc(r.ubicacion || '—')}</td>
      <td>${r.bajo_stock ? pill('BAJO') : pill('OK')}</td>
      <td><div class="g-acciones">
        <button class="g-btn sec chico" data-mov="${r.id}">Movimiento</button>
        <button class="g-btn sec chico" data-movs="${r.id}">Historial</button>
        <button class="g-btn peligro chico" data-delrep="${r.id}">Eliminar</button>
      </div></td></tr>`
  ).join('');
  tb.querySelectorAll('[data-mov]').forEach((b) =>
    b.addEventListener('click', () => movimientoRepuesto(REPUESTOS.find((x) => x.id === b.dataset.mov)))
  );
  tb.querySelectorAll('[data-movs]').forEach((b) =>
    b.addEventListener('click', () => movimientosRepuesto(REPUESTOS.find((x) => x.id === b.dataset.movs)))
  );
  tb.querySelectorAll('[data-delrep]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar repuesto?')) return;
      try {
        await json('/taller/repuestos/' + b.dataset.delrep, { method: 'DELETE' });
        toast('Repuesto eliminado', 'ok');
        cargarInventario();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );
}

function movimientoRepuesto(r) {
  modal(`<h3>Movimiento · ${esc(r.codigo)} ${esc(r.nombre)}</h3>
    <p class="g-sub">Stock actual: <b>${Number(r.stock_actual)}</b></p>
    <div class="g-form" style="flex-direction:column;align-items:stretch">
      <div class="g-campo"><label>Tipo</label><select id="mv-tipo">
        <option value="ENTRADA">Entrada (compra)</option>
        <option value="SALIDA">Salida (consumo)</option>
        <option value="AJUSTE">Ajuste (fijar stock)</option>
      </select></div>
      <div class="g-campo"><label>Cantidad</label><input id="mv-cantidad" type="number" min="0" value="1" /></div>
      <div class="g-campo"><label>Costo unitario (opcional)</label><input id="mv-costo" type="number" min="0" /></div>
      <div class="g-campo"><label>Motivo</label><input id="mv-motivo" placeholder="ej. compra proveedor" /></div>
    </div>
    <div class="g-modal-acciones">
      <button class="g-btn sec" onclick="cerrarModal()">Cancelar</button>
      <button class="g-btn" id="mv-guardar">Registrar</button>
    </div>`);
  $('mv-guardar').addEventListener('click', async () => {
    try {
      await json(`/taller/repuestos/${r.id}/movimientos`, {
        method: 'POST',
        body: JSON.stringify({
          tipo: $('mv-tipo').value,
          cantidad: Number($('mv-cantidad').value),
          costo_unitario: $('mv-costo').value || null,
          motivo: $('mv-motivo').value,
        }),
      });
      toast('Movimiento registrado', 'ok');
      cerrarModal();
      cargarInventario();
    } catch (e) {
      toast(e.message, 'err');
    }
  });
}

async function movimientosRepuesto(r) {
  const movs = await json(`/taller/repuestos/${r.id}/movimientos`);
  modal(`<h3>Historial · ${esc(r.codigo)}</h3>
    <div class="g-tabla-wrap"><table class="g-tabla">
      <thead><tr><th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Costo</th><th>Motivo</th><th>OT</th></tr></thead>
      <tbody>${movs.map((m) => `<tr>
        <td class="g-log">${fecha(m.created_at)}</td><td>${pill(m.tipo)}</td>
        <td>${m.cantidad}</td><td>${m.costo_unitario != null ? money(m.costo_unitario) : '—'}</td>
        <td>${esc(m.motivo || '—')}</td><td class="g-log">${esc(m.orden_codigo || '—')}</td></tr>`).join('') ||
        '<tr><td colspan="6" class="g-vacio">Sin movimientos.</td></tr>'}</tbody>
    </table></div>
    <div class="g-modal-acciones"><button class="g-btn sec" onclick="cerrarModal()">Cerrar</button></div>`);
}

$('f-repuesto').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await json('/taller/repuestos', {
      method: 'POST',
      body: JSON.stringify({
        codigo: $('r-codigo').value,
        nombre: $('r-nombre').value,
        categoria: $('r-categoria').value,
        unidad: $('r-unidad').value || 'UND',
        stock_actual: $('r-stock').value || 0,
        stock_minimo: $('r-min').value || 0,
        costo_unitario: $('r-costo').value || 0,
        ubicacion: $('r-ubicacion').value,
      }),
    });
    toast('Repuesto creado', 'ok');
    e.target.reset();
    cargarInventario();
  } catch (err) {
    toast(err.message, 'err');
  }
});
$('r-refrescar').addEventListener('click', cargarInventario);

/* ================================================================
 * NOTIFICACIONES
 * ================================================================ */
async function cargarNotificaciones() {
  const [configs, logs] = await Promise.all([json('/notificaciones'), json('/notificaciones/log?limite=100')]);
  const tb = $('tb-noti');
  tb.innerHTML = configs.length
    ? configs
        .map(
          (c) => `<tr>
        <td>${pill(c.canal)}</td><td class="g-log">${esc(c.evento)}</td>
        <td>${esc(c.destinatarios || '(webhook)')}</td>
        <td>${c.activo ? pill('ACTIVO') : pill('INACTIVO')}</td>
        <td><div class="g-acciones">
          <button class="g-btn sec chico" data-probarn="${c.id}">Probar</button>
          <button class="g-btn sec chico" data-togglen="${c.id}" data-val="${c.activo}">${c.activo ? 'Desactivar' : 'Activar'}</button>
          <button class="g-btn peligro chico" data-deln="${c.id}">Eliminar</button>
        </div></td></tr>`
        )
        .join('')
    : '<tr><td colspan="5" class="g-vacio">Sin configuraciones.</td></tr>';
  tb.querySelectorAll('[data-probarn]').forEach((b) =>
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const r = await json(`/notificaciones/${b.dataset.probarn}/probar`, { method: 'POST' });
        const ok = r.resultados.filter((x) => x.ok).length;
        toast(`Prueba: ${ok}/${r.resultados.length} envíos OK`, ok ? 'ok' : 'err');
        const fallos = r.resultados.filter((x) => !x.ok).map((x) => `${x.destino}: ${x.error}`).join(' | ');
        if (fallos) toast(fallos, 'err');
      } catch (e) {
        toast(e.message, 'err');
      }
      b.disabled = false;
    })
  );
  tb.querySelectorAll('[data-togglen]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        await json('/notificaciones/' + b.dataset.togglen, {
          method: 'PUT',
          body: JSON.stringify({ activo: b.dataset.val !== 'true' }),
        });
        cargarNotificaciones();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );
  tb.querySelectorAll('[data-deln]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar configuración?')) return;
      try {
        await json('/notificaciones/' + b.dataset.deln, { method: 'DELETE' });
        cargarNotificaciones();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );

  $('tb-noti-log').innerHTML = logs.length
    ? logs
        .map(
          (l) => `<tr>
        <td class="g-log">${fecha(l.created_at)}</td><td>${esc(l.canal)}</td><td class="g-log">${esc(l.evento)}</td>
        <td>${esc(l.destino || '—')}</td><td>${pill(l.estado)}</td><td class="g-log">${esc(l.error || '')}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="6" class="g-vacio">Sin envíos registrados.</td></tr>';
}

$('f-noti').addEventListener('submit', async (e) => {
  e.preventDefault();
  let params = {};
  try {
    params = $('n-params').value.trim() ? JSON.parse($('n-params').value) : {};
  } catch {
    return toast('Los parámetros no son JSON válido', 'err');
  }
  try {
    await json('/notificaciones', {
      method: 'POST',
      body: JSON.stringify({
        canal: $('n-canal').value,
        evento: $('n-evento').value,
        destinatarios: $('n-destinatarios').value,
        params,
        activo: true,
      }),
    });
    toast('Configuración guardada', 'ok');
    cargarNotificaciones();
  } catch (err) {
    toast(err.message, 'err');
  }
});

/* ================================================================
 * INTEGRACIONES
 * ================================================================ */
async function cargarIntegraciones() {
  const [webhooks, tokens] = await Promise.all([json('/webhooks'), json('/webhooks/tokens')]);
  const tb = $('tb-webhooks');
  tb.innerHTML = webhooks.length
    ? webhooks
        .map(
          (w) => `<tr>
        <td>${esc(w.nombre)}</td>
        <td class="g-log" style="max-width:280px;overflow:hidden;text-overflow:ellipsis">${esc(w.url)}</td>
        <td class="g-log">${esc(w.eventos || '*')}</td>
        <td>${w.activo ? pill('ACTIVO') : pill('INACTIVO')}</td>
        <td>${w.fallidas}/${w.total}</td>
        <td><div class="g-acciones">
          <button class="g-btn sec chico" data-testw="${w.id}">Probar</button>
          <button class="g-btn sec chico" data-entregas="${w.id}">Entregas</button>
          <button class="g-btn peligro chico" data-delw="${w.id}">Eliminar</button>
        </div></td></tr>`
        )
        .join('')
    : '<tr><td colspan="6" class="g-vacio">Sin webhooks.</td></tr>';
  tb.querySelectorAll('[data-testw]').forEach((b) =>
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const r = await json(`/webhooks/${b.dataset.testw}/probar`, { method: 'POST' });
        toast(`Entrega: ${r.estado}${r.http_status ? ' HTTP ' + r.http_status : ''}`, r.estado === 'ENVIADO' ? 'ok' : 'err');
      } catch (e) {
        toast(e.message, 'err');
      }
      b.disabled = false;
    })
  );
  tb.querySelectorAll('[data-entregas]').forEach((b) =>
    b.addEventListener('click', async () => {
      const es = await json(`/webhooks/${b.dataset.entregas}/entregas`);
      modal(`<h3>Entregas recientes</h3>
        <div class="g-tabla-wrap"><table class="g-tabla">
          <thead><tr><th>Fecha</th><th>Evento</th><th>Estado</th><th>Intentos</th><th>HTTP</th><th>Error</th></tr></thead>
          <tbody>${es.map((e) => `<tr><td class="g-log">${fecha(e.created_at)}</td><td class="g-log">${esc(e.evento)}</td>
            <td>${pill(e.estado)}</td><td>${e.intentos}</td><td>${e.http_status ?? '—'}</td><td class="g-log">${esc(e.error || '')}</td></tr>`).join('') ||
            '<tr><td colspan="6" class="g-vacio">Sin entregas.</td></tr>'}</tbody>
        </table></div>
        <div class="g-modal-acciones"><button class="g-btn sec" onclick="cerrarModal()">Cerrar</button></div>`);
    })
  );
  tb.querySelectorAll('[data-delw]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar webhook?')) return;
      try {
        await json('/webhooks/' + b.dataset.delw, { method: 'DELETE' });
        cargarIntegraciones();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );

  $('tb-tokens').innerHTML = tokens.length
    ? tokens
        .map(
          (t) => `<tr>
        <td>${esc(t.nombre)}</td><td class="g-log">${esc(t.token_preview)}</td>
        <td class="g-log">${fecha(t.ultimo_uso)}</td>
        <td><button class="g-btn peligro chico" data-deltok="${t.id}">Revocar</button></td></tr>`
        )
        .join('')
    : '<tr><td colspan="4" class="g-vacio">Sin tokens.</td></tr>';
  $('tb-tokens').querySelectorAll('[data-deltok]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Revocar token?')) return;
      try {
        await json('/webhooks/tokens/' + b.dataset.deltok, { method: 'DELETE' });
        cargarIntegraciones();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );
}

$('f-webhook').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await json('/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        nombre: $('w-nombre').value,
        url: $('w-url').value,
        eventos: $('w-eventos').value,
        secreto: $('w-secreto').value || null,
      }),
    });
    toast('Webhook creado', 'ok');
    e.target.reset();
    cargarIntegraciones();
  } catch (err) {
    toast(err.message, 'err');
  }
});

$('f-token').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const t = await json('/webhooks/tokens', { method: 'POST', body: JSON.stringify({ nombre: $('t-nombre').value }) });
    modal(`<h3>Token generado</h3>
      <p class="g-sub">Cópialo ahora: no se volverá a mostrar.</p>
      <p class="g-codigo">${esc(t.token)}</p>
      <div class="g-modal-acciones">
        <button class="g-btn sec" onclick="cerrarModal()">Cerrar</button>
        <button class="g-btn" id="tok-copiar">Copiar</button>
      </div>`);
    $('tok-copiar').addEventListener('click', () => {
      navigator.clipboard.writeText(t.token);
      toast('Token copiado', 'ok');
    });
    e.target.reset();
    cargarIntegraciones();
  } catch (err) {
    toast(err.message, 'err');
  }
});

/* ================================================================
 * DISPOSITIVOS
 * ================================================================ */
async function cargarDispositivos() {
  await cargarVehiculosCache();
  const ds = await json('/dispositivos');
  const tb = $('tb-dispositivos');
  tb.innerHTML = ds.length
    ? ds
        .map(
          (d) => `<tr>
        <td>${esc(d.placa || '—')}</td><td class="g-log">${esc(d.tipo)}</td><td class="g-log">${esc(d.imei || '—')}</td>
        <td>${esc(d.modelo || '—')}</td><td class="g-log">${esc(d.protocolo || '—')}</td>
        <td class="g-log">${fecha(d.ultimo_ping)}</td>
        <td>${d.activo ? pill('ACTIVO') : pill('INACTIVO')}</td>
        <td><div class="g-acciones">
          <button class="g-btn sec chico" data-regen="${d.id}">API Key</button>
          <button class="g-btn peligro chico" data-deldisp="${d.id}">Eliminar</button>
        </div></td></tr>`
        )
        .join('')
    : '<tr><td colspan="8" class="g-vacio">Sin dispositivos.</td></tr>';
  tb.querySelectorAll('[data-regen]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Regenerar la API Key? El dispositivo anterior dejará de reportar.')) return;
      try {
        const r = await json(`/dispositivos/${b.dataset.regen}/regenerar-key`, { method: 'POST' });
        modal(`<h3>Nueva API Key</h3>
          <p class="g-sub">Configúrala en el dispositivo como <code class="g-codigo">x-api-key</code>.</p>
          <p class="g-codigo">${esc(r.api_key)}</p>
          <div class="g-modal-acciones">
            <button class="g-btn sec" onclick="cerrarModal()">Cerrar</button>
            <button class="g-btn" id="dk-copiar">Copiar</button>
          </div>`);
        $('dk-copiar').addEventListener('click', () => {
          navigator.clipboard.writeText(r.api_key);
          toast('API Key copiada', 'ok');
        });
        cargarDispositivos();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );
  tb.querySelectorAll('[data-deldisp]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar dispositivo?')) return;
      try {
        await json('/dispositivos/' + b.dataset.deldisp, { method: 'DELETE' });
        cargarDispositivos();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );
}

$('f-dispositivo').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await json('/dispositivos', {
      method: 'POST',
      body: JSON.stringify({
        vehiculo_id: $('d-vehiculo').value,
        tipo: $('d-tipo').value,
        imei: $('d-imei').value,
        modelo: $('d-modelo').value,
        fabricante: $('d-fabricante').value,
        protocolo: $('d-protocolo').value,
        sim_msisdn: $('d-sim').value,
      }),
    });
    toast('Dispositivo registrado', 'ok');
    modal(`<h3>API Key del dispositivo</h3>
      <p class="g-sub">Úsala en el dispositivo GPS como <code class="g-codigo">x-api-key</code>.</p>
      <p class="g-codigo">${esc(r.api_key)}</p>
      <div class="g-modal-acciones"><button class="g-btn sec" onclick="cerrarModal()">Cerrar</button></div>`);
    e.target.reset();
    cargarDispositivos();
  } catch (err) {
    toast(err.message, 'err');
  }
});

/* ================================================================
 * PRIVACIDAD
 * ================================================================ */
async function cargarPrivacidad() {
  const [solicitudes, consentimientos] = await Promise.all([
    json('/privacidad/solicitudes'),
    json('/privacidad/consentimientos'),
  ]);
  $('tb-solicitudes').innerHTML = solicitudes.length
    ? solicitudes
        .map(
          (s) => `<tr>
        <td class="g-log">${fecha(s.created_at)}</td><td>${pill(s.tipo)}</td>
        <td>${esc(s.identificador)}</td><td>${esc(s.descripcion || '—')}</td><td>${pill(s.estado)}</td>
        <td><select data-sol="${s.id}" class="g-mini">
          ${['PENDIENTE', 'EN_PROCESO', 'RESUELTA', 'RECHAZADA']
            .map((e) => `<option ${s.estado === e ? 'selected' : ''}>${e}</option>`)
            .join('')}
        </select></td></tr>`
        )
        .join('')
    : '<tr><td colspan="6" class="g-vacio">Sin solicitudes.</td></tr>';
  $('tb-solicitudes').querySelectorAll('[data-sol]').forEach((sel) =>
    sel.addEventListener('change', async () => {
      try {
        await json('/privacidad/solicitudes/' + sel.dataset.sol, {
          method: 'PUT',
          body: JSON.stringify({ estado: sel.value }),
        });
        toast('Solicitud actualizada', 'ok');
        cargarPrivacidad();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );

  $('tb-consentimientos').innerHTML = consentimientos.length
    ? consentimientos
        .map(
          (c) => `<tr><td class="g-log">${fecha(c.created_at)}</td><td>${esc(c.tipo)}</td>
        <td>${esc(c.version)}</td><td>${esc(c.identificador)}</td>
        <td>${c.aceptado ? pill('ACTIVO') : pill('RECHAZADA')}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="5" class="g-vacio">Sin consentimientos.</td></tr>';
}

/* ================================================================
 * AUDITORIA
 * ================================================================ */
async function cargarAuditoria() {
  const logs = await json('/usuarios/auditoria?limite=200');
  $('tb-auditoria').innerHTML = logs.length
    ? logs
        .map(
          (l) => `<tr><td class="g-log">${fecha(l.created_at)}</td><td>${esc(l.usuario || '—')}</td>
        <td class="g-log">${esc(l.ip || '—')}</td><td>${esc(l.recurso || '—')}</td><td>${pill(l.accion)}</td>
        <td class="g-log" style="max-width:360px;white-space:normal">${esc(l.detalles || '')}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="6" class="g-vacio">Sin registros.</td></tr>';
}
$('a-refrescar').addEventListener('click', cargarAuditoria);

/* ---------------- Navegación / arranque ---------------- */
CARGADORES.usuarios = cargarUsuarios;
CARGADORES.roles = cargarRoles;
CARGADORES.ordenes = cargarOrdenes;
CARGADORES.inventario = cargarInventario;
CARGADORES.notificaciones = cargarNotificaciones;
CARGADORES.integraciones = cargarIntegraciones;
CARGADORES.dispositivos = cargarDispositivos;
CARGADORES.privacidad = cargarPrivacidad;
CARGADORES.auditoria = cargarAuditoria;

$('g-salir').addEventListener('click', () => {
  localStorage.removeItem('ecodrive_token');
  (window.top || window).location.href = '/panel/';
});

(async function init() {
  if (!getToken()) return;
  try {
    REPUESTOS = await json('/taller/repuestos');
  } catch {
    REPUESTOS = [];
  }
  cargarUsuarios().catch((e) => toast(e.message, 'err'));
})();

window.cerrarModal = cerrarModal;
