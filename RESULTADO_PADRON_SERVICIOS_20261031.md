# Catálogo y verificación de personal — 31/10/2026

Publicado: reglas y Hosting correctos, HTML público coincidente con compilación y acceso real por DNI/servicio verificado sin marcar. Evidencia de despliegue: `tmp/seven-services-deploy.log`.

## Catálogo

Servicios seleccionables por jornada: SPSA HD, Transferencia, Refrigerado, MASS, Paquetería, Giddings y TPSA. Se utiliza la ortografía Refrigerado y Paquetería. No se vincula un servicio permanente a las personas; el servicio aportado en la relación es contextual, porque pueden rotar.

Los nombres históricos SPS Home Delivery y Mass se presentan y filtran como SPSA HD y MASS. Las reglas conservan los valores antiguos para clientes abiertos y aceptan los siete actuales. Normalización al consultar/exportar; no se reescriben marcas históricas ni se completan servicios vacíos.

## Padrón

Se interpretaron las filas suministradas como empresa, servicio, ocupación, nombre, DNI y celular, pese al desplazamiento visual de encabezados. Los DNI se trataron como texto, conservando ceros iniciales. Se compararon nombres sin acentos, capitalización ni orden de palabras, para no confundir formatos de presentación con personas distintas.

Resultado: 16/16 personas ya existentes y activas. Empresa, ocupación y teléfono coincidentes en todas; ninguna tiene acceso aprobado aún. No fue necesario importar ni duplicar fichas. Pueden ingresar con su DNI y solicitar aprobación. La relación no se utiliza como lista para dar de baja a otras personas.

Verificación final de las vistas de acceso: 16 directorios habilitados/coherentes y 16 paneles coherentes, sin faltantes ni discrepancias. Evidencia: `tmp/service-roster-final.json`.

Se encontró una errata real en Eduardo Daniel Ubaldo Concha: UBADLO en lugar de UBALDO. Se corrigieron únicamente apellido y nombre de presentación, metadatos de actualización y el nombre de su panel, en una transacción con auditoría. Se preservaron aprobación, horario y contacto. Verificación posterior: cero discrepancias de nombre por el criterio indicado.

Dos personas comparten el celular proporcionado: José Miguel Saman Montes y Renzo Sebastian Huarcaya Abarca. Se conserva el dato y se señala para confirmación administrativa; no se inventa un reemplazo ni se bloquean por tener el mismo número. La identidad y la solicitud se distinguen por DNI.

El coordinador conserva la entrada 06:10 que ya figuraba en su ficha; esta tarea no cambia horarios. Si requiere otra hora, el encargado puede configurarla en Equipo.

## Conservación y pruebas

Inventario de referencia de esta revisión: 46 personas, 23 perfiles, 23 solicitudes, 84 marcas y 5 correcciones. Comparación posterior: cero perfiles, solicitudes, marcas o correcciones existentes modificados/ausentes; un documento de padrón cambiado por la errata indicada. Sin asignaciones de servicio a personas ni aprobaciones automáticas.

Compilación correcta; 30 pruebas de reglas/gestión y 11 pruebas de reportes/filtros aprobadas. Se probaron las siete opciones en reglas, compatibilidad histórica, marca sin servicio fija en padrón, flujo móvil, aprobación, entrada/salida, baja y filtros/exportaciones. Evidencia: `tmp/seven-services-tests.log` y pruebas en `tests/service-filter.test.mjs`, `tests/dni.rules.test.mjs` y `tests/attendance-report.test.mjs`.

Detalles de la conciliación en `tmp/service-roster-verified.json` (datos personales, uso interno). Referencia de integridad en `tmp/service-roster-integrity-before.json`, corrección auditada resumida en `tmp/service-roster-name-fix.json`. No se imprimieron credenciales.

Enlace a compartir: https://sistema-de-asistencia-os.web.app. El trabajador ingresa DNI, completa datos si es primera vez y espera aprobación del encargado. El catálogo se actualiza al recargar la página.
