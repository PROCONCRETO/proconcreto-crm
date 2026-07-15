# Visión General — Pro Concreto CRM

## Qué es esto

Aplicación web interna de **Pro Concreto** (planta de concreto premezclado, eje cafetero) que cubre el ciclo comercial y operativo de la empresa: cotización a clientes, producción, control de calidad de mezclas y logística de entregas. Ya está en uso real, publicada en GitHub Pages: https://proconcreto.github.io/proconcreto-crm/cotizaciones.html

Este no es un proyecto que arranca desde cero — es software existente que se va a seguir construyendo y ordenando de aquí en adelante con la metodología de agente descrita en [CLAUDE.md](../CLAUDE.md).

## Áreas cubiertas hoy

| Área | Pantallas / módulos existentes |
|---|---|
| Comercial / CRM | Cotizador, pipeline de cotizaciones, histórico de clientes y estadísticas, ficha de clientes |
| Producción | Órdenes de servicio, pipeline de producción, producción diaria |
| Calidad | Diseño de mezclas, ajuste de mezcla, control de ensayos, análisis estadístico, materia prima, trazabilidad, no conformidades, certificados de calidad |
| Logística | Calendario de entregas programadas |
| Catálogo | Productos (con importación desde Excel) |
| Cuenta | Autenticación (login, recuperación de contraseña) — un solo nivel de acceso para el equipo (`USUARIOS_CRM` en `js/config.js`) |

Ver detalle técnico de cada una en [docs/modulos/](modulos/).

## Lo que todavía no existe como módulo propio

- **Finanzas/presupuesto**: hoy las tarifas de transporte y precios viven como datos fijos en `js/config.js` y dentro del cotizador; no hay un módulo separado de rentabilidad, facturación o control de gastos.
- **Roles/permisos diferenciados**: todo usuario autenticado ve todo; no hay control de acceso por rol.
- **Inventario de materiales** más allá de `materia_prima` (control de calidad) — no hay control de stock/compras.

Estas son candidatas naturales para las próximas iteraciones, no vacíos accidentales — quedan para decidir prioridad con el usuario.

## Cómo se construye de aquí en adelante

Se usa la arquitectura de 3 capas (directivas / orquestación / ejecución) descrita en [CLAUDE.md](../CLAUDE.md) como metodología de trabajo. El producto en sí sigue siendo la aplicación estática (HTML/CSS/JS + Supabase) — ver [docs/01-arquitectura-tecnica.md](01-arquitectura-tecnica.md).
