# Aplicación de asistencia O.S. Logistics: investigación y plan

Fecha de consulta: 31/10/2026. Estado: propuesta para evaluación, sin cambios en la aplicación ni en Firebase. El usuario confirmó Android y varios iPhone; todavía no existe un inventario de modelos y versiones.

## 1. Recomendación

Recomiendo mantener al encargado en la web y desarrollar el acceso del trabajador con **React + Capacitor para Android e iOS**, conservando una versión web instalable (PWA) como respaldo. Es la mejor relación entre reutilización del sistema, sencillez operativa, acceso a ubicación del teléfono y mantenimiento, para el alcance actual.

La recomendación es un juicio técnico basado en el código revisado y las opciones siguientes, no un resultado de pruebas de rendimiento entre frameworks. Debe confirmarse con una prueba de concepto en dispositivos reales. No recomiendo decidir solo por tener Android Studio: una app únicamente Android no cubre los iPhone que ya usan los trabajadores.

Dos rutas de inversión:

- **Menor desembolso inicial:** PWA para Android/iPhone, sin tiendas, aceptando las limitaciones del navegador para ubicación e instalación.
- **Mejor experiencia instalada y continuidad del código actual:** Capacitor Android + iOS, con GPS nativo, tiendas y respaldo web. Se puede empezar el piloto Android mientras se prepara iOS; el iPhone mantiene acceso web durante esa transición. No se debe declarar una cobertura nativa completa hasta validar ambas plataformas.

Cambiaría a Flutter o React Native si la prueba de concepto revela problemas graves de WebView/SDK, o si el producto evoluciona a una aplicación operativa extensa. Kotlin nativo ganaría si se decide expresamente atender solo Android y priorizar integración profunda con el sistema sobre reutilización y cobertura iPhone.

## 2. Qué ya tenemos y qué se puede conservar

Revisión local de `package.json`, `src/firebase.ts`, `src/dniAccess.ts`, `src/WorkerPortal.tsx`, `src/workerActions.ts`, `src/services.ts` y `firestore.rules`:

- React, TypeScript y Vite. Interfaz del trabajador ya separada como componente, pero incluida en la misma aplicación que el panel del encargado.
- Firebase Authentication anónimo para el trabajador y Google para el encargado, con instancias separadas. El trabajador utiliza persistencia de sesión del navegador.
- Aprobación de la persona conservada en `personnel.approvedUid → users`; directorio mínimo, panel y sesiones por DNI. Sesiones con límite de 12 horas en reglas.
- Flujo DNI → servicio → entrada/salida; GPS obligatorio. Cinco servicios, incidencias, filtros y reportes existentes.
- Marca y auditoría se escriben juntas. IDs `DNI_fecha_tipo`, sin edición de marcas. Hora del servidor y día de Lima. Las correcciones se guardan aparte.
- Cuatro escuchas principales en el panel del trabajador; incidencias recientes se consultan al abrir su opción.
- Ubicación mediante `navigator.geolocation`. No se encontró una PWA formal con manifest y service worker en el código revisado.
- Las reglas de nuevas marcas exigen actualmente `source == 'web'`. Una app no podría cambiar ese valor a `android` o `ios` sin adaptar previamente el contrato y las reglas.

No es necesario reemplazar Firestore, duplicar el padrón ni pedir nuevas aprobaciones a las personas existentes. Se deben preservar DNI, vínculos y documentos históricos; cambiar de cliente no significa crear otra persona.

La interfaz del trabajador puede reutilizarse bastante, pero no todo se convierte automáticamente en código nativo. Ubicación, reanudación, almacenamiento de sesión, conectividad, botón Atrás, seguridad y publicación necesitan integración y pruebas.

## 3. Comparación de alternativas

Los esfuerzos son estimaciones propias de planificación para un MVP pequeño con pruebas. No son precios de mercado ni cotizaciones; dependen del estado del entorno y de los teléfonos.

