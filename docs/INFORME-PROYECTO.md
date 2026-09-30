# 📋 Informe del Proyecto EcoDrive

> **EcoDrive — Plataforma de telemetría vehicular OBD-II y mantenimiento predictivo de flotas**
> Proyecto formativo **SENA ADSO — ficha 3535013** · Autor: **Santiago Barrera**
> Documento generado el 29 de septiembre de 2026.

---

## 1. Resumen ejecutivo

EcoDrive es una plataforma web + móvil que vigila la **salud de una flota de vehículos en tiempo real**.
Utiliza un adaptador Bluetooth **OBD-II (ELM327)** para leer la temperatura del motor (ECT) y las RPM,
junto con nivel de combustible y GPS; envía las lecturas a un backend en la nube que las almacena y
genera **alertas automáticas de mantenimiento predictivo** cuando algo sale de rango.

El sistema está pensado para entregarse como **producto comercial tipo Samsara/Motive**: panel de
administración moderno, landing de ventas, aplicación para el conductor, app Android y una arquitectura
de ingesta segura por API Keys por vehículo.

| Dato | Valor |
|---|---|
| Demo en vivo | https://ecodrive-backend-r34q.onrender.com |
| Repositorio | https://github.com/Santiago-Gohan/Ecodrive |
| Backend | Node.js 20 · Express 4 · Socket.io 4 |
| Base de datos | PostgreSQL 16 (local y Neon en nube) |
| Frontend | HTML / CSS / JS puro (PWA en dispositivo) |
| App móvil | Android (Kotlin) |
| Despliegue | Render (web) + Neon (Postgres) + GitHub `main` |

**Estado actual: operativo.** Todas las funcionalidades del panel, la ingesta de telemetría y el módulo
de mantenimiento completo están probadas (suite automatizada 16/16 PASS y pruebas de navegador
headless de principio a fin).

---

## 2. Arquitectura

```
┌────────────────────┐   ┌────────────────────┐   ┌───────────────────────┐
│  Landing /         │   │  Panel admin /panel │   │  App conductor        │
│  (página de venta) │   │  (dashboard)        │   │  /dispositivo (PWA)   │
└─────────┬──────────┘   └─────────┬──────────┘   └───────────┬───────────┘
          │                       │                          │
          └───────────────►  Node.js / Express  ◄────────────┘
                           ── sirve los 4 frontends ──
                              ┌──────────┐ ┌──────────┐
                              │ Auth     │ │ Telemetry│  ← API Keys por vehículo
                              │ JWT admin│ │ device   │
                              └────┬─────┘ └────┬─────┘
                                   └─────┬───────┘
                                   PostgreSQL (Neon)
                                   vehiculos · telemetria_lectura
                                   alerta_mantenimiento · mantenimientos
```

### Componentes

| Componente | Ruta servida | Qué es |
|---|---|---|
| **API REST + WebSocket** | `/api/v1/*` | Backend Express; autenticación, ingesta, historial, mantenimiento |
| **Landing comercial** | `/` | Sitio de venta estilo Samsara: precios, cómo funciona, FAQ |
| **Panel admin** | `/panel` | Dashboard con KPIs, mapa GPS, flota, salud, mantenimiento, alertas |
| **App del conductor** | `/dispositivo` | PWA: ELM327 por Web Bluetooth o ECU virtual; cola offline |
| **APK Android** | `/apk` | Binario instalable (estado: en reparación, ver limitaciones) |

---

## 3. Funcionalidades implementadas

### 3.1 App del conductor (`/dispositivo`)

- Conexión al **adaptador OBD-II ELM327 por Web Bluetooth** (Chrome/Edge).
- **ECU virtual** integrada (simulador) para demostraciones sin hardware.
- Envío de lecturas cada 5 s: **ECT, RPM, nivel de combustible, latitud y longitud**.
- **Cola offline**: si no hay conexión, las lecturas se guardan y se reenvían al volver la señal
  (diseñado para zonas rurales con señal intermitente de 3–6 h).
- Soporte de **envío por lotes** (`/telemetry/lote`) para optimizar la subida.
- Medidores tipo gauge en tiempo real y estado de conexión.

