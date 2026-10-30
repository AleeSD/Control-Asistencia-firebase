# Gestión de personal y continuidad de salidas — 30/10/2026

## Accesos existentes

Revisión de producción: 18 personas activas aprobadas, 18 coherentes y 0 inconsistencias entre padrón, perfil aprobado, directorio y panel por DNI. En el momento de la revisión: 15 con entrada y sin salida hoy, 1 con jornada completada y 2 sin entrada. La auditoría comprueba autorizaciones y proyecciones de todas; no se inició sesión individualmente como cada persona.

Se comprobó en Hosting una persona aprobada con entrada previa: ingresó solo con DNI en un contexto nuevo y apareció «Marcar salida». No se pulsó marcar. Se eliminaron exclusivamente la sesión y cuenta anónima temporales del piloto. Las pruebas de reglas también cubren entrada con sesión anterior y salida con otra sesión DNI.

## Cambios publicados

- Equipo permite elegir Conductor, Auxiliar, Coordinador y Monitoreo. Las reglas y la validación local aceptan las cuatro ocupaciones. La ocupación no concede permisos de encargado. El horario sigue siendo el que se configura en el formulario.
- «Eliminar del padrón» está siempre disponible en cada fila, separado de «Eliminar acceso». Muestra confirmación e informa sobre revocación e historial.
- La acción ejecuta baja, revocación y eliminación mediante las operaciones auditadas existentes. Cada etapa vuelve a comprobar el estado actual. Si alguna falla, se puede reintentar; una baja ya confirmada conserva el bloqueo de acceso. No se borran marcaciones, correcciones ni incidencias. Las reglas siguen impidiendo borrar directamente una persona activa/aprobada fuera de esta secuencia.
- La importación Excel conserva el filtro previo de conductores/auxiliares propios de OS/SLI; Coordinador y Monitoreo pueden agregarse manualmente desde Equipo.

Se eliminó únicamente la persona sin aprobación indicada por el usuario, comprobando DNI y nombre dentro de una transacción. Se retiraron su documento de padrón y las dos vistas auxiliares; se agregó auditoría administrativa. No se eliminaron cuentas ni registros de otras personas.

## Verificación

Compilación correcta, 27 pruebas de reglas/gestión aprobadas y prueba de navegador con Auth/Firestore emulados: acceso de encargado, ambas nuevas opciones, alta de coordinador y eliminación confirmada. Las pruebas de eliminación incluyen persona activa aprobada y activa sin aprobación, reintento y conservación de historial.

Inventario antes/después de la eliminación: padrón 44→43; perfiles 21→21; marcaciones 53→53; correcciones 5→5. Los hashes de los perfiles, marcaciones y correcciones existentes no cambiaron. El único documento de padrón retirado fue el solicitado. Evidencias sin datos personales en `tmp/management-audit-remove.json` y `tmp/management-audit-final.json`; referencia de integridad en `tmp/management-integrity-before.json`. Pruebas en `tmp/management-rules.log` y `tmp/management-ui.log`.

Reglas y Hosting publicados en la URL habitual https://sistema-de-asistencia-os.web.app. El encargado debe actualizar una vez la página para ver los nuevos botones y ocupaciones.

No se agregaron listeners ni consultas al ingreso cotidiano. El costo de baja/revocación/eliminación ocurre solo al usar esa acción administrativa.
