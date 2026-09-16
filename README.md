# Ruta Cliente

Ruta Cliente es una app PWA/Android para organizar entregas desde archivos Excel, buscar clientes y preparar rutas de trabajo.

## Funciones principales

- Importar uno o varios archivos Excel.
- Combinar hojas y archivos diferentes en una sola vista de trabajo.
- Filtrar por municipios usando selector/autocompletado.
- Buscar por nombre, factura o número de orden.
- Guardar clientes seleccionados en Supabase con campos mínimos:
  - `id`
  - `nombre_completo`
  - `telefono`
  - `descripcion`
  - `latitud`
  - `longitud`
- Guardar estado local en el dispositivo con `localStorage`.
- Mensaje global con contador aproximado de segmentos SMS.
- Instalación como PWA y compilación Android con Capacitor.

## Versión actual

Estado público inicial: **v31**.

APK de referencia: `ruta-cliente-release-v31-icon-4.apk` publicado en Releases.

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

El archivo SQL incluido `supabase_clientes_campos_minimos_v19.sql` documenta la estructura mínima esperada de la tabla `clientes`.

## Nota

Este repositorio público contiene la copia limpia del estado final de Ruta Cliente. Las notas internas de trabajo, rutas locales y backups no forman parte del repositorio público.
