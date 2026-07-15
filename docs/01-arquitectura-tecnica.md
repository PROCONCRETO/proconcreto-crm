# Arquitectura Técnica (estado real, 2026-07-15)

## Stack

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | HTML + CSS + JavaScript vanilla, sin framework ni build step | Todo cuelga de un único `cotizaciones.html` (~1,500 líneas) que carga 13 archivos JS por `<script src>` con cache-busting manual (`?v=YYYYMMDDx`) |
| Backend | [Supabase](https://supabase.com) (Postgres + Auth + Realtime), cliente cargado por CDN | No hay servidor de aplicación propio |
| Hosting | GitHub Pages, repo `proconcreto/proconcreto-crm`, rama `main` | Sitio estático — Pages sirve directo lo que hay en el repo |
| Librerías de terceros (CDN) | Chart.js, jsPDF, html2canvas, SheetJS (xlsx.js) | Gráficos, generación de PDF de cotizaciones/certificados, e importación/exportación de Excel |
| Dev local | `serve.ps1` (servidor HTTP casero en PowerShell, puerto 8080) | Sirve los estáticos y expone `POST /guardar-cotizacion` para respaldar cotizaciones como JSON en `cotizaciones-guardadas/` (local, fuera del repo) |

## Cómo se guardan los datos en Supabase

Patrón consistente en casi todas las tablas: **una columna JSONB `datos`** con el objeto completo, más metadatos mínimos (`estado`, `creado`). Es decir, no hay un esquema relacional normalizado por campo — agregar un campo nuevo a una entidad es agregarlo al objeto JS y ya, sin migración de base de datos.

Tablas identificadas en el código (`js/datos-realtime.js` es el punto central que las carga todas al abrir la app):

| Tabla | Módulo(s) que la usan |
|---|---|
| `cotizaciones` | `cotizador.js`, `historico-clientes-stats.js` |
| `clientes` | `cotizador.js`, `historico-clientes-stats.js` |
| `ordenes_servicio` | `ordenes-produccion.js`, `historico-clientes-stats.js` |
| `producciones` | `produccion-diaria.js` |
| `productos` | `catalogo.js` |
| `disenos_mezcla` | `calidad-mezclas.js` |
| `ensayos_calidad` | `calidad-mezclas.js` |
| `materia_prima` | `calidad-trazabilidad.js` |
| `no_conformidades` | `calidad-trazabilidad.js` |
| `ajustes_mezcla` | `calidad-ajuste-mezcla.js` |
| `entregas_programadas` | `logistica.js` |

## Autenticación

Supabase Auth con email/contraseña (`js/auth.js`): login, recuperación de contraseña por email, cambio de contraseña. Los usuarios del equipo y su rol/cargo (solo informativo, no de permisos) están hardcodeados en `USUARIOS_CRM` dentro de `js/config.js`. No hay control de acceso diferenciado por rol todavía — cualquier cuenta autenticada ve todos los módulos.

## Por qué seguir así por ahora

Es el stack que ya está en producción, sin deuda de infraestructura (sin servidor que mantener, sin build) y le ha funcionado a la operación. No se propone una reescritura salvo que el usuario decida migrar a un stack moderno (Next.js, etc.) — si eso se decide, se documentará como un ADR nuevo en [docs/decisiones/](decisiones/).

## Riesgos/deuda técnica observados (para decidir prioridad, no para actuar de una)

- **Sin roles/permisos.**
- **Datos sensibles en el repo público**: `js/config.js` incluye celulares personales del equipo y la key pública de Supabase (esta última es segura de exponer por diseño).
- **Un solo archivo HTML gigante** (~1,500 líneas) concentra todas las pantallas — dificulta mantenimiento a largo plazo.
- **Sin tests automatizados.**
