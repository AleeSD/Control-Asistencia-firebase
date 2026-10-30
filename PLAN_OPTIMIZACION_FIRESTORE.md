# Plan de optimización de Firestore — O.S. Logistics

**Fecha:** 28 de octubre de 2026  
**Proyecto:** `sistema-de-asistencia-os` · plan Spark  
**Estado al 28/10/2026:** optimizaciones principales implementadas y publicadas. Seguimiento de 48 horas y siete días pendiente de transcurrir. Ver `RESULTADO_OPTIMIZACION.md`.

## 1. Objetivo y condiciones que deben conservarse

Reducir principalmente las **lecturas de Firestore** cuando crezcan el padrón y el historial, manteniendo el uso sencillo desde celular y el monitoreo diario del encargado. La meta operativa es sostener el servicio en Spark con margen frente a las cuotas de **50 000 lecturas y 20 000 escrituras por día**. La cuota diaria se reinicia alrededor de la medianoche del horario del Pacífico, no necesariamente a medianoche de Lima.

Condiciones obligatorias en todas las fases:

- Conservar los UID anónimos, los documentos `users`, las solicitudes aprobadas y `personnel.approvedUid`. No volver a registrar ni volver a aprobar los celulares que ya funcionan.
- Conservar los ID de marcación `DNI_YYYY-MM-DD_entrada|salida` de trabajadores y `UID_YYYY-MM-DD_entrada|salida` de cuentas antiguas del encargado, los documentos históricos y el formato actual de fechas de Lima. Ninguna fase requiere migrar ni borrar datos de producción.
- Mantener entrada y salida con ubicación obligatoria, hora del servidor, una marca por tipo y día, salida posterior a entrada, marcas originales inmutables y correcciones separadas.
- Mantener en vivo el estado **de hoy** del encargado y la aprobación o baja de un trabajador. La vista móvil debe seguir permitiendo marcar con el mismo número de pasos.
- Mantener reportes diarios y mensuales, vista previa, exportaciones Excel/PDF completas y acceso al enlace de Google Maps de cada marca.
- Mantener el correo personal del primer encargado fuera de la interfaz y `privateIdentities` inaccesible desde la aplicación.
- Usar Node.js portable en `C:\Users\transporte.ope3\tools\nodejs`; no requerir permisos de administrador ni Cloud Functions/Blaze.

## 2. Diagnóstico del flujo actual

| Pantalla | Lecturas que inicia hoy | Consecuencia al crecer el historial |
|---|---|---|
| Trabajador | Escucha su perfil, su solicitud, su ficha de personal, hasta 100 marcas y hasta 30 incidencias. | La pantalla muestra solo las dos marcas de hoy y tres incidencias, pero cada apertura puede recuperar muchos registros anteriores. |
| Encargado, cualquier sección | Escucha hasta 500 marcas, 300 incidencias, 300 correcciones, 300 perfiles, 300 eventos de auditoría y todo el padrón. | Inicio, Equipo o Auditoría mantienen consultas de secciones no visibles. |
| Equipo | Añade una escucha sin límite de todas las solicitudes históricas. | Solo se muestran las pendientes; aprobadas y rechazadas siguen aumentando el conjunto leído. |
| Reportes | Al entrar, añade consultas en vivo de todas las marcas y correcciones del día o del mes. | Se solapa con la escucha general de marcas. Con 20 personas que marcan dos veces durante 30 días, el mes contiene aproximadamente 1 200 marcas. |
| Importación del padrón | Para cada DNI se hacen lecturas y se escriben padrón y auditoría aunque la fila no haya cambiado. | Genera operaciones evitables; no es el principal gasto diario. |

Estos son **máximos y escenarios derivados del código**, no una atribución medida de las aproximadamente 4 000 lecturas observadas en la consola. Firestore puede cobrar lecturas por resultados iniciales, actualizaciones, reconexiones y documentos consultados por las reglas. Las métricas de la consola son estimaciones y pueden diferir de las operaciones facturables.

