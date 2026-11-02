# O.S. Logistics: plan de PWA y APK de asistencia

Investigación original: 31/10/2026. Actualización: **02/11/2026, horario de Lima**.

**Estado: plan pendiente de ejecución.** Se actualiza el mismo documento. Esta revisión no instala herramientas, publica aplicaciones ni modifica Firebase. Sustituye el alcance anterior de aplicaciones nativas Android e iOS en paralelo.

## 1. Alcance acordado

| Producto | Plataforma | Entrega |
| --- | --- | --- |
| PWA de asistencia | iPhone y Android | Enlace/QR e instalación en pantalla de inicio; también utilizable desde navegador |
| APK híbrido React + Capacitor | Android | Aplicación firmada; piloto asistido y canal operativo por definir |
| Panel actual | Web de encargado y OSMonitor | Conservar URLs, autenticación, permisos, aprobaciones, monitoreo y reportes |

Todos comparten **el mismo padrón, aprobaciones e historial de `sistema-de-asistencia-os`**. Instalar otro cliente no crea una persona ni exige volver a aprobar a quienes ya tienen acceso.

Incluye: registro inicial, aprobación vigente, DNI, servicio rotativo, entrada/salida con GPS, incidencias propias, ayuda, reanudación y estados claros de conexión/confirmación.

Fuera del MVP: reconocimiento facial, selfies, vectores biométricos, PIN nuevo, app iOS para App Store, cámara/micrófono, seguimiento GPS en segundo plano, estados operativos de base/precarga, turnos nocturnos y asistencia offline retroactiva. El APK no funciona en iPhone: su cobertura en esta entrega es mediante PWA.

Se dejará una interfaz de integración de identidad futura, sin recopilar biometría ni simular una comprobación inexistente. Mantener DNI solo es una política operativa, no una prueba de identidad.

## 2. Estado actual y restricciones del código

Base revisada: `README.md`, `package.json`, entradas React, módulos de trabajador/administración, `src/firebase.ts`, `firestore.rules`, `firebase.json` y `firebase.emulators.json`.

- React 19, TypeScript, Vite 8 y Firebase JS 13. Una entrada arranca trabajador y administración; no existe aún proyecto Android, manifest ni service worker del producto.
- Flujo DNI > registro/aprobación si corresponde > servicio > marca. Servicios: SPSA HD, Transferencia, Refrigerado, MASS, Paquetería, Giddings y TPSA.
- Aprobación canónica: `personnel/{dni}.approvedUid → users/{uid}`. Es diferente del UID temporal de una nueva sesión/dispositivo.
- Trabajador con Auth anónimo y Firestore en instancia separada, `browserSessionPersistence` y `workerSessions/{uid}` inmutable con máximo de 12 horas según servidor.
- Directorio mínimo activo/aprobado; panel con DNI/nombre/horario, sin contactos. Cuatro escuchas principales: sesión, panel, entrada y salida. Incidencias bajo demanda.
- GPS actual mediante `navigator.geolocation`. El APK deberá integrar ubicación nativa con un adaptador.
- Marca y auditoría atómicas, identificador por DNI/día/tipo, timestamp del servidor, originales inmutables y correcciones separadas.
- Reglas exigen `source == 'web'` y limitan las claves de las marcas. Agregar `platform`, `deviceId` o `faceVerified` sin cambiar y probar el contrato produciría rechazos.
- Encargado con Google; OSMonitor con contraseña y permisos limitados. Su usuario es manual y los avisos no muestran el correo.
- Hosting publica `dist/`, con protección de marcos, referencias, MIME y permisos; `camera=(), microphone=()` siguen activos.
- Última validación de implementación: 37 pruebas de reglas y 11 de reportes/filtros. No certifican por sí mismas la PWA/APK todavía inexistentes.
- `functions/` es un prototipo histórico; no se requiere desplegarlo para operar el flujo Spark actual.

No fijar como censo vigente el padrón inicial de 37 personas ni importar un Excel antiguo para preparar la app. El inventario real se obtiene al iniciar la transición.

## 3. Contrato de conservación

| Elemento | Regla obligatoria | Evidencia |
| --- | --- | --- |
| Personal | Mantener DNI/documentos y datos actuales | Firmas canónicas de campos previos |
| Aprobación | No reasignar `approvedUid` al UID del APK/PWA | Inventario privado y prueba de aprobados anteriores |
| Sesión | Nueva sesión técnica propia, solo para DNI autorizado | Otro dispositivo, expiración, baja y revocación |
| Marcas | Mantener IDs, originales, ubicación, servicio y auditoría | Comparación de documentos existentes |
| Duplicados | Misma clave persona/día/tipo en los tres clientes | Ensayo concurrente: una sola marca aceptada |
| Correcciones | Conservar `incidents` y `adjustments` | Paridad de resumen/detalle e incidencias |
| Roles | Encargado y monitor conservan su alcance | Regresión web y pruebas negativas por API |
| Clientes anteriores | Mantener acceso web compatible | Jornadas mixtas de prueba entre web, APK y PWA |

**No se requiere migrar datos de negocio para este MVP.** Una cuenta anónima nueva no debe sustituir el perfil aprobado original. No ejecutar scripts históricos de alta/migración/importación como parte de instalar la app.

Antes/después del corte: comparar documentos previos y clasificar cambios legítimos concurrentes. Una marca o aprobación real durante la observación no es corrupción; registrar hora y operaciones autorizadas. No congelar la operación ni restaurar la base para forzar hashes iguales.

