# Plataforma CIO 2032 (versión independiente)

Cuestionario The Future CIO - 2032, publicado como web estática con guardado automático en Supabase.

## Archivos
- `index.html`: la plataforma completa.
- `config.js`: dirección y clave pública (anon/publishable) de tu proyecto de Supabase.
- `shim.js`: capa de guardado (conexión con Supabase, acceso de administración, descargas).
- `supabase.sql`: script de base de datos. Se pega una vez en Supabase → SQL Editor → Run, tras sustituir `CAMBIA-ESTA-CLAVE` por tu clave de administración.

## Cómo funciona
- Cada persona tiene un identificador personal. Se genera solo la primera vez y va en su enlace (`?p=...`). Con ese enlace puede volver desde cualquier dispositivo.
- Las respuestas se guardan solas en el servidor. Si se corta la conexión, se reintenta.
- Panel del equipo: abre `tu-dominio/?admin`, introduce la clave de administración y entra en "Results Dashboard".
- Las tablas no son accesibles directamente: solo funciones que comprueban el token personal o la clave de administración.
- La clave de administración no debe guardarse en este repositorio.
