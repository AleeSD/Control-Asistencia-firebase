# Servicios en asistencia — 31/10/2026

Reglas y Hosting publicados en https://sistema-de-asistencia-os.web.app. Despliegue registrado en `tmp/service-deploy.log`.

## Comportamiento

Después del DNI aprobado se muestra un formulario móvil con fecha, nombre y selector obligatorio: SPS Home Delivery, Transferencia, Refrigerado, Mass y Paquetería. «Continuar» abre el panel de asistencia. «Volver al DNI» sale del acceso; «Cambiar servicio» permite revisar la elección antes de marcar. Se solicita de nuevo al volver a ingresar y al cambiar el día de Lima. La selección se mantiene en memoria, sin escribir un documento adicional.

Cada nueva marca del cliente actualizado incorpora `service`. No se actualizan documentos anteriores. Una entrada anterior sin servicio puede completarse con una salida nueva con servicio. Las correcciones sin marca original conservan servicio vacío.

Marcaciones muestra Servicio junto a Trabajador. El resumen y detalle de Reportes lo muestran junto al DNI. Excel incluye la columna en ambas hojas; PDF la incluye en resumen y detalle, por día y por mes. El resumen toma el servicio disponible entre entrada y salida; si ambos difieren, muestra los dos separados por « / ». El detalle refleja el valor original de cada marca, vacío en las anteriores.

## Compatibilidad y seguridad

Las reglas validan que, si una nueva marca incluye servicio, pertenezca a las cinco opciones. Se conserva compatibilidad con clientes anteriores sin ese campo para no bloquear una marcación desde una pestaña antigua. No se modifican aprobaciones, horarios, permisos, marcas anteriores ni correcciones. Se mantienen GPS obligatorio, hora del servidor, auditoría e inmutabilidad. Para que el personal vea el selector debe actualizar la página antes de marcar.

## Validación y consumo

Compilación TypeScript/Vite correcta. Pasaron 33 pruebas de reglas, gestión y reportes, incluyendo salida con servicio tras entrada antigua sin servicio, rechazo de valores vacíos/desconocidos, conservación de históricos y resumen con servicios diferentes. Navegador móvil con Auth/Firestore emulados: DNI, selección, entrada/salida, recarga, otro dispositivo, aprobación y baja. Captura: `tmp/service-picker.png`. Evidencia: `tmp/service-tests.log`.

La ampliación agrega un campo a la misma escritura de marcación. No añade consultas, listeners ni escrituras por selección. El tamaño almacenado/exportado aumenta ligeramente por el texto del servicio.

La prueba adicional `tmp/test-service-manager.mjs` verificó la columna y el valor Mass en los archivos Excel y PDF descargados por día y mes, además de la columna en Marcaciones. Evidencia: `tmp/service-exports-test.log`.
