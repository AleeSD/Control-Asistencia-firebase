# Filtros por servicio — 31/10/2026

Publicado en la URL habitual. Hosting HTTP 200 y HTML público coincidente con la compilación local. Evidencia: `tmp/filter-deploy.log`.

Marcaciones y Reportes incluyen filtros independientes con Todos los servicios (predeterminado), los cinco servicios configurados y Sin servicio para históricos. Los filtros se combinan con el día/mes y, en Marcaciones, con la búsqueda. Cambiar de cuenta restablece Todos.

En Marcaciones y en el detalle del reporte se filtra por el servicio de cada marca. En el resumen se seleccionan las jornadas completas con alguna marca del servicio elegido, conservando entrada, salida y correcciones: una entrada antigua sin servicio sigue visible en el resumen Mass si la salida nueva lleva Mass. Si hubo dos servicios en la misma jornada, la jornada aparece al filtrar cualquiera de ambos. Sin servicio, en resumen, incluye solo jornadas sin ningún servicio y personal sin registros, mientras el detalle incluye cada marca vacía. La plataforma y la hoja explicativa indican esta diferencia.

Excel y PDF respetan el filtro. El nombre de archivo indica servicio/todos/sin-servicio; el PDF y la hoja Cómo leer el reporte identifican el filtro. Excel contiene resumen de jornadas y detalle de marcas filtrados; PDF utiliza la vista elegida.

La implementación filtra los datos ya cargados, sin agregar consultas, listeners, índices ni escrituras. Conserva los límites existentes de Marcaciones recientes (500 para encargado), el rango consultado y la caché mensual de Reportes. No altera registros, aprobaciones ni reglas.

Validación: compilación TypeScript/Vite correcta; 10 pruebas de reportes y filtros aprobadas; prueba en navegador con Firebase emulado de Marcaciones por Mass, Transferencia, Sin servicio y Todos. Se verificaron 16 descargas (cuatro filtros × día/mes × Excel/PDF), comprobando valores y exclusión de otros servicios, conservación de entrada antigua en resumen y contenido filtrado de las dos hojas de datos. Evidencias: `tests/service-filter.test.mjs`, `tmp/test-service-filters.mjs`, `tmp/filter-tests.log`. Las pruebas no escriben datos de producción.
