# ADR-0001: Mantener el stack actual (HTML/CSS/JS vanilla + Supabase)

- **Fecha:** 2026-07-15
- **Estado:** Aceptado (es el estado de hecho del proyecto, no una elección nueva)

## Contexto

`proconcreto-crm` ya es una aplicación real en uso, con ~8,150 líneas de código repartidas en un HTML monolítico y 13 módulos JS vanilla, backend en Supabase, publicada en GitHub Pages. No tiene build step ni framework.

Antes de conocer el estado real de este proyecto se había propuesto (por error, sin contexto suficiente) migrar a un monorepo Next.js + NestJS + Prisma. Esa propuesta no aplica aquí.

## Decisión

Se continúa sobre el stack existente. No se reescribe el frontend a un framework ni se introduce build step por ahora. Los cambios se hacen módulo por módulo sobre el código actual.

## Consecuencias

- Sin curva de aprendizaje de un framework nuevo ni infraestructura de build/deploy que mantener.
- El HTML monolítico y la falta de tests siguen siendo deuda técnica a vigilar (ver [docs/01-arquitectura-tecnica.md](../01-arquitectura-tecnica.md)).
- Si en el futuro se decide migrar a un stack moderno, esa decisión se documentará en un ADR nuevo (ADR-0002 en adelante) en vez de sobre este.
