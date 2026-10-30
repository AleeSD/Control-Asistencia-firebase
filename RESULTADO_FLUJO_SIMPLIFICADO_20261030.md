# Flujo simplificado — 30/10/2026

Publicado en https://sistema-de-asistencia-os.web.app. Comprobación pública HTTP 200 y HTML coincidente con la compilación local. Evidencia de despliegue: `tmp/flow-deploy.log`.

## Recorridos

- Trabajador: URL habitual → DNI → panel de entrada/salida. Primera vez: DNI → datos → espera → panel automático cuando el encargado aprueba. Si falla la comprobación, «Comprobar acceso» permite reintentar. Salir devuelve al DNI.
- Encargado: «Acceso del encargado» abre Google directamente. La cuenta aprobada accede al panel; una sesión Google vigente vuelve directamente al panel al abrir la página. Cerrar sesión devuelve al DNI.
- Si se cierra o bloquea la ventana de Google, el mensaje aparece en el mismo ingreso para reintentar. La lectura del perfil tiene pantalla de carga, sin anunciar acceso pendiente antes de terminar.
- Al cambiar de cuenta se reinician vista, menú móvil, diálogos y avisos. Durante el ingreso Google o una operación del trabajador se bloquean acciones que podrían iniciar otro flujo simultáneo.

Se retiró la portada antigua con «Soy trabajador» y el segundo botón de acceso Google. Inicio, Marcaciones, Incidencias, Equipo, Reportes y Auditoría mantienen acceso directo desde el menú.

## Validación

Pruebas de navegador con Firebase Auth y Firestore emulados:

- DNI inexistente, registro, aprobación automática, entrada y salida con GPS, recarga, otra sesión/dispositivo y baja.
- Botón del encargado abre autenticación sin portada intermedia; cancelación permite continuar.
- Sesión Google de encargado simulada, altas/ocupaciones, eliminación confirmada y navegación por las seis secciones.
- Descargas Excel y PDF por día y mes; cierre de sesión de regreso al DNI.

Evidencias: `tmp/test-flow-worker.mjs`, `tmp/test-flow-manager.mjs`, `tmp/flow-tests.log`. Las pruebas usan el emulador, sin introducir credenciales ni modificar cuentas reales. El contenido externo de Google y el GPS físico de diferentes móviles requieren comprobación en esos dispositivos. Compilación TypeScript/Vite y cinco pruebas de reportes correctas.

Se actualizó el chequeo de Hosting del seguimiento para reconocer el ingreso directo. No abre sesión ni marca asistencia.

## Datos y consumo

Cambios de aplicación y Hosting, sin migraciones ni publicación de reglas. Las aprobaciones y marcaciones existentes se conservan. No se agregaron listeners ni consultas a las secciones de monitoreo. La comprobación automática tras aprobación ejecuta una vez el ingreso que antes requería pulsar «Comprobar acceso».
