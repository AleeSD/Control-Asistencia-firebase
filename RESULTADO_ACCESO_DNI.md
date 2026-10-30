# Acceso por DNI — 30/10/2026

## Implementación

La página de trabajadores abre directamente «Ingresa tu DNI». Los aprobados ingresan desde cualquier navegador sin repetir la aprobación. Los encargados conservan su acceso Google separado. Se implementa la opción de DNI solo autorizada por el usuario: identifica la persona declarada, pero no prueba quién escribe el DNI.

Se mantuvo el vínculo existente `personnel.approvedUid → users` como fuente de autorización de la persona. No fue necesario copiar aprobaciones a otra colección `workerAccess`. Las reglas verifican persona activa, perfil aprobado activo y coincidencia de DNI. Un UID nuevo puede crear únicamente su propia sesión vinculada a una persona ya aprobada. La sesión es inmutable y dura como máximo 12 horas; una nueva aprobación invalida las sesiones anteriores por su fecha. Dar de baja o revocar el acceso bloquea las operaciones y el panel de sesiones abiertas.

`workerDirectory/{dni}` contiene solamente dos indicadores: activo y aprobado. Permite lectura individual con sesión anónima; no permite listar a trabajadores. `workerPanels/{dni}` contiene DNI, nombre de presentación y horario, sin contactos. Solo puede leerse con una autorización vigente. `workerSessions/{uid}` contiene DNI y fecha de creación del servidor.

La aprobación ya no depende del navegador. Firebase mantiene una sesión técnica temporal en `browserSessionPersistence` en una instancia separada de la del encargado. Al recargar se solicita DNI; al salir se cierra esa sesión. Una recarga puede reutilizar la sesión técnica vigente y ahorra nuevas cuentas/escrituras. Cambiar de persona o vencer la sesión crea otro UID, sin reemplazar la aprobación original.

Se conserva la lectura de dos documentos de marcas de hoy. Las incidencias recientes se consultan solo al abrir «¿Olvidaste una marcación?». Las solicitudes pendientes del mismo navegador se recuperan; desde otro navegador puede enviarse otra solicitud pendiente para el mismo DNI, que el encargado puede identificar/rechazar. Una aprobación vigente impide volver a aprobar y reasignar silenciosamente ese DNI.

El DNI inexistente muestra la ventana «DNI no registrado» y la indicación de contactar al coordinador de la operación o Monitoreo. No guarda una solicitud. DNI inactivo y errores técnicos tienen mensajes distintos. La solicitud pendiente se muestra después de que Firebase confirma su escritura.

Las altas, ediciones, importaciones, aprobaciones, revocaciones y bajas del panel actualizan las vistas mínimas en la misma transacción. `savePersonnel` pasó a transacción para conservar el vínculo vigente frente a cambios concurrentes. Los clientes de encargado antiguos deben recargar antes de modificar el padrón: las reglas rechazan una actualización que dejaría las vistas incoherentes. Los clientes de trabajador antiguos continúan pudiendo marcar durante la transición.

## Preservación y migración

- Inventario: 44 personas, 17 aprobaciones activas coherentes, 20 perfiles y 20 solicitudes.
- La migración escribió exclusivamente 88 documentos auxiliares: un directorio mínimo y un panel por persona.
- No modificó padrón, perfiles, solicitudes, marcaciones ni correcciones.
- Segunda ejecución: 0 creaciones, 0 actualizaciones, 88 documentos sin cambios. Migración idempotente y con lecturas transaccionales.
- Verificación posterior al piloto: 0 documentos originales modificados o ausentes en padrón, perfiles, solicitudes, 52 marcaciones y 5 correcciones.
- La comprobación real usó dos sesiones anónimas aisladas para verificar acceso en la vista previa. No se pulsó marcar; sus sesiones y cuentas temporales se eliminaron al terminar. No se tocaron cuentas existentes.
- Respaldo local de código y reglas previas: `tmp/dni-backup-20261030/`.

Evidencias: `tmp/dni-migration-first-apply.json`, `tmp/dni-migration-apply.json`, `tmp/dni-migration-verify.json` y `tmp/dni-integrity-canonical-before.json`. La comparación inicial basada en el orden JSON no era válida porque la API cambia el orden de campos; se corrigió con ordenación canónica. La referencia canónica es posterior a la migración y anterior al piloto final. La conservación durante la migración se sustenta además en la restricción del script a las dos colecciones auxiliares y en los conteos concordantes; no se presenta aquel primer hash como prueba válida de cambios en los registros.

## Validación

- Compilación TypeScript/Vite correcta. Advertencia de tamaño de paquetes ya existente.
- 25 pruebas de reglas y gestión aprobadas: incluye continuidad del acceso legado, aprobación en navegador nuevo, identidad inmutable de sesión, aislamiento de datos privados, fecha de servidor, GPS obligatorio, entrada/salida sin duplicados, expiración, baja y nueva aprobación.
- 5 pruebas de reportes aprobadas.
- Navegador Chrome con Auth y Firestore emulados: DNI inexistente, solicitud y aprobación, recarga que vuelve al DNI, otra sesión/dispositivo que ve la entrada y registra la salida, y baja en vivo. No hay llamadas a producción en esas pruebas.
- Vista previa real: una aprobación existente abre el panel en un contexto de navegador nuevo; recargar vuelve al DNI. Sin marcaciones de prueba. Sin errores JavaScript detectados.
- Pruebas de permisos incluyeron el ciclo del encargado: alta, aprobación, actualización de horario, baja, revocación y eliminación del padrón con vistas coherentes.
- Los errores de permisos de los logs del emulador corresponden a pruebas de rechazo esperado; el resultado final es 25/25.

