# Plan de acceso por DNI y conservación de aprobaciones

Fecha: 30/10/2026. Estado: propuesta técnica; no implementada ni publicada.

Actualización 30/10/2026: opción B autorizada e implementada. Resultado, adaptación del modelo para reutilizar aprobaciones existentes, pruebas, límites de compatibilidad y estimación de consumo en `RESULTADO_ACCESO_DNI.md`. El texto siguiente conserva el plan original como referencia; prevalece el resultado de implementación para describir el estado actual.

## 1. Objetivo y alcance

El trabajador abre la página, escribe su DNI y accede a marcar si esa persona ya fue aprobada por el encargado. Cambiar de navegador o borrar sus datos no debe obligarlo a solicitar aprobación otra vez. Los nuevos trabajadores continúan sujetos a aprobación. Quien no esté en el padrón recibe un aviso claro y una indicación de contacto.

Se conserva el plan Spark, Node portable y la operación sin permisos de administrador. Se mantienen GPS obligatorio, hora de servidor, entrada/salida, horarios vigentes, incidencias y monitoreo. Las marcas y correcciones históricas no se reescriben. El acceso de encargados con Google sigue separado del acceso de trabajadores.

Supuesto de diseño: ingreso desde cualquier navegador mediante DNI. Este alcance es más amplio que pedir DNI en el celular ya autorizado.

## 2. Diagnóstico del código actual

- `src/firebase.ts`: usa `getAuth` sin una política de persistencia explícita para el trabajador. El flujo depende de recuperar su sesión anónima.
- `src/App.tsx`: inicia una cuenta anónima y deriva directamente a `WorkerPortal` cuando la sesión ya existe.
- `src/roster.ts`, `approveRegistration`: la aprobación crea `users/{uid}` y asigna ese UID a `personnel/{dni}.approvedUid` en una transacción.
- `src/WorkerPortal.tsx`, `src/workerActions.ts` y `firestore.rules`: exigen que el UID anónimo coincida con `approvedUid`. Un UID nuevo no hereda la aprobación.
- `marks`: el identificador del trabajador ya es estable, `DNI_fecha_tipo`. Esto permite conservar las marcas al cambiar la sesión. `userId` conserva al actor original y no debe reemplazarse.
- Las reglas `requestOK` ya exigen un DNI existente y activo para solicitar registro. La interfaz no puede consultar ese padrón antes de ser aprobada y muestra un error genérico de permisos.

Este diagnóstico se basa en los archivos locales actuales. El inventario actualizado de aprobaciones en producción se hará en modo lectura al iniciar la implementación; no se reutilizarán cifras históricas como si fueran actuales.

## 3. Opciones evaluadas

| Opción | Experiencia | Cambio de celular | Implicación |
|---|---|---|---|
| A. Pedir DNI sobre el dispositivo ya aprobado | Un campo DNI | Sigue requiriendo autorización del nuevo dispositivo | Menor cambio, pero no resuelve la dependencia del navegador. |
| B. Aprobación por persona y acceso solo con DNI | Un campo DNI, sin correo ni clave | Conserva la aprobación | Compatible en principio con Spark y reglas; cualquier persona que conozca un DNI aprobado podría acceder como ese trabajador. |
| C. DNI y secreto personal, por ejemplo PIN | DNI más un dato secreto | Conserva la aprobación | Mejor protección de identidad. Exige diseñar emisión, recuperación, verificación y límites de intentos en un servicio confiable. |

**Ruta propuesta para cumplir literalmente la solicitud: B**, condicionada a reconocer su limitación de identidad y a superar las pruebas de permisos y consumo. **Recomendación de seguridad: C** si se requiere impedir que otra persona marque con un DNI conocido.

Un DNI no es una contraseña. Ni Firebase Anonymous Auth, ni la aprobación previa de ese DNI, ni el GPS prueban que quien ingresa sea su titular. Un backend con tokens personalizados tampoco resuelve esto si solo pide DNI. Las reglas pueden limitar qué identidad declarada usa cada sesión y proteger al encargado, pero no distinguir al titular de alguien que conoce su número.

