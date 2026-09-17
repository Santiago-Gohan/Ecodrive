# EcoDrive - Análisis de Mercado y Modelo de Servicio

Versión 1.0 - Santiago Barrera Barbosa - SENA ADSO Ficha 3535013

---

## 1 · Marca y productos

| Producto | Público | Qué es |
|---|---|---|
| **EcoDrive** | Cualquier vehículo (particular) | Plataforma: app de toma de telemetría + panel |
| **EcoDrive Fleet** | Empresas multivehículo | Servicio SaaS: flotas, umbrales, reportes, multi-usuario |
| **EcoDrive Caja Negra** | Buses/camiones, zona rural | Hardware: captura local durable + sincronización offline |

## 2 · Segmentos de mercado (viabilidad)

| Segmento | Ejemplos | Puerta de datos | Sensores | Viabilidad |
|---|---|---|---|---|
| Autos particulares | Cualquier vehículo 2001+ | OBD-II 16 pines + ELM327 | ECT, RPM, DTC, velocidad, consumo | Alta |
| Taxis / colectivos | Pequeñas flotas urbanas | OBD-II + celular del conductor | Idem + localización | Alta |
| Buses interdepartamentales | Rutas rurales | OBD-II / J1939 + caja negra | ECT, RPM + buffer offline | Alta |
| Buses urbanos | SITP y similares | J1939 (Volvo, Mercedes) | Idem + tacógrafo | Alta |
| Camiones / carga | Reparto, tractocamiones | J1939 (Deutsch 9 pines) | ECT, RPM, presión aceite | Alta |
| Motos | Mensajería, domicilios | Sin OBD en la mayoría | Solo GPS + acelerómetro | Media (línea futura) |
| Eléctricos (EV) | Buses/carros eléctricos | CAN propio del fabricante | Temperatura batería, SOC | Futura (requiere desarrollo) |
| Maquinaria agrícola | Tractores, retroexcavadoras | J1939 | Temp motor, RPM, horas | Media |

**Decisiones técnicas por segmento**
- Gasolina/diésel OBD-II: chip ELM327. Implementado (Web Bluetooth + Android).
- Pesados (buses/camiones): conector 9 pines J1939 → transceptor CAN MCP2515. Pendiente.
- Diésel Euro 5/6: algunos fabricantes bloquean PIDs → matriz de compatibilidad por marca.
- Eléctricos: mapear PIDs de batería por fabricante (Volvo, BYD, GM, etc.).

## 3 · Limitaciones

### Compatibilidad por año, motor y conector

| Vehículo | Rango | Compatibilidad OBD-II | Qué ofrecemos |
|---|---|---|---|
| Gasolina | 2013+ | Completa (OBD obligatorio en Colombia, Res. 245/2013) | Telemetría de motor total |
| Gasolina | 2004–2012 | Validar por modelo (algunos PIDs propietarios, K-line lento) | Telemetría + prueba previa |
| Gasolina | Antes de 2004 | Solo algunos (OBD no estandarizado en el país) | Solo GPS/localización |
| Diésel | 2010+ (Euro 4+) | Completa | Telemetría total |
| Diésel | Antes de 2010 | Sin puerto OBD estándar en la mayoría | Solo GPS |
| Bus/camión pesado (J1939) | 2005+ | Requiere conector 9 pines + transceptor CAN (kit) | Telemetría + caja negra |
| Moto | Cualquiera | Sin OBD en la gran mayoría | Solo GPS/acelerómetro (futuro) |
| Eléctrico (EV) | Cualquiera | OBD no expone motor térmico | Pendiente desarrollo (PIDs batería) |
| 24V (buses, camiones) | — | ELM327 es 12V | Requiere módulo 24→5V en la caja |

### Regla de compatibilidad (para el contrato de servicio)
> "EcoDrive garantiza telemetría de motor en vehículos **gasolina 2013+** y **diésel 2010+** con puerto
> OBD-II 16 pines ISO 15765-4. Años inferiores: servicio validado por modelo con prueba previa sin costo.
> Vehículos sin OBD estándar (gasolina pre-2004, diésel pre-2010, motos) solo incluyen localización y comportamiento."

### Técnicas
1. Vehículos anteriores al 2000 sin OBD estandarizado → no aplica telemetría, solo GPS.
2. El conector OBD es único: conflictos con otros aparatos de diagnóstico del conductor o del taller.
3. PIDs propietarios: ciertos fabricantes limitan datos (sobre todo diésel Euro 5/6 y J1939 premium).
4. Consumo de datos: 1 lectura/5 s × 24/7 ≈ 17.000 lecturas/día/vehículo → comprimir y bajar frecuencia (10-30 s) a escala.
5. En zona sin señal, solo el buffer local (EcoDrive Caja Negra) garantiza captura continua; la alerta en tiempo real (<2 s, RNF-01) solo aplica con conexión activa.
6. Fuera de alcance técnico: leer/controlar ABS, airbags o cableado de confort por CAN (solo lectura de motor).