### 3.2 API Backend (`base /api/v1`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | — | Estado del servidor |
| POST | `/auth/login` | — | Login admin → JWT (8 h) |
| GET | `/vehiculos` | admin | Listar flota (con próximos mantenimientos calculados) |
| POST | `/vehiculos` | admin | Crear vehículo (genera API Key `ECDV-…`) |
| PUT | `/vehiculos/:id` | admin | Actualizar (SET dinámico; soporta programación de mantenimiento) |
| DELETE | `/vehiculos/:id` | admin | Eliminar (con limpieza en cascada) |
| GET | `/vehiculos/:id/apikey` | admin | Ver API Key del vehículo |
| POST | `/vehiculos/:id/apikey/regenerar` | admin | Regenerar API Key |
| GET | `/vehiculos/:id/mantenimientos` | admin | Historial de servicios del vehículo |
| POST | `/vehiculos/:id/mantenimientos` | admin | Registrar servicio (actualiza últ/próx automáticamente) |
| DELETE | `/vehiculos/:id/mantenimientos/:mnt` | admin | Eliminar servicio (recalcula fechas) |
| GET | `/telemetry/resumen` | — | Última lectura por vehículo + salud |
| POST | `/telemetry` | API Key | Enviar lectura individual |
| POST | `/telemetry/lote` | API Key | Enviar lote de lecturas |
| POST | `/telemetry/demo` | admin | Demo en vivo (genera telemetría simulada) |
| GET | `/telemetry/quien-soy` | API Key | Identificación del dispositivo |
| GET | `/historial/telemetria` | admin | Historial de lecturas |
| GET | `/historial/alertas` | admin | Historial de alertas |
| POST | `/historial/alertas/:id/atender` | admin | Marcar alerta como atendida |
| GET/POST | `/registration` | — | Registro y compatibilidad del dispositivo |

**Validaciones de la ingesta** (robustez calle): rangos plausibles — ECT entre −40 y 150 °C,
RPM entre 0 y 9000, combustible 0–100 %, latitud ±90, longitud ±180. Lecturas inválidas
se rechazan con 400 sin contaminar la base.

### 3.3 Panel de administración (`/panel`)

- **Dashboard en vivo**: KPIs de flota (vehículos, en línea, alertas, temperatura máxima),
  gráfica ECT en tiempo real, salud por vehículo y **mapa Leaflet con marcadores** coloreados por
  temperatura.
- **Gestión de flota**: crear/editar/eliminar vehículos, ver y **regenerar API Keys** (modal con
  botón Copiar), activar/desactivar.
- **Salud de flota** 🟢🟡🔴: cada vehículo se clasifica en **Óptimo / Riesgo / Crítico** según
  alertas activas, temperatura ECT, nivel de combustible y proximidad al mantenimiento → se pinta
  como columna en dashboard y tabla de flota.
- **Alerta de mantenimiento**: el precio y el próximo mantenimiento se derivan de
  `ultimo_mantenimiento + intervalo` o de una fecha fijada manualmente.
- **Demo en vivo**: un botón genera telemetría simulada cada 5 s por vehículo (ECT, RPM,
  combustible, GPS con deriva y alertas ocasionales ~8 %) para presentaciones comerciales.
- **Exportar CSV** (alertas y telemetría) con separador `;` y BOM UTF-8 para Excel.
- **Informe de flota imprimible/PDF** (KPIs, salud y tabla) desde el botón Informe.
- **Historial de alertas** con acción "Atender".

### 3.4 Módulo de mantenimiento completo (última iteración)

El modal **Mant.** por vehículo incluye:

1. **Ficha del vehículo** — placa destacada, nombre, tipo, estado Activo/Inactivo y badge de salud.
2. **4 tarjetas KPI** — Próximo servicio (con **barra de progreso** verde/ámbar/roja según urgencia),
   Último servicio (hace N días), Costo invertido total, Intervenciones (con odómetro del último).
3. **Programación** — próxima fecha, intervalo en días y plan de mantenimiento (se guardan con
   `PUT /vehiculos/:id`).
4. **Registrar servicio** — fecha, odómetro, descripción y costo; al guardar **actualiza los KPIs
   y las fechas automáticamente** (`ultimo` = servicio más reciente, `próximo` = fecha o
   `último + intervalo`).