La opción C no debe resolverse almacenando un PIN o su hash en documentos consultables por el cliente, usando el DNI como contraseña, ni incluyendo claves privadas en JavaScript. Si se elige verificación propia mediante backend, su alojamiento y costos deben evaluarse aparte; no se da por autorizado cambiar a Blaze.

## 4. Flujo propuesto

### Trabajador ya aprobado

1. Abre la página y ve «Ingresa tu DNI», teclado numérico y botón «Ingresar».
2. Se valida un DNI de ocho dígitos, conservando los ceros iniciales.
3. Se comprueba en servidor que existe la autorización de esa persona y que sigue activa.
4. Se vincula la sesión temporal con ese DNI y aparece su panel de marcación.
5. Marca entrada o salida con GPS y hora oficial. Si ya marcó, se muestra la marca existente; otro navegador no habilita un duplicado.

Botón «Salir» visible. Al salir se limpian el panel y las escuchas. Al cambiar de persona se crea una sesión distinta, sin reutilizar el vínculo anterior. La interfaz pide DNI al abrir o recargar el acceso; una sesión técnica recuperada no debe llevar directamente al panel.

### Persona del padrón aún no aprobada

Tras consultar el DNI se ofrece el formulario actual de datos y contacto. Se envía una solicitud y se muestra «Solicitud pendiente de aprobación». Una nueva sesión puede conocer que existe una solicitud pendiente sin leer los datos de contacto ni editar una solicitud ajena. Las solicitudes duplicadas se agrupan por DNI para revisión del encargado; no producen una aprobación automática.

### DNI no encontrado

Mostrar una ventana accesible con este texto:

> **DNI no registrado**
>
> No encontramos tu DNI en el registro del personal de la empresa. Revisa que esté bien escrito. Si es correcto, comunícate con el coordinador de tu operación o con el área de Monitoreo para que revisen tus datos.

Acciones: «Revisar DNI» y «Volver al inicio». No crear solicitud ni acceso para ese DNI. Es preferible decir que no aparece en el registro, en vez de afirmar que la persona no trabaja en la empresa.

Un trabajador inactivo verá «Tu acceso está desactivado. Comunícate con el coordinador de tu operación o con Monitoreo». Un error de red o permisos mostrará «No pudimos validar tu DNI. Intenta nuevamente»; no se confundirá con un DNI inexistente.

## 5. Modelo propuesto para Spark

Los nombres de colecciones son propuestos, sujetos al prototipo y las pruebas:

| Colección | Propósito | Acceso |
|---|---|---|
| `personnel/{dni}` | Padrón privado existente; estado laboral, horario y contactos | Encargados; conservar acceso legado durante la transición. |
| `workerAccess/{dni}` | Aprobación de la persona: estado, versión de autorización, fecha, actor y referencia de origen | Encargados/migración; el trabajador no puede otorgarla ni modificarla. |
| `workerDirectory/{dni}` | Proyección mínima: elegible, pendiente o habilitado; sin nombres, teléfonos, correo ni UID aprobado | Lectura individual por DNI para el flujo previo; nunca listar. Escritura solo de encargado. |
| `workerSessions/{uid}` | Vínculo entre UID anónimo, DNI, versión de autorización y vencimiento | Crear solo para el propio UID y un DNI ya aprobado y activo; leer solo sesión propia. |
| `workerPanels/{dni}` | Proyección de los datos necesarios para marcar: nombre de presentación y horario | Solo sesión autorizada para ese DNI o encargado. Sin contactos ni información administrativa. |

Firestore entrega documentos completos: no se abrirá el padrón privado para mostrar únicamente un aviso. La proyección mínima debe mantenerse de forma atómica junto con las altas, bajas y aprobaciones; nunca depender de que el navegador del trabajador la actualice.

