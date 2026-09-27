# 🚗 EcoDrive — Plataforma de telemetría vehicular OBD-II

> **¿Por qué existe?** Un motor que se sobrecalienta sin que nadie lo note termina en una reparación
> costosa o en un vehículo varado. EcoDrive nació para **vigilar la salud de una flota en tiempo real**:
> captura la temperatura del motor (ECT) y las RPM de cada vehículo con un adaptador OBD-II barato
> (ELM327) y genera **alertas automáticas de mantenimiento predictivo** cuando algo sale de rango.
> Proyecto formativo **SENA ADSO — ficha 3535013**.

🌐 **Demo en vivo:** https://ecodrive-backend-r34q.onrender.com
📖 **Manual de uso completo:** [MANUAL-DE-USO.md](./MANUAL-DE-USO.md)

---

## ✨ Qué hace

- 📊 **Panel admin** (`/`) — dashboard de la flota: última ECT/RPM por vehículo, historial de
  lecturas y alertas, registro y gestión de vehículos con API Keys.
- 📱 **App del dispositivo** (`/dispositivo/`) — PWA para el conductor: conecta el ELM327 por
  Bluetooth (Web Bluetooth) o usa la **ECU virtual** (simulador integrado) y envía lecturas cada
  5 segundos. Funciona con cola offline de hasta 100 lecturas.
- 🔔 **Alertas en tiempo real** — ECT > 105 °C dispara alerta por WebSocket al panel, sin recargar.
- 🔑 **Doble autenticación** — JWT para el admin, API Key (`X-API-Key`) por vehículo para los
  dispositivos.
- 🤖 **App Android** (`/android/`, Kotlin) — cliente Bluetooth nativo (en reparación, ver
  limitaciones).

## 🛠️ Tecnologías

| Capa | Stack |
|---|---|
| Backend | Node.js 20, Express 4, Socket.io 4 |
| Base de datos | PostgreSQL 16 (`pg`) |
| Frontend | HTML/CSS/JS puro, Web Bluetooth, PWA |
| Móvil | Kotlin (Android) |
| Despliegue | Render (web) + Neon (Postgres) |

## 📁 Estructura

```
Ecodrive/
├── backend/            # API REST + WebSocket + sirve los frontends
│   ├── src/server.js   # punto de entrada (node src/server.js)
│   ├── src/routes/     # auth, vehiculos, telemetry, historial, registration
│   ├── scripts/        # db-init, simulator y utilidades
│   └── sql/schema.sql  # esquema + datos semilla
├── frontend/           # panel admin (servido en /)
├── dispositivo/        # app del conductor (servida en /dispositivo/)
├── android/            # app Android (Kotlin)
├── docs/               # documentación del proyecto
├── render.yaml         # blueprint de despliegue en Render
└── MANUAL-DE-USO.md    # guía completa de operación
```

## 🚀 Cómo correrlo en local

Requisitos: **Node.js 20+** y **PostgreSQL 16+**.

```bash
# 1) Clonar e instalar
git clone https://github.com/Santiago-Gohan/Ecodrive.git
cd Ecodrive/backend
npm install

# 2) Configurar variables (copia el ejemplo y edítalo)
cp .env.example .env

# 3) Crear las tablas
psql -U postgres -d ecodrive -f sql/schema.sql
# (o: npm run db:init — ⚠️ BORRA las tablas, solo en BD vacía)

# 4) Arrancar
npm start
```

Abre http://localhost:3000 (panel) y http://localhost:3000/dispositivo/ (app conductor).

### Variables de entorno (`backend/.env`)

| Variable | Ejemplo | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor |
| `DATABASE_URL` | `postgres://user:pass@localhost:5432/ecodrive` | Conexión PostgreSQL |
| `PGSSL` | `require` | Solo en la nube (Neon/Render exigen SSL) |
| `JWT_SECRET` | *(secreto largo)* | Firma de tokens admin |
| `ADMIN_USER` / `ADMIN_PASS` | `admin` / *(clave fuerte)* | Acceso al panel |
| `THRESHOLD_ECT` | `105` | Umbral de sobrecalentamiento (°C) |
| `SEVERIDAD_ALERTA` | `ALTA` | Severidad por defecto |

## ☁️ Despliegue

Blueprint listo en [`render.yaml`](./render.yaml): Render → **New + → Blueprint** → conectar
este repo → pegar la `DATABASE_URL` de Neon → Deploy. La URL queda fija
(`https://<servicio>.onrender.com`), sin túneles temporales.

## 🔌 API (base `/api/v1`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | — | Estado del servidor |
| POST | `/auth/login` | — | Login admin → JWT (8 h) |
| GET/POST | `/vehiculos` | admin | Listar / crear vehículo |
| PUT/DELETE | `/vehiculos/:id` | admin | Actualizar / eliminar |
| GET | `/vehiculos/:id/apikey` | admin | Ver API Key |
| GET | `/historial/telemetria`, `/historial/alertas` | admin | Historiales |
| POST | `/telemetry` | API Key | Enviar lectura (ECT + RPM) |
| GET | `/telemetry/resumen` | — | Estado actual de la flota |
| GET/POST | `/registration` | — | Compatibilidad OBD y auto-registro |

Referencia completa con flujos de uso en el [manual](./MANUAL-DE-USO.md).

## ⚠️ Limitaciones conocidas

- La app Android envía `vehiculo_id = "-1"` fijo y el backend la rechaza (403) — pendiente de arreglo.
- La cola offline del dispositivo aún no reenvía lecturas al recuperar conexión.
- No usar las credenciales de demostración en producción: define `ADMIN_USER`/`ADMIN_PASS` fuertes.

## 👤 Autor

**Santiago Barrera** — Análisis y Desarrollo de Software (ADSO), SENA — ficha 3535013.
