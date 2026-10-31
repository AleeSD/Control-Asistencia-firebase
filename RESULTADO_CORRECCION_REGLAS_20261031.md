# Errores de lectura de reglas — 31/10/2026

## Hallazgos

La métrica de reglas desglosada por `request_method` atribuye los 24 ERROR iniciales a GET, no a escrituras. Los seis recientes estaban en el bloque aproximado 09:09–09:14 de Lima. En una segunda consulta apareció otro ERROR GET anterior al despliegue correctivo. La métrica API consultada no mostró Commit/PERMISSION_DENIED del 31/10; los cuatro rechazos visibles pertenecían al 30/10, durante el incidente de aprobación previamente corregido. La ausencia de Commit fallidos en esta métrica no prueba que ningún usuario haya tenido un problema de red, GPS o lectura.

Consulta de Logging: no devolvió entradas de error del servicio para la ventana. No se dispone de una traza por persona/documento que permita atribuir cada ERROR histórico a una acción concreta. No se activó logging adicional ni se imprimieron datos personales o credenciales.

Estado de datos: 20 personas activas aprobadas, todas coherentes entre padrón, perfil, directorio y panel. No se encontró evidencia de un bloqueo general de marcación. Los momentos de los bloques de seis errores coinciden con períodos de comprobación de acceso y eliminación de sesiones temporales, pero esa correlación no identifica por sí sola cada petición histórica.

## Causa reproducida

Las funciones de autorización consultaban `.data` y campos de documentos inexistentes. Al faltar una sesión DNI, se intentaba el perfil antiguo `users/{uid}`; para un UID temporal sin ese perfil, la consulta y el acceso a `personnelId` generaban errores de evaluación. También había rutas inseguras para Gmail sin perfil, perfil con identidad privada sin email público y aprobación nula/perfil eliminado.

Se reprodujo el comportamiento con datos ficticios y las reglas publicadas originales. El informe de cobertura del emulador mostró `Null value error` y `Property email is undefined` en esas rutas. Las solicitudes no autorizadas seguían denegadas, pero la evaluación fallaba internamente. Una lectura del panel que falle sí puede impedir a ese cliente llegar al botón de marcar, aunque aquí no se identificó una aprobación vigente incoherente.

## Corrección

- Comprobar existencia antes de leer documentos opcionales.
- Validar claves opcionales con valores predeterminados, sin construir rutas con UID/DNI nulos.
- Conservar la identidad privada del encargado como alternativa válida sin exigir email público.
- Denegar de forma controlada cuando faltan perfil, persona, aprobación o sesión.

No se abrieron nuevas lecturas públicas ni se retiraron controles de aprobación, roles, expiración, GPS, servicio, hora de servidor, auditoría o duplicados. No se añadieron consultas/listeners del cliente. Solo se publicaron reglas; Hosting y aplicación permanecieron en su versión existente.

## Verificación y conservación

29 pruebas de reglas/gestión aprobadas. La regresión específica también comprueba ausencia de errores de evaluación en su cobertura: después de la corrección no aparece ningún `causeMessage` en los casos de perfil ausente, sesión retirada, aprobación nula y Gmail nuevo/identidad privada. Los rechazos esperados de solicitudes malformadas en otras pruebas no deben interpretarse como fallos de una operación válida.

Navegador con Auth/Firestore emulados: DNI → servicio → entrada/salida GPS, otra sesión, aprobación, baja y monitoreo/exportaciones filtradas. Prueba posterior en Hosting: aprobado existente entra con DNI, selecciona servicio y abre el panel en un navegador nuevo. No se pulsó marcar; su cuenta y sesión técnicas de prueba se eliminaron al finalizar.

Comparación canónica antes/después: 43 documentos de padrón, 23 perfiles, 43 directorios, 43 paneles, 23 solicitudes, 84 marcas y 5 correcciones: cero documentos existentes modificados o ausentes. Las 20 aprobaciones activas siguen coherentes. No se realizaron marcaciones ficticias en producción.

Reglas finales publicadas y coincidencia con archivo local comprobada; compilación final sin advertencias. Respaldo original: `tmp/rules-before-null-guards-20261031.rules`. Evidencias: `tmp/rules-diagnosis-before.json`, `tmp/rules-diagnosis-after.json`, `tmp/rules-fix-integrity-before.json`, `tmp/null-before-tests.log`, `tmp/null-after-tests.log`, `tmp/null-ui-tests.log`, `tmp/null-guards-deploy.log` y cobertura `tmp/null-guard-coverage-{before,after}.json`.

## Seguimiento

Monitoring tiene retraso y las ventanas de 24 horas conservan errores anteriores. No se afirma todavía que el contador productivo posterior sea cero: la consulta final cortaba cinco minutos antes y no cubría completamente la versión recién publicada. El seguimiento debe separar errores anteriores y posteriores a este despliegue. Esta investigación es adicional a la revisión diaria 3/7; no cuenta como una revisión nueva y conserva `tmp/optimization-baseline.json`.
