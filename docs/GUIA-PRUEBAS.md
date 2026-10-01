# Guía de pruebas del sistema EcoDrive

Cómo probar todo sin necesidad de un adaptador ELM327 y cómo hacerlo después en campo.

---

## 1. Sin adaptador ELM327 (modo «ECU virtual»)

La app del conductor incluye un **simulador de motor** integrado. No necesitas ningún
hardware para ver el sistema completo en funcionamiento.

### Requisitos
- Backend levantado (local: `node backend/src/server.js`) o la web desplegada en Render.
- Un navegador Chrome/Edge.

### Pasos
1. Abre la **app del conductor**: `http://localhost:3000/dispositivo/` (o la URL de Render).
2. Activa **«ECU virtual (simulador sin adaptador)»**.
3. Elige un perfil de vehículo:
   - **Carro gasolina 2013 / Bus diésel 2015** → compatible, envía telemetría.
   - **Carro diésel 2008 / Moto** → rechazado por incompatibilidad (prueba el control).
4. Vincula el vehículo (ver más abajo: por **código**, **placa**, **API Key** o **QR**).
5. Presiona **Iniciar**. Verás lecturas en vivo cada 5 s (ECT, RPM, combustible).
6. Presiona **Detener** → aparece el **resumen de jornada**.

### Vincular el vehículo (fácil, sin copiar la API Key)
1. En el **panel** → Flota → botón **Key** del vehículo: verás un **código corto de 6 caracteres**
   (ej. `6E78FE`), el QR y la casilla *Permitir vincular escribiendo solo la placa*.
2. En la **app del conductor**, en el único campo de vinculación escribe **una** de estas cosas:
   - el **código** de 6 caracteres (lo más fácil), o
   - la **placa** (ej. `ABC-123` o `ABC123`) si el vehículo lo permite, o
   - la **API Key** completa (`ECDV-…`, se pega y vincula sola).
3. Con adaptador **ELM327**, al conectar la app **lee el VIN** (PID 0900) y vincula el vehículo
   automáticamente, sin escribir nada.

> La vinculación por placa está apagada por defecto (por seguridad): actívala por vehículo
> desde el panel. La búsqueda por código/placa/VIN está limitada a 10 intentos por minuto por IP.

### Probar la alerta de sobrecalentamiento
- En modo virtual, cada ~50 s el simulador genera un **pico de 108 °C**.
- Cuando el ECT pase **105 °C** verás: banner rojo en la app, **sonido** y **vibración**.
- Con la ECU virtual activa también aparecerá la **alerta en el panel** (baja severidad ALTA).

---

## 2. Probar el panel administrador (demo en vivo)

1. Entra a `/panel` e inicia sesión (local: `admin` / `admin123`).
2. Usa el botón **«Demo en vivo»** del panel: genera telemetría simulada en el vehículo
   seleccionado sin tocar nada.
3. Revisa: mapa en vivo, tarjeta del vehículo con ECT/RPM/combustible, alertas y mantenimientos.

### Datos de prueba ya cargados (local)
- `ABC-123` → API Key `key_abc123_secret` (vehículo de pruebas telemetría).
- `ABC-888` → vehículo para mantenimiento.
- `3535013` → placa de prueba adicional.

---

## 3. Prueba automatizada (16 checkpoints)

El backend incluye una suite de verificación:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\SANTIAGO\AppData\Local\Temp\opencode\test_ecodrive.ps1"
```

Al final debe decir `=== RESULTADO: 16 pass, 0 fail ===`.

> Nota: el login tiene anti-fuerza-bruta (10 intentos por IP en 5 min). Si pruebas
> `POST /auth/login` muchas veces seguidas, el backend responderá `429` y hasta el login
> legítimo quedará bloqueado; reinicia el backend para limpiarlo.

---

## 4. Condiciones que ya están verificadas

- **Rate limit por vehículo** (caudal): con `LIMITE_LECTURAS_MINUTO=8`, tras 8 lecturas el
  servidor responde `429` con `Retry-After: 60` y el dispositivo aplica backoff.
- **Caudal por lote**: `POST /telemetry/lote` consume una lectura por vehículo.
- **Backoff offline**: si el servidor está caído o responde 429, el dispositivo reintenta
  en 5 s → 10 s → 20 s → … hasta 5 min (respeta `Retry-After`).
- **CSP y cabeceras de seguridad** presentes en `/`, `/panel/` y `/dispositivo/`.
- **Login** con bloqueo por IP tras 10 fallos.
- **Purga de telemetría**: retiene 30 días y resume por hora en `telemetria_resumen`
  (cada 60 min con advisory lock).
- **Health real**: `/api/v1/health` responde `db: "ok"`, `uptime` y `hora`; da `503` si la BD falla.

---

## 5. Prueba en campo (cuando tengas el ELM327)

1. Conecta el **ELM327 v1.5 Bluetooth** a la toma OBD-II del vehículo (encendido, motor parado).
2. Desde la app: **Conectar dispositivo** → Bluetooth → elige **OBDII**.
3. Si el motor lo soporta, verás «Vehículo compatible: ECT y RPM soportados».
4. Elige frecuencia (2/5/10/30 s), tu vehículo + API Key e **Iniciar**.
5. Conduce y luego **Detener** → compara el resumen de jornada con el panel.

### Checklist en campo
- [ ] Lecturas llegan al panel en tiempo real (mapa y tarjeta).
- [ ] Sin señal: las lecturas se acumulan en la cola y se reenvían al volver la cobertura.
- [ ] Alerta de sobrecalentamiento suena/vibra en la app y aparece en el panel.
- [ ] Recorrido en km (GPS) coincide aproximadamente con el cuenta kilómetros.
- [ ] El resumen de jornada cuadra con lo visto en vivo.

---

## 6. Probar en producción (Render)

- Página: `https://ecodrive-backend-r34q.onrender.com`
  - Landing: `/` · Panel: `/panel` · App conductor: `/dispositivo/`
- Recuerda hacer **Ctrl+F5** (o recargar sin caché) tras cada despliegue.
- Los datos son los mismos de la BD Neon (al prod le llega telemetría real/simulada).