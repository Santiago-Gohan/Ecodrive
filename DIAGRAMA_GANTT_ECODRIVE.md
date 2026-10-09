# 📊 Diagrama de Gantt - Proyecto EcoDrive

## Resumen Ejecutivo

| Dato | Valor |
|---|---|
| **Fecha inicio (commit inicial)** | **2026-09-17 09:29** (`e9c6786` — plataforma de telemetría y mantenimiento predictivo) |
| **Fecha fin (último avance)** | 2026-10-08 |
| **Duración total del proyecto** | 21 días naturales, **9 días activos** de trabajo |
| **Tiempo de trabajo estimado** | **≈ 31,4 horas** (~4 jornadas de 8h) |
| **Total commits** | 51 |
| **Sesiones de trabajo** | 10 (entre 07:14 y 23:53, incluye madrugada y dobles jornadas) |

> **Nota de estimación:** las horas se calculan a partir del rango real de horimestamps de commits y las sesiones de trabajo detectadas. Los commits aislados se estiman según complejidad del cambio.

---

## 🗓️ Cronograma por Día (inicio, fin, horas y % trabajado)

| Fecha | 🟢 Inicio | 🔴 Fin | Commits | Horas | % del día | **% trabajado (acumulado)** | Enfoque principal |
|---|---|---|---|---|---|---|---|
| **2026-09-17** | 09:29 | ~13:30 | 1 | **4,0h** | 12,7% | 🟦 **12,7%** | Commit inicial: plataforma completa (backend + frontend + BD) |
| **2026-09-27** | 11:20 | 14:01 | 7 | **2,7h** | 8,6% | 🩵 **21,3%** | Deploy/SSL/README + robustez calle y zonas rurales |
| **2026-09-28** | 07:37 | 18:22* | 13 | **9,0h** | 28,7% | 🟨 **50,0%** | App Android, panel admin, landing, GPS, API key, demo |
| **2026-09-29** | 22:00 | 23:53 | 6 | **2,0h** | 6,4% | 🟧 **56,4%** | Módulo de mantenimiento + flota + QR |
| **2026-09-30** | 00:08 | 00:23 | 4 | **0,5h** | 1,6% | 🟪 **58,0%** | Fases 1-3: producción, confiabilidad, seguridad |
| **2026-10-01** | 07:14 | 22:24 | 17 | **9,3h** | 29,6% | 🔴 **87,6%** | Doble jornada: alertas, vinculación, landing, opiniones, eventos, tour |
| **2026-10-04** | 17:24 | 17:24 | 1 | **0,1h** | 0,3% | ⚪ **87,9%** | Chores (.gitignore) |
| **2026-10-07** | 22:16 | 22:16 | 1 | **1,3h** | 4,1% | 🔵 **92,0%** | Fase 0: RBAC + vehículos no compatibles |
| **2026-10-08** | 08:24 | ~10:54 | 1 + manual | **2,5h** | 8,0% | 🟤 **100%** | Documentación (manual, este Gantt) + operación túnel/backend |

*\*28/09 incluye pausa ~11:46–15:20.*

**🟢 Inicio total: 2026-09-17 09:29 · 🔴 Fin total: 2026-10-08 ~10:54 · TOTAL: ≈ 31,4 horas · 100% trabajado**

---

## 📈 Gantt por Fases × Fechas (inicio, fin y % trabajado)