Si F1 demuestra una necesidad real de esquema, definir el cambio mínimo, aditivo e idempotente, probarlo y mantener clientes anteriores compatibles. Nunca completar retroactivamente servicios ni modificar etiquetas/horas originales por cambiar de cliente.

## 4. Arquitectura propuesta

```text
WEB ACTUAL: ENCARGADO / OSMONITOR
             |
             |     CLIENTE COMPARTIDO DEL TRABAJADOR
             |     DNI > aprobación > servicio > marca > confirmación
             |                  /                 \
             |       PWA Android/iPhone       APK Android
             |       GPS del navegador        GPS nativo
             |                  \                 /
             +------- Firebase Auth + Firestore + reglas -------+
                                datos únicos
```

### Entradas y builds

| Pieza propuesta | Responsabilidad |
| --- | --- |
| Entrada web actual | Conservar raíz, acceso encargado y `/?login=monitor` |
| `src/worker/main.tsx` / `WorkerApp` | Arrancar solo trabajador; no importar `App` administrativo |
| `src/shared/` | Modelos, servicios, fechas, validaciones y contrato de asistencia |
| `src/platform/` | Ubicación, sesión, conectividad, ciclo de vida y capacidades |
| Build PWA | Base `/trabajador/`, manifest y SW acotados |
| Build APK | Recursos locales con rutas para WebView; sin registrar SW |
| `capacitor.config.ts`, `android/` | Runtime, ID de paquete, permisos y compilación Android |

Son rutas/nombres propuestos, no archivos o URL ya implementados. Ocultar botones no separa dependencias ni protege datos. Reorganizar `firebase.ts` para que el cliente trabajador no arranque la sesión administrativa ni se convierta en panel de encargado si hay una cuenta Google guardada.

### Hosting

- Conservar la raíz actual como acceso compatible y contingencia.
- Proponer `/trabajador/` para PWA, con su HTML/manifest/SW/assets. No anunciar esa URL como disponible hasta publicarla.
- Ensamblar web y PWA en un artefacto: raíz vigente y `dist/trabajador/`; APK en otro directorio. Controlar `emptyOutDir`/orden de builds para no borrar la otra compilación.
- Reescritura de `/trabajador/**` antes de la regla general; probar recargas y que JS/manifest/SW inexistentes no reciban el HTML de la SPA.
- SW solo bajo `/trabajador/`, sin alcance global. No interceptar panel, reportes ni autenticación administrativa.
- Preservar assets públicos necesarios de N-1 durante la transición y probar despliegue/reversión del artefacto completo.

### Adaptadores

| Interfaz | PWA | APK | Invariante |
| --- | --- | --- | --- |
| `LocationProvider` | Geolocation web | Plugin Capacitor | Posición reciente, permiso, rangos y precisión |
| `SessionProvider` | Auth del navegador instalado | SDK JS probado en WebView; puente solo si hace falta | Mismo UID efectivo en Auth/Firestore; revocación y 12 h de servidor |
| `LifecycleProvider` | Visibilidad/navegación | Primer plano, Atrás y proceso Android | Reconciliar estado antes de otra marca |
| `ConnectivityProvider` | Red y respuesta real de Firebase | Red nativa y respuesta real | `online` no equivale a servidor disponible |
| `AttendanceRepository` | Lógica compartida | Lógica compartida | ID estable, batch y confirmación real |
| `IdentityVerificationProvider` | Contrato futuro inactivo | Contrato futuro inactivo | Sin datos ni autorización biométrica ficticia |

Si se necesita un puente nativo Firebase, probarlo de nuevo: no mezclar Auth nativo y escrituras JS con identidades distintas ni asumir la misma cola offline.

## 5. Experiencia del trabajador

### Registro y aprobación

Enlace/icono > DNI > padrón > nombres/apellidos y celular o correo > Enviar para aprobación > espera > servicio > marca. Se mantienen avisos de DNI desconocido/inactivo y ayuda del coordinador/Monitoreo. Encargado o monitor aprueban desde Equipo con los permisos actuales.

### Ya aprobado

Icono > DNI > comprobar nombre y servicio > acción principal > GPS > confirmación. Cambiar de cliente/dispositivo no requiere aprobar nuevamente. Sin autorización verificable, ofrecer reintento/ayuda, no éxito ficticio.

El servicio puede rotar y se elige antes de marcar. No hacer una asignación fija al padrón ni rellenar marcas históricas vacías.

### Sesión, privacidad y accesibilidad

- Mantener inicialmente DNI manual y máximo de 12 h; no extenderlos por instalar la app.
- “Recordar mi DNI” será una opción voluntaria, apagada por defecto y evaluada en piloto: solo identificador, con Cambiar persona/Borrar. No guardar contraseñas, tokens, contactos o ubicación en preferencias genéricas ni autoautorizar.
- `sessionStorage` puede perderse al cerrar o por decisión del sistema. Crear otra sesión autorizada sin repetir aprobación; no prometer persistencia en todo cierre de iOS/WebView.
- Al reanudar comprobar token, sesión, baja y marcas antes de habilitar otra acción. Cambiar persona cierra sesión y limpia datos visibles previos.
- Registrar listeners una vez y liberar los obsoletos; no olvidar una operación pendiente al suspender la pantalla.
- Una acción principal, objetivos táctiles de al menos 48 px lógicos, texto ampliable, contraste y mensajes no basados solo en color. Probar TalkBack/VoiceOver, teclado, safe areas y Atrás.
- Pedir GPS al marcar; no rastrear continuamente. Los permisos y Ajustes dependen del SO: no prometer activación automática ni imitar un diálogo nativo.

## 6. Confirmación, conectividad y operaciones pendientes