Archivos de referencia: `src/WorkerPortal.tsx`, `src/App.tsx`, `src/RosterPanel.tsx`, `src/roster.ts`, `src/workerActions.ts`, `firestore.rules`, `firestore.indexes.json` y `tests/firestore.rules.test.mjs`.

## 3. Requisitos previos y métricas de referencia — Fase 0

**Trabajo:** preparar medición y recuperación antes de cambiar consultas.

1. Registrar durante **7 días de operación comparables**: lecturas, escrituras, eliminaciones, almacenamiento, tráfico de Firestore y descargas de Hosting. Anotar día, cantidad aproximada de trabajadores activos, marcas, encargados conectados, aperturas de reportes e importaciones. No incluir DNI, nombres, correo ni coordenadas en la hoja de métricas.
2. En Cloud Monitoring, revisar `Document Reads` por `LOOKUP` y `QUERY`, `Snapshot Listeners`, `Active Connections` y errores de reglas. Usar el panel de Firestore para la tendencia diaria y el de reglas para solicitudes denegadas. Separar denegaciones esperadas de usuarios sin aprobar de los fallos de usuarios aprobados.
3. Tomar mediciones controladas de una sesión de trabajador aprobado y una del encargado: abrir la página, marcar entrada/salida en entorno de prueba, cambiar de sección, abrir reporte diario y mensual. Registrar cuántos documentos devuelve cada consulta y cuántos listeners permanecen activos. No hacer marcas ficticias en producción para medir.
4. Guardar una copia versionada de código, `firestore.rules`, `firestore.indexes.json` y configuración de despliegue, sin incluir `.env.local`, claves, exportaciones de personal ni tokens. Registrar la versión actual de Hosting y la revisión de reglas para poder revertir. Confirmar qué consultas e índices están realmente publicados antes de tocar reglas.
5. Establecer la comparación: **lecturas por apertura** de trabajador y encargado, lecturas diarias por cada 100 marcaciones, máximo diario de siete días y tiempo desde pulsar «Marcar» hasta confirmación. Comparar días con actividad similar; el número de usuarios crecerá durante el proyecto.

**Salida:** línea base, versión recuperable y lista exacta de consultas. **Puerta para avanzar:** el flujo existente sigue funcionando y se conocen las cifras previas.

## 4. Trabajador: leer solo lo necesario — Fase 1

1. Sustituir la consulta de hasta 100 marcas por escuchas de los **dos documentos de hoy** (entrada y salida), cuyos ID ya son deterministas. Mantener la actualización en vivo para que el botón pase de entrada a salida y luego a jornada completada sin recargar.
2. Consultar solamente las tres incidencias que muestra la pantalla, o abrir una sección específica si en el futuro se necesita historial completo. Dejar de escuchar `registrationRequests/{uid}` tras confirmar el perfil aprobado; volver a escucharla cuando el perfil no exista o la solicitud esté pendiente/rechazada.
3. Mantener las escuchas de `users/{uid}` y `personnel/{dni}`: son necesarias para detectar aprobación, baja y retiro del acceso. No tocar la sesión anónima guardada en el navegador.
4. Probar los estados: primer ingreso, pendiente, rechazado, aprobado, baja, acceso retirado y cambio de celular; entrada, salida, recarga de página y cambio de día de Lima. Verificar que el permiso GPS y la hora del servidor no cambian.

**Meta de medición:** la apertura de un trabajador aprobado debe dejar de crecer con sus meses de historial; idealmente recuperar dos marcas del día y solo las incidencias visibles, más los documentos de autorización. **Publicación:** solo Hosting; las reglas actuales ya permiten consultar marcas propias por ID. **Reversión:** restaurar la versión anterior de Hosting sin alterar aprobaciones o marcas.

## 5. Encargado: consultas por sección — Fase 2

