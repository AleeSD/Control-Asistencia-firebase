# Corrección de aprobación — 30/10/2026

La solicitud reportada correspondía a una persona activa con ocupación MONITOREO ya existente en el padrón. La versión publicada de las reglas coincidía con el archivo local: el rechazo no se debía a falta de publicación. `personnelOK` solo aceptaba conductores y auxiliares, incluso al actualizar exclusivamente la aprobación de esa persona.

Se permite conservar MONITOREO durante actualizaciones de documentos que ya tenían esa ocupación. Las nuevas altas y reclasificaciones a MONITOREO siguen restringidas; se conservan las comprobaciones de encargado, auditoría, solicitud pendiente y coherencia de las vistas para DNI. El mensaje genérico de permisos ya no afirma que faltan reglas por publicar.

Se reprodujo el fallo en el emulador antes del cambio. Después pasaron 26 pruebas de reglas y gestión, incluida aprobación y revocación del personal de Monitoreo existente. Compilación TypeScript/Vite correcta. Reglas y Hosting publicados correctamente; evidencia en `tmp/approval-before-fix.log`, `tmp/approval-after-fix.log` y `tmp/approval-fix-deploy.log`.

La investigación consultó únicamente los campos necesarios y la versión de reglas. La corrección no ejecuta aprobaciones, migraciones ni cambios en cuentas, solicitudes o asistencias de producción. El encargado puede aprobar la misma solicitud desde el panel tras actualizar la página.

No se agregaron lecturas de documentos ni escrituras al flujo normal: la excepción compara la ocupación del documento ya evaluado por las reglas.