**MVP con asistencia confirmada en línea y hora del servidor.** Interfaz offline no equivale a una asistencia acreditada offline ni a conservar como oficial la hora del toque.

Estados: cargando > lista > obteniendo ubicación > enviando > confirmada; alternativas sin conexión, sin confirmar, rechazada y sesión vencida. Una operación en curso bloquea doble toque y conserva su ID estable.

1. Verificar autorización/estado reciente y marca existente antes del envío; una aprobación cacheada no es una autorización nueva.
2. Obtener ubicación y guardar marca/auditoría con el contrato actual, mismo ID y `source: 'web'`. Ese campo heredado no certifica plataforma.
3. Mostrar éxito solo con reconocimiento del servidor y timestamp resuelto. Un snapshot local con `hasPendingWrites` no confirma entrada ni habilita salida.
4. Si se pierde la respuesta, recuperar conexión y consultar la marca canónica antes de reintentar. “Ya existe” puede corresponder al éxito anterior.
5. Un timeout de interfaz **no cancela** necesariamente un batch ya entregado al SDK. Seguir su estado/promesa, sin duplicar la operación ni prometer que nunca se registrará después.
6. No agregar cola persistente propia ni habilitar caché offline de Firestore como atajo. El SDK puede mantener escrituras pendientes: probar cierre/reanudación y cualquier cambio de SDK.
7. Una marca aceptada tarde tendrá hora del servidor al recibirse. Si cruza medianoche de Lima o vence la sesión, puede rechazarse: explicar y ofrecer incidencia, sin backdating.

Reconciliar lecturas adicionales solo en casos ambiguos; no consultar otra vez innecesariamente después de todo commit exitoso. Mantener control de duplicados aunque se usen varios clientes.

## 7. PWA: instalación, caché y actualización

### Instalación

Manifest con `id`, `start_url`, `scope` bajo `/trabajador/`, nombre O.S. Asistencia, idioma, colores, `display: standalone`, iconos 192/512, maskable y Apple Touch Icon. Probar HTTPS y MIME real, sin fallback HTML para esos recursos.

Mostrar Instalar donde exista soporte; en iPhone guiar por Compartir > Añadir a pantalla de inicio según Safari/versión. Desde WhatsApp puede ser necesario Abrir en Safari/Chrome. El enlace sigue sirviendo si no se instala; no bloquear ni repetir avisos en cada visita.

### Política de caché

| Recurso | Tratamiento |
| --- | --- |
| Assets públicos del trabajador con hash | Precache/Cache First limitado y limpieza por versión |
| Entrada HTML y SW | Revalidación/actualización controlada; `no-cache` HTTP |
| Manifest | Revalidar, sin congelar start URL/iconos |
| Auth, Firestore, perfiles, aprobaciones, solicitudes y GPS | Nunca guardar mediante SW ni caché genérico de respuestas privadas |
| Panel administrativo/reportes | Fuera del scope y precache |
| APK | Sin SW registrado |

La sesión la administra el SDK; no copiarla a Cache Storage. Esta política no significa que Firebase no use almacenamiento propio para Auth.

### Actualizaciones

Aviso “Actualización disponible” con aplicación en momento seguro. No recargar ni activar `skipWaiting` incondicional durante un formulario, GPS o envío. Probar versiones N/N-1, tab antigua, regreso tras días y limpieza de cachés sin borrar Auth/preferencias ni datos de negocio.

Un SW nuevo no corrige inmediatamente instalaciones offline. Diseñar contingencia para un SW antiguo todavía activo; la raíz de respaldo queda fuera de su alcance.

## 8. APK Android y distribución

- Capacitor con runtime Android y recursos locales: app híbrida, no reescritura completa a Kotlin.
- Validar compatibilidad de Capacitor/plugins, Node, Vite, JDK/Gradle y Android Studio, y fijar versiones/lockfile tras F1; no asumir que últimas versiones independientes son compatibles.
- Elegir `applicationId` estable de propiedad corporativa y versiones `versionName`/`versionCode`. Ningún nombre de ejemplo equivale a un registro ya realizado.
- Integrar ubicación de primer plano: aproximada/precisa, GPS apagado, revocación, timeout y Ajustes. No pedir cámara, micrófono, contactos, almacenamiento general ni ubicación permanente.
- Mantener reglas de rangos/precisión actuales. No imponer una exactitud muy pequeña que bloquee interiores sin evidencia del piloto.
- Release con `webDir` local, sin SW, `server.url` de desarrollo, cleartext global ni interfaz remota arbitraria.
- Resolver Atrás, teclado, cierre por memoria y reanudación. Abrir destinos externos permitidos fuera de la WebView; no ejecutar URL/esquemas arbitrarios.
- Firma corporativa con respaldo cifrado y responsable suplente. Keystore y contraseñas fuera de Git, APK, logs y scripts compartidos. Probar actualización sobre la anterior, no solo instalación limpia.
- Piloto por enlace corporativo HTTPS, versión/fecha/SHA-256; WhatsApp puede comunicar el enlace, pero no ser el único archivo maestro ni mecanismo de actualización.
- Elegir canal operativo: APK directo con soporte/versionado o Google Play/gestión empresarial después. Revisar verificación de desarrolladores al distribuir; no prometer instalación externa ilimitada sin mantenimiento.
- Si hace falta comprobar versiones, usar un recurso estático y frecuencia limitada; no un listener Firestore por usuario ni una lectura por pantalla. No forzar actualización durante una marca.

La detección de ubicaciones Android marcadas como simuladas puede evaluarse después como señal auxiliar, no garantía antifraude ni requisito del MVP. Una restricción solo en el APK no protege una ruta web que permita omitirla.