5. **Historial en línea de tiempo** — punto verde, fecha, badge de costo, descripción, odómetro,
   botón Eliminar y **total invertido** en el encabezado.
6. **Sin scroll lateral**: el historial se expande y toda la ventana del modal baja con **un solo
   scroll vertical**; secciones en tarjetas y KPIs adaptativos (4→2→1 columnas).

### 3.5 Herramienta de ventas (landing)

Conversión del proyecto de "demo técnica" a **producto comercial**: marca cian/verde con gradiente,
secciones de precios (`$29.900` / `$59.900` / `$99.900` por vehículo/mes), "Cómo funciona", FAQ y
CTA. Se está personalizando precio/contacto en `pagina-web/`.

---

## 4. Base de datos

### 4.1 Tablas principales (`backend/sql/schema.sql` + migraciones)

| Tabla | Propósito |
|---|---|
| `vehiculos` | `id` (UUID PK), `placa`, `nombre`, `api_key`, `tipo_vehiculo`, `combustible`, `anio`, `activo`, `fecha_creacion`, `ultimo_mantenimiento`, `intervalo_mantenimiento`, `plan_mantenimiento`, **`proximo_mantenimiento`** |
| `telemetria_lectura` | Lecturas: `vehiculo_id` (FK), `ect_temperatura`, `rpm`, `nivel_combustible`, `lat`, `lng`, `fecha_registro` |
| `alerta_mantenimiento` | Alertas: tipo (SOBRECALENTAMIENTO…), severidad, estado (PENDIENTE/ACTIVA/ATENDIDA) |
| `mantenimientos` | Historial de servicios por vehículo: `fecha`, `descripcion`, `costo NUMERIC(12,2)`, `odometro`, `created_at` |

- Relaciones con **ON DELETE CASCADE** (eliminar vehículo limpia telemetría/alertas/mantenimientos).
- **`proximo_mantenimiento`** se calcula en consulta con `COALESCE(proximo_mantenimiento,
  ultimo_mantenimiento + intervalo)` y al registrar un servicio se sincroniza explícitamente.
- Migración aplicada en local y producción (Neon): `backend/sql/migrations/2026-09-28-mantenimiento-completo.sql`.
- Datos demo de mantenimiento sembrados en ambas bases para demostración.

### 4.2 Seguridad

- **Doble autenticación**: JWT para admin (8 h) y **API Key por vehículo** (`X-API-Key`) para
  dispositivos.
- **API Key profesional** con formato `ECDV-XXXX-XXXX-XXXX` (alfabeto sin 0/1/I/O, generada con
  `crypto.randomBytes`), regenerable desde el panel.
- Credenciales por variables de entorno (`ADMIN_USER`, `ADMIN_PASS`, `JWT_SECRET`) — nunca en el repo.
- Errores del servidor no exponen detalles internos al cliente (mensajes genéricos + log).

---

## 5. Despliegue y operación

- **Render** (blueprint `render.yaml`): sirve API + los 4 frontends; redepliega automáticamente al
  pushear `main`.
- **Neon**: PostgreSQL en la nube con SSL obligatorio (`PGSSL=require`).
- Estáticos servidos por Express: `/` → `pagina-web`, `/panel` → `frontend`, `/dispositivo` →
  `dispositivo`, `/apk` → binario Android.
- Variables: `PORT`, `DATABASE_URL`, `PGSSL`, `JWT_SECRET`, `ADMIN_USER`, `ADMIN_PASS`,
  `THRESHOLD_ECT` (105 °C), `SEVERIDAD_ALERTA`.

### Contexto local

```bash
cd backend && npm install
psql -U postgres -d ecodrive -f sql/schema.sql   # crear esquema
npm start                                        # → http://localhost:3000
# Panel: /panel · App conductor: /dispositivo · Landing: /
# Admin local de demo: admin / admin123
```

---

## 6. Pruebas y calidad

- **Suite automatizada** (`test_ecodrive.ps1`): 16 pruebas sobre la API real
  (health, login admin, creación de vehículo y API Key, telemetría normal, alerta ECT>105,
  atender alerta, rechazo de llave inválida 401, rangos fuera de límite 400, eliminación,
  y disponibilidad de `/`, `/panel` y `/dispositivo/`). **Estado: 16/16 PASS**.