| Alternativa | Ventajas para este proyecto | Limitaciones y desventajas | Esfuerzo orientativo | Dictamen |
|---|---|---|---:|---|
| Web móvil actual mejorada | Casi ninguna transición, cualquier navegador compatible, actualización central | Sin instalación gestionada; permisos y activación de ubicación dependen del navegador | 12–24 h para mejoras acotadas | Respaldo permanente |
| PWA instalable | Reutiliza React; icono de acceso; Android/iPhone; sin cuota de tiendas | Instalación distinta por navegador; límites de APIs web; icono no convierte GPS web en nativo; debe gestionar caché/versiones | 24–48 h como proyecto independiente | Mejor alternativa de presupuesto mínimo |
| React + Capacitor | Reutiliza pantallas y lógica TypeScript; plugins nativos; Android Studio en Android; iOS posible | Usa WebView; versiones del runtime importan; plugins y ciclo de vida requieren mantenimiento; iOS necesita su cadena de herramientas | 100–180 h Android+iOS, con pruebas y preparación de publicación | Recomendación principal |
| Kotlin Android nativo | Control directo de permisos y ubicación; SDK Firebase nativo; buena integración Android | Reescritura del cliente; no funciona en iPhone; mantener web y otra app iOS si se amplía | 100–180 h Android | Buena si se acepta excluir iOS nativo |
| Flutter | Interfaz compartida Android/iOS; integración Firebase; base para una app operativa mayor | Reescritura en Dart, plugins y aprendizaje; la simplicidad del alcance no justifica por sí sola migrar | 140–240 h ambas plataformas | Segunda familia viable si se prefiere reescribir |
| React Native, con o sin Expo | React/TypeScript, UI nativa, Android/iOS | Los componentes HTML/CSS actuales no se reutilizan directamente; hay que adaptar interfaz, librerías y persistencia | 130–220 h ambas | Alternativa sólida, más trabajo que Capacitor aquí |
| TWA / Bubblewrap | Publica la experiencia web en Android, poco cambio de UI | Es contenido web mostrado por el navegador; no soluciona por sí mismo el GPS nativo; iPhone sigue fuera | 24–48 h más preparación web/tienda | Poco valor adicional para la necesidad de ubicación |
| WebView propio muy básico | Parece rápido al principio | Hay que resolver permisos, seguridad, navegación, sesión y versiones; suele trasladar los mismos problemas de la web al APK | Variable | Prefiero un runtime mantenido a construirlo desde cero |
| No-code, por ejemplo AppSheet | Formularios y captura de ubicación sin escribir toda la interfaz | Licencias por usuario; integración y autenticación no equivalentes al sistema actual; riesgo de duplicar datos y controles | Depende de integración | No lo recomiendo teniendo ya este sistema |