## 9. Base de identidad futura, sin reconocimiento facial ahora

1. Separar interfaz, autorización de la persona y comando de asistencia; definir `IdentityVerificationProvider` sin cámara ni modelos en el bundle actual.
2. Documentar modalidad inicial `dni_only`. No añadir `verified: true`, una prueba vacía o campos que aparenten reconocimiento. La app no decide por sí sola qué evidencia exigirá el servidor en una fase futura.
3. Preparar contrato/pruebas de estados futuros: requerida, cancelada, fallida, no disponible y alternativa supervisada. No mostrar pantallas biométricas ahora.
4. Mantener `camera=()` y no declarar permiso Android de cámara. Habilitarlo solo cuando una función concreta se apruebe e implemente.
5. No crear ni guardar fotos/vectores en `registrationRequests`, `workerDirectory` o `workerPanels`. Un panel accesible mediante DNI aprobado no es depósito adecuado para biometría.
6. La fase futura exige enrolamiento verificado, finalidad/base legal, acceso mínimo, conservación/eliminación, falsos rechazos y detección de presencia real. Dimensiones/tamaño dependen del modelo: no fijar “128 números/1 KB” como contrato actual.
7. Si se exige identidad real para marcar, un componente confiable debe validar la evidencia y ligarla a persona, operación y vigencia. No basta un booleano del celular; habrá que cerrar también rutas antiguas que omitan la prueba, con transición específica.
8. Evaluar entonces backend, costos, atestación/App Check y almacenamiento privado. Este MVP no los implementa. Cloud Storage for Firebase requiere Blaze; no presuponer selfies gratuitas en Spark.

Una aprobación laboral actual no es un enrolamiento facial ni una autorización implícita de tratamiento biométrico. No modificar aprobaciones para simularlo.

## 10. Herramientas, pruebas aisladas e insumos

### Equipos

Conservar en oficina Node portable y operación sin administrador, sin sustituir herramientas o sesión CLI. El usuario indicó contar con PC personal y Android Studio: verificar instalación, SDK/JDK, RAM/SSD, virtualización y espacio. No se certificó ese equipo ni se garantizan segundos de arranque/compilación por la GPU.

Este alcance no requiere Mac/Xcode/membresía Apple. Sí requiere iPhone físicos: Android Studio no emula iOS. Si no hay virtualización/drivers, avanzar en Android físico autorizado y tareas web independientes.

Inventariar modelo/sistema, memoria aproximada, navegador/WebView y red; no IMEI, serial ni cuentas personales. Capacitor 8 documenta runtime Android API 24+, pero eso no certifica nuestro JS/Firebase/plugin en todo equipo. Fijar mínimo Android/iOS tras inventario y F1; no elegir dependencias abandonadas para bajar artificialmente el mínimo.

### Entornos

- Emuladores o proyecto de pruebas aislado con personal sintético y reglas equivalentes; nunca copiar el padrón real completo al teléfono de laboratorio.
- Auth `9099`, Firestore `8080`, proyecto ficticio `demo-os-logistics`. Escritorio usa loopback; Android Emulator llega al PC con `10.0.2.2`; físicos requieren red local/configuración de host autorizada, no el `localhost` del PC.
- Hoy los emuladores dependen de `import.meta.env.DEV && VITE_USE_EMULATORS`. Un APK compilado con Vite no debe asumir que esa bandera basta: diseñar build de pruebas con allowlist demo/host configurable y exclusión comprobada en release.
- Excepciones HTTP solo en debug/red local. Release con HTTPS, destino correcto y sin host/puertos de emulador, servidor de desarrollo o secretos.
- Registrar app Android en Firebase solo si lo requiere el SDK/plugin elegido y con el ID acordado. Configuración pública no concede permisos; nunca incorporar Admin SDK/credenciales de servidor al cliente.

| Insumo | Responsable propuesto | Cómo avanzar si falta |
| --- | --- | --- |
| Inventario y teléfonos representativos | Coordinación/Monitoreo | Emuladores y separación web, sin declarar compatibilidad física |
| PC, SDK/JDK y firma | Responsable técnico | PWA/refactor y pruebas web independientes |
| Nombre/icono y textos | Operaciones | Diseño provisional identificado, validar antes de distribuir |
| Canal Android/custodios de clave | Empresa + técnico | Debug solo en laboratorio, sin lanzamiento general |
| Soporte y participantes | Encargado/Monitoreo | Vía web/incidencias actual; no saltar salida del piloto |

No pedir contraseñas/códigos por chat. Resolver tareas independientes sin saltarse criterios de salida.

## 11. Fases, dependencias y esfuerzo

**Todas están pendientes.** Horas de esfuerzo técnico, no tiempo de máquina, cotización ni garantía de fecha.

| Fase | Dependencia | Entrega | Horas |
| --- | --- | --- | --- |
| F0. Preparación | Ninguna | Cobertura, entorno, responsables y versiones candidatas | 6-10 |
| F1. Preservación y prototipo | F0 técnica | Línea base; Auth/Firestore/GPS entre clientes comprobados | 12-20 |
| F2. Cliente compartido | F1 | Entradas/builds separados, adaptadores y regresión web | 12-20 |
| F3. PWA | F2 | Instalación, caché, actualización y recuperación | 16-28 |
| F4. APK Android | F2 + POC F1; paralelo a F3 si procede | Release de pruebas y GPS/reanudación nativos | 20-32 |
| F5. Validación | F3 + F4 | Matriz física, seguridad, rendimiento e integridad | 20-32 |
| F6. Piloto | F5 | Cinco días laborables observados e informe | 8-14 + observación |
| F7. Publicación | F6 | Despliegue gradual, guías y contingencia | 6-10 + seguimiento |