1. En **Inicio**, mantener en vivo las marcas de **hoy** para entradas y «sin entrada», el padrón activo y las incidencias pendientes. Conservar la marca propia del encargado si usa ese botón, su resumen mensual y sus cinco movimientos recientes mediante consultas propias acotadas. Evitar que el inicio cargue de inmediato 500 marcas de todo el equipo y 300 eventos de auditoría.
2. En **Marcaciones**, activar la consulta actual de hasta 500 filas **solo mientras se muestra esa sección**, preservando inicialmente el alcance de la búsqueda y las correcciones visibles. Si después se necesita más historial o menos lecturas por visita a esa sección, añadir paginación por cursor y filtros por fecha/persona; verificar que la búsqueda siga encontrando los registros esperados antes de reducir el límite inicial.
3. En **Incidencias**, mantener en vivo las pendientes; cargar las resueltas al abrir la sección y paginarlas si es necesario. En **Auditoría**, suscribirse únicamente mientras se muestra la sección y paginar eventos antiguos.
4. En **Equipo**, consultar `registrationRequests` con `status == "pendiente"` y ordenar el resultado localmente. Mantener el padrón disponible para validar nombres/DNI y gestionar bajas. Si luego se requiere historial de solicitudes, abrirlo con una consulta aparte y paginada.
5. Suscribir perfiles y correcciones únicamente donde se usen; coordinar consultas compartidas para que una misma vista no recupere dos veces la misma colección sin necesidad. Cancelar listeners al salir de la sección.

**Índices:** comprobar en emulador y en el proyecto los índices de cada nueva combinación `where`/`orderBy` antes de publicar Hosting. Un filtro simple `status == "pendiente"` puede ordenarse en memoria; una combinación con orden remoto podría exigir índice compuesto.

**Meta de medición:** bajar al menos un **40 % las lecturas de una apertura controlada de Inicio** frente a la línea base, con las cifras de «entradas hoy» y «sin entrada» idénticas. **Puerta:** cambio de sección, alertas de incidencias, bajas y actualización de marcas funcionan en dos sesiones del encargado y con un trabajador marcando en paralelo.

## 6. Reportes completos sin consultas duplicadas — Fase 3

1. Mantener la vista **diaria** actualizada para el encargado. Al abrir el día, consultar solo ese `dayKey` y las correcciones correspondientes; no depender del límite de 500 marcas del panel general.
2. Para la vista **mensual**, efectuar una lectura al seleccionar el mes y conservar el resultado mientras se permanezca en esa vista. Añadir «Actualizar» para traer cambios recientes. Mostrar cuándo se cargó el reporte, especialmente para el mes en curso.
3. Garantizar que Excel y PDF usen el conjunto **completo** del período elegido. Validar conteos, tardanzas, correcciones y coordenadas contra la versión actual antes de publicar. No exportar solo la página visible ni solo las 500 marcas recientes.
4. Si el volumen mensual hace costosa la vista previa, implementar en una segunda iteración páginas de 100–200 filas con cursores. Mantener totales exactos mediante una consulta agregada evaluada por costo y seguridad, o un mecanismo equivalente probado; exportar el período completo al pulsar Descargar. Esta iteración se activa solo si las métricas justifican la complejidad.

**Meta de medición:** abrir varias veces el mismo mes en una sesión no debe releerlo íntegro cada vez. **Puerta:** paridad de reporte diario/mensual y Excel/PDF, incluidos meses con más de 500 marcas, correcciones aprobadas y registros sin marca original.

## 7. Padrón e importación — Fase 4

1. Comparar cada fila del Excel con el padrón ya cargado por el encargado y omitir las filas sin cambios. Las filas modificadas conservan `approvedUid`, estado, contacto y horarios definidos manualmente salvo cambio explícito de la operación.
2. No dar de baja automáticamente a quien desaparezca del Excel; mantener la decisión manual actual. No reescribir el documento del trabajador ni su solicitud al importar una fila sin cambios.
3. Registrar en la vista previa: nuevos, modificados, sin cambios y conflictos por DNI. Escribir auditoría solo para cambios reales.

**Meta:** una segunda importación idéntica debe producir cero escrituras de padrón y cero eventos nuevos de auditoría. **Puerta:** las aprobaciones y marcas previas son idénticas antes y después de importar.

## 8. Reglas de seguridad e índices — Fase 5

