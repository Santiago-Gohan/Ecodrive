# Privacidad, seguridad y tratamiento de datos · EcoDrive

Documento de referencia para el cumplimiento de la **Ley 1581 de 2012** y el
**Decreto 1377 de 2013** (Colombia), y buenas prácticas de seguridad.

## 1. Principios aplicados

- **Finalidad:** los datos se tratan solo para operar la telemetría, el
  mantenimiento predictivo, las alertas, el soporte y las obligaciones legales.
- **Minimización:** se guardan únicamente los campos necesarios (placa,
  telemetría, contacto, credenciales).
- **Seguridad:** cifrado en tránsito (HTTPS forzado en producción), control de
  acceso por roles, registro de auditoría y contraseñas con hash bcrypt.
- **Conservación:** las lecturas crudas de telemetría se conservan por un
  periodo y luego se agregan a resúmenes (retención configurable del backend,
  por defecto 30 días).

## 2. Consentimiento

- La página pública [privacidad.html](../../pagina-web/privacidad.html) permite
  registrar autorización de tratamiento (`POST /api/v1/privacidad/consentimiento`).
- Cada consentimiento guarda `tipo`, `version`, `identificador`, `aceptado`,
  `ip` y `user_agent`, con fecha. Tipos: `PRIVACIDAD`, `MARKETING`, `TERMINOS`.
- Se consultan desde *Gestión → Privacidad → Consentimientos*.

## 3. Derechos del titular (ARCO)

Acceso, Rectificación, Cancelación (supresión) y Oposición.

- El titular radica la solicitud desde la página de privacidad
  (`POST /api/v1/privacidad/solicitud`), sin necesidad de sesión.
- El equipo la gestiona en *Gestión → Privacidad → Solicitudes*, cambiando el
  estado: `PENDIENTE → EN_PROCESO → RESUELTA | RECHAZADA`.
- Al pasar a `RESUELTA`/`RECHAZADA` se registra `resuelto_en` automáticamente.

## 4. Seguridad técnica implementada

| Control | Implementación |
| --- | --- |
| Contraseñas | hash con bcrypt (`bcryptjs`), nunca en texto plano |
| Sesión | JWT firmado (`JWT_SECRET`), expiración por tiempo |
| Roles y permisos | tabla `permisos` + `rol_permiso` + middleware `permAuth` |
| Auditoría | tabla `audit_log` (quién, IP, recurso, acción, detalles) |
| Cabeceras | `securityHeaders` (helmet-like) |
| HTTPS | redirección forzada en producción, `trust proxy` |
| En tránsito | TLS/HTTPS obligatorio + HSTS |
| En reposo | base gestionada (Neon/Render) con cifrado en reposo de discos y respaldos; conexiones por SSL |
| Dispositivos | API Key por vehículo/dispositivo, regenerable |
| Webhooks | firma HMAC-SHA256 con secreto por integración |

> Recomendaciones de puesta en producción: definir un `JWT_SECRET` largo y
> aleatorio, habilitar `PGSSL=require` con base gestionada (Neon/Render),
> rotar tokens de API periódicamente y activar copias de seguridad.

## 4b. Geolocalización de conductores

- **Finalidad:** monitoreo operativo, alertas, mantenimiento predictivo y
  reportes. No se vende ni comparte la ubicación con terceros (salvo obligación
  legal o autorización expresa).
- **Acceso:** historial de rutas únicamente para roles autorizados (admin,
  supervisión); el conductor consulta solo su propio vehículo.
- **Conservación:** posiciones retenidas por un periodo definido; luego se
  agregan o eliminan (sin trazabilidad histórica indefinida).
- **Derechos del titular:** ARCO aplicable a la geolocalización (acceso,
  rectificación, eliminación, oposición) y revocatoria de la autorización.

## 5. Roles sugeridos

- **admin:** control total.
- **supervisor:** flota, taller, reportes, aprobación de opiniones.
- **mecanico / taller:** órdenes de trabajo e inventario.
- **conductor:** solo su vehículo / telemetría móvil.
- **comercial:** opiniones y reportes.

Los permisos concretos por rol se ajustan en *Gestión → Roles* sin tocar código.

## 6. Solicitudes y plazos

Conforme a la ley, las consultas se atienden en un máximo de **10 días hábiles**
y los reclamos en **15 días hábiles** (prorrogables). El estado y las fechas
quedan registrados en la tabla `solicitudes_datos`.