**Total inicial: 100-166 horas técnicas**, más observación y espera por equipos/verificación/canal. Con unas 25-30 horas semanales, reservar aproximadamente 4-7 semanas de trabajo técnico, además de las esperas/observación; recalcular tras F1. No duplicar el esfuerzo de módulos compartidos en las dos plataformas. La base facial es arquitectura y contratos; implementar reconocimiento no está incluido.

### F0. Preparación

- [ ] Registrar alcance/políticas actuales e inventario; proponer matriz y mínimo provisional según teléfonos.
- [ ] Verificar herramientas en oficina/PC personal y compatibilidad de Vite/PWA/Capacitor antes de fijar versiones.
- [ ] Acordar nombre, ID Android, firma, soporte, canal y responsables.
- [ ] Preparar control de versiones o copia privada de código/configuración, sin secretos; aislar datos/builds de prueba.

**Salida:** requisitos y entorno seguro documentados; insumos ausentes identificados sin bloquear trabajo independiente. No exigir Mac para esta ruta.

### F1. Preservación y prueba de concepto

- [ ] Guardar configuración/reglas y firmas canónicas privadas de documentos previos; conservar `tmp/optimization-baseline.json`.
- [ ] Personal sintético: aprobado antiguo/nuevo, baja/revocado, marcas, correcciones y servicio histórico vacío.
- [ ] Probar Auth anónimo + Firestore con mismo UID en Capacitor y GPS nativo en Android real.
- [ ] Probar Safari normal/instalado y reingreso DNI sin depender de cookies entre contenedores.
- [ ] Jornada mixta entrada web/salida APK y entrada PWA/salida web; timestamp, batch, duplicados, sesión vencida y build demo compilado.
- [ ] Fijar versiones/persistencia por resultados; repetir el contrato si hace falta puente nativo.

**Salida:** tres clientes usan la misma persona aprobada sin reasignar su vínculo y completan jornada sintética. Resolver un fallo de integración, no abrir reglas para evitarlo.

### F2. Separación y lógica compartida

- [ ] Extraer arranque trabajador, tipos/servicios y adaptadores, conservando contratos y funciones existentes.
- [ ] Separar inicialización administrativa/trabajador; builds web/PWA/APK con rutas y resultados comprobados.
- [ ] Mantener Google/monitor, aprobación, incidencias, reportes y auditoría de web.
- [ ] Estado de operación, reanudación, cambio de persona y liberación de listeners; contrato de identidad futura inactivo.
- [ ] Mantener `source: web` y claves actuales. Documentar aparte cualquier cambio real de esquema.

**Salida:** regresiones pasan; bundle trabajador excluye componentes administrativos, ExcelJS/jsPDF y mapeo de acceso de monitor. No afirmar por ello que se elimina información del cliente administrativo actual.

### F3. PWA

- [ ] Manifest, iconos, scope/start URL, SW y ayuda por navegador, incluido WhatsApp/iPhone.
- [ ] Caché público limitado, exclusión de datos privados y cabeceras/MIME/rutas correctas.
- [ ] Actualización por aviso seguro, versiones N/N-1 y recuperación con SW antiguo.
- [ ] Probar navegador/standalone, pérdida de almacenamiento, cambio de persona y coexistencia administrativa.

**Salida:** instalación y marcas de prueba en Android e iPhone; SW no controla panel ni contiene respuestas privadas.

### F4. APK

- [ ] Proyecto Capacitor/Android, ID estable y dependencias fijadas.
- [ ] GPS/primer plano y permisos/errores mediante el adaptador común.
- [ ] Ajustes, Atrás, teclado, cierre por memoria y reanudación coherentes.
- [ ] Firma y release; inspeccionar destino Firebase, manifiesto, secretos, debug/emuladores y versión.
- [ ] Instalar/actualizar sobre versión anterior; sesión expirada y coexistencia con PWA/web.
- [ ] Descarga, versión, instrucciones y custodia corporativa de clave.

**Salida:** APK instalable/actualizable en equipos definidos, sin permisos ni panel administrativos. PWA permanece para quien no pueda instalar APK externo.

### F5. Validación

- [ ] Ejecutar 37 pruebas actuales de reglas y 11 de reportes; ampliar para comportamientos nuevos relevantes.
- [ ] Completar sección 12 y comprobar panel web, integridad y tareas administrativas antes/después.
- [ ] Medir inicio frío/caliente, GPS, guardado, memoria/red en teléfonos físicos.
- [ ] Ensayar respuesta perdida, snapshots pendientes, medianoche y actualización durante envío.
- [ ] Inspeccionar cachés, artefactos, permisos, logs y tráfico; comparar campos originales clasificando actividad real legítima.
- [ ] Probar reversión PWA y actualización correctiva de APK.

**Salida:** cero defectos críticos de autorización, conservación, confirmación o duplicados, con cobertura física documentada. La GPU de desarrollo no sustituye estas pruebas.

### F6. Piloto

- [ ] 10-15 participantes de diferentes servicios/gamas, con varios iPhone, manteniendo sus aprobaciones.
- [ ] Cinco días laborables y referencia comparable; identificar labores administrativas extraordinarias.
- [ ] Tras autorización operativa del piloto, solo marcaciones reales habituales; no insertar/borrar pruebas en producción.
- [ ] Explicar instalación, ubicación, incidencia, soporte y vuelta a web. No inducir múltiples marcas diarias para ensayar.
- [ ] Revisar fallos/métricas sin DNI o GPS en diagnóstico y detener ampliación ante fallo crítico.