PWA tiene instalación en iOS, pero el botón web `beforeinstallprompt` no tiene el mismo soporte allí; debe guiarse al usuario según su navegador. [Instalación PWA, MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

Capacitor utiliza runtimes con acceso a código nativo; la parte Android se trabaja con Android Studio. Su documentación de la rama consultada indica Android 7/API 24+ con WebView compatible. Esto no garantiza que nuestro JavaScript, Firebase y cada plugin funcionen en todo dispositivo que cumpla ese mínimo. [Android en Capacitor](https://capacitorjs.com/docs/android).

Flutter publica una matriz de plataformas que debe verificarse al fijar versión. React Native permite compartir desarrollo entre Android/iOS, pero la UI actual en HTML se reescribe con sus componentes. [Plataformas Flutter](https://docs.flutter.dev/reference/supported-platforms), [React Native](https://reactnative.dev/docs/environment-setup).

TWA depende de la experiencia web y de la asociación del sitio con el propietario de la app; no equivale a integrar un plugin GPS. [TWA, Google](https://developer.chrome.com/docs/android/trusted-web-activity).

## 4. Arquitectura propuesta

```text
WEB DEL ENCARGADO                    APP DEL TRABAJADOR
React actual                        React + Capacitor Android / iOS
Google, equipo, aprobaciones         DNI, aprobación, servicio,
marcaciones, reportes, auditoría     ubicación, entrada/salida, ayuda
             \                     /
              Firebase Auth + Firestore + reglas comunes
                         |
               Padrón e historial únicos

WEB/PWA DEL TRABAJADOR → mismo contrato y base, como respaldo
```

Separar puntos de entrada y compilaciones. La app del trabajador no necesita cargar ExcelJS, jsPDF, gráficos de monitoreo ni el código del panel de equipo. Compartir modelos, servicios, validaciones, cálculo de fecha y contrato de escritura. La separación de interfaz mejora tamaño y mantenimiento; la seguridad seguirá dependiendo de las reglas, no de ocultar botones.

Introducir adaptadores con implementaciones diferentes:

- `LocationProvider`: navegador en PWA; plugin nativo en Android/iOS.
- `SessionStore`: persistencia adecuada a cada entorno, manteniendo expiración y revocación del servidor. No guardar contraseñas/tokens propios en almacenamiento genérico.
- `Lifecycle/Connectivity`: suspender escuchas que no hacen falta en segundo plano, recargar estado al volver, recuperar operaciones dudosas.
- `AttendanceRepository`: mismo contrato y confirmación del servidor. Comenzar evaluando el SDK JS actual dentro del runtime; si falla, valorar un puente al SDK nativo. No mezclar dos sesiones Auth independientes sin diseño explícito.

La compatibilidad del SDK Firebase debe probarse en la WebView real, no inferirse solo de una ejecución correcta en Chrome de escritorio. [Entornos del SDK JS](https://firebase.google.com/docs/web/environments-js-sdk).

## 5. Cómo se usaría

**Habitual:** abrir icono → DNI → verificar nombre → seleccionar servicio del día → botón grande «Marcar entrada» o «Marcar salida» → ubicación y envío → confirmación de hora recibida del servidor.

**Primera vez:** el mismo registro y aprobación vigentes. Al aprobar, se habilita la persona; instalar la app no requiere volver a aprobar a quien ya tiene autorización. Un celular nuevo genera una sesión técnica, no otra ficha de personal.

**Permiso denegado/GPS apagado:** explicación breve con «Permitir ubicación» o «Abrir ajustes». Android puede presentar un diálogo del sistema para corregir ajustes cuando el sistema lo permite; requiere consentimiento. iOS tiene su propio permiso y, cuando corresponde, guía a Ajustes. No se puede garantizar que la aplicación active GPS por sí sola en todos los teléfonos. [Ajustes de ubicación Android](https://developer.android.com/develop/sensors-and-location/location/change-location-settings), [plugin de ubicación](https://capacitorjs.com/docs/apis/geolocation).

**Sin señal:** indicar que la marca no está confirmada. Ofrecer reintento y conservar la vía de incidencia. La pantalla instalada puede abrir sin internet si sus recursos están locales; eso no convierte la marcación en una operación validada fuera de línea.

**Envío dudoso:** si se pierde conexión después de tocar Marcar, consultar el ID estable de esa marca antes de reintentar. No mostrar un segundo éxito ni crear otro ID. La escritura atómica y la prohibición de actualizar conservan el control de duplicados entre dispositivos.

Para personas con poca experiencia: una acción principal, botones de al menos 48 unidades de interfaz, texto legible con tamaño del sistema, mensajes con palabras y no solo colores, compatibilidad TalkBack/VoiceOver. No solicitar contactos, micrófono ni ubicación en segundo plano para registrar asistencia.

## 6. Compatibilidad real y optimización

No prometer «funciona en todos». Definir cobertura después del inventario: modelo, versión Android/iOS, memoria aproximada, espacio, WebView/navegador, servicios de Google y red habitual. No hace falta recoger IMEI, seriales ni cuentas personales para este inventario.

Objetivo propuesto, no certificado todavía: Android 8+ y iOS 15+; evaluar Android 7 si hay usuarios que lo necesitan y las dependencias lo permiten. La rama Capacitor consultada indica iOS 15+ y Xcode 26+. Fijar versiones y requisitos reales antes de construir. Si un teléfono queda fuera, ofrecer web compatible o dispositivo de operación; no usar dependencias abandonadas solo para bajar el mínimo. [Capacitor iOS](https://capacitorjs.com/docs/ios).

Pruebas físicas mínimas sugeridas: 6 Android de varias marcas, incluyendo uno de gama baja y uno antiguo, y 3 iPhone representativos. Incluir Huawei sin Google si existe en el padrón. La compatibilidad de Firebase no prueba la del proveedor de ubicación ni la de App Check; son componentes separados. [Dependencias Firebase/Play Services](https://firebase.google.com/docs/android/android-play-services).

Optimización prevista:

1. Paquete exclusivo del trabajador, sin dependencias administrativas.
2. Recursos locales pequeños, sin mapas embebidos ni video; mantener coordenadas y enlace Maps.
3. Capturar una posición al marcar; no seguimiento continuo ni GPS permanente.
4. Solicitar ubicación reciente y registrar precisión; fijar política de calidad a partir del piloto. No bloquear arbitrariamente con un umbral pequeño en almacenes/interiores.
5. Consultar solo panel, sesión y las dos marcas del día; incidencias bajo demanda.
6. Reconectar y verificar aprobación al volver al primer plano; no recrear cuentas anónimas por cada pantalla.
7. Caché solo de recursos públicos de la PWA. No almacenar respuestas privadas de Firestore o Auth en un service worker genérico.
8. Compilar para producción y medir inicio, RAM, descarga y batería en el dispositivo más débil. Un framework, por sí solo, no asegura menor tamaño o mayor velocidad.

La ubicación puede ser aproximada, imprecisa o manipulada. Ni una app nativa ni el indicador de GPS constituyen prueba absoluta de identidad o presencia. Un control antifraude futuro necesita una política específica.

## 7. Dos decisiones de seguridad importantes

### Identidad

El DNI identifica a la persona declarada; cualquiera que conozca un DNI aprobado puede intentar usarlo bajo el flujo actual. Empaquetar esa pantalla no elimina el riesgo. Mantener DNI puede ser una decisión operativa para el MVP, pero debe quedar explícita. Alternativas posteriores: activación por dispositivo, PIN con verificación segura, QR temporal supervisado o segundo factor. No recomiendo un PIN comprobado solo en JavaScript ni exponer un hash de PIN en el directorio.

### Hora y falta de conexión

El contrato actual utiliza hora del servidor, no hora aportada por el celular. Si una marca se pulsa 06:00 sin red y llega 08:00, `serverTimestamp()` no acredita las 06:00. Si cruza medianoche de Lima, el día local pendiente puede no coincidir con el servidor y las reglas rechazarán el envío. La sesión de 12 horas también puede vencer antes de sincronizar.

Por eso recomiendo MVP con confirmación en línea y recuperación clara de errores. Si se necesita asistencia offline real, diseñarla aparte: hora declarada, hora recibida, evidencias y revisión del encargado, sin mezclarla con una marca puntual confirmada en línea. El almacenamiento offline de Firebase, por sí solo, no resuelve esta política. Además, el SDK nativo habilita persistencia offline de forma predeterminada, a diferencia del comportamiento web habitual; hay que configurar la cola y la interfaz expresamente si se cambia de SDK. [Persistencia offline Firestore](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

## 8. Seguridad de integración y transición

- Nunca incluir claves de cuenta de servicio, credenciales Admin o tokens de despliegue en APK/IPA. La configuración pública de Firebase no sustituye reglas.
- Conservar aprobación, baja, fecha de servidor, GPS, catálogo de servicios, inmutabilidad y auditoría. Las sesiones nativas deben respetar las 12 horas actuales hasta que se apruebe otra política.
- La versión inicial puede conservar el contrato actual, incluido el valor `source: web`, documentando esa compatibilidad. Para identificar plataformas con precisión, proponer un campo o esquema aditivo y desplegar reglas compatibles antes del nuevo cliente. El valor declarado de plataforma no prueba autenticidad.
- App Check puede reducir abuso de clientes no autorizados, pero no identifica al trabajador ni elimina fraude. En Capacitor con SDK JS, integrar tokens nativos requiere comprobar un puente/proveedor apropiado: añadir una configuración Android en Firebase no conecta automáticamente App Check al SDK web.
- Activarlo primero en observación. La configuración de Play Integrity depende de distribución Play/APK y dispositivos; no imponer una verificación que deje fuera teléfonos válidos ni el respaldo web. [App Check](https://firebase.google.com/docs/app-check), [configuración según distribución](https://firebase.google.com/docs/app-check/android/play-integrity-provider).
- Política de privacidad con finalidad de ubicación, contacto corporativo y mecanismo de solicitudes. Revisar los requisitos de eliminación de cuenta de las tiendas y cómo se explicará la conservación legítima de historial. No confundir eliminar del padrón con eliminar cuenta y datos en todos los sistemas. [Google Play: solicitudes de eliminación](https://support.google.com/googleplay/android-developer/answer/13327111).

## 9. Distribución, instalación y mantenimiento

| Canal | Uso recomendado | Ventajas | Límites relevantes |
|---|---|---|---|
| PWA por enlace/QR | Respaldo y ruta inicial sin tiendas | Sin APK ni membresía Apple; mismo enlace | Instalar según navegador; capacidades web |
| APK Android firmado | Piloto pequeño asistido | Instalación directa y control de versión | Permitir origen, avisos del teléfono, actualizaciones manuales, soporte; no sirve para iPhone |
| Play interno/cerrado | Piloto Android | Actualizaciones por tienda | Invitaciones y cuenta Google de instalación; interno hasta 100 testers; no confundir con producción |
| Play producción | Operación Android estable | Instalación y actualización familiares | Registro, verificación, políticas y revisión |
| TestFlight | Piloto iPhone | Distribución beta controlada | Compilaciones de prueba hasta 90 días; no es entrega definitiva |
| App Store o distribución empresarial Apple adecuada | Operación iPhone estable | Actualizaciones y gestión de publicación | Revisar modalidad según quién usará la app; cuenta, firma y revisión |
| MDM / tiendas privadas de empresa | Si la empresa administra teléfonos | Políticas y distribución central | Mayor administración y posible licencia; poco atractivo para móviles personales no gestionados |

Firebase App Distribution sirve para pruebas y figura como servicio sin costo; los lanzamientos están disponibles 150 días. No lo tomaría como sustituto permanente de la distribución operativa. [Tarifas Firebase](https://firebase.google.com/pricing), [App Distribution](https://firebase.google.com/docs/app-distribution/troubleshooting), [Play testing](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en), [TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/).

Para una nueva cuenta personal de Play, la política consultada exige al menos 12 participantes inscritos de forma continua durante 14 días antes de solicitar acceso a producción. La cuenta empresarial tiene requisitos propios de verificación; no asumir exención de todas las revisiones. Recomiendo propiedad corporativa de las cuentas, no dependencia de un trabajador particular. [Requisitos Play](https://support.google.com/googleplay/android-developer/answer/14151465).

La instalación externa Android está evolucionando: la verificación de desarrolladores comenzó en regiones concretas en 2026 y se anuncia expansión global desde 2027. Perú no aparece entre las regiones iniciales de la página consultada; no se debe prometer que un APK sin registro será una solución indefinida. Las cuentas limitadas gratuitas de hasta 20 dispositivos no son una base apropiada para toda la operación. [Verificación Android](https://developer.android.com/developer-verification).

Una aplicación de asistencia pequeña puede aportar utilidad suficiente, pero Apple pide que no sea simplemente una web reempaquetada. Preparar ubicación nativa, estados claros, navegación adaptada y acceso de revisión con datos ficticios. Ninguna tecnología garantiza aprobación de tienda. [Guía Apple 4.2](https://developer.apple.com/app-store/review/guidelines/).

Las actualizaciones de Hosting no actualizan automáticamente el código empaquetado dentro de la app. Se debe mantener versión mínima compatible, reglas compatibles con clientes anteriores, notas de versión y una vía de actualización de tiendas. No propongo actualización remota arbitraria de código como forma de evitar revisiones.

## 10. Costos

Importes en USD, consultados el 31/10/2026; sin conversión a soles, impuestos, comisiones o tipo de cambio. Los ejemplos de trabajo son cálculos propios, no tarifas oficiales.

| Concepto | Presupuesto o tarifa | Observación |
|---|---:|---|
| React/Capacitor y compilación local | Sin licencia por trabajador de esta arquitectura | No exige contratar un servicio de compilación comercial para Android |
| Google Play Console | US$25 una vez | Registro, sujeto a requisitos de la cuenta |
| Apple Developer Program | US$99 al año | Necesario para la distribución habitual de app iOS en tienda |
| Acceso a Mac compatible, dispositivos y/o compilación en la nube | Por cotizar | Windows/Android Studio no compilan iOS localmente; préstamo, equipo propio o servicio |
| Firebase Spark | US$0 mientras se respeten cuotas y servicios admitidos | Tener app instalada no obliga a pasar a Blaze |
| Mantenimiento técnico | Reservar 4–8 horas/mes como hipótesis inicial | Revisar según incidencias, actualizaciones de SO y librerías; no es SLA |
| Funciones futuras: SMS, fotos, mapas embebidos, backend adicional | Cotizar aparte | No necesarias para el MVP descrito |

Fuentes: [Play Console](https://support.google.com/googleplay/android-developer/answer/6112435), [Apple](https://developer.apple.com/help/account/membership/program-enrollment), [entorno Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup).

Si se publican ambas tiendas y se mantienen las cuotas gratuitas, el piso de cuotas de cuentas es **US$124 el primer año** y **US$99 los siguientes**. No es el costo total del proyecto: faltan tiempo de trabajo, equipos, internet, pruebas, soporte y eventual nube. Con PWA sin tiendas esas cuotas no son necesarias.

Para dimensionar desarrollo, usar 100–180 horas de esfuerzo para el MVP Android+iOS propuesto. A una tarifa puramente ilustrativa de US$15–30/h, serían US$1.500–5.400 de trabajo. No es una cotización, no incluye equipos ni espera por verificación/tiendas, y puede aumentar si la integración SDK/WebView/App Check requiere trabajo adicional. Trabajándolo internamente, ese costo monetario puede transformarse en horas propias; no desaparecen las pruebas y el mantenimiento.

Como referencia de la alternativa no-code: AppSheet publica Starter US$5 y Core US$10 por usuario/mes, con condiciones de planes/Workspace. Para 50 usuarios, serían US$250 o US$500 mensuales por esas licencias si todos requieren una; no implica que alguno de esos planes pueda integrar nuestro Firestore y autorización actuales sin más trabajo. [Tarifas AppSheet](https://about.appsheet.com/pricing/).

## 11. Spark y consumo previsto

App y web compartirían las cuotas del mismo proyecto; no se obtiene otra cuota gratuita por registrar Android o iOS. Firestore publica 50.000 lecturas, 20.000 escrituras y 20.000 eliminaciones diarias, 1 GiB almacenado y 10 GiB mensuales de salida gratuitos. [Cuotas](https://firebase.google.com/docs/firestore/quotas).

Según el código, dos marcas diarias por trabajador producen cuatro escrituras de marca/auditoría. Si además se abren dos sesiones nuevas, se suman dos escrituras: hasta seis por trabajador/día en este ejemplo, antes de registro, gestión e incidencias. Son conteos de operaciones de aplicación, no una medición de producción.

| Trabajadores que marcan en el día | Marca + auditoría | Hasta dos sesiones nuevas por persona | Total ilustrativo de escrituras |
|---:|---:|---:|---:|
| 50 | 200 | 100 | 300 |
| 100 | 400 | 200 | 600 |
| 500 | 2.000 | 1.000 | 3.000 |

Para lecturas no existe una equivalencia fija por marca: afectan inicio, sesiones, reglas dependientes, escuchas y reconexión. Como presupuesto de ensayo, 40–100 lecturas por trabajador activo/día darían 4.000–10.000 para 100 personas y 20.000–50.000 para 500, antes del encargado. Es un rango supuesto para probar sensibilidad, no consumo observado ni techo garantizado. Las reglas también pueden facturar lecturas dependientes. [Facturación Firestore](https://firebase.google.com/docs/firestore/pricing).

La medición histórica previa al acceso DNI de 3.016 lecturas/24 h del 30/10 no representa el consumo actual ni valida una app todavía inexistente. Al pilotar: comparar costo por ingreso y trabajador/día, reanudaciones y lecturas del encargado, evitando contar dos clientes de prueba abiertos como un ahorro. Mantener el umbral operativo de investigación de 25.000 lecturas en 24 h. El día de cuota se reinicia según la referencia de Firestore, no necesariamente a medianoche de Lima; conservar intervalos equivalentes.

Spark puede seguir siendo suficiente para una operación pequeña si el piloto confirma el consumo. Una app puede reducir descargas de recursos web, pero no reduce automáticamente lecturas. El historial acumulado también consume almacenamiento con los años. Si se supera cuota o se necesitan servicios no disponibles en Spark, habría que evaluar Blaze con presupuesto; las alertas de gasto no deben confundirse con un tope de facturación.

## 12. Requerimientos previos

1. Inventario real de Android/iPhone y usuarios por servicio, incluidos dispositivos compartidos.
2. Definir si ambos necesitan instalación de tienda desde el primer despliegue, o aceptan PWA transitoria.
3. Acceso a Mac/Xcode y al menos dos iPhone de prueba; identificar responsables de cuentas corporativas, firma y publicación.
4. Ubicar Android Studio, SDK y JDK instalados. No se encontraron en las rutas habituales comprobadas; eso no demuestra que no estén instalados en otra carpeta. Node portable sí está disponible.
5. Mantener paquetes, SDK y cachés en carpetas de usuario. Verificar proxy/red/permisos de descarga y compilación. No exigir cambios globales ni derechos de administrador como requisito implícito.
6. Probar en Android físico. La virtualización o drivers del emulador pueden necesitar administrador; si no están habilitados, usar dispositivo y conexión autorizada, o pedir apoyo de TI para lo indispensable. [Aceleración del emulador](https://developer.android.com/studio/run/emulator-acceleration).
7. Catálogo de servicios, horarios, política de ubicación imprecisa y soporte de falta de conexión acordados. La primera versión conserva lo actual salvo aprobación de una política nueva.
8. Proyecto/emuladores de pruebas, cuentas sintéticas y plan de respaldo. Separar entornos de producción/pruebas para evitar contaminar las asistencias reales. [Entornos Firebase](https://firebase.google.com/docs/projects/learn-more#setting-up-a-staging-environment).

## 13. Plan por fases

Las horas de fases son esfuerzo técnico aproximado; pueden solaparse. La reserva final aproxima el total 100–180 h. No incluye espera de terceros ni la PWA completa como producto adicional independiente.

| Fase | Trabajo | Entregable y condición para avanzar | Esfuerzo |
|---|---|---|---:|
| 0. Decisión y cobertura | Inventario, cuentas, Mac, alcance, acceso DNI y política de red | Matriz de teléfonos, presupuesto y decisión de plataforma/canal | 6–10 h |
| 1. Separar cliente | Entradas worker/manager, módulos compartidos, adaptadores, entornos | Web actual conserva su funcionamiento; pruebas de regresión pasan | 12–20 h |
| 2. Prueba de concepto | Capacitor Android+iOS: Auth, sesión, reglas, GPS, reanudación y escritura atómica | Una jornada sintética completa en Android débil e iPhone; sin acceso Admin en app | 16–28 h |
| 3. MVP trabajador | Registro/aprobación, DNI, servicio, marcas, confirmación, ayuda, errores y accesibilidad | App utilizable y verificable desde panel web con datos de prueba | 24–40 h |
| 4. Compatibilidad y piloto | Pruebas de matriz y 10–15 participantes de ambos SO durante 5 días laborables | Sin pérdidas/duplicados, incidencias clasificadas, consumo medido | 20–36 h más observación |
| 5. Publicación | Firma, fichas, privacidad, accesos para revisión, tiendas, manual corto | Canal estable y versión de contingencia documentados | 8–16 h más revisión |
| 6. Despliegue gradual | 10% → 30% → 100%, soporte y comparación web/app | Balance de estabilidad y costo, web de respaldo disponible | 8–12 h |

Calendario orientativo: 4–8 semanas con dedicación técnica sostenida y recursos listos; puede alargarse por curva de aprendizaje, iOS, cuentas y tiendas. Las 12 personas/14 días de Play personal, si aplican, no se sustituyen por el piloto de cinco días. No prometer fecha de aprobación de Google/Apple.

La fase 2 es la decisión más importante: invertir primero en un prototipo técnico pequeño, en vez de asumir que copiar el sitio a un APK resuelve permisos y compatibilidad. Si no supera esa fase, comparar Kotlin/Flutter/React Native con resultados concretos; hasta entonces no reescribir el backend.

## 14. Pruebas y aceptación

| Área | Casos obligatorios |
|---|---|
| Aprobaciones | Aprobado existente sin repetir alta; nuevo aprobado; desconocido; baja; revocación en sesión abierta; cambio de dispositivo |
| Jornada | Entrada/salida, servicio, marca antigua sin servicio, corrección y reporte por servicio en web |
| Duplicados | Doble toque, dos teléfonos simultáneos, respuesta perdida, reintento después de reiniciar |
| Fecha y sesión | Hora del teléfono manipulada, cambio de día Lima, regreso tras más de 12 h, token vencido |
| GPS | Permitir/denegar, aproximada/precisa, GPS apagado, interiores, timeout, cambio de permiso en Ajustes |
| Red | Wi-Fi/datos, pérdida antes/durante/después de envío, modo avión, aprobación imposible de verificar sin red |
| Dispositivo | Atrás, teclado, fuentes grandes, lector de pantalla, rotación, cierre del sistema por memoria, actualización sin perder datos |
| Seguridad | Otro DNI, documento privado, escalamiento de rol, timestamp adulterado, servicio inválido, cliente antiguo compatible |
| Tiendas | Instalación limpia, actualización firmada, política/ficha, credenciales sintéticas para revisión |

Metas propuestas, a confirmar con el piloto, no garantías actuales:

- Cero aprobaciones o marcas históricas alteradas por migración.
- Cero duplicados aceptados y cero confirmaciones de éxito sin reconocimiento del servidor.
- ≥98% de intentos completados con permisos y conectividad disponibles; separar fallos por falta de señal/GPS de fallos de software.
- Inicio hasta formulario ≤3 s y envío confirmado ≤5 s después de obtener ubicación, como objetivos p95 en teléfonos de referencia/red adecuada; medir GPS aparte, no ocultarlo.
- Comparar lecturas por trabajador/día con web; investigar incremento >20% sostenido ajustado por actividad, o >25.000 lecturas/24 h.
- Usuario mayor puede completar su primera marca asistido una vez y luego sin ayuda. Registrar dudas del piloto, no solo métricas técnicas.

## 15. Migración y reversión

1. Guardar inventario de configuración y hashes de datos críticos, sin publicar DNI ni tokens en logs.
2. Probar únicamente en emuladores/proyecto de pruebas; registrar apps en producción cuando el piloto lo justifique.
3. Mantener IDs y aprobaciones. No importar otro padrón ni sobrescribir `approvedUid` por instalar la app.
4. Cualquier campo nuevo debe ser aditivo. Reglas compatibles primero, nuevo cliente después, exigencias nuevas solo tras cobertura suficiente.
5. Validar una muestra real sin crear asistencias ficticias, con autorización concreta si se requiere alguna acción de negocio.
6. Si falla una versión, detener distribución y dirigir al trabajador a la web existente. No restaurar una copia antigua de Firestore, porque borraría marcas legítimas posteriores.
7. Conservar claves de firma y acceso corporativo a cuentas. Probar actualización de la app, no solo instalación limpia.

## 16. Decisiones pendientes para iniciar

- Cantidad/modelos/versiones de Android e iPhone, y presencia de Huawei sin servicios de Google.
- Disponibilidad de Mac/Xcode y responsable de publicación corporativa.
- Presupuesto: PWA inicial o ambas tiendas.
- Aceptación de DNI solo como política inicial, sin suponer que la app agrega prueba de identidad.
- Si la falta de conexión es excepcional o frecuente. Si es frecuente, tratar offline como alcance adicional antes de prometer asistencia automática.

**Paso recomendado para evaluar:** aprobar únicamente un inventario y prueba de concepto multiplataforma, con GPS nativo y una jornada ficticia completa contra Firebase de pruebas. Con esos resultados se valida Capacitor y se fija presupuesto final. El sistema productivo continúa operando mientras se desarrolla.
