# Ruta Cliente v34 — teléfono y sincronización completa

## Cambios

- Supabase usa `telefono`; la app deja de escribir en `identidad`.
- Buscar cliente encuentra coincidencias por nombre o por teléfono.
- Al abrir, recuperar conexión, volver a primer plano o pulsar «Enviar pendientes ahora», la app primero envía la cola y después actualiza la caché local desde Supabase.
- Los registros eliminados en la nube desaparecen de la caché del teléfono en la siguiente sincronización.
- Los pendientes locales nunca se eliminan al refrescar desde la nube.

## Migración de Supabase

Ejecutar `supabase_clientes_telefono_v34.sql` una sola vez en SQL Editor. Copia los teléfonos existentes desde `identidad`, elimina la columna antigua y recarga el esquema de PostgREST.

## Instalación

Instalar v34 encima de la versión actual. No desinstalar ni borrar datos, porque la cola pendiente está en el almacenamiento de la app.

## Verificación

- 9 pruebas automatizadas aprobadas.
- APK `versionCode 34`, `versionName 34.0`.
- Firma válida y mismo certificado SHA-256 que v32/v33: `8c64a98ee499b611ee5bbe9496f71485cf46cd3b1919ca5ad5f4df9b9f6bf5fa`.
- `app.js` e `index.html` empaquetados coinciden byte por byte con las fuentes.
- SHA-256 de la APK: `d5a2945b618ba069eee036831f1e10df718b930fba5b2a4bf2c17aad2eae26e0`.