**Salida:** operación sin ayuda recurrente, pérdida de datos, bloqueo de aprobados ni consumo injustificado. Cumplir plazo no equivale a aprobar el piloto.

### F7. Publicación y transferencia

- [ ] Desplegar artefacto completo de PWA/web atómicamente y APK firmado por canal acordado.
- [ ] Escalar piloto > aproximadamente 30% > resto; observar al menos una jornada real entre escalones.
- [ ] Actualizar README y guías Android/iPhone con capturas ficticias; probar actualización y vía web.
- [ ] Entregar versiones, firma custodiada, responsables, soporte y contingencia.
- [ ] Medir siete días laborables tras despliegue general; seguimiento distinto de las siete revisiones de optimización ya existentes.

**Salida:** canales operativos y respaldo web utilizables, mantenimiento asignado. Ninguna reclasificación de marcas originales por instalar la app.

## 12. Matriz mínima de pruebas

| Área | Casos | Resultado obligatorio |
| --- | --- | --- |
| Aprobados anteriores | Mismo DNI entra en PWA/APK | Sin nueva alta/aprobación ni reasignación de `approvedUid` |
| Registro | Activo no aprobado, desconocido, inactivo, solicitud repetida | Solo solicitud válida; mensajes y revisión coherentes |
| Revocación | Baja/retiro de acceso con cliente abierto | Próxima operación bloqueada, sin autorización por caché |
| Jornada mixta | Entrada web/salida móvil y viceversa; servicio histórico vacío | Jornada/reporte únicos y sin rellenar datos antiguos |
| Duplicados | Doble toque, dos teléfonos, reintento tras respuesta perdida | Un ID/marca aceptado y auditoría coherente |
| Confirmación | Snapshots pendientes, pérdida antes/durante/después del commit | Sin éxito ficticio ni salida por entrada local no confirmada |
| Fecha | Reloj adulterado, medianoche Lima, entrega tardía | Hora del servidor y rechazo/explicación si no coincide el día |
| Sesión | Recarga, cierre, renovación, más de 12 h, otro DNI | Nueva sesión técnica cuando procede, aprobación conservada |
| GPS | Denegado/bloqueado, apagado, aproximado, impreciso, timeout y Ajustes | No guardar sin posición válida; reintento comprensible |
| Instalación | Safari, Chrome, WhatsApp, navegador/standalone | Ruta y ayuda correctas; acceso web alternativo |
| Caché | Offline inicial/postinstalación y cambio de persona | Sin filtrar datos ni fabricar autorización |
| Actualización | N/N-1, tab antigua, SW viejo, envío en curso, APK sobre anterior | Sin recarga destructiva; operación reconciliada y fallback |
| Seguridad | Otro DNI, padrón privado, escalada de rol, fecha/GPS/servicio adulterados | Rechazo por reglas, no solo por interfaz |
| Administración | Google, monitor, aprobación, incidencias, filtros, Excel/PDF | Mismo alcance y funcionamiento; sin SW interfiriendo |
| Dispositivo | Poca memoria, equipo antiguo, fuente grande, lector de pantalla | Flujo legible y límites reales documentados |
| Release | Demo/emuladores, cleartext, secretos, permisos | Destino correcto, sin herramientas de prueba ni cámara/micrófono |

Muestra sugerida: seis Android de marcas/gamas distintas, incluido uno antiguo y uno de gama baja, y tres iPhone representativos. Si hay Huawei sin Google, probarlo expresamente: Firebase y proveedor GPS tienen dependencias diferentes. Sin esa muestra, declarar solo cobertura efectivamente probada, sin inventar compatibilidad.

Ensayos cruzados/malformados en proyecto de pruebas, nunca con DNIs reales en logs o ataques de ensayo contra personal de producción.

## 13. Métricas y aceptación

| Métrica | Meta inicial propuesta | Interpretación |
| --- | --- | --- |
| Conservación | 0 originales alterados por transición; 0 aprobaciones reasignadas | Diferencia no explicada bloquea publicación |
| Duplicados/éxito falso | 0 aceptados | Incidencia crítica; detener ampliación |
| Intentos válidos completados | Al menos 98%, con permiso, red y sesión disponibles | Separar software de falta de GPS/red; reportar también fallos percibidos totales |
| Inicio | p95 hasta formulario de 3 s en referencia/red adecuada | Meta a confirmar tras F1, frío/caliente separados |
| Confirmación | p95 de 5 s después de obtener posición | Medir GPS aparte y también duración total |
| Facilidad | Al menos 9 de 10 participantes sin ayuda repetida tras instrucción inicial | Revisar pasos/textos antes de ampliar |
| Lecturas relativas | Investigar aumento >20% sostenido frente a carga comparable sin explicación | Ajustar por ingresos, participantes, reconexiones y administración |
| Lecturas absolutas | Investigar >25.000/24 h; prioridad alta a 40.000 | Umbrales operativos, no cuotas/factura |
| Reglas/Auth | 0 ERROR nuevos atribuibles al cliente y 0 bloqueos de aprobados | DENY esperado no implica fallo |
| Listeners/cuentas | Sin acumulación por abrir/cerrar pantallas | Seguir sesiones/cuentas anónimas, sin limpieza automática nueva |

Los objetivos de tiempo/éxito son metas de prueba, no garantías del producto actual. Registrar versión/canal, cantidades agregadas, duración y categoría de fallo sin DNI, nombre, email, coordenadas ni tokens. No añadir Analytics/Crashlytics u otro SDK sin revisar finalidad/política/costo; comenzar con medición de laboratorio y agregados operativos.

