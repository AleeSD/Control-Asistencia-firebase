# Marcaciones por día y reportes — 30/10/2026

## Conservación de la información

Por indicación del usuario, las entradas previas al 30/10/2026 08:50:29 (Lima) conservan la etiqueta Puntual. Las nuevas entradas dentro del horario muestran Registrado. Las tardanzas y horarios mantienen su cálculo anterior. Este cambio es de presentación: no migra ni modifica documentos existentes.

No se escribieron ni eliminaron usuarios, solicitudes, aprobaciones, personal ni marcaciones en producción. No se modificaron reglas ni índices. Las pruebas con escrituras se ejecutaron exclusivamente en el emulador del proyecto `demo-os-logistics`; la interfaz y las descargas se probaron con datos simulados.

Copia de los archivos originales: `tmp/reportes-backup-20261030/`.

## Consulta y reportes

- Marcaciones abre el día seleccionado, inicialmente hoy. Consultas de marcas y correcciones por igualdad de fecha, sin recortar a 500. Búsqueda por nombre, fecha o tipo dentro del período; botón Hoy. Recientes conserva el historial limitado a las últimas 500 marcas para el encargado.
- Reportes conserva mes y día. Resumen por persona: una fila por identidad/DNI y día, ordenada por fecha y nombre; entrada, salida, empresa, estado de entrada, minutos de tardanza y corrección aprobada.
- El resumen muestra la hora corregida cuando existe una corrección aprobada. Conserva el horario de la marca original para calcular tardanza; una corrección sin marca usa el horario actual del padrón si está disponible. El detalle muestra por separado los originales y la tardanza original.
- Reporte diario incluye el padrón activo **actual** y personas con marcas/correcciones del día. «Sin registro» y «Sin entrada» no equivalen a faltas. No reconstruye el padrón de fechas pasadas. El mes muestra solo personas/días con marcas o correcciones; no inventa ausencias, descansos ni permisos.
- Duplicados históricos, si existen: resumen elige primera entrada y última salida; el detalle conserva todos los registros.
- Excel incluye Resumen asistencia, Cómo leer el reporte y Detalle marcaciones. PDF descarga la vista elegida (resumen o detalle). Cambiar la vista o descargar no realiza nuevas consultas.
- Se conserva la consulta mensual completa con memoria por sesión y botón Actualizar; el día sigue en vivo. No se aumentan listeners por alternar diseños del reporte.

## Pruebas

- Compilación TypeScript/Vite correcta; advertencia de tamaño de paquetes ya existente.
- 19 pruebas de permisos aprobadas, incluyendo consultas por día con 601 marcas, consultas propias de marcas/correcciones y protección contra acceso a otros trabajadores.
- 5 pruebas de resumen: cambio prospectivo, conservación de datos originales, correcciones, padrón activo, personal de baja con registros históricos y más de 500 marcas.
- Chrome: filtro día/anterior/recientes/hoy, resumen/detalle, archivos Excel diarios y mensuales reabiertos y comprobados; cuatro descargas PDF, incluido uno de seis páginas con 75 nombres largos. Renderizado y revisión visual sin recortes. Portal trabajador aprobado mantiene dos escuchas de marcas.

## Consumo medido antes de esta publicación

Fuente: Cloud Monitoring mediante la autenticación existente de Firebase CLI. Archivo `tmp/optimization-monitoring/2026-10-30T13-34-53-790Z.json`. Línea base original preservada.

Ventanas consecutivas de 24 horas con corte a las 08:29:43 de Lima (no son días de cuota de Firebase):

| Métrica | 28–29/10 | 29–30/10 |
|---|---:|---:|
| Lecturas de documentos | 4.863 | 1.700 |
| Escrituras | 130 | 101 |
| Eliminaciones | 22 | 5 |
| Máximo de listeners simultáneos | 42 | 25 |
| Máximo de conexiones simultáneas | 16 | 7 |
| Errores de evaluación de reglas | 3 | 0 |
| Evaluaciones denegadas | 77 | 22 |

Disminución observada de lecturas: 65,04 %. No es una atribución causal exclusiva a la optimización: cambiaron la actividad, las sesiones y las pruebas. La primera ventana también contiene horas anteriores a la optimización. Las denegaciones no identifican por sí solas un fallo de usuarios aprobados. Se prioriza el recurso Database para evitar duplicar métricas de reglas/gauges con firestore_instance.

La última ventana representa el 3,4 % del límite diario de referencia de 50.000 lecturas; no es un porcentaje exacto del día de cuota, que se reinicia según hora del Pacífico. Escrituras y eliminaciones muy por debajo de las 20.000/día. Facturación deshabilitada comprobada por Cloud Billing (`billingEnabled: false`). Almacenamiento de datos e índices: 518.973 bytes en la última muestra disponible del 30/10 a las 07:59 de Lima, por debajo de 1 GiB. Evidencia: `tmp/optimization-monitoring/billing-20261030.json`. No constituye una auditoría de todas las cuotas de Hosting, transferencia u otros servicios.

Referencias oficiales: https://firebase.google.com/docs/firestore/quotas y https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

## Publicación

Vista previa `reportes-dia`, versión `3cdf4dc03b50c298`, compilada y verificada antes de promover a live. Versión pública anterior: `7922d34077152497`.

Promoción a live completada mediante `hosting:clone` exclusivamente. Pantalla de acceso pública verificada; el HTML público coincide con `dist/index.html` y el recurso principal responde HTTP 200.

La recarga de la página obtiene la interfaz nueva sin cerrar sesión ni borrar datos del navegador. Los clientes abiertos pueden continuar marcando; las etiquetas se calculan al cargar la versión nueva y respetan el corte temporal anterior.
