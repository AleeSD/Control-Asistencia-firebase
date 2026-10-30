# Control de asistencia · O.S. Logistics

Aplicación web para Firebase `sistema-de-asistencia-os`, preparada para el plan gratuito Spark. Funciona con Firebase Authentication, Firestore y Hosting, sin Cloud Functions ni instalación de Node.js con permisos de administrador.

## Estado del proyecto

- La nueva versión ya está publicada en [sistema-de-asistencia-os.web.app](https://sistema-de-asistencia-os.web.app/) con registro de celulares por DNI y aprobación del encargado.
- Firestore está en Santiago (`southamerica-west1`) y el acceso Google para encargados está habilitado. El correo público de asistencia de Firebase es `operaciones4@oslogisticsperu.com`.
- El primer encargado ya puede entrar con su cuenta de Google. Su dirección personal queda en `privateIdentities`, fuera del acceso de la aplicación; el perfil visible usa el correo corporativo.
- El proveedor **Anónimo** está habilitado sin limpieza automática. Las reglas e índices están publicados, el padrón se gestiona desde **Equipo** y Hosting sirve la versión nueva.

## Flujo preparado

1. El trabajador abre la web desde su propio celular y elige **Soy trabajador**. En su primer ingreso escribe DNI, nombres, apellidos y al menos un contacto: celular o correo. No se le pide verificar ese contacto.
2. El sistema acepta solicitudes solo para DNI activos del padrón. El encargado compara la solicitud con los datos de la empresa y aprueba ese celular desde **Equipo**.
3. Después, en ese mismo navegador, el trabajador pulsa **Marcar entrada** y **Marcar salida**. Ese toque solicita de inmediato el permiso de ubicación al navegador; si ya estaba concedido, obtiene las coordenadas sin otra confirmación. Si el permiso fue rechazado, muestra indicaciones para activarlo y reintentar. Sin coordenadas no se registra la marca. Las marcaciones son únicas por día, tienen hora del servidor y no se pueden editar ni borrar desde la aplicación.
4. El encargado ve entradas, personal activo sin entrada, incidencias y bajas. En **Reportes** puede consultar un día o un mes y descargar cada vista en Excel o PDF. Las coordenadas capturadas se abren en Google Maps. Una incidencia aprobada crea una corrección separada sin alterar la marcación original.

Los conductores y auxiliares tienen como límite de entrada sin tardanza las 06:10, sin tolerancia adicional, y salida variable.

El navegador conserva una credencial anónima para reconocer el celular aprobado. Si se borran sus datos, se usa modo incógnito o se cambia de teléfono, el encargado deberá aprobar el nuevo acceso. El DNI por sí solo no habilita marcaciones.

Desde **Equipo**, el encargado puede usar **Eliminar acceso** para borrar el perfil y la solicitud del dispositivo aprobado, liberar el DNI y aprobar otro celular. Para eliminar una persona del padrón, debe darla de baja y liberar su acceso antes de usar **Eliminar del padrón**. Ambas acciones quedan auditadas y conservan las marcaciones e incidencias históricas. Una importación posterior puede volver a agregar al padrón a una persona eliminada si sigue en el Excel.

## Padrón inicial

El importador lee únicamente las hojas `PERSONAL_OS` y `PERSONAL_SLI` de `PERSONAL_ACTUALIZADO_2026.xlsx`. Acepta solo conductores y auxiliares activos con DNI válido, excluye al coordinador y al personal de monitoreo, y deduplica una persona presente en ambas hojas. El padrón actual contiene **37 personas únicas**: 19 conductores y 18 auxiliares. Las hojas de terceros y vehículos se ignoran. El padrón puede ampliarse, corregirse y darse de baja desde el panel. Una importación posterior actualiza las filas presentes y **no da de baja automáticamente** a quienes falten en el nuevo archivo.

## Ejecutar con Node.js portable

En PowerShell, desde esta carpeta:

```powershell
& 'C:\Users\transporte.ope3\tools\nodejs\npm.cmd' install
& 'C:\Users\transporte.ope3\tools\nodejs\npm.cmd' run dev
```

Abrir `http://localhost:5173/`. Para compilar:

```powershell
& 'C:\Users\transporte.ope3\tools\nodejs\npm.cmd' run build
```

`npm.cmd` evita la restricción de PowerShell sobre `npm.ps1`. La configuración real de la aplicación web está en `.env.local`; no debe copiarse a documentación pública.

## Publicaciones futuras

Al cambiar reglas o índices:

```powershell
& 'C:\Users\transporte.ope3\tools\nodejs\npx.cmd' --yes firebase-tools deploy --only firestore:rules,firestore:indexes --project sistema-de-asistencia-os
```

El padrón se actualiza desde **Equipo** con la sesión del encargado. Para publicar cambios de la aplicación:

```powershell
& 'C:\Users\transporte.ope3\tools\nodejs\npm.cmd' run build
& 'C:\Users\transporte.ope3\tools\nodejs\npx.cmd' --yes firebase-tools deploy --only hosting --project sistema-de-asistencia-os
```

Para volver a probar las reglas, iniciar el emulador de Firestore con Java portable y ejecutar `npm.cmd run test:rules`. Actualmente pasan 14 pruebas locales. La carpeta `functions/` es un prototipo histórico, no forma parte del despliegue Spark.

Consulta [GUIA_ASISTENCIA.md](GUIA_ASISTENCIA.md) para las instrucciones de trabajadores y encargados.