Monitoring no atribuye por sí solo el consumo a cada persona/plataforma. Con `source` heredado no afirmar ahorro exacto de APK; comparar intervalos de duración y carga semejantes con adopción conocida, incluyendo uso administrativo y limitaciones.

Referencia al redactar: 02/11, corte **09:21 de Lima**, 1.544 lecturas y 171 escrituras en 24 h, frente a 7.724 lecturas de la ventana previa, sin errores de reglas recientes. El corte anterior del mismo día informaba 474 lecturas. Son ventanas móviles solapadas y cargas distintas, no días de cuota ni garantía de capacidad. Consultar [RESULTADO_OPTIMIZACION.md](RESULTADO_OPTIMIZACION.md) para la referencia más reciente; el seguimiento existente va 4/7.

## 14. Consumo y presupuesto

PWA, APK y web comparten las cuotas del mismo proyecto; instalar otra plataforma no duplica la gratuidad. Mantener Spark inicialmente sin Functions, fotos/Storage ni backend biométrico, sujeto a consumo/servicios reales.

Cuotas gratuitas de Firestore consultadas: 50.000 lecturas, 20.000 escrituras y 20.000 eliminaciones diarias, 1 GiB almacenado y 10 GiB/mes de salida. El día de cuota se reinicia alrededor de medianoche del Pacífico, no necesariamente a medianoche de Lima. Confirmar límites/plan al ampliar.

Dos marcas generan cuatro escrituras de marca/auditoría; dos sesiones nuevas agregan otras dos. Ejemplo orientativo, antes de solicitudes, incidencias y administración:

| Personas que marcan | Marca + auditoría | Hasta dos sesiones nuevas | Total ilustrativo |
| --- | --- | --- | --- |
| 50 | 200 | 100 | 300 escrituras |
| 100 | 400 | 200 | 600 escrituras |
| 500 | 2.000 | 1.000 | 3.000 escrituras |

No es consumo facturado exacto ni significa que toda recarga cree cuenta/sesión. Las lecturas dependen de reglas, consultas, listeners y reconexiones; medirlas, no fijar un costo por marca inventado. Evitar consultas por render, listeners de versión y una escritura de telemetría por toque.

Presupuestar también descargas/actualizaciones, recursos de PWA y almacenamiento del historial. El alojamiento del APK no debe consumir inadvertidamente toda la transferencia de Hosting.

| Concepto | Tratamiento |
| --- | --- |
| PWA y Capacitor Android | Sin licencia de framework por trabajador; sí desarrollo, pruebas y soporte |
| Android Studio/compilación | Verificar herramientas/equipo disponibles y teléfonos de prueba |
| Mac/Xcode/Apple Developer | No requeridos por este alcance con PWA en iPhone |
| Google Play, opcional | Registro publicado de US$25; verificar condiciones/requisitos al contratar |
| APK externo | Alojamiento, actualización, soporte y verificación del desarrollador por definir |
| Firebase | Spark si cuotas/servicios lo permiten, no promesa de gratuidad a cualquier escala |
| Mantenimiento | Reserva inicial hipotética 4-8 h/mes, a ajustar; no SLA |
| Biometría futura | Proyecto/costo independiente: privacidad, servidor, almacenamiento, modelo y licencia |

100-166 horas son estimación propia, no cotización. Con desarrollo interno son dedicación del equipo; no desaparecen pruebas/mantenimiento. No se traslada al alcance actual el presupuesto anterior de ambas tiendas o una app iOS.

## 15. Seguridad y privacidad

- Preservar aprobación, roles, revocación, sesión inmutable/expirable, fecha de servidor, GPS, servicios, auditoría y marca única. Ocultar botones o declarar plataforma no autentica al trabajador.
- No incluir un padrón, DNIs o perfiles en JSON/manifest/SW/APK de descarga pública.
- Conservar cabeceras; ajustar solo rutas/caché necesarias para PWA. Cámara y micrófono siguen bloqueados.
- No cargar cuenta administrativa/mapeo del monitor en el bundle trabajador; las limitaciones del cliente administrativo ya documentadas no desaparecen por esa separación.
- Keystore, tokens CLI/Admin, archivos de entorno y datos reales fuera de repositorio/artefactos. La configuración Firebase pública no sustituye reglas.
- Plugins y navegación mínimos; sin identificadores de hardware/permisos preventivos.
- Revisar dependencias nuevas y alertas existentes; no usar `npm audit fix --force` ni actualizaciones incompatibles automáticas que rompan reportes.
- App Check se puede evaluar en observación; no imponerlo sin probar puente/SDK, APK externo y equipos sin Google. No identifica al trabajador ni reemplaza aprobación.
- DNI solo y GPS cliente conservan riesgo de suplantación. No vender el empaquetado como reconocimiento o garantía de presencia.

## 16. Transición, publicación y reversión

### Corte

1. Guardar código/configuración y evidencia privada de originales; preparar reversión de código, no restauración rutinaria de datos.
2. Completar emuladores/proyecto aislado y canal de vista previa antes de sustituir el sitio público.
3. Si hacen falta reglas, probarlas y publicarlas compatibles antes del cliente. Preferir no cambiarlas si se conserva el contrato.
4. Publicar artefacto web/PWA completo; comprobar raíz, monitor, trabajador, SW/scope, assets/MIME, permisos y administración.
5. Entregar APK firmado al piloto para asistencia real habitual, sin crear ni borrar marcas ficticias.
6. Comparar vínculos/documentos previos clasificando actividad legítima, observar consumo/errores y ampliar por etapas.
7. Conservar versiones compatibles y firma; avisar de actualizaciones sin cortar una operación.

