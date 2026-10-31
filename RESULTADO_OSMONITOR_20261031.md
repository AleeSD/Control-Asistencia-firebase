# Acceso OSMonitor — 31/10/2026

Nombre visible: OSMonitor. Cuenta autorizada: `superv.nac@oslogisticsperu.com`. Rol de plataforma: `monitor`, separado de `encargado`. Autorización preparada mediante invitación; el perfil se crea al primer ingreso Google verificado con esa dirección exacta. No se creó una cuenta de Google ni se estableció una contraseña. No se otorgaron permisos de consola Firebase/Google Cloud.

## Alcance autorizado

| Función | Monitor |
|---|---|
| Ingreso directo a Marcaciones | Sí |
| Consultar marcas, fechas, servicios y ubicación | Sí |
| Aprobar/rechazar solicitudes de acceso de personal ya existente y activo | Sí |
| Consultar equipo y su estado | Sí |
| Consultar y aprobar/rechazar correcciones de incidencias | Sí, confirmado por el usuario |
| Consultar y exportar reportes diarios/mensuales | Sí |
| Inicio y Auditoría | Sin vistas; lectura de auditoría denegada en reglas |
| Agregar/importar/editar/bajar/eliminar personas | No |
| Revocar accesos aprobados o modificar horarios | No |
| Invitar otros usuarios/cambiar roles | No |
| Marcar asistencia propia desde el perfil Google Monitor | No; la asistencia por DNI sigue separada |

## Seguridad

Las reglas incorporan validación de cuenta Google verificada para soportar el correo corporativo. Esto no autoriza a cualquier cuenta Google: se exige perfil activo e identidad coincidente o una invitación explícita para crear el perfil. La invitación se vincula a su correo exacto, no a un nombre escrito libremente.

La aprobación por Monitor tiene un permiso específico: persona activa y sin aprobación, solicitud correspondiente, estado aprobado y resolución del mismo actor/hora, contactos de la solicitud y auditoría asociada. No permite modificar el resto de campos del padrón. Las proyecciones deben seguir reflejando los datos canónicos. No se reutiliza el permiso amplio del encargado para habilitar la aprobación.

La resolución de incidencias conserva restricciones de campos, vínculo con la solicitud, corrección inmutable y auditoría. Monitor puede escribir la auditoría de sus operaciones autorizadas, pero no consultarla. No puede leer identidades privadas ni listar perfiles de encargados; la consulta de perfiles para reportes se limita a trabajadores.

El encargado actual mantiene sus permisos. Las restricciones existen tanto en interfaz como en reglas; no dependen de ocultar botones.

## Validación y publicación

- Compilación TypeScript/Vite correcta.
- 33 pruebas de reglas y gestión aprobadas, incluidas tres del nuevo rol: invitación/alta Google corporativa, aprobación/rechazo, restricciones de padrón y roles, correcciones, lectura de reportes y bloqueo de auditoría/identidades privadas.
- 11 pruebas de reportes y filtros aprobadas.
- Navegador con Auth/Firestore emulados: creación del perfil desde invitación corporativa, entrada directa a Marcaciones, ausencia de Inicio/Auditoría y botones de gestión de padrón, aprobación de trabajador, resolución de incidencia, Excel y cierre de sesión.
- Regresión de navegador del trabajador y del encargado: DNI, servicio, entrada/salida GPS, aprobación, baja y reportes por servicio.

Al desarrollar las pruebas se ajustó el permiso específico de aprobación para mantenerlo dentro del presupuesto de evaluación de reglas; no se ampliaron los permisos generales de edición del padrón al Monitor.

Reglas y Hosting publicados. Invitación exacta creada transaccionalmente con auditoría administrativa. No se activó ninguna aprobación de trabajador. Se conservaron 46 documentos del padrón, 23 perfiles existentes, 23 solicitudes, 84 marcas y 5 correcciones: cero documentos originales modificados/ausentes en la comparación canónica. El perfil adicional del Monitor aparecerá después de su primer ingreso.

Evidencias: `tests/monitor.rules.test.mjs`, `tmp/monitor-role-tests.log`, `tmp/monitor-ui-tests.log`, `tmp/monitor-role-deploy.log`, `tmp/monitor-rules-final-deploy.log`, `tmp/monitor-access-final.json` y `tmp/monitor-access-integrity-before.json`. Captura con datos ficticios: `tmp/monitor-equipo.png`.

## Cómo ingresar

1. Abrir https://sistema-de-asistencia-os.web.app y actualizar si había una pestaña antigua.
2. Pulsar Acceso del encargado.
3. Seleccionar la cuenta Google/Workspace `superv.nac@oslogisticsperu.com`.
4. Se mostrará OSMonitor y abrirá Marcaciones.

Si Google no reconoce esa dirección, la existencia del buzón corporativo no basta: se necesita una cuenta Google/Workspace con esa dirección. La invitación de la plataforma queda preparada, pero esta tarea no verifica ni crea credenciales externas.