La prueba visual móvil se realizó en Chrome a 390 px; no sustituye una prueba física de GPS en Android/iPhone ni la validación nativa en Safari. Se mantuvo la API de ubicación que ya utilizaba la aplicación.

## Publicación y contingencia

Reglas publicadas y versión de Hosting `6c4e51efc9dcc1ba`, canal `acceso-dni`, promovida a live. URL habitual: https://sistema-de-asistencia-os.web.app.

Comprobación final pública: HTTP 200, HTML coincidente con la compilación local y archivo `index-De0QUXJL.js`; pantalla DNI y navegación al acceso Google del encargado operativas, sin errores JavaScript detectados.

Versión previa pública de reportes: `3cdf4dc03b50c298`. Versión compatible de contingencia con DNI, previamente verificada en producción sin marcar: `4c595a0f47fe01ed` (mostraba primero la portada «Soy trabajador»). Si hiciera falta volver a esa versión compatible, usar como origen `sistema-de-asistencia-os@4c595a0f47fe01ed` en `hosting:clone`, conservando las reglas nuevas y los datos. No restaurar ciegamente un respaldo de la base ni las reglas anteriores tras comenzar a usar sesiones DNI.

No se activaron Cloud Functions, Blaze, TTL de pago ni otros servicios facturables. Tampoco se activó App Check de forma obligatoria durante el corte, para no bloquear clientes antiguos sin tokens de atestación.

## Efecto esperado en Spark

Referencia previa al corte DNI: medición `tmp/optimization-monitoring/2026-10-30T16-08-45-095Z.json`, ventana móvil de 24 horas terminada el 30/10 a las 11:03:38 de Lima: 3.016 lecturas, 116 escrituras, 9 eliminaciones, pico de 25 listeners y 7 conexiones, sin errores de evaluación de reglas. No es un día de cuota y contiene uso normal y labores administrativas anteriores al corte.

### Gasto puntual

88 escrituras para crear vistas, más lecturas de inventario, verificación y transacciones. Los dos pilotos añadieron dos sesiones de prueba y su limpieza. Esto no debe extrapolarse como consumo diario de trabajadores. La segunda migración no escribió datos.

### Gasto recurrente

Por ingreso aprobado en una sesión nueva, el código realiza aproximadamente 8 lecturas directas de documentos (incluidas sus escuchas iniciales) y 1 escritura de sesión. Una recarga con la misma sesión válida necesita aproximadamente 7 lecturas directas y 0 escrituras de sesión. Estos conteos incluyen lecturas de documentos inexistentes y la validación previa del panel. No incluyen lecturas dependientes de las reglas, reconexiones, actividad de marcación ni vistas del encargado.

Las reglas de la nueva sesión consultan sesión, persona y perfil aprobado; algunas dependencias se reutilizan dentro de la evaluación, pero no se presupone una caché entre solicitudes distintas. Se conserva la escritura de marca y auditoría, dos por marcación, sin duplicarlas. El panel mantiene cuatro escuchas principales (sesión, panel, entrada y salida), y abre la de incidencias solo cuando se necesita.

**Estimación conservadora para planificación, no medición facturada:** reservar entre 10 y 20 lecturas adicionales por ingreso frente al flujo previo, contando comprobaciones de reglas y margen por reconexión. Puede ser menor al reutilizar sesión y evitar las incidencias; también puede ser mayor si hay muchas reaperturas o desconexiones. No es un límite garantizado.

| Escenario | Ingresos diarios | Lecturas adicionales estimadas | Escrituras nuevas de sesión, hasta |
|---|---:|---:|---:|
| 17 aprobados, 2 ingresos cada uno | 34 | 340–680 | 34 |
| 44 personas, 2 ingresos cada una | 88 | 880–1.760 | 88 |

Con la referencia de 3.016 lecturas y actividad equivalente, el segundo escenario daría aproximadamente 3.900–4.800 lecturas diarias, antes de otros cambios de uso. Es una proyección orientativa, no una promesa de consumo. El límite gratuito de referencia es 50.000 lecturas y 20.000 escrituras por día; 88 escrituras extra serían 0,44 % de la cuota diaria de escrituras.

Firebase Authentication también limita creación de cuentas por IP. Reutilizar la sesión evita crear una cuenta por cada recarga; salir, cambiar de dispositivo o vencer una sesión sí puede crear una cuenta anónima nueva. Vigilar las entradas simultáneas desde una misma red y el crecimiento de cuentas/sesiones acumuladas. No se configuró una limpieza automática de pago ni se borraron cuentas originales.

### Siguiente revisión de optimización

1. Medir al menos 3–7 días completos después del corte, diferenciando migración y uso normal, y sin contar las mediciones manuales como revisiones programadas.
2. Comparar lecturas por trabajador/día e ingreso, escrituras de sesión, listeners máximos y errores de Auth/reglas. La métrica agregada de Firestore sola no atribuye cada lectura al ingreso DNI.
3. Investigar si se superan 25.000 lecturas en 24 horas, aparecen bloqueos de aprobados o el consumo por acceso supera de forma sostenida el margen previsto.
4. Si hace falta otro plan: evitar la lectura duplicada del panel antes de su listener sin debilitar la validación, revisar comprobaciones repetidas de reglas, reducir creación de sesiones y proponer limpieza administrativa de sesiones vencidas. No retirar controles de aprobación, bajas, GPS o duplicados para ahorrar.

No hay indicios actuales de que este cambio requiera salir de Spark. El incremento real requiere observación posterior; no se afirma haberlo medido inmediatamente al publicar.

Referencias: [cuotas de Firestore](https://firebase.google.com/docs/firestore/quotas), [lecturas de reglas y facturación](https://firebase.google.com/docs/firestore/pricing), [límites de Authentication](https://firebase.google.com/docs/auth/limits).
