# Control de asistencia · O.S. Logistics

Aplicación web de asistencia para personal de OS y SLI, con ingreso del trabajador por DNI, aprobación inicial, servicio por marcación, ubicación obligatoria y monitoreo desde el panel administrativo.

**Documentación actualizada al 02/11/2026, horario de Lima.** Este README describe el funcionamiento vigente; los informes fechados conservan el contexto de cada implementación.

## Estado y acceso

| Elemento | Configuración |
| --- | --- |
| Sitio publicado | [sistema-de-asistencia-os.web.app](https://sistema-de-asistencia-os.web.app/) |
| Acceso directo a monitoreo | [Ingreso OSMonitor](https://sistema-de-asistencia-os.web.app/?login=monitor) |
| Proyecto Firebase | `sistema-de-asistencia-os` |
| Base de datos | Firestore `(default)`, Santiago: `southamerica-west1` |
| Arquitectura | Firebase Authentication + Firestore + Hosting, preparada para Spark |
| Frontend | React 19, TypeScript y Vite 8 |
| Exportación | ExcelJS; jsPDF y jsPDF-AutoTable |
| Desarrollo local | Windows, PowerShell y Node.js portable; sin permisos de administrador |

El despliegue vigente no utiliza Cloud Functions. La carpeta `functions/` conserva un prototipo histórico y herramientas de dependencias de mantenimiento; no es el backend del flujo publicado ni debe desplegarse para operar esta versión.

## Usuarios y permisos

| Función | Trabajador | Encargado | OSMonitor |
| --- | --- | --- | --- |
| Ingreso | DNI aprobado | Cuenta Google autorizada | Usuario y contraseña autorizados |
| Panel de marcación del trabajador | Propio, con DNI | Acceso separado mediante DNI | Acceso separado mediante DNI |
| Inicio y Auditoría administrativos | No | Sí | No |
| Consultar marcaciones y ubicación del equipo | No | Sí | Sí |
| Aprobar o rechazar solicitudes de acceso | No | Sí | Sí |
| Consultar padrón | No | Sí | Sí |
| Agregar, importar, editar, dar de baja o eliminar personal/accesos | No | Sí | No |
| Solicitar corrección de marcación propia | Sí | Sí, en su flujo autorizado | No desde el panel de monitor |
| Aprobar o rechazar correcciones de incidencias | No | Sí | Sí |
| Reportes diarios/mensuales y exportación | No | Sí | Sí |

Las restricciones también se comprueban en `firestore.rules`; ocultar un botón no es la autorización. El primer encargado conserva un vínculo privado de identidad en `privateIdentities`, que ningún cliente de la aplicación puede leer. No se documentan aquí direcciones personales ni credenciales.

### Trabajador: registro y aprobación inicial

1. Abrir el sitio desde el celular. Se muestra directamente **Ingresa tu DNI**; ya no existe el paso «Soy trabajador».
2. Escribir los ocho dígitos y tocar **Ingresar**.
3. Si el DNI está activo en el padrón y aún no tiene aprobación, completar nombres, apellidos y al menos un contacto: **celular o correo**. No se requiere Google, contraseña ni verificación de ese contacto.
4. Tocar **Enviar para aprobación** y comunicar la solicitud al coordinador o a Monitoreo. La pantalla muestra **Esperando aprobación**.
5. El encargado o monitor revisa **Equipo → Solicitudes de acceso**, compara identidad y padrón, y aprueba o rechaza con el flujo correspondiente. Si los nombres difieren, debe confirmar la identidad antes de marcar la casilla de revisión.
6. Al aprobarse, la pantalla puede avanzar automáticamente; también se puede pulsar **Comprobar acceso** o volver a ingresar con el DNI.

Un DNI que no figura muestra **DNI no registrado** e indica contactar al coordinador de la operación o Monitoreo; no crea una solicitud. Una persona inactiva recibe un aviso de acceso desactivado. Desde otro navegador puede existir una segunda solicitud pendiente: debe revisarse, no reasignarse una aprobación vigente.

### Trabajador: uso diario

**DNI → servicio que realiza → Marcar entrada / Marcar salida.**

- La aprobación pertenece a la persona: cambiar de celular, navegador o borrar datos locales **no exige otra aprobación**, mientras el acceso siga vigente.
- Cada apertura o recarga vuelve al DNI; una sesión técnica válida puede reutilizarse. Está separada de la sesión administrativa, usa `browserSessionPersistence`, queda vinculada a un solo DNI y vence a las **12 horas**. Salir cierra esa sesión.
- Elegir el servicio y tocar **Continuar**. El servicio no es fijo por trabajador; se puede usar **Cambiar servicio** antes de una nueva marcación.
- Al marcar se solicita la ubicación. Activar GPS y elegir **Permitir** y ubicación precisa cuando el navegador lo ofrezca. Si ya se concedió, el aviso puede no repetirse; si se rechazó, la aplicación indica cómo habilitarlo y reintentar.
- Sin ubicación o sin confirmación del servidor no hay una marcación confirmada. La web no puede activar por sí sola el GPS ni saltarse un permiso denegado; no es una aplicación nativa y el diálogo depende del navegador/teléfono.
- Esperar el aviso de registro correcto. La salida se habilita después de una entrada existente; después de ambas marcas se muestra **Jornada completada**.
- **¿Olvidaste una marcación?** permite solicitar una corrección con fecha, entrada/salida, hora propuesta y motivo. El encargado o monitor decide; el trabajador no edita la marca original.

### Encargado y OSMonitor

Los accesos administrativos aparecen en filas independientes debajo del formulario DNI. **Acceso del encargado** abre directamente Google; **Acceso OSMonitor con contraseña** abre un solo formulario, también disponible mediante `?login=monitor`. El monitor entra directamente a Marcaciones. Volver o cerrar sesión devuelve al ingreso sin los selectores antiguos ni ventanas intermedias repetidas.

En OSMonitor el usuario empieza vacío y se ingresa manualmente. **Crear o recuperar contraseña** requiere introducir el usuario y envía un enlace al buzón asociado a la cuenta autorizada; los avisos no muestran la dirección. La contraseña de esta plataforma es independiente de la del buzón y no exige una cuenta Google. No hay un formulario público de alta de monitores: la cuenta y el perfil activo `role: monitor`, `authMethod: password` deben provisionarse por administración autorizada. Las aprobaciones de trabajadores no otorgan este rol.

## Servicios, horarios y marcaciones

Servicios disponibles en [src/services.ts](src/services.ts): **SPSA HD, Transferencia, Refrigerado, MASS, Paquetería, Giddings y TPSA**. Se guardan en cada marca, no como una asignación permanente del padrón. Las marcas anteriores sin servicio conservan ese campo vacío. Los nombres históricos compatibles se normalizan al consultar, sin reescribir documentos originales.

- Fecha y visualización en `America/Lima` (UTC-05:00); `occurredAt` y fechas de auditoría usan hora del servidor.
- Conductores y auxiliares tienen como horario base **06:10**, tolerancia **0 minutos** y salida variable. Se respeta el horario particular que el encargado configure en Equipo; una salida fija permite mostrar antes/después/a horario.
- La tardanza se calcula **por minuto**, con el horario y tolerancia guardados en la marca. No se usa el segundo como precisión de cálculo ni se calculan pagos u horas extra.
- Una entrada y una salida por persona y día. El identificador actual es `{DNI}_{YYYY-MM-DD}_{entrada|salida}`; siguen siendo compatibles los registros antiguos identificados por usuario.
- Marca y auditoría se guardan juntas. Las reglas rechazan duplicados, modificaciones y borrados de marcas, fechas de cliente en lugar de servidor y ubicaciones mal formadas.
- **Registrado** sustituye prospectivamente a **Puntual** en entradas a tiempo desde el **30/10/2026 a las 08:50:29 de Lima**. Las anteriores mantienen su etiqueta histórica; no hubo una reclasificación masiva.
- Una incidencia aprobada crea `adjustments` separado. Las correcciones quedan auditadas y no reemplazan ni eliminan el original; la decisión incluye una nota.

No hay todavía turnos nocturnos, múltiples jornadas diarias, estados operativos de precarga/base, descansos/permisos automáticos ni seguimiento GPS continuo. El servicio es una categoría de asistencia, no esos estados futuros. Las coordenadas se capturan al marcar y se consultan mediante **Ver en Maps**.

## Equipo y padrón

El padrón puede crecer o reducirse. **Agregar persona** permite ocupaciones Conductor, Auxiliar, Coordinador y Monitoreo. El encargado administra empresa OS/SLI, nombres, DNI, ubicación de referencia, contactos, horario, tolerancia y estado. Ser Coordinador o Monitoreo en el padrón no concede permisos administrativos: esos dependen del rol del perfil.

### Importación de Excel

El importador admite `.xlsx` de hasta **6 MB**, con primera fila de encabezados y hojas exactas `PERSONAL_OS` y `PERSONAL_SLI`. Lee estas columnas por posición:

| Columna | Contenido |
| --- | --- |
| B | DNI de ocho dígitos; conservar ceros iniciales, preferentemente como texto |
| C | Apellido paterno |
| D | Apellido materno |
| E | Nombres |
| F | Ocupación: conductor o auxiliar |
| G | Ubicación |
| H | Estado `ACTIVO` |

Se ignoran hojas de terceros/vehículos y filas que no cumplen esos criterios. Coordinadores y Monitoreo pueden agregarse manualmente, pero no se importan desde este formato. Un DNI repetido entre ambas hojas se consolida con ambas empresas si los datos coinciden; si son contradictorios, se detiene la lectura para corregirlos.

La vista previa diferencia nuevas, modificadas y sin cambios. Importar preserva aprobaciones, contactos, estado y horarios existentes, vuelve a comprobar el registro dentro de una transacción y evita escrituras/auditoría de filas idénticas. Quienes no aparecen en el archivo **no se dan de baja automáticamente**. Una persona eliminada puede volver a agregarse si se incluye en una importación posterior.

### Baja, retiro de acceso y eliminación

- **Baja:** bloquea las operaciones de asistencia manteniendo a la persona y su historial.
- **Eliminar acceso:** retira el perfil y la solicitud aprobados, libera el vínculo de autorización y bloquea las sesiones dependientes. Solo se usa para revocar/reiniciar un acceso, no para cambiar de teléfono.
- **Eliminar del padrón:** pide confirmación y ejecuta baja, retiro de acceso si existe y eliminación de persona/vistas auxiliares. Cada etapa se comprueba y audita; se puede reintentar si una etapa falla.

Estas operaciones conservan marcas, incidencias y correcciones históricas. No usar borrados manuales en Firestore para reemplazar el flujo. Los totales de personal y aprobados cambian con el uso; no se toma como censo vigente el padrón inicial de 37 personas.

## Monitoreo y reportes

- **Inicio, encargado:** indicadores del día, personal activo sin entrada y sus marcaciones. «Sin registro» no equivale a ausencia o falta.
- **Marcaciones:** vista de un día o registros recientes; búsqueda y filtro por servicio. El historial reciente general tiene límite de 500 marcas y sus correcciones recientes, de 300; usar el reporte del período para una exportación completa.
- **Incidencias:** solicitudes y decisiones de corrección. La vista administrativa carga hasta 300 recientes; también se escuchan las pendientes para el aviso del panel.
- **Reportes:** Día/Mes, fecha, servicio y vistas Resumen/Detalle. Excel contiene resumen, detalle e instrucciones; PDF exporta la vista elegida. Ambos respetan período y servicio.
- **Resumen:** una fila por persona y día, entrada/salida efectiva con correcciones y tardanza calculada con esa hora. El día incluye el padrón activo actual y personas con marcas/correcciones; el mes incluye días con movimientos, sin inventar ausencias.
- **Detalle:** conserva originales, correcciones, servicio y ubicación. Al filtrar un servicio, el resumen mantiene la jornada completa de las personas que lo realizaron; el detalle muestra las marcas de ese servicio. **Todos los servicios** incluye históricos vacíos y **Sin servicio** permite consultarlos aparte.
- **Auditoría, encargado:** acciones y responsables; el monitor no tiene acceso a esta vista ni a sus datos.

Los reportes consultan todas las marcas y correcciones del período, sin el límite de 500 de Marcaciones. Las tablas auxiliares de perfiles/incidencias mantienen sus límites; no son un archivo histórico ilimitado. Los días sin registro no descuentan descansos o permisos, y el padrón de un reporte diario es el actual, no una fotografía histórica de altas/bajas.

## Arquitectura y datos

La aplicación web llama directamente a Authentication y Firestore. Las acciones del cliente y transacciones se autorizan con las reglas; no hay un servidor propio validando usuarios en esta versión.

| Archivo o colección | Función |
| --- | --- |
| `src/App.tsx`, `src/RosterPanel.tsx` | Panel administrativo, reportes y gestión del equipo |
| `src/WorkerPortal.tsx`, `src/MonitorLogin.tsx` | Ingreso/marcación DNI y acceso con contraseña |
| `src/dniAccess.ts`, `src/workerActions.ts` | Sesiones, solicitud de acceso, ubicación, marcas e incidencias del trabajador |
| `src/actions.ts`, `src/roster.ts` | Acciones administrativas, aprobaciones y padrón |
| `src/attendanceReport.ts`, `src/services.ts` | Cálculo de estados/resumen y servicios compatibles |
| `personnel/{dni}` | Padrón, horario, contactos y `approvedUid` |
| `users/{uid}` | Perfil aprobado y rol; vínculo canónico desde el padrón |
| `registrationRequests/{uid}` | Solicitud y resolución de aprobación |
| `workerDirectory/{dni}` | Solo indicadores activo/aprobado, consulta individual previa al acceso |
| `workerPanels/{dni}` | DNI, nombre y horario; sin contactos, acceso con aprobación vigente |
| `workerSessions/{uid}` | DNI y creación del servidor; sesión inmutable de hasta 12 horas |
| `marks/{id}` | Marcaciones originales inmutables |
| `incidents/{id}`, `adjustments/{id}` | Solicitudes y correcciones aprobadas |
| `audit/{id}` | Evidencia de acciones; lectura exclusiva del encargado |
| `invites/{email}`, `privateIdentities/{uid}` | Invitaciones administrativas y vínculo privado del primer encargado |
| `firestore.rules`, `firestore.indexes.json` | Autorización y consultas indexadas |
| `firebase.json`, `.firebaserc` | Hosting, cabeceras, reglas/índices y proyecto destino |

Las vistas de directorio/panel se actualizan junto con los cambios del padrón. No editar aisladamente `approvedUid`, perfiles o proyecciones: puede bloquear accesos o dejar datos incoherentes. No hay limpieza automática de pago configurada para cuentas anónimas o sesiones vencidas; su acumulación requiere seguimiento.

## Desarrollo con Node.js portable

Trabajar en PowerShell dentro de la carpeta del proyecto. Las siguientes variables afectan solo a esa terminal; ajustar las rutas en otra computadora. Herramientas verificadas en este equipo: **Node.js v26.12.0** y **Firebase CLI 15.34.1**.

```powershell
$NodePortable = 'C:\Users\transporte.ope3\tools\nodejs'
$env:Path = "$NodePortable;$env:Path"
$FirebaseToolsVersion = '15.34.1'

& "$NodePortable\node.exe" --version
& "$NodePortable\npm.cmd" ci
```

`npm ci` instala según `package-lock.json` y reemplaza `node_modules`; no elimina datos de Firebase. No requiere instalar Node globalmente. Usar `npm.cmd`/`npx.cmd` evita la restricción sobre scripts `.ps1`.

La configuración local está en `.env.local`, excluida de Git. Si ya existe, conservarla; crearla desde `.env.example` únicamente en un entorno nuevo y completar valores reales de la aplicación web Firebase:

| Variable | Valor requerido |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Clave de configuración web del proyecto |
| `VITE_FIREBASE_AUTH_DOMAIN` | Dominio de Authentication configurado |
| `VITE_FIREBASE_PROJECT_ID` | `sistema-de-asistencia-os` |
| `VITE_FIREBASE_APP_ID` | Identificador de la aplicación web registrada |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Identificador configurado del proyecto |

No inventar valores, subir `.env.local` ni copiar credenciales de servidor al frontend. Las variables `VITE_*` se incluyen en el código compilado y no son un almacén secreto. Reiniciar Vite tras cambiar el archivo.

```powershell
# Desarrollo: normalmente http://localhost:5173/; usar la URL que indique Vite.
& "$NodePortable\npm.cmd" run dev

# Compilar y revisar la compilación local.
& "$NodePortable\npm.cmd" run build
& "$NodePortable\npm.cmd" run preview
```

Con la configuración normal, el desarrollo local apunta a Firebase real. Para probar registros/aprobaciones sin tocar producción, usar los emuladores del siguiente apartado. La ubicación exige un contexto seguro: HTTPS o localhost.

## Pruebas y emuladores

La última validación de implementación registra **37 pruebas de reglas y 11 de reportes/filtros aprobadas**, además de recorridos en navegador. Los ensayos visuales con ubicación simulada no sustituyen probar GPS físico en Android/iPhone; tampoco se afirma cobertura exhaustiva de todos los dispositivos.

Pruebas de reportes/filtros, sin Firebase ni Java:

```powershell
& "$NodePortable\node.exe" --test tests/attendance-report.test.mjs tests/service-filter.test.mjs
```

Para Firestore se requiere Java portable compatible. Ruta usada en este equipo, alojada en una carpeta temporal: comprobarla y ajustar si se mueve o elimina.

```powershell
$JavaPortable = 'C:\Users\transporte.ope3\AppData\Local\Temp\os-asistencia-temurin21-jre\jdk-21.0.12.1+1-jre'
$env:Path = "$JavaPortable\bin;$env:Path"
& "$JavaPortable\bin\java.exe" -version

$RuleTests = 'node --test tests/firestore.rules.test.mjs tests/dni.rules.test.mjs tests/dni-manager.rules.test.mjs tests/missing-profile.rules.test.mjs tests/monitor.rules.test.mjs tests/monitor-password.rules.test.mjs'
& "$NodePortable\npx.cmd" --yes "firebase-tools@$FirebaseToolsVersion" emulators:exec --only firestore --project demo-os-logistics --config firebase.emulators.json $RuleTests
```

`npm run test:rules` ejecuta solo `tests/firestore.rules.test.mjs`; no es la suite completa anterior y necesita un emulador activo. Las denegaciones esperadas de las pruebas negativas no deben confundirse con fallos de usuarios reales.

Para recorrer la interfaz con servicios locales:

```powershell
# Terminal 1, con Node y Java portable en Path.
& "$NodePortable\npx.cmd" --yes "firebase-tools@$FirebaseToolsVersion" emulators:start --only auth,firestore --project demo-os-logistics --config firebase.emulators.json

# Terminal 2, dentro del proyecto y con Node portable en Path.
$env:VITE_USE_EMULATORS = 'true'
& "$NodePortable\npm.cmd" run dev -- --host 127.0.0.1 --port 5174
```

En esa modalidad se usa el proyecto ficticio `demo-os-logistics`, Auth `9099` y Firestore `8080`, con datos de prueba propios. Activar la variable antes de iniciar Vite; no basta con abrir emuladores. La conexión local está limitada a `import.meta.env.DEV`, por lo que no se activa en el build de producción. Las evidencias/scripts auxiliares en `tmp/` son locales y no se incluyen en Hosting ni se garantizan en otro checkout.

## Publicación y mantenimiento

Reutilizar la autenticación Firebase CLI existente del equipo; comprobar el proyecto destino antes de publicar. Si falta sesión en otro equipo, iniciar sesión en el navegador mediante la CLI. No pegar contraseñas, tokens ni códigos OAuth en el chat, código o README.

```powershell
# Cambios de interfaz: publicar únicamente Hosting tras verificar el build.
& "$NodePortable\npm.cmd" run build
& "$NodePortable\npx.cmd" --yes "firebase-tools@$FirebaseToolsVersion" deploy --only hosting --project sistema-de-asistencia-os

# Solo si se cambiaron y probaron reglas o índices.
& "$NodePortable\npx.cmd" --yes "firebase-tools@$FirebaseToolsVersion" deploy --only firestore:rules,firestore:indexes --project sistema-de-asistencia-os
```

No ejecutar el despliegue de `functions/` ni un despliegue genérico para esta arquitectura. Tras publicar, comprobar ingreso, navegación, permisos y reportes; actualizar la página para cargar el cliente nuevo. Antes de gestionar padrón desde una pestaña antigua, recargarla para mantener coherentes las vistas auxiliares. Probar cambios funcionales con datos ficticios en emuladores, no borrar marcas reales para ensayar.

Una reversión debe elegir código compatible con las sesiones DNI y las reglas vigentes. No restaurar ciegamente datos, aprobaciones o reglas anteriores; las versiones fechadas de los informes son evidencias históricas, no instrucciones automáticas de rollback.

## Consumo, optimización y seguimiento

- El trabajador escucha su sesión, panel y los dos documentos de entrada/salida de hoy; las incidencias recientes se consultan al abrir su formulario. La nueva sesión técnica agrega una escritura; cada marca escribe documento y auditoría.
- El panel administrativo activa consultas según la sección, manteniendo pendientes y padrón en vivo. Equipo consulta solicitudes pendientes e importar filas idénticas no vuelve a escribirlas.
- Reporte diario en vivo; reporte mensual completo con memoria de sesión y botón **Actualizar**. Cambiar usuario, rol o estado invalida la memoria. El filtro de servicio se aplica sobre los datos cargados: no se presenta como ahorro de lecturas de servidor.
- Comparar lecturas, escrituras, eliminaciones, listeners, conexiones y resultados de reglas. Umbral operativo de investigación: **25.000 lecturas en 24 horas**; prioridad alta a 40.000. Son umbrales del proyecto, no límites de facturación.

La revisión guardada del **02/11/2026, corte 07:44 de Lima**, es la **4/7**: 474 lecturas y 75 escrituras en la última ventana móvil de 24 horas, pico de 17 listeners y 6 conexiones, sin series recientes de ERROR/DENY; Hosting HTTP 200. La ventana previa informó 8.059 lecturas. La diferencia de carga entre fin de semana y lunes temprano impide atribuir ese descenso exclusivamente al código. Una ventana móvil no es el día de cuota ni una factura; no garantiza consumo futuro dentro del plan gratuito.

Conservar `tmp/optimization-baseline.json` sin sobrescribirlo y mediciones fechadas en `tmp/optimization-monitoring/`; el progreso se guarda en `review-progress.json`. No hay revisión diaria almacenada del 01/11, y las mediciones manuales adicionales no suman revisiones. Son archivos locales excluidos de Git; conservarlos en respaldo privado si se traslada el entorno. La automatización pertenece al entorno de Codex de este equipo, no a Hosting, y requiere disponibilidad del equipo y autenticación CLI.

## Privacidad y límites conocidos

- **DNI solo no comprueba identidad:** conocer un DNI aprobado permite entrar como esa persona. Agregar PIN, vínculo de dispositivo u otra verificación exige un diseño posterior que conserve las aprobaciones; no está implementado.
- El directorio previo al acceso solo permite lecturas individuales mínimas, no listar personal. Eso no elimina intentos sistemáticos de probar DNIs ni garantiza protección contra consumo malicioso de cuotas. No hay App Check obligatorio ni límite propio por IP en esta versión.
- El usuario de monitor no viene prellenado y el correo no aparece en pantalla/avisos. El navegador o gestor de contraseñas puede ignorar `autocomplete=off`. La dirección todavía puede inspeccionarse en el JavaScript/peticiones de autenticación: ocultarla totalmente requiere otra arquitectura.
- GPS obligatorio y rangos válidos no impiden una ubicación simulada. Para contrastes operativos se mantiene la comprobación con Onway. Compartir una cuenta de monitor limita la identificación individual del operador en la auditoría.
- Hosting incluye bloqueo de incrustación, `nosniff`, política de referencia y permisos de ubicación propios, sin cámara/micrófono. La CSP actual es parcial; no equivale a una protección completa contra XSS.
- La revisión del 31/10 encontró alertas moderadas transitivas en ExcelJS, sin una vía explotable identificada en los recorridos revisados. No se aplicó el retroceso incompatible sugerido por `npm audit`; queda pendiente evaluar actualización/sustitución con pruebas de importación/exportación. Consultar el informe para alcance y versiones del análisis.

Las reglas conservan aprobación, roles, expiración, hora del servidor, GPS, auditoría e inmutabilidad. No retirar controles para reducir consumo. Una validación local o una métrica agregada sin errores no certifica ausencia de todas las vulnerabilidades ni el éxito de cada marcación física.

## Guías y documentación relacionada

- [Guía vigente del personal: registro y asistencia, 2 páginas](output/pdf/Guia_personal_registro_y_asistencia_actualizada.pdf).
- [Guía vigente de aprobación para encargado/monitor, 1 página](output/pdf/Guia_aprobacion_encargado_y_monitor_actualizada.pdf).
- [Acceso por DNI y conservación de aprobaciones](RESULTADO_ACCESO_DNI.md).
- [Gestión de personal](RESULTADO_GESTION_PERSONAL_20261030.md) y [flujo de ingreso simplificado](RESULTADO_FLUJO_SIMPLIFICADO_20261030.md).
- [Reportes](RESULTADO_REPORTES_20261030.md), [servicios](RESULTADO_SERVICIOS_20261031.md), [filtros](RESULTADO_FILTROS_SERVICIO_20261031.md) y [consolidación de padrón](RESULTADO_PADRON_SERVICIOS_20261031.md).
- [Permisos de OSMonitor](RESULTADO_OSMONITOR_20261031.md) y [acceso con contraseña](RESULTADO_OSMONITOR_CONTRASENA_20261031.md).
- [Optimización y revisiones de consumo](RESULTADO_OPTIMIZACION.md), [plan de optimización](PLAN_OPTIMIZACION_FIRESTORE.md) y [corrección de reglas](RESULTADO_CORRECCION_REGLAS_20261031.md).
- [Revisión de privacidad y seguridad](REVISION_PRIVACIDAD_SEGURIDAD_20261031.md).

Los informes describen el momento de su publicación: por ejemplo, el de alta de OSMonitor precede a la eliminación del usuario prellenado. `GUIA_ASISTENCIA.md` y `output/pdf/Guia_rapida_asistencia_OS_Logistics.pdf` conservan instrucciones anteriores de acceso por celular; para uso operativo compartir los dos PDF vigentes enlazados arriba. Este README se mantiene como único archivo principal de presentación del proyecto.