- **Pruebas de navegador headless (Chrome + CDP)**: login, navegación del panel, modal de API Key,
  demo en vivo, y el **flujo completo de mantenimiento** (abrir modal → KPIs correctos → registrar
  servicio → toast de éxito → historial actualizado → sumatoria de costos → eliminar → totales
  recalculados). Verificado también que no existe desplazamiento horizontal con 27 servicios.
- Depuración realizada sobre el propio navegador: se detectó y corrigió el bug `dataset.id` vs
  `data-mant` que impedía registrar mantenimientos (el id llegaba `undefined`).

---

## 7. Historial de desarrollo (24 commits)

Línea de evolución del proyecto (los más recientes arriba):

1. **Fundación** — API de telemetría, alertas, backend con Express+PG, esquema SQL, blueprint Render.
2. **Robustez de calle** — validación de rangos ECT/RPM, reintentos de PID, detección de desconexión
   Bluetooth, sin envío de basura.
3. **Zonas rurales** — cola offline + envío por lotes.
4. **App Android (Kotlin)** — reescrita con vehículo real, ELM327 + buffer SQLite.
5. **Panel rediseñado** — marca, KPIs en vivo, tema responsive; navegación cruzada; APK pública.
6. **Tablero premium** — gráfica ECT en vivo, gauges, pills, toasts, mapa Leaflet GPS, combustible.
7. **Landing comercial** — precios, cómo funciona, FAQ; panel movido a `/panel`.
8. **API Key ECDV** + duplicado de modal corregido (bug de navegación).
9. **Presentación ganadora** — demo en vivo, salud de flota, export CSVs, informe imprimible.
10. **Mantenimiento completo** — historial, próximos mantenimientos, rediseño profesional del modal
    y sin scroll lateral.

---

## 8. Deuda técnica y pendientes conocidos

- **App Android**: envía `vehiculo_id = "-1"` fijo y el backend la rechaza (403) — pendiente.
- Cola offline del dispositivo: reenvío implementado; validar en pruebas de campo extensas.
- Landing: precios y contacto aún en configuración (usuario define valores finales).
- Credenciales demo no aptas para producción real sin antes robustecer (se recomienda cambiar
  `ADMIN_USER`/`ADMIN_PASS`).
- Integración con hardware físico ELM327 dependerá de pruebas en campo con el vehículo real.

---

## 9. Próximos pasos sugeridos

1. **Notificaciones preventivas** por WhatsApp/email cuando un mantenimiento esté por vencer
   (integración con el cálculo de `proximo_mantenimiento`).
2. **Gráficas de tendencia** de costos de mantenimiento por vehículo y por mes.
3. **Soporte de múltiples planes de servicio** por vehículo (A/B/C con intervalos distintos).
4. **App Android funcional** (corregir `vehiculo_id` y validar en el dispositivo real).
5. Publicación en **Play Store** cuando el hardware esté probado.

---

## 10. Estructura de archivos relevante

```
Ecodrive/
├── backend/
│   ├── src/
│   │   ├── server.js              # Express: API + WebSocket + estáticos
│   │   ├── routes/                # auth, vehiculos, telemetry, historial, registration
│   │   └── utils/apiKey.js        # generador ECDV-XXXX-XXXX-XXXX
│   ├── sql/schema.sql             # esquema + semilla
│   ├── sql/migrations/            # migraciones aplicadas (mantenimiento completo)
│   └── scripts/                   # db-init, simulator
├── frontend/                      # panel admin (/panel)
│   ├── index.html                 # modales: mantenimiento, API Key, informe impresión
│   ├── app.js                     # lógica del panel (1.100+ líneas)
│   └── style.css
├── pagina-web/                    # landing comercial (/)
├── dispositivo/                   # app del conductor (/dispositivo)
├── android/                       # app Android (Kotlin)
├── docs/                          # documentación
├── MANUAL-DE-USO.md               # guía de operación
└── render.yaml                    # blueprint de despliegue
```

---

*Informe generado a partir del estado real del repositorio (24 commits, HEAD `4a11912`) y de las
pruebas automatizadas vigentes.*