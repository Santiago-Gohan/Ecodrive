# Integraciones y API · EcoDrive

EcoDrive expone una API REST versionada en `/api/v1` y documentación interactiva
OpenAPI (Swagger UI).

- Swagger UI: `http://localhost:3000/api-docs`
- Especificación JSON: `http://localhost:3000/api/v1/openapi.json`

## Autenticación

### Usuarios del panel
1. `POST /api/v1/auth/login` con `{ "username", "password" }`.
2. Devuelve `{ token, role, permisos }`.
3. Envía el token en cada petición: `Authorization: Bearer <token>`.

### Integraciones (ERP, contabilidad, BI)
Genera un **token de API** en el panel: *Gestión → Integraciones → Tokens de API*.
Se muestra una sola vez. Úsalo igual que el token de usuario:

```
Authorization: Bearer ECDV-API-<hex>
```

### Dispositivos de telemetría
Cada vehículo o dispositivo GPS usa una **API Key** como `x-api-key`:

```
POST /api/v1/telemetry
x-api-key: ECDV-XXXX-XXXX-XXXX
Content-Type: application/json
{ "ect": 98.5, "rpm": 2100, "nivel_combustible": 62, "lat": 4.6, "lng": -74.0 }
```

## Control de acceso por roles (RBAC)

Los permisos tienen la forma `recurso:accion` (p. ej. `taller:editar`,
`integraciones:ver`). El rol `admin` siempre tiene acceso total (`*`).
Los permisos se administran en *Gestión → Roles*.

| Recurso | Acciones típicas |
| --- | --- |
| flota | ver, editar |
| usuarios | ver, editar |
| taller | ver, crear, editar, eliminar |
| inventario | ver, editar |
| notificaciones | ver, editar |
| integraciones | ver, editar |
| reportes | ver |
| configuracion | ver, editar |

## Webhooks salientes

EcoDrive notifica eventos a sistemas externos mediante webhooks firmados.

- Configura: *Gestión → Integraciones → Nuevo webhook* (URL, eventos, secreto).
- Eventos: `alerta.termica`, `alerta.mantenimiento`, `evento.vial`, `opinion`, `ot.cerrada`.
- Firma: cabecera `X-EcoDrive-Signature: sha256=<hmac>` calculada con HMAC-SHA256
  sobre el cuerpo usando el `secreto` del webhook.
- Reintentos: las entregas fallidas se reintentan (intervalo programado del backend).
- Historial: *Gestión → Integraciones → Entregas*.

### Verificar la firma (Node.js)

```js
const crypto = require('crypto');
function firmaValida(secreto, cuerpoCrudo, cabecera) {
  const esperado = 'sha256=' + crypto.createHmac('sha256', secreto).update(cuerpoCrudo).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(cabecera));
}
```

## Alertas externas (notificaciones)

Se configuran en *Gestión → Alertas* por canal y evento:

| Canal | Proveedor soportado | Parámetros (`params`) |
| --- | --- | --- |
| WHATSAPP | CallMeBot / Meta Cloud API / webhook | `callmebot_apikey` · `phone_id`+`token` · `webhook_url` |
| EMAIL | SMTP (nodemailer) / API HTTP | `smtp_host`,`smtp_port`,`smtp_user`,`smtp_pass` · `api_url`+`api_key` |
| SMS | Twilio | `account_sid`,`auth_token`,`from` |
| WEBHOOK | Genérico | `webhook_url` (+ `header_name`/`header_value`) |

Cada envío queda registrado con su estado en *Gestión → Alertas → Registro*.

## Ejemplos (curl)

```bash
# Login
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Listar órdenes de trabajo
curl -s http://localhost:3000/api/v1/taller/ordenes \
  -H "Authorization: Bearer $TOKEN"

# Resumen de costos por vehículo
curl -s http://localhost:3000/api/v1/taller/costos/resumen \
  -H "Authorization: Bearer $TOKEN"
```

## Endpoints principales

- `auth`: `POST /auth/login`, `GET /auth/me`, `PUT /auth/password`
- `usuarios`: usuarios, `GET /usuarios/roles`, `GET /usuarios/permisos`, `GET /usuarios/auditoria`
- `taller`: `GET|POST /taller/ordenes`, `/:id/cerrar`, `/:id/repuestos`, `GET /taller/repuestos`, movimientos, `GET /taller/costos/resumen`
- `notificaciones`: `GET|POST /notificaciones`, `/:id/probar`, `GET /notificaciones/log`
- `webhooks`: `GET|POST /webhooks`, `/:id/probar`, `/:id/entregas`, tokens
- `dispositivos`: `GET|POST /dispositivos`, `/:id/regenerar-key`
- `privacidad`: `POST /privacidad/consentimiento`, `POST /privacidad/solicitud`, administración
