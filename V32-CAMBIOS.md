# Ruta Cliente v32 — municipios y guardado sin conexión

## Cambios
- Municipio se guarda al escribir, autocompletar, elegir, borrar y ocultar la app; se restaura incluso si el filtro quedó vacío. Se conserva la tabla Excel existente.
- Cola persistente compartida para clientes y Jamazon: el guardado local ocurre antes de solicitar la red. Pendientes visibles en el menú y botón «Enviar pendientes ahora».
- Reintento al abrir, volver a primer plano, recuperar conexión y cada 30 segundos mientras la app está visible. No se promete ejecución si Android cierra la app.
- UUID estable y upsert por id para reintentos; no se descarta una edición nueva mientras se envía la anterior. Los errores HTTP o de red conservan el pendiente.
- Búsqueda local inmediata, caché de resultados consultados en nube y prioridad de las coordenadas pendientes. La búsqueda no descarga toda la base: offline solo están disponibles los clientes guardados o consultados en este teléfono.
- Formulario de alta/edición restaurado: «Modificar» antes apuntaba a controles inexistentes. Entrada desde Buscar cliente.
- Mensaje de error si no se puede escribir el pendiente por falta de almacenamiento; no se anuncia un guardado exitoso.
- Se conserva la clave anterior de pendientes Jamazon. No se reenvían indiscriminadamente clientes locales antiguos: no se puede distinguir cuáles ya estaban sincronizados; si uno conserva datos sin enviar, abrir Modificar y Guardar lo incorpora a la cola.

## Verificación
- 8 pruebas automatizadas: `node --test tests/offline.test.js` (todas aprobadas).
- Chrome real con viewport móvil: guardar offline, recargar, restaurar Playa, buscar cliente y editar coordenadas; sin excepciones JavaScript.
- Build Windows/JBR `assembleRelease --offline`: correcto.
- APK comparada con fuentes: app.js e index.html incluidos coinciden byte por byte.
- Firma APK válida y mismo certificado que la APK v31. applicationId sin cambios; versionCode 32, versionName 32.0.
- No se hicieron escrituras de prueba en la base Supabase real. El envío se probó con respuestas simuladas (éxito, error y respuesta perdida). Pendiente validación en el teléfono del usuario y con sus permisos reales de base de datos.

## Instalación
Instalar `dist-apk/ruta-cliente-release-v32-offline-municipios.apk` sobre la app existente. No desinstalar ni borrar datos. Confirmar que aparece v32 en el panel rápido, cambiar a Playa, cerrar/reabrir y verificar. Guardar un cliente de prueba sin conexión, reabrir y comprobar pendientes; activar Internet y usar «Enviar pendientes ahora». Comprobar su presencia en la base real.

SHA-256: `dde87d653d7e88786d0be6fa2a811737de855c7fc54c24bb31f86792ecb68e63`.

Referencia de protocolo: [PostgREST: upsert](https://docs.postgrest.org/en/stable/references/api/tables_views.html#upsert). El servidor debe permitir insertar/actualizar; un rechazo conserva la cola.
