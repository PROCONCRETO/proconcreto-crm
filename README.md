# Pro Concreto — CRM/ERP interno

Aplicación web interna de Pro Concreto: cotizaciones, producción, calidad de mezclas, logística y catálogo de productos.

- **En vivo:** https://proconcreto.github.io/proconcreto-crm/cotizaciones.html
- **Dev local:** `powershell -ExecutionPolicy Bypass -File serve.ps1` (sirve en `http://localhost:8080`) — o F5 en VS Code con la configuración en `.claude/launch.json`.

## Documentación

- [Visión general](docs/00-vision-general.md)
- [Arquitectura técnica](docs/01-arquitectura-tecnica.md)
- [Módulos](docs/modulos/)
- [Decisiones de arquitectura (ADRs)](docs/decisiones/)

## Metodología de construcción

Este proyecto se construye usando la arquitectura de agente de 3 capas descrita en [CLAUDE.md](CLAUDE.md) (también replicada en AGENTS.md y GEMINI.md).

## Estructura

```
cotizaciones.html   → única pantalla HTML, carga todos los módulos JS
css/                → estilos
js/                 → módulos de la aplicación (cotizador, producción, calidad, logística, catálogo, auth)
docs/               → documentación funcional y técnica
directives/         → SOPs del agente (capa 1)
execution/          → scripts Python del agente (capa 3) — no forman parte del producto
serve.ps1           → servidor local de desarrollo
```
