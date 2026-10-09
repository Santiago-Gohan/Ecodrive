# Roadmap de hardware · GPS fijo e iOS

EcoDrive nació con telemetría desde el **celular del conductor** (app Android →
API con `x-api-key`). Esta fase agrega soporte para **hardware GPS fijo**
(hardwired) y planifica la app **iOS**.

## 1. Estado actual

- Ingesta por HTTP: `POST /api/v1/telemetry` autenticada con `x-api-key`.
- La app Android (`/dispositivo/`, APK) envía ECT, RPM, combustible y GPS.
- Vinculación por **código de 6 caracteres** o **QR** (sin escribir la API Key).
- Registro de dispositivos en *Gestión → Dispositivos* (`tipo`: `GPS_FIJO`,
  `OBD_TELEFONO`, `OBU`), con IMEI, modelo, fabricante, protocolo y SIM.
- Al registrar un `GPS_FIJO`, el vehículo pasa a `tipo_conexion = 'GPS_FIJO'`.

## 2. GPS fijo (hardwired) — Fase 6

### Hardware objetivo
- Rastreadores vehiculares tipo **Teltonika FMB920/FMB020**, **Concox GT06**,
  **Queclink GV55**, o módulos **OBD II LTE**.

### Integración
1. El dispositivo envía posición y diagnósticos por red celular (TCP/UDP o HTTP).
2. Adaptadores de protocolo traducen al formato EcoDrive:
   - `TELTONIKA` (`Codec 8/8E`)
   - `GT06`
   - `HTTP_GENERICO` (JSON directo a `/api/v1/telemetry`)
3. Autenticación por `x-api-key` (dispositivo) o IMEI registrado.

### Campos de telemetría soportados
`ect` (temperatura motor), `rpm`, `nivel_combustible`, `lat`, `lng`,
`odometro_km`, `voltaje`, `ignicion`.

### Pendientes de ingeniería
- [ ] Adaptador TCP dedicado (puerto 5023/5063 Teltonika) que hospede el
      parser de Codec 8/8E y guarde en `telemetria_lectura`.
- [ ] Ingesta por webhook del fabricante (algunos GPS ofrecen HTTP push).
- [ ] Comandos de salida (inmovilización) — requiere doble confirmación y se
      documentará como acción sensible auditada.
- [ ] Gestión de SIM y datos (MSISDN, operador) por dispositivo.
- [ ] Alertas por pérdida de señal (`ultimo_ping` antiguo).

## 3. App iOS — plan

La API es agnóstica del cliente, por lo que un cliente iOS puede reutilizar los
mismos endpoints.

### Opciones
- **PWA** (rápida): la web app del conductor con manifest + service worker.
- **App nativa** (Swift/SwiftUI): mejor acceso a ubicación en segundo plano y BLE.

### Requisitos Apple
- Permisos de ubicación (`When In Use` / `Always`) y justificación en tienda.
- `NSLocationBackgroundModes` para rastreo continuo.
- Política de privacidad publicada
  (ver [PRIVACIDAD.md](PRIVACIDAD.md) y `/privacidad.html`).

### Fases
1. PWA instalable del panel/dispositivo.
2. App SwiftUI de toma de telemetría (ECT/RPM/combustible/GPS) contra la misma API.
3. Publicación en App Store (cuenta de desarrollador + revisión).

## 4. Próximos hitos sugeridos

| Hito | Descripción | Prioridad |
| --- | --- | --- |
| Parser TCP Teltonika | Ingesta GPS fijo real | Alta |
| Alertas de señal | `ultimo_ping` > umbral | Media |
| PWA iOS | App instalable sin tienda | Media |
| App iOS nativa | SwiftUI + BLE OBD | Baja |
| Comandos remotos | Inmovilización auditada | Baja |