Las reglas actuales ya distinguen `get` y `list`, verifican el encargado, vinculan el trabajador anónimo a su DNI y UID aprobados, exigen GPS/hora del servidor y prohíben editar o borrar marcas. La optimización de consultas **no debe ampliar** esos permisos.

| Colección | Regla que debe seguir vigente | Endurecimiento posible, después de adaptar la interfaz |
|---|---|---|
| `marks` | Un trabajador solo puede obtener sus marcas; el encargado puede consultar el equipo. Crear exige UID aprobado, fecha/hora del servidor, GPS y auditoría; actualizar o borrar sigue prohibido. | Mantener `get` por ID para el trabajador. No imponer un límite global a `list` del encargado que corte reportes mensuales. |
| `personnel` y `users` | El trabajador solo obtiene su ficha/perfil; únicamente el encargado administra personal y aprobaciones. | Comprobar en pruebas que las consultas nuevas no permiten enumerar el padrón desde una sesión anónima pendiente. |
| `registrationRequests` | La persona anónima solo obtiene su solicitud; únicamente el encargado puede listar y resolver solicitudes. | Cuando Equipo use consulta acotada, considerar un máximo de resultados por consulta del encargado. Mantener la aprobación atómica y el vínculo `approvedUid`. |
| `incidents`, `adjustments`, `audit` | Incidencias propias para el trabajador; correcciones y auditoría protegidas según el rol actual, sin editar los originales. | Acotar listados históricos del encargado cuando su interfaz ya pagine; conservar consultas necesarias para revisar pendientes y exportar correcciones completas. |
| `privateIdentities` | Lectura y escritura denegadas a la aplicación, incluso para encargados. | Sin cambios; añadir pruebas de regresión explícitas. |

1. Añadir pruebas de reglas para las consultas nuevas: lectura directa de las dos marcas propias por un trabajador aprobado; denegación de marcas de otro DNI; consulta de pendientes solo por encargado; consultas del día/mes solo por encargado; y bloqueo del vínculo `privateIdentities` para ambos tipos de usuario. Las reglas no filtran resultados: una consulta del trabajador debe demostrar por sus filtros que solo puede devolver sus datos.
2. Mantener pruebas de alta y aprobación, retiro de acceso, baja, validación de GPS, servidor, secuencia entrada→salida, unicidad diaria, inmutabilidad, auditoría y corrección separada. Probar también un usuario **ya aprobado** con el formato de datos que existe hoy.
3. Evaluar límites `request.query.limit` para listados históricos de auditoría, incidencias y solicitudes **solo después** de que las nuevas vistas usen paginación. No imponer un límite general a `marks`: impediría reportes mensuales completos y podría bloquear versiones antiguas de la página en caché.
   Estos límites serían una defensa frente a consultas accidentales muy grandes; el ahorro principal proviene de cambiar las consultas de la aplicación, no de las reglas.
4. Medir las lecturas adicionales de `get()`/`exists()` en reglas. Simplificar una condición únicamente si el emulador confirma la misma matriz de permisos. No sustituir la comprobación del UID aprobado y del estado activo por una simple comprobación del DNI, ni quitar auditoría para ahorrar escrituras.
5. Validar o crear los índices compuestos exigidos por las consultas nuevas y esperar a que estén listos antes de publicar la versión que los usa. Evitar publicar reglas más estrictas antes de que el cliente compatible esté desplegado y verificado.

**Puerta:** pruebas positivas y negativas completas en el emulador, `npm run build` correcto y ninguna lectura nueva autorizada para usuarios sin aprobación. **Publicación:** primero índices necesarios, luego Hosting compatible; las reglas nuevas se publican en una ventana separada tras verificar compatibilidad. Las reglas no tienen reversión automática de versión: conservar el archivo anterior y volver a desplegarlo si hay una regresión.

## 9. Despliegue, seguimiento y reversión — Fase 6