### Regulatorias (Colombia)
7. Ley 1581/2012 (Habeas Data): GPS y tiempos del conductor = dato personal → consentimiento y política de privacidad.
8. Res. 3313/2021 (seguimiento obligatorio) y Res. 3603/2014 (tacógrafo): EcoDrive complementa, NO reemplaza equipos homologados de transporte público.
9. Ventas B2B: contrato de servicio, SLA y respaldo de datos (cumplir reglas de transferencia).

### Comerciales
10. Hoy EcoDrive es mono-empresa: para vender como servicio falta multi-tenant (aislamiento por empresa: RN-02 escalada).
11. Soporte por marca es costoso: priorizar las ~10 marcas más comunes del parque nacional (Renault, Chevrolet, Toyota, Mazda, Kia, Hyundai, Nissan, Ford, Volvo, Scania, Mercedes).

### Escalabilidad
12. PostgreSQL soporta ~100-200 vehículos. Para crecer: TimescaleDB (series temporales) + colas (Kafka/RabbitMQ) + compresión.

## 4 · Requisitos de acceso al servicio (por vehículo)

### A · Obligatorios
1. **Compatibilidad por año/motor**: gasolina 2013+, diésel 2010+. Gasolina 2004-2012: validado por modelo con prueba previa.
2. **Puerto OBD-II funcional**: 16 pines ISO 15765-4 (CAN). Buses/camiones pesados: J1939 9 pines con kit.
3. **Puerto disponible**: no ocupado en forma permanente por otro equipo.
4. **Alimentación**: 12 V (autos) o 24 V con módulo 24→5 V (buses/camiones).
5. **Dispositivo de lectura**: adaptador ELM327 BLE v1.5+ + celular Android con Chrome o app nativa.
6. **Documentación legal**: matrícula/Soat vigente y titularidad clara.
7. **Consentimiento Habeas Data** (Ley 1581/2012): conductor/es firman autorización (GPS + tiempos = dato personal).
8. **Cuenta + API Key**: un vehículo = una API Key generada al registrarlo.

### B · Recomendados
- GPS activo en el dispositivo.
- Plan de datos mínimo o modo offline con EcoDrive Caja Negra.
- Modelo dentro de la matriz de compatibilidad probada.

### C · Proceso de ingreso (onboarding)
1. **Registro**: placa, marca, modelo, año, tipo de motor, empresa.
2. **Prueba de compatibilidad**: el dispositivo consulta PIDs soportados (PID 0100) → acepta o rechaza automáticamente (implementado en la app de telemetría).
3. **Asignación**: se genera la API Key del vehículo.
4. **Piloto**: 1 hora de lectura real (ECT, RPM, DTC) validada.
5. **Activación**: entra el plan contratado.

### D · No acceden (por ahora)
- Gasolina anterior a 2004 · Diésel anterior a 2010.
- Motos sin puerto OBD · Vehículos eléctricos (en desarrollo).
- Puertos intervenidos/dañados o que no responden PID 0100.
- Empresa sin consentimiento firmado de conductores.

## 5 · Modelo de servicio SaaS

| Plan | Cliente | Incluye | Precio aprox/mes |
|---|---|---|---|
| Básico | Particular, 1-3 vehículos | App, alertas, historial 30 días | $10-15 |
| Flota PyME | Taxis, reparto, 5-50 vehículos | Multi-cuenta, umbrales, reportes | $25 + $4/vehículo |
| Transporte (Rutas) | Buses rurales/interdepartamentales | Caja negra offline, sync terminal, J1939 | $40 + $8/vehículo |
| Enterprise | Grandes flotas | API, integración, zona de datos propia | A medida |

## 6 · Hoja de ruta para convertirlo en servicio

1. **Multi-tenant**: tabla `empresas`; usuarios, vehículos, alertas ligados y aislados por empresa.
2. **Onboarding por tipo de vehículo**: registrar "qué conector tiene" → cargar kit correcto.
3. **Soporte J1939** (camiones y buses pesados, conector 9 pines).
4. **Matriz de compatibilidad por marca/modelo** (probar en terreno).
5. **Reportes PDF** (HU-D01) y analítica comparativa (HU-D03).
6. Motos y EV como líneas futuras: no bloquean lanzamiento.
7. Plan de cumplimiento Habeas Data (Ley 1581/2012).