# OSMonitor: ingreso sin cuenta de Google

Publicado el 31/10/2026 en https://sistema-de-asistencia-os.web.app.

## Primer ingreso

1. Abrir https://sistema-de-asistencia-os.web.app/?login=monitor o pulsar «Acceso OSMonitor con contraseña» en el ingreso principal.
2. Dejar el usuario **OSMonitor** y pulsar **Crear o recuperar contraseña**.
3. Abrir el enlace recibido en **superv.nac@oslogisticsperu.com**; revisar también Correo no deseado. Elegir una contraseña propia para esta plataforma, independiente de la del buzón.
4. Volver al ingreso y usar OSMonitor y la contraseña elegida. También se admite escribir el correo corporativo como usuario.

No es necesaria una cuenta de Google. No se envió un correo durante la implementación: el envío se solicita con el botón. No se entrega una contraseña por chat. La contraseña inicial aleatoria se generó en memoria y no se guardó en los archivos del proyecto.

## Flujo y permisos

- Trabajador: DNI → servicio del día → entrada/salida con ubicación. Solicitud y aprobación inicial conservadas; aviso de DNI ajeno al padrón sin cambios.
- Encargado: botón directo → Google → panel completo. Cancelar la ventana permite continuar desde el mismo ingreso.
- OSMonitor: formulario único → Marcaciones. Acceso a Marcaciones, Equipo de consulta y aprobación de solicitudes, Incidencias con aprobación/rechazo de correcciones y Reportes con exportación.
- Sin Inicio, Auditoría, altas/importaciones/ediciones/bajas/eliminaciones del padrón, retiro de accesos ni gestión de roles para OSMonitor. Las reglas comprueban estos límites también fuera de la interfaz.
- Volver al ingreso y cerrar sesión no muestran los antiguos selectores «Soy trabajador / Soy encargado». Los avisos del acceso del encargado se limpian al cambiar a OSMonitor o cambiar la sesión. El enlace directo también funciona si queda una sesión anónima antigua.

## Implementación y seguridad

Se habilitó correo/contraseña en Firebase Authentication y se creó únicamente la cuenta autorizada, con perfil de rol `monitor` y `authMethod: password`. Google y acceso anónimo siguen habilitados. No hay formulario público de alta de encargados o monitores.

Una cuenta de contraseña no puede apropiarse de la invitación de Google ni crear su propio perfil de monitor. El acceso operativo requiere perfil previamente provisionado, activo y con correo coincidente. Una cuenta de contraseña con rol encargado, sin la autorización explícita de método o con otro correo no recibe acceso operativo. Las marcaciones originales siguen inmutables y las correcciones siguen auditadas.

Archivos principales: `src/MonitorLogin.tsx`, `src/App.tsx`, `src/WorkerPortal.tsx`, `src/actions.ts`, `firestore.rules`. No se añadieron dependencias ni un backend de pago.

## Validación

- Compilación de TypeScript y Vite correcta. Persiste el aviso existente de tamaño de algunos paquetes de producción.
- **37 pruebas de reglas y 11 pruebas de reportes/filtros: 48 aprobadas.** Incluyen monitor por Google y contraseña, restricciones, aprobación/rechazo, correcciones y regresiones de DNI/encargado.
- Navegador con Authentication y Firestore locales: creación/recuperación de contraseña por enlace, contraseña errónea, usuario o correo, regreso, enlace directo, recarga con sesión, cierre de sesión, aprobación, resolución y exportación de OSMonitor.
- Regresión en navegador: monitor Google; trabajador con DNI no reconocido, aprobación, cambio de celular/recarga, entrada/salida con GPS, servicio y baja; encargado con apertura/cancelación de Google, gestión de padrón, filtros y exportaciones Excel/PDF.
- Producción: HTTP 200; HTML coincide con la compilación publicada; formulario móvil, ingreso principal, regreso y enlace directo sin excepciones de página. No se probó el envío real de correo ni un inicio de sesión real con una contraseña del usuario; esos pasos quedan bajo su control.
- Integridad por hashes contra el estado previo: **0 documentos existentes modificados o ausentes** en personal, perfiles, solicitudes, marcaciones y correcciones. Se mantienen 46 personas, 23 solicitudes, 84 marcaciones y 5 correcciones; perfiles pasan de 23 a 24 por el nuevo OSMonitor. Se creó además el registro de auditoría del alta de la cuenta.

Evidencias: `tmp/monitor-password-rules.log`, `tmp/monitor-password-ui-final.log`, `tmp/monitor-password-build.log`, `tmp/monitor-password-deploy.log`, `tmp/monitor-password-final.json`, `tmp/osmonitor-password-mobile.png`. Los ensayos de recuperación de contraseña fueron exclusivamente en el emulador; sus enlaces de prueba no sirven en producción. Se conserva `tmp/optimization-baseline.json`.

Referencias técnicas: [Firebase: acceso con contraseña](https://firebase.google.com/docs/auth/web/password-auth), [administración de cuentas](https://firebase.google.com/docs/auth/admin/manage-users).