La consulta exacta del directorio revela si un DNI es elegible; negar listados no impide probar números sucesivos. Es una limitación real de la opción B. App Check puede reducir ciertos abusos, pero no verifica identidad ni sustituye un límite de intentos de servidor. No se prometerá protección contra enumeración basada solo en un temporizador del navegador.

### Persistencia y sesiones

- La aprobación permanente queda en Firestore, asociada al DNI, nunca en almacenamiento local.
- Propuesta: sesión técnica temporal de Firebase con `browserSessionPersistence`, más una pantalla de DNI que se reinicia al cargar. Esto conserva la sesión técnica al recargar una pestaña y evita crear una cuenta anónima por cada interacción.
- Lo anterior todavía usa almacenamiento temporal de sesión. Si se requiere cero persistencia de autenticación, usar `inMemoryPersistence`; se evaluará el aumento de cuentas anónimas al recargar.
- Aislar el contexto de autenticación del trabajador del contexto Google del encargado. Cambiar la persistencia de la instancia compartida sin aislamiento podría afectar al encargado o al acceso legado.
- Definir vencimiento en servidor (propuesta inicial: máximo 12 horas) y revocación mediante versión de autorización. El cierre visual del panel no es una barrera de seguridad por sí solo.
- No guardar el DNI como credencial, ni generar tokens propios con datos predecibles. Cambiar el DNI de una sesión vinculada requiere una sesión nueva.
- La limpieza de sesiones y cuentas anónimas acumuladas requiere una política explícita; no se asumirá limpieza automática gratuita ni se borrarán cuentas antiguas como parte del corte.

## 6. Fases de implementación

### Fase 0 — Cerrar el diseño

Documentar la elección entre acceso solo por DNI y verificación con un secreto. La opción B es acceso por identificación declarada, no verificación del titular. Definir sesión temporal, expiración y alcance del panel. Para B, limitar los datos expuestos al mínimo de marcación; evaluar particularmente los motivos de incidencias históricas, que pueden contener información personal. El historial completo del encargado se conserva.

**Salida:** diseño y criterios de aceptación definidos. Esta fase no cambia producción.

### Fase 1 — Inventario y respaldo

1. Guardar código, reglas, índices y versión de Hosting recuperable.
2. Leer padrón, perfiles y solicitudes de forma restringida. Emitir conteos y discrepancias; no imprimir DNI ni contactos en logs.
3. Identificar aprobaciones vigentes por la concordancia entre persona activa, `approvedUid` y perfil trabajador activo con el mismo DNI. Conservar trazabilidad de solicitud/auditoría cuando esté disponible.
4. Separar pendientes, rechazados, bajas y vínculos inconsistentes. La ausencia de una solicitud antigua no debe revocar automáticamente un acceso actualmente válido.
5. Obtener una referencia de integridad de marcas, correcciones y vínculos. Comparar por documento y versión, considerando nuevas marcaciones legítimas durante el trabajo.

**Salida:** inventario y simulación de migración. Cantidades aprobadas comprobadas en ese momento.

### Fase 2 — Prototipo y reglas en emulador

Implementar el nuevo acceso en un entorno local con personas ficticias. Crear proyecciones mínimas, autorizaciones y sesiones. Actualizar el panel para usar la identidad estable de persona; `userId` continúa identificando al actor de cada nueva marca.

Reglas mínimas:

