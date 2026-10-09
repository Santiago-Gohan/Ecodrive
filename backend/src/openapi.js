/**
 * Especificación OpenAPI 3.0 de la API pública y del panel de EcoDrive.
 * Se sirve en GET /api/v1/openapi.json y se visualiza en /api-docs.
 */
const spec = {
  openapi: '3.0.3',
  info: {
    title: 'EcoDrive API',
    version: '1.0.0',
    description:
      'API de telemetría, flota, mantenimiento, taller, alertas e integraciones de EcoDrive.\n\n' +
      'Autenticación del panel: JWT (`Authorization: Bearer <token>`), obtenido en `/auth/login`.\n' +
      'Dispositivos/vehículos: `X-API-Key` con la API key del vehículo o del dispositivo GPS.\n' +
      'Integraciones (plan Flota): `X-Api-Token` con un token creado en el panel.',
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  tags: [
    { name: 'Auth' }, { name: 'Telemetría' }, { name: 'Flota' },
    { name: 'Historial' }, { name: 'Mantenimiento' }, { name: 'Taller' },
    { name: 'Usuarios' }, { name: 'Notificaciones' }, { name: 'Integraciones' },
    { name: 'Eventos' }, { name: 'Opiniones' }, { name: 'Dispositivos' }, { name: 'Privacidad' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      apiKeyDevice: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      apiToken: { type: 'apiKey', in: 'header', name: 'X-Api-Token' },
    },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' } } },
      Login: {
        type: 'object', required: ['username', 'password'],
        properties: { username: { type: 'string' }, password: { type: 'string', format: 'password' } },
      },
      Vehiculo: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, placa: { type: 'string' },
          nombre: { type: 'string' }, tipo_vehiculo: { type: 'string' },
          tipo_conexion: { type: 'string', enum: ['OBD', 'GPS_SOLO', 'GPS_FIJO', 'MANUAL'] },
          api_key: { type: 'string' }, proximo_mantenimiento: { type: 'string', format: 'date' },
          activo: { type: 'boolean' },
        },
      },
      Lectura: {
        type: 'object', required: ['vehiculo_id', 'ect', 'rpm'],
        properties: {
          vehiculo_id: { type: 'string', format: 'uuid' },
          ect: { type: 'number', description: 'Temperatura ECT en °C' },
          rpm: { type: 'integer' }, nivel_combustible: { type: 'number' },
          lat: { type: 'number' }, lng: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      OrdenTrabajo: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, codigo: { type: 'string' },
          vehiculo_id: { type: 'string', format: 'uuid' },
          tipo: { type: 'string', enum: ['PREVENTIVO', 'CORRECTIVO'] },
          estado: { type: 'string', enum: ['ABIERTA', 'EN_PROCESO', 'ESPERA_REPUESTOS', 'CERRADA', 'CANCELADA'] },
          prioridad: { type: 'string', enum: ['BAJA', 'MEDIA', 'ALTA'] },
          costo_mano_obra: { type: 'number' }, costo_repuestos: { type: 'number' }, costo_total: { type: 'number' },
        },
      },
      Repuesto: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, codigo: { type: 'string' }, nombre: { type: 'string' },
          stock_actual: { type: 'number' }, stock_minimo: { type: 'number' }, costo_unitario: { type: 'number' },
        },
      },
      Webhook: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, nombre: { type: 'string' }, url: { type: 'string' },
          eventos: { type: 'string', description: 'CSV: alerta.termica,ot.cerrada,evento.vial,opinion,opinion' },
          secreto: { type: 'string' }, activo: { type: 'boolean' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': { get: { tags: ['Auth'], summary: 'Estado del servicio', security: [], responses: { 200: { description: 'OK' } } } },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Inicio de sesión', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Login' } } } },
        responses: { 200: { description: 'Token JWT' }, 401: { description: 'Credenciales inválidas' } },
      },
    },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Usuario y permisos actuales', responses: { 200: { description: 'OK' } } } },
    '/telemetry': {
      post: {
        tags: ['Telemetría'], summary: 'Ingesta de una lectura', security: [{ apiKeyDevice: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Lectura' } } } },
        responses: { 201: { description: 'Lectura registrada' } },
      },
    },
    '/telemetry/lote': { post: { tags: ['Telemetría'], summary: 'Ingesta de lote offline', security: [{ apiKeyDevice: [] }], responses: { 201: { description: 'OK' } } } },
    '/telemetry/manual': { post: { tags: ['Telemetría'], summary: 'Lectura manual (vehículos sin OBD)', security: [{ apiKeyDevice: [] }], responses: { 201: { description: 'OK' } } } },
    '/vehiculos': {
      get: { tags: ['Flota'], summary: 'Listar flota', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Flota'], summary: 'Registrar vehículo', responses: { 201: { description: 'OK' } } },
    },
    '/vehiculos/{id}': {
      put: { tags: ['Flota'], summary: 'Actualizar vehículo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } },
      delete: { tags: ['Flota'], summary: 'Eliminar vehículo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } },
    },
    '/vehiculos/{id}/mantenimientos': {
      get: { tags: ['Mantenimiento'], summary: 'Historial de mantenimiento', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } },
      post: { tags: ['Mantenimiento'], summary: 'Registrar mantenimiento', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 201: { description: 'OK' } } },
    },
    '/historial/telemetria': { get: { tags: ['Historial'], summary: 'Historial de lecturas', responses: { 200: { description: 'OK' } } } },
    '/historial/alertas': { get: { tags: ['Historial'], summary: 'Historial de alertas', responses: { 200: { description: 'OK' } } } },
    '/historial/alertas/{id}/atender': { post: { tags: ['Historial'], summary: 'Marcar alerta atendida', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/taller/ordenes': {
      get: { tags: ['Taller'], summary: 'Listar órdenes de trabajo', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Taller'], summary: 'Crear orden de trabajo', responses: { 201: { description: 'OK' } } },
    },
    '/taller/ordenes/{id}': {
      get: { tags: ['Taller'], summary: 'Detalle de orden', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } },
      put: { tags: ['Taller'], summary: 'Actualizar orden', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } },
      delete: { tags: ['Taller'], summary: 'Eliminar orden', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } },
    },
    '/taller/ordenes/{id}/repuestos': { post: { tags: ['Taller'], summary: 'Agregar repuesto a la orden', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 201: { description: 'OK' } } } },
    '/taller/ordenes/{id}/cerrar': { post: { tags: ['Taller'], summary: 'Cerrar orden y generar mantenimiento', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/taller/repuestos': {
      get: { tags: ['Taller'], summary: 'Inventario de repuestos', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Taller'], summary: 'Crear repuesto', responses: { 201: { description: 'OK' } } },
    },
    '/taller/repuestos/{id}/movimientos': { post: { tags: ['Taller'], summary: 'Registrar entrada/salida/ajuste', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 201: { description: 'OK' } } } },
    '/taller/costos/resumen': { get: { tags: ['Taller'], summary: 'Costos acumulados por vehículo', responses: { 200: { description: 'OK' } } } },
    '/taller/kpis': { get: { tags: ['Taller'], summary: 'KPIs de taller (abiertas, costo del mes, stock bajo, top repuestos)', responses: { 200: { description: 'OK' } } } },
    '/usuarios': {
      get: { tags: ['Usuarios'], summary: 'Listar usuarios', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Usuarios'], summary: 'Crear usuario', responses: { 201: { description: 'OK' } } },
    },
    '/usuarios/roles': { get: { tags: ['Usuarios'], summary: 'Roles y sus permisos', responses: { 200: { description: 'OK' } } } },
    '/usuarios/roles/{id}/permisos': { put: { tags: ['Usuarios'], summary: 'Asignar permisos a un rol', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/notificaciones': {
      get: { tags: ['Notificaciones'], summary: 'Configuración de notificaciones', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Notificaciones'], summary: 'Crear/actualizar canal por evento', responses: { 201: { description: 'OK' } } },
    },
    '/notificaciones/log': { get: { tags: ['Notificaciones'], summary: 'Historial de envíos', responses: { 200: { description: 'OK' } } } },
    '/webhooks': {
      get: { tags: ['Integraciones'], summary: 'Listar webhooks', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Integraciones'], summary: 'Crear webhook', responses: { 201: { description: 'OK' } } },
    },
    '/webhooks/tokens': {
      get: { tags: ['Integraciones'], summary: 'Listar tokens de API', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Integraciones'], summary: 'Crear token de API', responses: { 201: { description: 'OK' } } },
    },
    '/dispositivos': {
      get: { tags: ['Dispositivos'], summary: 'Listar dispositivos GPS', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Dispositivos'], summary: 'Registrar dispositivo GPS fijo', responses: { 201: { description: 'OK' } } },
    },
    '/eventos': {
      get: { tags: ['Eventos'], summary: 'Eventos viales activos', security: [], responses: { 200: { description: 'OK' } } },
      post: { tags: ['Eventos'], summary: 'Reportar evento vial', security: [], responses: { 201: { description: 'OK' } } },
    },
    '/opiniones': { post: { tags: ['Opiniones'], summary: 'Enviar opinión', security: [], responses: { 201: { description: 'OK' } } } },
    '/privacidad/consentimiento': { post: { tags: ['Privacidad'], summary: 'Registrar consentimiento de datos', security: [], responses: { 201: { description: 'OK' } } } },
    '/privacidad/solicitud': { post: { tags: ['Privacidad'], summary: 'Solicitud de datos (ARCO)', security: [], responses: { 201: { description: 'OK' } } } },
  },
};

module.exports = spec;