<table>
  <tr>
    <th>Fase</th>
    <th>🟢 Inicio</th>
    <th>🔴 Fin</th>
    <th>Horas</th>
    <th>% Fase</th>
    <th>% Acum.</th>
    <th>17/09</th>
    <th>27/09</th><th>28/09</th><th>29/09</th><th>30/09</th>
    <th>01/10</th><th>04/10</th><th>07/10</th><th>08/10</th>
  </tr>
  <tr>
    <td>🟦 Fundación / Plataforma</td>
    <td>17/09 09:29</td><td>17/09 ~13:30</td>
    <td>4,0h</td><td style="text-align:center">12,7%</td><td style="text-align:center"><b>12,7%</b></td>
    <td style="background:#2563eb;color:#fff;text-align:center"><b>■</b></td>
    <td colspan="8" style="background:#f1f5f9"></td>
  </tr>
  <tr>
    <td>🩵 Deploy & Cloud</td>
    <td>27/09 11:20</td><td>27/09 12:48</td>
    <td>1,0h</td><td style="text-align:center">3,2%</td><td style="text-align:center"><b>15,9%</b></td>
    <td style="background:#f1f5f9"></td>
    <td style="background:#06b6d4;color:#fff;text-align:center"><b>■</b></td>
    <td colspan="7" style="background:#f1f5f9"></td>
  </tr>
  <tr>
    <td>🟩 Robustez & Zonas rurales</td>
    <td>27/09 13:24</td><td>27/09 14:01</td>
    <td>1,7h</td><td style="text-align:center">5,4%</td><td style="text-align:center"><b>21,3%</b></td>
    <td style="background:#f1f5f9"></td>
    <td style="background:#16a34a;color:#fff;text-align:center"><b>■</b></td>
    <td colspan="7" style="background:#f1f5f9"></td>
  </tr>
  <tr>
    <td>🟨 App Android + Panel + Landing + GPS</td>
    <td>28/09 07:37</td><td>28/09 18:22</td>
    <td>9,0h</td><td style="text-align:center">28,7%</td><td style="text-align:center"><b>50,0%</b></td>
    <td colspan="2" style="background:#f1f5f9"></td>
    <td style="background:#eab308;color:#000;text-align:center"><b>■</b></td>
    <td colspan="6" style="background:#f1f5f9"></td>
  </tr>
  <tr>
    <td>🟧 Mantenimiento & QR</td>
    <td>29/09 22:00</td><td>29/09 23:53</td>
    <td>2,0h</td><td style="text-align:center">6,4%</td><td style="text-align:center"><b>56,4%</b></td>
    <td colspan="3" style="background:#f1f5f9"></td>
    <td style="background:#f97316;color:#fff;text-align:center"><b>■</b></td>
    <td colspan="5" style="background:#f1f5f9"></td>
  </tr>
  <tr>
    <td>🟪 Producción & Seguridad</td>
    <td>30/09 00:08</td><td>30/09 00:23</td>
    <td>0,5h</td><td style="text-align:center">1,6%</td><td style="text-align:center"><b>58,0%</b></td>
    <td colspan="4" style="background:#f1f5f9"></td>
    <td style="background:#9333ea;color:#fff;text-align:center"><b>■</b></td>
    <td colspan="4" style="background:#f1f5f9"></td>
  </tr>
  <tr>
    <td>🔴 Features UX (conductor, opiniones, eventos, tour)</td>
    <td>01/10 07:14</td><td>01/10 22:24</td>
    <td>9,3h</td><td style="text-align:center">29,6%</td><td style="text-align:center"><b>87,6%</b></td>
    <td colspan="5" style="background:#f1f5f9"></td>
    <td style="background:#dc2626;color:#fff;text-align:center"><b>■</b></td>
    <td colspan="3" style="background:#f1f5f9"></td>
  </tr>
  <tr>
    <td>⚪ Mantenimiento repo</td>
    <td>04/10 17:24</td><td>04/10 17:24</td>
    <td>0,1h</td><td style="text-align:center">0,3%</td><td style="text-align:center"><b>87,9%</b></td>
    <td colspan="6" style="background:#f1f5f9"></td>
    <td style="background:#94a3b8;color:#fff;text-align:center">■</td>
    <td colspan="2" style="background:#f1f5f9"></td>
  </tr>
  <tr>
    <td>🔵 RBAC / Fase 0</td>
    <td>07/10 22:16</td><td>07/10 22:16</td>
    <td>1,3h</td><td style="text-align:center">4,1%</td><td style="text-align:center"><b>92,0%</b></td>
    <td colspan="7" style="background:#f1f5f9"></td>
    <td style="background:#3b82f6;color:#fff;text-align:center"><b>■</b></td>
    <td style="background:#f1f5f9"></td>
  </tr>
  <tr>
    <td>🟤 Docs & Operación</td>
    <td>08/10 08:24</td><td>08/10 ~10:54</td>
    <td>2,5h</td><td style="text-align:center">8,0%</td><td style="text-align:center"><b>100%</b></td>
    <td colspan="8" style="background:#f1f5f9"></td>
    <td style="background:#a16207;color:#fff;text-align:center"><b>■</b></td>
  </tr>
  <tr style="background:#e2e8f0">
    <td><b>📊 TOTAL</b></td>
    <td><b>17/09 09:29</b></td>
    <td><b>08/10 ~10:54</b></td>
    <td><b>31,4h</b></td>
    <td style="text-align:center"><b>100%</b></td>
    <td style="text-align:center"><b>100%</b></td>
    <td style="text-align:center"><b>12,7</b></td>
    <td style="text-align:center"><b>8,6</b></td>
    <td style="text-align:center"><b>9,0</b></td>
    <td style="text-align:center"><b>2,0</b></td>
    <td style="text-align:center"><b>0,5</b></td>
    <td style="text-align:center"><b>9,3</b></td>
    <td style="text-align:center"><b>0,1</b></td>
    <td style="text-align:center"><b>1,3</b></td>
    <td style="text-align:center"><b>2,5</b></td>
  </tr>