- Solo el encargado puede aprobar, revocar o cambiar la versión de autorización.
- La creación de una sesión comprueba autorización vigente, persona activa, UID propio y fecha del servidor; vincularse a un DNI pendiente/inactivo se rechaza.
- El DNI de una sesión no se cambia mediante actualización. No se permite escribir roles ni perfiles administrativos.
- Cada operación verifica sesión vigente y autorización actual; la baja debe bloquear también una pestaña que ya estaba abierta.
- Marcas: solo creación, hora de servidor, GPS válido, horario del padrón, auditoría atómica, identificador `DNI_fecha_tipo`; salida requiere entrada existente.
- Incidencias y correcciones continúan referidas al DNI; ninguna modificación de autores o fechas históricas.
- Lecturas de trabajadores limitadas a su identidad declarada; listados de personal, otras sesiones, contactos, auditoría y funciones de encargado denegados.
- Medir llamadas `get/exists/getAfter` dentro de las reglas, límites por operación y costo de lecturas; no asumir que las consultas de reglas son gratis.

**Salida:** reglas probadas sin abrir el padrón. Prototipo que funciona desde un navegador nuevo.

### Fase 3 — Migración aditiva de aprobaciones

1. Crear una herramienta con modo simulación, ejecución explícita y reporte agregado.
2. Para cada aprobación válida, crear la autorización por DNI y las proyecciones correspondientes. Guardar referencia al vínculo anterior y al lote de migración.
3. Volver a leer los documentos dentro de cada transacción: si se modificaron durante la migración, reconciliar contra el estado actual. No resucitar bajas o accesos revocados.
4. Hacer el proceso idempotente: volver a ejecutarlo no duplica autorizaciones ni sobrescribe decisiones nuevas.
5. Conservar los UID, perfiles y solicitudes antiguos; no reemplazar `approvedUid` por el UID de cada nuevo inicio de sesión.
6. No escribir en marcas, ajustes, incidencias ni sus autores históricos.
7. Ante un vínculo inconsistente, conservar el acceso legado mientras se resuelve la inconsistencia; no aprobar por defecto ni exigir nuevamente aprobación a todos.

**Salida:** cada trabajador con aprobación vigente conserva una autorización equivalente, con excepciones identificadas y sin migraciones destructivas.

### Fase 4 — Actualizar el panel del encargado y el registro

- Cambiar «Aprobar celular» por «Aprobar acceso» para el flujo nuevo.
- Aprobar por DNI y actualizar autorización, proyecciones, solicitud y auditoría atómicamente.
- Revisar el control de concurrencia de `approveRegistration`: una solicitud adicional no debe reasignar silenciosamente la aprobación anterior.
- Separar «revocar acceso de la persona» de «cerrar una sesión». Dar de baja bloquea todas las sesiones de esa persona.
- Mantener las importaciones idempotentes; importar el padrón no concede aprobaciones ni borra las existentes.
- Implementar los mensajes de DNI inexistente, inactivo y pendiente y las rutas de recuperación del formulario.

**Salida:** altas y bajas coherentes para acceso nuevo y legado durante la transición.

### Fase 5 — Pruebas de aceptación

| Caso | Resultado exigido |
|---|---|
| Aprobado actual entra desde otro navegador | Accede con DNI sin nueva aprobación. |
| Se borran datos del navegador | La aprobación en servidor sigue vigente. |
| DNI pendiente o nuevo del padrón | Solicitud y espera; no puede marcar. |
| DNI inexistente | Aviso específico y contacto con coordinador/Monitoreo; sin solicitud guardada. |
| Sin conexión o fallo de permisos | Error técnico, nunca falso «DNI no registrado». |
| Baja mientras el panel está abierto | Se bloquea la próxima operación y se retiran datos del panel. |
| Dos dispositivos marcan entrada simultáneamente | Una única marca; el segundo informa que ya existe. |
| Entrada en cliente antiguo y salida en nuevo | Misma jornada por DNI, sin duplicados ni pérdida de entrada. |
| Cambiar DNI de sesión, crear rol o autoaprobarse | Rechazado por reglas. |
| Acceso solo DNI con número ajeno aprobado | Riesgo inherente de B, documentado; no falsear una prueba afirmando que se impide suplantación. |
| Migración repetida o concurrente con una baja | Sin duplicación y sin reactivar al trabajador. |
| Marcas e informes de antes y después del corte | Historial íntegro; reportes diarios/mensuales conservan cantidades y horas. |
| Recargar, volver atrás, cambiar persona o vencer sesión | No muestra información de la sesión anterior. |
| Todos los trabajadores conectan desde una misma red | Medir límites de creación anónima por IP y errores de acceso. |

