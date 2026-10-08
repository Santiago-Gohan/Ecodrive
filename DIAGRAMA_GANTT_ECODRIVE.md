# Diagrama de Gantt - Proyecto EcoDrive

## Resumen Ejecutivo
- **Fecha inicio:** 2026-10-01
- **Fecha fin (último avance):** 2026-10-07  
- **Duración total estimada:** 9,75 horas (~1,2 jornadas de 8h)
- **Total commits analizados:** 15
- **Tareas principales:** Rediseño landing, sistema de opiniones, eventos viales, tour guiado, RBAC/Fase 0

## Cronograma Detallado

| Fecha | Commit | Tarea | Horas | Categoría |
|---|---|---|---|---|
| 2026-10-01 | 0e517ab | Rediseño landing estilo Samsara | 2.00h | UI/Landing |
| 2026-10-01 | 3e4bec5 | Fix fondo formulario 'Pruébalo gratis' | 0.25h | UI/Landing |
| 2026-10-01 | 4cd1213 | Foto industrial sección prueba gratis | 0.15h | UI/Landing |
| 2026-10-01 | fa0dd08 | Fondo fotográfico sutil página | 0.25h | UI/Landing |
| 2026-10-01 | 5220076 | Fondo página con <img> | 0.15h | UI/Landing |
| 2026-10-01 | 6f2bf29 | Nuevo fondo página (fondo-pagina.jpg) | 0.15h | UI/Landing |
| 2026-10-01 | 8879188 | Parallax suave + viñetado | 0.30h | UI/Landing |
| 2026-10-01 | ed7256a | Tour guiado (panel + dispositivo) | 1.25h | Tour/UX |
| 2026-10-01 | 2898892 | Dispositivo: WhatsApp + sección opiniones | 0.50h | Opiniones |
| 2026-10-01 | 710f9d3 | Sistema real de opiniones (API + panel + landing) | 1.50h | Opiniones |
| 2026-10-01 | 106e5c8 | Eventos viales (backend + app + panel) | 1.00h | Eventos |
| 2026-10-01 | 168581d | Agrupación de eventos cercanos (<60m) | 0.40h | Eventos |
| 2026-10-01 | 7980865 | Tour actualizado + auto 1ª visita | 0.50h | Tour/UX |
| 2026-10-04 | 7d51c5e | Ignorar opencode.exe (.gitignore) | 0.10h | Chore |
| 2026-10-07 | 8bfd75a | Fase 0: RBAC + vehículos no compatibles + /telemetry/manual | 1.25h | RBAC/Backend |

**TOTAL: 9,75 horas**

## Desglose por Categoría

| Categoría | Horas | % | Descripción |
|---|---|---|---|
| **UI/Landing** | 3.25h | 33.3% | Rediseño visual, fondos, parallax, formulario |
| **Tour/UX** | 1.75h | 17.9% | Tour guiado + auto-mostrado solo primera visita |
| **Opiniones** | 2.00h | 20.5% | Sistema completo (envío → moderación → publicación) |
| **Eventos** | 1.40h | 14.4% | Reportes viales + agrupamiento para evitar solapados |
| **RBAC/Backend** | 1.25h | 12.8% | Roles/permisos, vehículos no-OBD, endpoint manual |
| **Chore** | 0.10h | 1.0% | Mantenimiento repo (.gitignore) |

## Distribución por Fecha

| Fecha | Horas | Tareas |
|---|---|---|
| **2026-10-01** | 8.40h | 13 tareas (mayor bloque: landing + tour + opiniones + eventos) |
| **2026-10-04** | 0.10h | 1 tarea |
| **2026-10-07** | 1.25h | 1 tarea (Fase 0 - RBAC) |

## Línea Temporal Simplificada (Gantt)

```
2026-10-01
├── UI/Landing (3.25h) ████████████████░░░
├── Tour/UX (1.75h)    ███████░░░░░░░░░░░░░
├── Opiniones (2.00h)  ██████████░░░░░░░░░░
└── Eventos (1.40h)    ███████░░░░░░░░░░░░░

2026-10-04
└── Chore (0.10h)      ░

2026-10-07
└── RBAC/Backend (1.25h) ███████░░░░░░░░░░░░░
```

**Interpretación:** El 86% del trabajo se concentró el **01/10/2026** (8.40h), enfocando ese día en las funcionalidades visibles (landing, opiniones, eventos, tour). Los días siguientes fueron ajustes menores (gitignore) y el inicio de la **Fase 0** con RBAC y soporte a vehículos sin OBD.