</table>

---

## 🕐 Gantt por Horas del Día (sesiones reales)

Columnas = hora del día. `█` sesión activa · `▓` hora parcial · `·` sin trabajo · `⏸` pausa.

```
HORA        00  07  08  09  10  11  12  13  14  15  16  17  18  19  20  21  22  23   HORAS
─────────────────────────────────────────────────────────────────────────────────────────────
17/09 🟦     ·   ·   ·   ▓   █   █   █   ▓   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·    4,0h
27/09 🩵🟩   ·   ·   ·   ·   ·   ▓   █   █   ▓   ·   ·   ·   ·   ·   ·   ·   ·   ·    2,7h
28/09 🟨     ·   ▓   █   █   █   ▓  ⏸  ⏸  ⏸   ▓   █   █   ▓   ·   ·   ·   ·   ·    9,0h
29/09 🟧     ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   █   █    2,0h
30/09 🟪    ▓   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·    0,5h
01/10 🔴     ·   ▓   █   █   █   █   ▓   ·   ·   ·   ·   ·   ▓   █   █   █   ▓   ·    9,3h
04/10 ⚪     ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ▓   ·   ·   ·   ·   ·   ·    0,1h
07/10 🔵     ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ▓   ·    1,3h
08/10 🟤     ·   ·   ▓   █   █   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·    2,5h
```

| Día | Franja horaria | Descripción |
|---|---|---|
| 17/09 | 09:29 → ~13:30 | Sesión única, commit inicial |
| 27/09 | 11:20 → 14:01 | Sesión continua de mediodía |
| 28/09 | 07:37 → 18:22 | Jornada larga con pausa 11:46–15:20 |
| 29/09 | 22:00 → 23:53 | Sesión nocturna |
| 30/09 | 00:08 → 00:23 | Madrugada (4 commits de fase seguidos) |
| 01/10 | 07:14 → 12:44 · 18:36 → 22:24 | **Doble jornada** (la más productiva: 17 commits) |
| 04/10 | 17:24 | Commit rápido |
| 07/10 | 22:16 | Sesión nocturna (RBAC) |
| 08/10 | 08:24 → ~10:54 | Documentación + operación |

---

## 📊 Desglose por Categoría (con colores)

| Color | Categoría | Horas | % | Descripción |
|---|---|---|---|---|
| 🟦 | **Fundación / Plataforma** | 4,0h | 12,7% | Commit inicial: backend, frontend, BD, telemetría |
| 🩵 | **Deploy & Cloud** | 1,0h | 3,2% | render.yaml, SSL en DB, credenciales env, README |
| 🟩 | **Robustez & Rural** | 1,7h | 5,4% | Validación PID, reintentos BT, cola offline, buffer 5000 |
| 🟨 | **App + Panel + Landing + GPS** | 9,0h | 28,7% | App Android (SQLite offline, APK), panel KPIs, mapa Leaflet, landing Samsara, API key ECDV, demo |
| 🟧 | **Mantenimiento & QR** | 2,0h | 6,4% | Historial/próximo servicio, flota en tarjetas, vinculación QR |
| 🟪 | **Producción & Seguridad** | 0,5h | 1,6% | Índices DB, retención telemetría, CSP, anti-brute-force, backups |
| 🔴 | **Features UX** | 9,3h | 29,6% | Alertas térmicas, vinculación por código, opiniones, eventos viales, tour guiado, rediseño landing |
| ⚪ | **Chores** | 0,1h | 0,3% | .gitignore opencode.exe |
| 🔵 | **RBAC / Fase 0** | 1,3h | 4,1% | Roles/permisos, vehículos manuales, /telemetry/manual |
| 🟤 | **Docs & Operación** | 2,5h | 8,0% | MANUAL-DE-USO, guías, este Gantt, túnel/backend |

**TOTAL: 31,4 horas**

---

## 📋 Historial Completo de Commits (51)

### 🟦 2026-09-17 — Inicio real del proyecto (4,0h)
| Hora | Commit | Tarea |
|---|---|---|
| 09:29 | `e9c6786` | **EcoDrive: plataforma de telemetría y mantenimiento predictivo** (commit inicial) |