Validar en Chrome Android y Safari iPhone, permisos GPS y pantallas pequeñas. Comparar lecturas/listeners con la optimización vigente: dos documentos de marcas de hoy, sin volver a cargar todo el historial.

### Fase 6 — Corte controlado

1. Preparar reglas y aplicación de compatibilidad que acepten temporalmente los dos flujos.
2. Incorporar la migración verificada y actualizar la gestión de aprobaciones antes del cambio general de pantalla.
3. Probar un grupo reducido con aprobaciones existentes. Verificar entrada, salida y reporte del encargado sin crear marcas ficticias en producción.
4. Publicar el nuevo acceso por DNI y comunicar que solo deben actualizar la página y escribir su DNI; no necesitan registrarse ni ser aprobados de nuevo.
5. Mantener una transición de al menos un ciclo completo de entrada y salida y observar clientes antiguos. Las nuevas sesiones no reemplazan el UID legado.
6. Retirar el flujo legado solo después de verificar que no se bloquean usuarios. Registrar fecha, versión y resultado del corte.

**Salida:** flujo DNI activo, aprobaciones preservadas y compatibilidad confirmada durante la jornada.

### Fase 7 — Seguimiento y reversión

- Medir lecturas y escrituras por ingreso, sesiones nuevas, cuentas anónimas creadas, fallos por IP, accesos denegados de personas aprobadas y tiempo hasta el panel.
- Seguir el umbral existente de 25.000 lecturas en 24 horas; comparar ventanas equivalentes y separar consumo de migración del uso habitual.
- Mantener detección de marca duplicada, respuesta a bajas, GPS y reportes.
- Ante fallos de aprobados, detener expansión y servir la última versión **compatible con las autorizaciones nuevas**. Volver ciegamente a la aplicación original puede dejar fuera a quienes fueron aprobados durante el corte.
- Conservar autorizaciones, sesiones y registros del período. No restaurar un respaldo completo que borre marcas o aprobaciones posteriores.
- Preparar antes del corte una versión de contingencia capaz de continuar atendiendo tanto a los aprobados antiguos como a los nuevos.

## 7. Requisitos y decisiones para iniciar el desarrollo

1. Confirmar como decisión de producto el alcance de DNI solo desde cualquier navegador, con la limitación de identidad descrita, o elegir una verificación adicional.
2. Mantener Spark como restricción. No activar backend facturable ni servicios externos por suposición.
3. Contar con el inventario vivo, respaldo, emulador y versión de contingencia.
4. Validar la política de sesión temporal. La recomendación usa almacenamiento de sesión técnico, pero la aprobación deja de depender de él.
5. Definir qué información personal necesita realmente el panel accesible solo con DNI.

No es necesario pedir nuevamente aprobación a todos los trabajadores para ejecutar una migración correcta. La aprobación se traslada en servidor; cada persona solo introduce su DNI en el nuevo acceso.

## Fuentes técnicas verificadas

- Firebase permite persistencia local, de sesión o en memoria: [Authentication State Persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence).
- Las cuentas anónimas están sujetas a límites de creación por IP; su creación no verifica la identidad de una persona: [Anonymous Authentication](https://firebase.google.com/docs/auth/web/anonymous-auth).
- App Check reduce ciertos accesos abusivos y complementa la autenticación: [Firebase App Check](https://firebase.google.com/docs/app-check).
- Los tokens personalizados se generan en un entorno confiable: [Create Custom Tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens).
- Las reglas admiten comprobaciones de documentos y tienen límites de llamadas: [Security Rules](https://firebase.google.com/docs/rules/rules-behavior).
