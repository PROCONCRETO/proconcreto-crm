# Módulo: Autenticación

## Archivos

- `js/auth.js` (76 líneas)

## Cómo funciona

Supabase Auth con email/contraseña: login, recuperación de contraseña por link, cambio de contraseña. Un solo nivel de acceso — cualquier cuenta autenticada ve todos los módulos.

Los usuarios del equipo (nombre, cargo, celular) están hardcodeados en `USUARIOS_CRM` dentro de `js/config.js` — es solo para mostrar el nombre/cargo del vendedor en la cotización, no controla permisos.

## Pendiente de definir

- ¿Se necesitan roles/permisos diferenciados (p. ej. calidad no debería poder editar cotizaciones)?