### 🩵🟩 2026-09-27 — Deploy + Robustez (2,7h)
| Hora | Commit | Tarea |
|---|---|---|
| 11:20 | `cb2c985` | Listo para despliegue: SSL en DB, credenciales por env, blueprint render.yaml |
| 11:26 | `0fa0b08` | Fix SSL: solo exigirlo con PGSSL=require (local sin SSL) |
| 12:48 | `37ccc12` | README completo del proyecto + .env.example |
| 13:24 | `56501b6` | Limpieza scripts + fix api_key al crear vehículo + ON DELETE CASCADE |
| 13:32 | `479fb6b` | Robustez calle: validación ECT/RPM, reintento PID, ATH0, desconexión BT |
| 13:39 | `ecc9a73` | Reenvío automático de cola offline al volver la señal |
| 14:01 | `fde52b9` | Soporte rural 3-6h: buffer 5000 lecturas + POST telemetry/lote |

### 🟨 2026-09-28 — App Android + Panel + Landing + GPS (9,0h)
| Hora | Commit | Tarea |
|---|---|---|
| 07:37 | `90d9be3` | App Android reescrita: vehículo real, init ELM327, buffer SQLite offline |
| 07:48 | `a5c4a4d` | Panel admin redisenado: KPIs en vivo, tema premium responsive |
| 07:54 | `4d1004d` | Navegación cruzada: panel ↔ app dispositivo |
| 11:46 | `3104e07` | Android: repos para dependencias + limpieza de build |
| 15:20 | `d9386e3` | Servir APK públicamente en /apk + botón descargar |
| 15:30 | `546ddeb` | Fix registro vehículo: columnas anio/combustible/tipo_vehiculo |
| 15:56 | `70b0665` | Mejora visual: gráfica ECT en vivo, medidores gauge, KPIs, toasts |
| 16:49 | `6e0642d` | Nivel de combustible en tiempo real + módulo mantenimiento |
| 16:59 | `76e00db` | Mapa GPS en vivo: Leaflet con marcadores por ECT |
| 17:07 | `7a068df` | Landing comercial estilo Samsara: precios, FAQ, /panel |
| 17:40 | `53a359c` | Fix modal panel (ubicación antes de app.js) |
| 17:56 | `780a346` | API key formato ECDV-XXXX-XXXX-XXXX + modal |
| 18:22 | `e6c1416` | Demo en vivo, salud por vehículo, exportación de informes |

### 🟧 2026-09-29 — Mantenimiento + QR (2,0h)
| Hora | Commit | Tarea |
|---|---|---|
| 22:00 | `0d3201e` | Módulo mantenimiento completo (historial, próximo, intervalo/manual) |
| 22:57 | `6e1278f` | Modal mantenimiento estilo Samsara/Motive (timeline, KPIs) |
| 23:15 | `4a11912` | Mantenimiento sin scroll lateral, secciones en tarjetas |
| 23:27 | `5ea67d3` | Flota: columna única con botón gradiente por urgencia |
| 23:35 | `84815e3` | Flota como tarjetas responsive |
| 23:53 | `263c66b` | Vinculación por QR (placa + API key) |

### 🟪 2026-09-30 — Fases de producción (0,5h)
| Hora | Commit | Tarea |
|---|---|---|
| 00:08 | `31b6c0f` | **Fase 1:** índices DB, retención/purga telemetría, límite de caudal |
| 00:15 | `020d70a` | **Fase 2:** health real con DB, backoff exponencial, backups pg_dump |
| 00:21 | `32562f7` | **Fase 3:** CSP/HSTS, anti fuerza bruta, límites JSON, errores sin fuga |
| 00:23 | `059dcd5` | Docs: APK guardado para Play Store |

### 🔴 2026-10-01 — Doble jornada, features de usuario (9,3h)
**☀️ Sesión 1 (07:14 → 12:44):**
| Hora | Commit | Tarea |
|---|---|---|
| 07:14 | `6a073c7` | Alertas térmicas locales (sonido, vibración, banner ECT 95/105) + resumen de jornada |
| 10:02 | `3f92b8e` | CTA "Pruébalo gratis", sección Opiniones, guía de pruebas sin ELM327 |
| 10:02 | `59a5256` | Docs: historial opiniones + guía |
| 12:44 | `b7ee258` | Código corto de 6 caracteres + QR, fix CSP bloqueaba Leaflet |

