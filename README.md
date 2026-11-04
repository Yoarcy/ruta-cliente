# Ruta Cliente

Ruta Cliente es una app PWA/Android para organizar entregas desde archivos Excel, buscar clientes y preparar rutas de trabajo.

## Funciones principales

- Importar uno o varios archivos Excel.
- Combinar hojas y archivos diferentes en una sola vista de trabajo.
- Filtrar por municipios usando selector/autocompletado.
- Buscar clientes guardados por nombre o teléfono.
- Buscar entregas del Excel por nombre, factura o número de orden.
- Guardar clientes seleccionados en Supabase con campos mínimos:
  - `id`
  - `nombre_completo`
  - `telefono`
  - `descripcion`
  - `latitud`
  - `longitud`
- Guardar estado local en el dispositivo con `localStorage`.
- Conservar envíos pendientes sin conexión y reintentarlos al recuperar Internet.
- Sincronizar la caché del teléfono con Supabase sin borrar operaciones pendientes.
- Mensaje global con contador aproximado de segmentos SMS.
- Instalación como PWA y compilación Android con Capacitor.

## Versión actual

Versión actual: **v34**.

Cambios principales desde v31:

- v32: persistencia de municipios y cola offline durable.
- v34: campo `telefono`, búsqueda por nombre/teléfono y sincronización completa con Supabase.

Los detalles de verificación están en `V32-CAMBIOS.md` y `V34-CAMBIOS.md`.

## Desarrollo

```bash
npm install
npm run prepare:www
```

Para sincronizar Android:

```bash
npm run cap:sync
```

Para compilar APK release, usar Android Studio/Gradle desde la carpeta `android`.

## Configuración de Supabase

La app usa una clave publishable/anon para conectar con Supabase desde cliente. Asegúrate de tener reglas RLS/políticas correctas en tu proyecto antes de usarla en producción.

El archivo `supabase_clientes_telefono_v34.sql` migra la columna antigua `identidad` a `telefono`. Debe ejecutarse una sola vez en Supabase SQL Editor antes de usar v34 contra una tabla antigua.

## Nota

Este repositorio público contiene la copia limpia del estado final de Ruta Cliente. Las notas internas de trabajo, rutas locales y backups no forman parte del repositorio público.
