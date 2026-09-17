# EcoDrive - Arquitectura del Sistema

Sistema de Gestión Inteligente y Mantenimiento Predictivo para Flotas de Vehículos
SENA - ADSO - Ficha 3535013 - Santiago Barrera Barbosa

---

## 1 · Vista general

```
 VEHÍCULO (puerto OBD-II / CAN bus ISO 15765-4)
   ECU motor (sensor ECT, RPM, DTC)
        │
        ▼
 ADAPTADOR ELM327 Bluetooth BLE (hardware ~US$15)
        │  Bluetooth SPP / BLE
        ▼
 APP DE TOMA DE TELEMETRÍA
   - Web Bluetooth (Chrome escritorio/Android)  -> /dispositivo
   - Android nativa (Kotlin)                   -> /android
   Lee PIDs cada 5 s (RN-03) y envía HTTPS POST
        │  X-API-Key del vehículo (RNF-02)
        ▼
 BACKEND (Node.js + Express + Socket.io) :3000
   POST /api/v1/telemetry
   Evalúa RN-01: ECT > 105°C -> alerta severidad ALTA
        ├─────────────► PostgreSQL (telemetria_lectura, alerta_mantenimiento, vehiculos)
        └─────────────► WebSocket evento "alerta:nueva"
                            │
                            ▼
                   PANEL ADMIN (navegador)
                   Dashboard · Flota · Historial
                   Banner rojo < 2 s (RNF-01)
```

## 2 · Cómo se toman los datos reales

1. El sensor **ECT** del motor mide la temperatura del refrigerante y el sensor de **RPM** la velocidad del cigüeñal.
2. La **ECU** del vehículo los expone por el puerto OBD-II usando PIDs estandarizados SAE J1979:
   - `0105` → temperatura del refrigerante: `valor = HEX - 40` (°C)
   - `010C` → RPM: `valor = HEX / 4`
   - `03` → códigos DTC almacenados
3. El **adaptador ELM327** conectado al puerto traduce el CAN bus a Bluetooth.
4. La app del conductor se conecta al adaptador y consulta esos PIDs.
5. La app envía `{ vehiculo_id, ect, rpm, timestamp }` al backend cada 5 s.
6. El backend evalúa la regla, persiste y notifica al panel en tiempo real.

## 3 · Componentes

| Componente | Tecnología | Ubicación |
|---|---|---|
| Backend API | Node.js + Express + Socket.io | `backend/` |
| Base de datos | PostgreSQL 16 | `backend/sql/schema.sql` |
| Panel administrador | HTML/CSS/JS (WebSocket) | `frontend/` |
| Toma de telemetría (web) | Web Bluetooth + PWA | `dispositivo/` |
| Toma de telemetría (Android) | Kotlin + Bluetooth SPP | `android/` |
| Simulador OBD-II (pruebas) | Node.js | `backend/scripts/simulator.js` |

## 4 · Reglas de negocio implementadas

- **RN-01**: ECT > 105°C → alerta `SOBRECALENTAMIENTO`, severidad ALTA, estado ACTIVA. No se duplican alertas mientras exista una ACTIVA/PENDIENTE para ese vehículo.
- **RN-02**: cada dispositivo se autentica con la API Key exclusiva de su vehículo (X-API-Key). El backend verifica que el dispositivo pertenezca al `vehiculo_id` enviado (403 si no).
- **RN-03**: la app envía máximo 1 lectura cada 5 segundos.
- **RNF-01**: la alerta llega al panel en < 2 s (WebSocket).
- **RNF-02**: autenticación con Token JWT (panel) y API Key (dispositivo).

## 5 · Endpoints API

