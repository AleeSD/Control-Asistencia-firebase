# Optimización publicada — 28/10/2026

La versión de Hosting `7922d34077152497` se probó en el canal `optimizacion` y se promovió al canal público. La versión anterior recuperable es `fa452fc558312d8e`. Copia local previa: `tmp/optimization-backup-20261028-140247.zip`.

## Cambios

- Trabajador: dos escuchas a las marcas de hoy; tres incidencias recientes; la solicitud se escucha mientras aún no existe el perfil aprobado. El botón espera a cargar ambas marcas. Se conserva el UID anónimo y el vínculo del celular.
- Encargado: Inicio escucha hoy y su historial propio; historial general, correcciones, perfiles y auditoría se cargan según la sección. Las incidencias pendientes y el padrón siguen en vivo. El historial de Marcaciones conserva su límite anterior de 500 para mantener la búsqueda existente.
- Equipo: consulta solo solicitudes pendientes. La importación muestra nuevas/modificadas/sin cambios; compara nuevamente el registro dentro de una transacción para preservar aprobaciones, estado, contactos y horario ante cambios concurrentes. Una fila idéntica no escribe ni genera auditoría. Datos contradictorios del mismo DNI entre hojas detienen la importación antes de escribir.
- Reportes: día en vivo; mes con lectura completa, memoria por sesión y botón Actualizar. El cambio de usuario, rol o estado invalida la memoria. Excel y PDF continúan usando todo el período, sin aplicar el límite de 500.

## Verificación

- Compilación TypeScript/Vite correcta.
- 19 pruebas del emulador aprobadas: incluye permisos de consultas nuevas, lectura de marcas propias inexistentes, rechazo de otro DNI, reporte de 601 marcas e importación idempotente que conserva aprobación/contacto/horario.
- Pruebas de interfaz en Chrome con datos simulados: trabajador aprobado muestra salida y consulta dos documentos; Inicio no escucha auditoría; volver al reporte mensual usa memoria y Actualizar vuelve a consultar; descarga Excel correcta. Estas pruebas no sustituyen una marcación física con GPS de un celular real.
- Vista previa y sitio público: HTTP 200 y pantalla de ingreso operativa sin errores de JavaScript.
- Las reglas publicadas coincidían con el archivo local verificado. No se cambiaron reglas ni índices; se evitaron restricciones que pudieran bloquear clientes antiguos.
- El despliegue se limita a Hosting. No se hicieron marcaciones de prueba, importaciones, modificaciones ni eliminaciones en la base de producción. Se compararon firmas de los vínculos de autorización antes y después del despliegue.

## Medición y seguimiento

Se guardó `tmp/optimization-baseline.json` mediante la API de Monitoring, con consulta de los siete días anteriores. Había dos intervalos con datos disponibles. En el intervalo móvil de 24 horas terminado a las 19:08 UTC del 28/10/2026 se informaron 9 633 lecturas sumando las series recibidas. Es un intervalo móvil, no el día de cuota de Firebase, y no constituye una factura ni una línea base de siete días completos.

No se afirma todavía un porcentaje de ahorro real. La reducción de 100 documentos históricos a dos documentos de hoy es un cambio de alcance de la consulta del trabajador; el ahorro total depende del historial, las sesiones y las lecturas de reglas.

Revisar a las 48 horas y durante siete días: lecturas por intervalo comparable, conexiones/listeners, errores de permiso de aprobados, marca visible en el panel, GPS, y paridad de reportes. Umbrales de investigación propuestos: 25 000 lecturas diarias; prioridad alta a 40 000. No se implementó paginación adicional ni endurecimiento de límites de reglas: esas etapas eran condicionales a las métricas y requieren comprobar compatibilidad de clientes antiguos.

La validación en celulares reales y la observación de días futuros quedan pendientes; los usuarios pueden seguir usando la misma URL y las aprobaciones existentes.

Se programaron siete revisiones diarias a las 14:30 en esta conversación mediante la automatización `seguimiento-asistencia-os`. Avisará sobre problemas, consumo elevado o impedimentos para medir y entregará un balance en la última revisión. Las ejecuciones dependen de la disponibilidad del entorno y de la autenticación existente.

## Consulta solicitada por el usuario — 30/10/2026

**Corte adicional del 30/10:** se implementó ingreso por DNI con sesiones temporales, conservando aprobaciones. Consultar `RESULTADO_ACCESO_DNI.md` al interpretar mediciones posteriores. Referencia previa: ventana terminada a las 11:03:38 de Lima, 3.016 lecturas. La migración añadió 88 escrituras auxiliares puntuales; no extrapolarlas al uso diario. Las nuevas sesiones añaden comprobaciones y una escritura; incidencias del trabajador pasan a consulta bajo demanda. La comparación causal debe separar este corte de la optimización del 28/10 y de los reportes del 30/10.

Medición adicional (no reemplaza la revisión diaria programada): ventanas consecutivas con corte 08:29 de Lima, 4.863 → 1.700 lecturas en 24 horas (−65,04 % observado; no atribuible exclusivamente al código). 101 escrituras, 5 eliminaciones, pico de 25 listeners y 7 conexiones; 0 errores de evaluación de reglas y 22 denegaciones en la última ventana. Sitio y recurso JavaScript HTTP 200. Facturación deshabilitada; datos e índices 518.973 bytes en la última muestra. No se sobrescribió la línea base. La ventana móvil no coincide con el día de cuota. Detalle y cambios de interfaz solicitados en `RESULTADO_REPORTES_20261030.md`.