1. Ejecutar cada fase de aplicación por separado; no combinar optimización, cambios de reglas e importación del padrón en una sola publicación. Usar una vista previa de Hosting y el emulador para revisar la versión antes de pasarla al canal público.
2. Publicar con la CLI ya conectada y Node portable; compilar antes de cada despliegue. Registrar fecha, versión, cambios, resultados de pruebas y métricas previas. Nunca incluir `.env.local`, credenciales ni listas de personal en artefactos compartidos.
3. Tras cada publicación, comprobar con un celular **ya aprobado**, otro pendiente y la cuenta del encargado: marcar entrada/salida con GPS, ver la marca en Inicio, aprobar una solicitud de prueba, abrir reportes y exportar. Las pruebas que generen datos deben ejecutarse preferentemente en emulador; en producción, usar actividad real o un caso coordinado sin borrar historial.
4. Observar al menos 48 horas de operación y luego siete días de uso normal: lecturas, escrituras, conexiones, listeners, denegaciones de reglas, fallos al marcar, carga de Inicio y consistencia de reportes. Registrar el máximo diario, no sumar porcentajes de días distintos.
5. **Reversión de Hosting:** usar la versión anterior conocida desde el historial de versiones de Firebase Hosting. **Reversión de reglas:** desplegar el archivo de reglas previamente guardado y probado. Como no hay migración de datos, los UID, aprobaciones y marcas permanecen en Firestore durante la reversión.

### Tablero mínimo y umbrales propuestos

| Métrica | Fuente | Meta / acción |
|---|---|---|
| Lecturas de documentos por día y máximo de 7 días | Firebase/Cloud Monitoring | Meta de margen: menos de **25 000/día** con el equipo completo. Investigar al superar 25 000; prioridad alta al superar 40 000 de 50 000. |
| Lecturas por apertura controlada de trabajador y de Inicio del encargado | Medición de consultas antes/después | Reducir la lectura inicial del trabajador a la información visible; lograr al menos 40 % menos en Inicio con actividad comparable. |
| `Snapshot Listeners` y `Active Connections` | Cloud Monitoring | Que listeners suban al abrir una sección y bajen al salir; investigar crecimiento sostenido con el mismo número de sesiones. |
| Escrituras y eliminaciones por día | Firebase/Cloud Monitoring | Confirmar aproximadamente dos escrituras por marcación y detectar importaciones repetidas o borrados inesperados. |
| Denegaciones de reglas a usuarios aprobados; fallos al marcar | Panel de reglas y pruebas operativas | **Cero regresiones**. Las denegaciones esperadas a no aprobados se registran por separado. |
| Tiempo para marcar y visibilidad en el panel | Pruebas móviles con conexión real | El flujo no añade pasos; la marca confirmada aparece en el panel sin recarga manual. |
| Exactitud de reportes diario/mensual y exportaciones | Comparación con datos de prueba y muestras existentes | Mismos registros, horas, tardanzas, correcciones y ubicación que antes; sin truncar el mes. |
| Almacenamiento y transferencia de Firestore/Hosting | Firebase | Revisar semanalmente y ante picos; el objetivo principal del plan sigue siendo lecturas. |

Los umbrales de 25 000/40 000 y la reducción del 40 % son **criterios internos propuestos**, no límites de Firebase ni resultados garantizados. Se ajustan después de medir la línea base y el uso real con más trabajadores.

## 10. Referencias oficiales

- [Cuotas gratuitas de Cloud Firestore](https://firebase.google.com/docs/firestore/quotas)
- [Cómo se contabilizan consultas, listeners y lecturas de reglas](https://firebase.google.com/docs/firestore/pricing)
- [Métricas de uso, listeners y reglas](https://firebase.google.com/docs/firestore/monitor-usage)
- [Las reglas no filtran consultas; restricciones de `get`, `list` y `limit`](https://firebase.google.com/docs/firestore/security/rules-query)
- [Pruebas locales de reglas](https://firebase.google.com/docs/rules/unit-tests)
- [Paginación con cursores](https://firebase.google.com/docs/firestore/query-data/query-cursors)
- [Reversión de una versión de Firebase Hosting](https://firebase.google.com/docs/hosting/manage-hosting-resources)