| Método | Ruta | Acción |
|---|---|---|
| POST | `/api/v1/telemetry` | Ingesta telemétrica (API Key). |
| GET | `/api/v1/telemetry/resumen` | Estado actual de la flota. |
| POST | `/api/v1/telemetry/demo` | Simular lectura (pruebas en el panel). |
| POST | `/api/v1/auth/login` | Login admin → JWT. |
| GET/POST/PUT/DELETE | `/api/v1/vehiculos` | CRUD de flota (JWT admin). |
| GET | `/api/v1/vehiculos/:id/apikey` | Ver API Key (JWT admin). |
| POST | `/api/v1/vehiculos/:id/apikey/regenerar` | Regenerar API Key (JWT admin). |
| GET | `/api/v1/historial/telemetria` | Historial de lecturas (JWT admin). |
| GET | `/api/v1/historial/alertas` | Historial de alertas (JWT admin). |
| POST | `/api/v1/historial/alertas/:id/atender` | Marcar alerta ATENDIDA (JWT admin). |

## 6 · Base de datos

- `vehiculos`: id (UUID), placa (única), api_key (única), nombre, activo, fecha_creacion.
- `telemetria_lectura`: id (UUID), vehiculo_id (FK), ect_temperatura (DECIMAL), rpm (INT), fecha_registro.
- `alerta_mantenimiento`: id (UUID), vehiculo_id (FK), tipo_alerta, severidad, estado (PENDIENTE/ACTIVA/ATENDIDA), fecha_generacion.

## 7 · Puesta en marcha

```bat
:: Todo con doble clic
iniciar.bat          :: enciende servidor + abre panel admin
```

```bat
:: Manual
cd backend
npm install
npm run db:init      :: crea BD y tablas
npm start            :: servidor en :3000
```

- Panel admin: `http://localhost:3000` (admin / admin123)
- Toma de telemetría: `http://localhost:3000/dispositivo/`

## 8 · Prácticas reales con el vehículo - Lista de lo que se necesita

### Hardware (consíguelo antes de la práctica)
1. [ ] **Adaptador OBD-II ELM327 Bluetooth BLE** (v1.5+). Ejemplos: Veepeak OBDCheck BLE, OBDLink, o cualquier ELM327 BLE genérico (~US$15-25). Evitar los ELM327 clásicos que solo son Bluetooth Classic si se usará el celular con Web Bluetooth (se requieren BLE).
2. [ ] **Vehículo con puerto OBD-II** (1996+). Todos los carros en Colombia desde ~2000 lo tienen (cerca del volante o consola).
3. [ ] **Celular con Chrome** (Android) o **PC con Chrome** y Bluetooth activo (para Web Bluetooth / la app web).
4. [ ] **(Opcional) Android Studio** instalado en el PC para compilar la app nativa `android/`.

### Conexión de red para el celular (app de toma de telemetría)
5. [ ] El **PC con el backend** y el **celular** deben estar en la misma red WiFi.
6. [ ] Averigua la IP del PC: `ipconfig` → línea IPv4. El backend responde desde el celular en `http://<IP_del_PC>:3000`.
   - ⚠️ Web Bluetooth solo funciona en contexto seguro: en **escritorio localhost** no hay problema; en el **celular** activa en Chrome: `chrome://flags/#unsafely-treat-insecure-origin-as-secure` y agrega `http://<IP_del_PC>:3000`.
   - La app nativa Android trae `usesCleartextTraffic` habilitado, no necesita eso.

### Pasos de la práctica
1. Enciende el carro (posición "ON", no arrancado necesariamente).
2. Conecta el adaptador ELM327 al puerto OBD-II.
3. Empareja el adaptador con el celular (Ajustes > Bluetooth).
4. Panel admin → Flota → "Ver API Key" de tu vehículo.
5. Abre `http://<IP_del_PC>:3000/dispositivo/` en el celular, selecciona el vehículo y pega la API Key.
6. "Conectar ELM327", elige el adaptador Bluetooth.
7. "Iniciar envío cada 5 s". Mueve el carro / acelera y observa el panel admin reaccionar en tiempo real.
8. Para probar la alerta real: en clima de subida o con el carro caliente, observa ECT subir; el umbral es 105°C.