# EcoDrive — Manual de Uso

**Plataforma de telemetría vehicular** (proyecto SENA ADSO, ficha 3535013)
Documento generado el 26 de septiembre de 2026.

---

## 1. ¿Qué es?

EcoDrive es un sistema que **recoge la temperatura del motor (ECT) y las RPM** de vehículos
mediante un adaptador OBD-II (ELM327) y las envía a un panel web donde se pueden ver **en vivo**,
con alerta automática cuando el motor se sobrecalienta (ECT > 105 °C).

### Las 3 apps del proyecto

| App | Ruta / tipo | ¿Para quién? |
|---|---|---|
| **Panel admin** | `/` — web (HTML/JS puro) | Tú: ver toda la flota y gestionar vehículos |
| **App dispositivo** | `/dispositivo/` — web (PWA + Web Bluetooth) | El conductor: conectar el OBD y enviar datos |
| **App Android** | APK (Kotlin) | Conectar por Bluetooth (⚠️ ver limitaciones, §7) |

---

## 2. Estado actual del sistema

| Componente | Estado |
|---|---|
| PostgreSQL 16 | ✅ Corriendo (puerto 5432) |
| Backend Node (Express + Socket.io) | ✅ Corriendo (puerto 3000) |
| Túnel Cloudflare (acceso desde internet) | ✅ Activo |
| Tarea de auto-recuperación | ✅ `EcoDriveMantener` (cada 1 min, oculta) |
| Vehículos registrados | 6 |
| Lecturas / alertas almacenadas | 11 / 2 |

### 🌐 URL de acceso

```
https://premiere-attacks-dept-genres.trycloudflare.com
```

> ⚠️ **Importante:** esta URL es del túnel **gratuito** de Cloudflare. **Cambia cada vez que se
> reinicia el túnel** y puede caerse en cualquier momento. Para una URL fija hay que desplegar en
> Render o Railway (pendiente).

| Qué abres | Dónde |
|---|---|
| Panel admin (tú) | `https://…trycloudflare.com/` |
| App del dispositivo (conductor) | `https://…trycloudflare.com/dispositivo/` |

---

## 3. Cómo arrancar el sistema (manual)

Por si algún día hay que levantarlo a mano:

```powershell
# 1) Verificar que PostgreSQL esté corriendo
Get-Service postgresql-x64-16

# 2) Arrancar el backend
cd C:\Users\SANTIAGO\Documents\EcoDrive\backend
node src\server.js

# 3) (Opcional) Exponerlo a internet con un túnel
cloudflared tunnel --url http://localhost:3000
```

**O simplemente doble clic en:** `C:\Users\SANTIAGO\Documents\EcoDrive\iniciar.bat`
(levanta el backend y abre el panel en el navegador).

### Auto-recuperación

La tarea programada **`EcoDriveMantener`** revisa cada minuto y, si falta el backend o el túnel,
los relanza **en segundo plano y sin abrir ventanas**. No necesitas hacer nada manualmente.
Para desactivarla: `schtasks /Delete /TN EcoDriveMantener /F`

### Comprobar que todo funciona

```powershell
# Backend local
curl http://localhost:3000/api/v1/health     # debe responder {"status":"ok"}

# A través del túnel
curl https://<URL>/api/v1/health
```

---

## 4. Acceso al panel admin (como administrador)

1. Abre `https://<URL>/`
2. Inicia sesión con las credenciales:
   - **Usuario:** `admin`
   - **Contraseña:** `admin123`

### Qué puedes hacer en el panel

| Vista | Para qué sirve |
|---|---|
| **Dashboard** | Estado de toda la flota: última ECT, RPM y alertas activas |
| **Flota** | Ver, registrar, editar y eliminar vehículos; consultar sus API Keys |
| **Historial** | Lecturas de telemetría y alertas generadas; marcar alertas como atendidas |

Las alertas llegan **en tiempo real** por WebSocket: aparece un banner en pantalla sin recargar
(la página ya está suscrita al socket al abrirse).

---

## 5. Conectar un vehículo (flujo completo)

### Opción A — Lo registras tú desde el panel (recomendado)

1. Panel admin → **Flota** → *Registrar vehículo*
2. Escribe la **placa** y el **nombre** (ej. `GHI-111` / "Camioneta del amigo")
3. En la fila del vehículo pulsa **Ver API Key** → se abre el diálogo y se copia al portapapeles
4. Pásale esa **API Key** al conductor

### Opción B — El conductor se registra solo (sin cuenta)

Desde la app del dispositivo, sección **"¿No encuentras tu vehículo? Regístralo aquí"**:

| Campo | Valor |
|---|---|
| Placa | Ej. `ABC-123` |
| Combustible | `GASOLINA`, `DIESEL` o `MOTO` |
| Año | 1950 – 2030 |
| Tipo | `CARRO`, `CAMIONETA`, `BUS`, `CAMION`, `MOTO` |

El sistema **valida la compatibilidad OBD** y, si es compatible, **crea el vehículo y devuelve la
API Key automáticamente** (la app la guarda sola en el navegador).

Reglas de compatibilidad:
- `MOTO` → **rechazado** (no hay puerto OBD)
- Diésel ≥ 2010 → compatible (en bus/camión sugiere kit J1939)
- Gasolina ≥ 2013 → compatible
- Gasolina 2004 – 2012 → compatible "validado por modelo"
- Cualquier otro → rechazado

---

## 6. Enviar telemetría (app del dispositivo)