### Detener ampliación si ocurre

Pérdida/reasignación de aprobación; cambio no autorizado de original; éxito sin servidor; duplicado aceptado; acceso de otro rol; bloqueo repetido de aprobados; regresión administrativa; GPS/sesión roto en un modelo frecuente. Superar consumo exige investigar, no retirar controles para sostener el piloto.

### Reversión

- PWA: detener enlace nuevo, publicar versión compatible/corrección y ofrecer la raíz fuera del scope. Considerar SW instalado; actualizar/retirar controladamente sin borrar todo el almacenamiento del usuario.
- APK: detener distribución, ofrecer web y generar correctiva con mismo ID/firma y `versionCode` mayor. Android no permite siempre instalar versión anterior sobre la nueva; no basar la recuperación solo en desinstalar y perder almacenamiento.
- No restaurar una copia antigua de Firestore ni retirar aprobaciones legítimas: se perderían cambios posteriores. Mantener reglas compatibles con clientes aún activos.
- Reconciliar IDs de envíos ambiguos; no mover marcas a otra fecha ni generar IDs nuevos para reenviarlas.

## 17. Entregables de cierre

| Entregable | Evidencia |
| --- | --- |
| Cliente compartido | Entradas/builds, módulos y adaptadores; web vigente preservada |
| PWA Android/iPhone | Instalación, manifest/SW/scope, actualización y pruebas físicas |
| APK Android | Release firmado, actualización demostrada, canal/versiones y clave custodiada |
| Continuidad | Aprobaciones/originales conservados y jornadas mixtas probadas |
| Pruebas | Suites ampliadas, red/GPS/medianoche/concurrencia y defectos resueltos |
| Privacidad | Paquetes/cachés/permisos/logs inspeccionados y límites registrados |
| Operación | README/guías, responsables, soporte y contingencia |
| Rendimiento/consumo | Referencia, informe de piloto y seguimiento con limitaciones |
| Base facial futura | Contrato/decisiones, sin captura, modelos ni datos biométricos |

Producir un APK o un icono no cierra el proyecto. Deben cumplirse conservación, flujo, compatibilidad y soporte. La función facial queda pendiente de otra decisión/implementación.

## 18. Investigación previa y decisiones

Se mantiene el nombre del archivo para continuidad. El 31/10 se compararon PWA, Capacitor Android+iOS, Kotlin, Flutter, React Native, TWA/WebView propio y no-code. La decisión del 02/11 concreta PWA multiplataforma + Capacitor Android + administración web.

| Alternativa | Decisión vigente |
| --- | --- |
| PWA sola | Base de ambas plataformas y contingencia; APK añade integración Android |
| Capacitor Android | Elegido por reutilización de React y plugins nativos |
| Capacitor iOS/App Store | Fuera del MVP; reconsiderar si PWA resulta insuficiente en pruebas |
| Kotlin/Flutter/React Native | Reconsiderar ante limitaciones graves demostradas por F1 |
| TWA | Menor utilidad para integrar GPS nativo propio |
| WebView propio básico | No preferido por mantenimiento de seguridad/permisos/navegación |
| No-code | No preferido por integración, autorización y posible duplicación/licencias |

No tomar como benchmarks las promesas de segundos de emulador, minuto de compilación o rendimiento facial en GPU. La referencia son los teléfonos y condiciones reales del personal.

## 19. Fuentes y documentos relacionados

Referencias primarias consultadas/revisadas al 02/11/2026; volver a comprobar versiones y requisitos al fijar herramientas/distribución.

- [Capacitor Android](https://capacitorjs.com/docs/android), [entorno](https://capacitorjs.com/docs/getting-started/environment-setup), [GPS](https://capacitorjs.com/docs/apis/geolocation) y [build/firma](https://capacitorjs.com/docs/cli/commands/build).
- [MDN: PWA e instalación por plataforma](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
- [Vite PWA: actualización con aviso](https://vite-pwa-org.netlify.app/guide/prompt-for-update) y [alcance de SW](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register).
- [Firebase: entornos SDK JS](https://firebase.google.com/docs/web/environments-js-sdk), [offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline), [cuotas](https://firebase.google.com/docs/firestore/quotas), [lecturas/facturación](https://firebase.google.com/docs/firestore/pricing) y [App Check](https://firebase.google.com/docs/app-check).
- [Android: red de emulador](https://developer.android.com/studio/run/emulator-networking), [posición simulada](https://developer.android.com/reference/android/location/Location#isMock()) y [verificación de desarrolladores](https://developer.android.com/developer-verification).
- [Google Play: registro y tarifa](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en).
- [Firebase: Cloud Storage y Blaze](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), solo pertinente si después se evalúan fotos.
- [ANPD Perú: datos biométricos](https://www.gob.pe/institucion/anpd/campa%C3%B1as/118736-que-tan-seguros-estan-tus-datos-biometricos), referencia futura, no autorización de tratamiento.

Documentación local: [README vigente](README.md), [acceso DNI](RESULTADO_ACCESO_DNI.md), [optimización y mediciones](RESULTADO_OPTIMIZACION.md), [privacidad/seguridad](REVISION_PRIVACIDAD_SEGURIDAD_20261031.md), [servicios](RESULTADO_SERVICIOS_20261031.md), [filtros](RESULTADO_FILTROS_SERVICIO_20261031.md) y [acceso de monitor](RESULTADO_OSMONITOR_CONTRASENA_20261031.md). Informes fechados conservan el estado de ese momento; verificar código/reglas/datos al ejecutar, sin trasladar instrucciones antiguas de acceso por celular.
