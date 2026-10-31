# Revisión de privacidad y seguridad

Fecha: 31/10/2026, horario de Lima. Aplicación: https://sistema-de-asistencia-os.web.app.

## Cambios publicados

- Usuario de OSMonitor inicialmente vacío, sin valor ni sugerencia que publique su identificador en el campo. El campo solicita `autocomplete="off"`, sin mayúsculas automáticas ni corrector. Un gestor de contraseñas o navegador puede ignorar esta preferencia; la aplicación no completa el usuario por sí misma.
- Eliminado el párrafo que mostraba el correo corporativo. La recuperación también usa un aviso genérico, sin revelar la dirección.
- Usuario inválido y contraseña incorrecta comparten el mensaje de acceso fallido. La solicitud de recuperación para un usuario desconocido presenta el mismo aviso genérico de solicitud, sin enviar correo. Un campo vacío pide ingresar el usuario.
- Recuperar contraseña y volver al ingreso están en filas separadas.
- Hosting envía `X-Frame-Options: DENY` y `Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'` para impedir la incrustación de la página en otros sitios y limitar objetos y bases de URL. Es una política parcial, no una CSP completa contra todo script malicioso.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` y `Permissions-Policy: geolocation=(self), camera=(), microphone=()`. La aplicación mantiene la ubicación y evita divulgar la URL de origen al seguir enlaces externos; cámara y micrófono no se utilizan.
- `tmp/` queda excluido de futuras incorporaciones a Git para reducir la publicación accidental de respaldos o evidencias locales. Hosting ya publica únicamente `dist/`.

No se modificaron cuentas, contraseñas, aprobaciones, documentos de asistencia ni reglas de Firestore en esta revisión. El despliegue fue exclusivamente de Hosting.

## Hallazgos pendientes y alcance

| Prioridad | Hallazgo | Alcance y siguiente paso |
| --- | --- | --- |
| Alta | DNI como único dato de acceso | Es el flujo solicitado anteriormente. Quien conoce un DNI aprobado puede iniciar una sesión de esa persona, consultar los datos que su sesión permite y marcar en su nombre. La aprobación del padrón no demuestra quién está usando otro celular. Una protección adicional —por ejemplo PIN personal con verificación segura en servidor o vínculo de dispositivo— requiere un cambio de diseño y pruebas de migración que mantengan las aprobaciones. No se añadió unilateralmente un requisito de acceso. |
| Media | Correo del monitor incluido en JavaScript público | Se eliminó de la interfaz y avisos, pero la aplicación todavía convierte el usuario en una dirección para llamar a Firebase Authentication. Esa dirección puede inspeccionarse en el código o la petición de inicio de sesión. Moverla a una variable de entorno u ofuscarla no la convierte en secreta. Ocultarla también a una inspección técnica requiere trasladar esa traducción/autenticación a un componente de servidor o rediseñar las identidades. No se cambió de plan ni se creó un backend de pago. |
| Media | Abuso de solicitudes y cuotas | Las reglas limitan datos y acciones, pero no aportan un límite general de intentos por persona o por IP para DNI. La interfaz genérica no evita peticiones directas a las APIs. Evaluar App Check y límites en servidor antes de ampliar el uso; desplegarlos gradualmente y medir rechazos para no bloquear a trabajadores. |
| Media | Alertas de dependencias de Excel | `npm audit --omit=dev` informó 9 paquetes con clasificación moderada, 0 altas y 0 críticas. Se originan en dos avisos de `minimatch` y `uuid`, propagados por dependencias de ExcelJS. La sugerencia automática incluye retroceder ExcelJS de 4.4.0 a 3.4.0; no se aplicó porque puede romper la importación/exportación. En el código instalado, ExcelJS usa `uuid.v4()`, mientras el aviso describe v3/v5/v6 con búfer externo; el empaquetado de navegador usa la variante de documento, no el escritor de streams de Node que importa Archiver. No se identificó una vía explotable en los recorridos revisados, pero no se declara el riesgo inexistente. Programar actualización o sustitución de la biblioteca con pruebas de archivos. |
| Operativa | GPS recibido desde el cliente | Las reglas verifican presencia, tipos y rangos. Esto no acredita físicamente la posición ni evita GPS simulado. Mantener la comparación operacional con Onway; un control más estricto requiere otro diseño. |
| Operativa | Cuenta de monitor compartida | La auditoría identifica a OSMonitor, no al operador humano que comparte esa cuenta. Si se necesita responsabilidad individual, conviene dar una cuenta limitada a cada operador. |

## Controles revisados

- Los roles se comprueban en Firestore, además de ocultarse opciones en la interfaz. Monitor no obtiene permisos para modificar el padrón, retirar accesos, cambiar roles, leer Auditoría o vínculos privados.
- El directorio anterior al ingreso permite consultar un DNI exacto y solo sus indicadores activo/aprobado; se deniega listar el padrón desde una sesión anónima. Permanece la posibilidad de probar DNIs individualmente, vinculada al diseño anterior.
- Las sesiones de trabajador se vinculan a un DNI, duran 12 horas y vuelven a comprobar su aprobación. No pueden cambiar de persona modificando ese documento.
- Marcaciones originales sin permiso de edición o borrado; creación con hora del servidor, ubicación y auditoría. Las correcciones requieren el flujo autorizado.
- Los valores de la interfaz se renderizan como texto React; no se encontraron usos de `dangerouslySetInnerHTML`, `innerHTML` ni registros explícitos de contraseñas o tokens en `src/`. Los enlaces de Maps usan coordenadas numéricas y `noopener noreferrer`.
- En `dist/`: 9 archivos, ningún archivo de datos/documento/entorno, ninguna fuente `.map`, ninguna coincidencia con el Gmail personal del encargado ni patrones de clave privada o token de actualización buscados. Es una comprobación de patrones, no una garantía exhaustiva de ausencia de secretos.
- Solicitudes públicas a `.env.local`, código fuente, `tmp/optimization-baseline.json` e informe local devolvieron el HTML del ingreso por la reescritura SPA, no esos archivos.
- Configuración de Firebase Authentication consultada en modo lectura: protección mejorada de privacidad del correo activada; acceso por contraseña y anónimo habilitados; sin política de contraseña personalizada en la respuesta. No se modificaron estos ajustes.
- Las claves web de configuración de Firebase son identificadores de proyecto, no una autorización para leer la base. La protección efectiva sigue siendo Authentication y las reglas. No se publicaron credenciales de servidor.

## Verificación

- Compilación TypeScript/Vite correcta.
- 37 pruebas de reglas aprobadas: DNI, encargado, monitor Google/contraseña, permisos, rechazo de escalada de rol, aprobaciones, bajas, marcaciones y correcciones. Las denegaciones esperadas de esos ensayos son locales.
- Navegador local con emuladores: campo vacío, recuperación sin correo visible, contraseña errónea, recuperación válida, ingreso, aprobación, corrección, exportación, recarga y cierre de sesión. El único correo de recuperación del ensayo lo gestionó el emulador, no el servicio real.
- Producción: formulario y mensajes sin dirección visible, usuario vacío y `autocomplete=off`, enlaces en filas independientes a 320/390/480/1440 px, ubicación disponible, apertura/cancelación de Google y vuelta a monitoreo sin excepciones. No se enviaron correos ni se iniciaron sesiones reales durante esa comprobación.
- Cabeceras presentes en ambos dominios Hosting. El recurso reservado `/__/auth/iframe` de Firebase no recibe la prohibición de marcos aplicada a la página, preservando la autenticación.
- Integridad respecto a la captura anterior: 0 documentos existentes modificados o ausentes. Se conservan 46 personas, 24 perfiles, 23 solicitudes, 84 marcaciones y 5 correcciones.
- Se conserva `tmp/optimization-baseline.json`. Las cabeceras y textos no añaden lecturas o escrituras de Firestore al flujo normal.

La revisión cubre el código del cliente, reglas, configuración de Authentication consultada, artefactos desplegados y recorridos indicados. No equivale a una prueba de penetración completa ni a una auditoría de todos los permisos IAM, dispositivos o buzones corporativos.

Evidencias locales: `tmp/monitor-privacy-build.log`, `tmp/monitor-privacy-ui.log`, `tmp/privacy-rules.log`, `tmp/monitor-privacy-deploy.log`, `tmp/privacy-bundle-audit.json`, `tmp/privacy-auth-config.json`, `tmp/privacy-npm-audit.json`, `tmp/osmonitor-privacy-mobile.png`, `tmp/check-monitor-privacy-public.cjs`.

## Fuentes técnicas

- [Firebase: acceso por contraseña y privacidad de correo](https://firebase.google.com/docs/auth/web/password-auth).
- [Firebase: claves web de configuración](https://firebase.google.com/docs/projects/api-keys).
- [Firebase Hosting: configuración de cabeceras](https://firebase.google.com/docs/hosting/full-config).
- [MDN: X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options).
- [Aviso de minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) y [aviso de uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