1. Abre `https://<URL>/dispositivo/`
2. **Pega la API Key** (la que te dio el admin o el registro automático) y pulsa **Guardar**
3. Elige cómo conectar:
   - 🔌 **Conectar ELM327** → usa el adaptador real por Bluetooth (requiere **Web Bluetooth**:
     Chrome/Edge en PC, o Android compatible; **no funciona en iPhone/Safari**)
   - 🧪 **Activar ECU virtual** → **simulador integrado** que no necesita hardware (ideal para
     demostrar el sistema). Emula 6 perfiles de vehículo y, cada 10 lecturas, provoca un pico de
     temperatura **a propósito** para disparar la alerta de sobrecalentamiento.
4. Pulsa **Probar compatibilidad** → valida que el vehículo reporta ECT y RPM
5. Pulsa **Iniciar envío** → envía una lectura **cada 5 segundos**

> La app guarda hasta **100 lecturas** en el navegador si no hay conexión y **las reenvía
> solas** (con su hora original) en cuanto vuelve la señal. Ideal para zonas rurales.

### Simulador por consola (alternativa)

`backend/scripts/simulator.js` envía lecturas directamente, útil para pruebas:

```powershell
cd backend
npm run sim -- --placa ABC-123 --ect 112 --count 5 --interval 2000
```

Flags: `--placa` `--ect` `--rpm` `--count` `--interval` `--invalid` (este último prueba el
rechazo con una API Key inválida).

---

## 7. ⚠️ Limitaciones conocidas

| # | Problema | Impacto |
|---|---|---|
| 1 | **App Android rota** — envía `vehiculo_id = "-1"` fijo, el backend exige que coincida con la API Key | La app Android **nunca** logra registrar lecturas (403) |
| 2 | **Cola offline sin reenvío** — guarda hasta 100 lecturas, nada las reintenta | Lecturas perdidas si hay corte de internet |
| 3 | **URL del túnel no es fija** | Cambia al reiniciarse; si cae, el acceso externo se pierde |
| 4 | **Credenciales débiles** — `admin/admin123` y secreto JWT están en el código | **Solo para demostración**, no usar en producción |
| 5 | **Endpoints públicos sin autenticación** — `GET /telemetry/resumen` y `POST /registration` | Cualquiera con la URL ve el resumen de la flota y puede registrar vehículos |
| 6 | **CORS abierto (`*`)** | Sin restricción de origen |
| 7 | **Umbral 105 °C duplicado** en el frontend (además del backend) | Si se cambia, hay que editar varios archivos |
| 8 | **`db:init` es destructivo** — ejecuta `DROP TABLE` | ⚠️ **Nunca lo ejecutes con datos que quieras conservar** |

---

## 8. Referencia rápida de la API

Base: `http://localhost:3000` (o la URL del túnel). Prefijo: `/api/v1`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | — | Estado del servidor |
| POST | `/auth/login` | — | Inicio de sesión admin → JWT (8 h) |
| GET | `/vehiculos` | admin | Lista la flota |
| POST | `/vehiculos` | admin | Crea vehículo (genera API Key) |
| PUT | `/vehiculos/:id` | admin | Actualizar nombre / activar |
| DELETE | `/vehiculos/:id` | admin | Eliminar (borra lecturas y alertas) |
| GET | `/vehiculos/:id/apikey` | admin | Ver la API Key en claro |
| POST | `/vehiculos/:id/apikey/regenerar` | admin | Rotar la API Key |
| GET | `/historial/telemetria` | admin | Historial de lecturas |
| GET | `/historial/alertas` | admin | Historial de alertas |
| POST | `/historial/alertas/:id/atender` | admin | Marcar alerta como atendida |
| POST | `/telemetry` | **API Key** | Enviar una lectura (ECT + RPM) |
| POST | `/telemetry/demo` | admin | Simular lectura por placa |
| GET | `/telemetry/resumen` | — | Estado actual de la flota (público) |
| GET | `/registration` | — | Consultar compatibilidad (público) |
| POST | `/registration` | — | Registrar vehículo (público, devuelve API Key) |

**Autenticación:**
- **Admin** → `Authorization: Bearer <JWT>` (el login lo genera)
- **Dispositivo** → header `X-API-Key: key_...`

---

## 9. Modelo de datos

**`vehiculos`** — `id` (UUID), `placa` (única), `api_key` (única), `nombre`, `activo`,
`fecha_creacion`, `marca`, `modelo`, `anio`, `combustible`, `tipo_vehiculo`

**`telemetria_lectura`** — `id`, `vehiculo_id` (FK), `ect_temperatura`, `rpm`, `fecha_registro`

**`alerta_mantenimiento`** — `id`, `vehiculo_id` (FK), `tipo_alerta`, `severidad`,
`estado` (`PENDIENTE` / `ACTIVA` / `ATENDIDA`), `fecha_generacion`

Esquema completo: `backend/sql/schema.sql`

---

## 10. Pendientes sugeridos

1. **Desplegar en Render/Railway** → URL fija y estable (el más importante)
2. **Arreglar la app Android** → que use el `vehiculo_id` real en vez de `-1`
3. **Implementar el reenvío** de la cola offline
4. **Endpoint de registro protegido** (o con captcha) para no exponerlo públicamente
5. **Cambiar credenciales** antes de cualquier uso real
6. **Limpiar los 14 scripts de túnel** en `backend/src/scripts/` (son iteraciones de depuración
   antiguas, ya innecesarias desde que existe la tarea `EcoDriveMantener`)

---

*Documento generado con verificación directa del sistema: salud del backend, esquema real de la
base de datos, y prueba de los tres flujos (login admin, registro público, resumen de flota).*