**🌙 Sesión 2 (18:36 → 22:24):**
| Hora | Commit | Tarea |
|---|---|---|
| 18:36 | `0e517ab` | Rediseño landing estilo Samsara (banner, hero, testimonios, WhatsApp) |
| 18:42 | `3e4bec5` | Fix fondo formulario "Pruébalo gratis" |
| 18:48 | `4cd1213` | Foto industrial sección prueba gratis |
| 18:51 | `fa0dd08` | Fondo fotográfico sutil para toda la página |
| 18:52 | `5220076` | Fondo página con `<img>` en vez de CSS |
| 18:57 | `6f2bf29` | Nuevo fondo (fondo-pagina.jpg, opacidad 0.58) |
| 19:02 | `8879188` | Parallax suave + viñetado (respeta reduced-motion) |
| 19:10 | `ed7256a` | Tour guiado estilo Samsara/Navattic en panel y app |
| 19:31 | `2898892` | Dispositivo: WhatsApp + sección opiniones |
| 19:51 | `710f9d3` | Sistema real de opiniones (API + moderación + landing) |
| 22:03 | `106e5c8` | Eventos viales (app conductor + mapa panel + tabla) |
| 22:12 | `168581d` | Agrupación de eventos cercanos (<60 m) |
| 22:24 | `7980865` | Tour actualizado + auto-mostrado solo 1ª visita |

### ⚪ 2026-10-04 — Chores (0,1h)
| Hora | Commit | Tarea |
|---|---|---|
| 17:24 | `7d51c5e` | Ignorar opencode.exe (.gitignore, binario >100MB) |

### 🔵 2026-10-07 — Fase 0 (1,3h)
| Hora | Commit | Tarea |
|---|---|---|
| 22:16 | `8bfd75a` | RBAC inicial + vehículos no compatibles (tipo_conexion/manual) + POST /telemetry/manual |

### 🟤 2026-10-08 — Documentación y operación (2,5h)
| Hora | Commit | Tarea |
|---|---|---|
| 08:24 | `3df0d7b` | Diagrama de Gantt con tiempos por horas |
| — | *(sin commit)* | MANUAL-DE-USO.md, fix eco_start.bat, tarea schtasks, túnel Cloudflare, limpieza placas de prueba, este Gantt completado |

---

## 📈 Distribución por Fecha

| Fecha | Horas | % | Commits | Intensidad |
|---|---|---|---|---|
| **2026-09-17** | 4,0h | 12,7% | 1 | ██░░░░░░░░ |
| **2026-09-27** | 2,7h | 8,6% | 7 | ██░░░░░░░░ |
| **2026-09-28** | 9,0h | 28,7% | 13 | ██████░░░░ |
| **2026-09-29** | 2,0h | 6,4% | 6 | █░░░░░░░░░ |
| **2026-09-30** | 0,5h | 1,6% | 4 | ░░░░░░░░░░ |
| **2026-10-01** | 9,3h | 29,6% | 17 | ██████░░░░ |
| **2026-10-04** | 0,1h | 0,3% | 1 | ░░░░░░░░░░ |
| **2026-10-07** | 1,3h | 4,1% | 1 | █░░░░░░░░░ |
| **2026-10-08** | 2,5h | 8,0% | 1+ | ██░░░░░░░░ |

---

## 🧭 Línea de Tiempo Visual

```
SEPTIEMBRE                                    OCTUBRE
17        27    28    29  30  01      04  07  08
 │         │     │     │   │   │       │   │   │
 ▼         ▼     ▼     ▼   ▼   ▼       ▼   ▼   ▼
🟦         🩵🟩  🟨    🟧  🟪  🔴      ⚪  🔵  🟤
4,0h      2,7h  9,0h  2,0 0,5  9,3h    0,1 1,3  2,5
 │         │     │     │   │   │       │   │   │
 │         │     │     │   │   │       │   │   └─ Docs + operación
 │         │     │     │   │   │       │   └──── RBAC Fase 0
 │         │     │     │   │   │       └──────── Chore
 │         │     │     │   │   └──────────────── Doble jornada (17 commits)
 │         │     │     │   └──────────────────── Seguridad/producción
 │         │     │     └──────────────────────── Mantenimiento + QR
 │         │     └────────────────────────────── App+Panel+Landing+GPS
 │         └──────────────────────────────────── Deploy + Robustez
 └────────────────────────────────────────────── Inicio del proyecto
```

---

## 💡 Interpretación

- **Inicio real: 17/09/2026** — 14 días antes de lo que registraba la versión anterior del archivo.
- **Días pico:** 01/10 (9,3h / 17 commits) y 28/09 (9,0h / 13 commits) concentran el **58%** del trabajo.
- **58% del esfuerzo** fue funcionalidad visible para el usuario (🟨 App/Panel/Landing + 🔴 Features UX = 18,3h de 31,4h).
- **Solo 1,6%** se dedicó a producción/seguridad (🟪) — área candidata a reforzar.
- El proyecto avanzó en **2 grandes bloques**: construcción funcional (17/09–01/10, ~29,5h) y luego mantenimiento/documentación (04/10–08/10, ~3,9h).
