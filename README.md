# Conta Magno Assistant Backend

Backend Node.js + TypeScript para WhatsApp (Meta y Twilio), con OpenAI Responses API, Conversations API y `gpt-6-luna`.

## Arquitectura

- `domain`: entidades, enums, interfaces de repositorio y reglas de dominio.
- `infrastructure`: Prisma, repositorios, OpenAI/WhatsApp/email, logging y adapters.
- `application`: DTOs, orquestación, functions y prompt mantenido en el repositorio.
- `presentation`: Express, controladores, REST y Socket.IO del panel.

Los Request DTO exponen `validate(payload: unknown): [string?, RequestDTO?]`. El primer elemento contiene el error y el segundo el DTO validado. No se usa Zod.

La interpretación de intenciones, preguntas, respuestas y datos del prospecto corresponde exclusivamente al modelo de IA, con el contexto y las tools disponibles. El backend no clasifica mensajes por expresiones regulares, palabras clave o frases, ni modifica el texto de respuesta generado por el modelo. Persiste los datos estructurados y aplica validaciones de formato, códigos de catálogo, control humano y reglas operativas. Si el modelo no extrae un dato, permanece pendiente. `clientType` acepta únicamente un código del catálogo o `null` en la salida del modelo; las tools exigen códigos válidos y no traducen frases del prospecto. Esta regla también está en `AGENTS.md`.

## Configuración y desarrollo

Se requiere Node.js 22, pnpm 9 y PostgreSQL. Configura `.env.development` y `.env.production` tomando `.env.example` como referencia. Ambos deben contener:

```dotenv
OPENAI_API_KEY="tu-clave"
OPENAI_MODEL="gpt-6-luna"
```

`OPENAI_ASSISTANT_ID`, `OPENAI_ASSISTANT_NAME`, `OPENAI_ASSISTANT_MODEL` y `assistant:bootstrap` ya no se utilizan. No hace falta crear un Assistant remoto.

```sh
pnpm install --frozen-lockfile
pnpm env:use:dev
pnpm prisma:migrate
pnpm prisma:generate
pnpm seed
pnpm dev
```

`dev`, `prisma:migrate` y `seed` copian `.env.development` a `.env`. `start` y `prisma:deploy` copian `.env.production`. El modelo predeterminado también es `gpt-6-luna` cuando `OPENAI_MODEL` no está definido.

## Flujo de Responses y memoria

1. El webhook transforma la entrada, obtiene la conversación y guarda el mensaje local.
2. La cola agrupa mensajes por conversación. Cada entrada guarda su ID local; el último ID del lote delimita el historial que puede procesarse.
3. Si falta `Conversation.openAiConversationId`, crea una conversación remota, guarda su ID y reconstruye el historial cronológico desde PostgreSQL, con roles `user` para IN y `assistant` para OUT. La importación usa lotes de hasta 20 items.
4. En turnos posteriores incorpora únicamente mensajes con `Message.openAiSyncedAt = null`, incluidos los del operador. Los mensajes recibidos durante una generación quedan para el siguiente lote.
5. Envía las instrucciones y las siete functions en cada solicitud Responses: `reasoning.effort = low`, `max_output_tokens = 8192`, timeout de 90 segundos por solicitud y sin reintentos automáticos del SDK.
6. Ejecuta las llamadas nativas secuencialmente, valida argumentos mediante DTOs y almacena `function_call_output` con su `call_id` en la misma conversación antes de continuar. El turno admite hasta ocho rondas de funciones; los errores se devuelven al modelo.
7. Valida estado completo, ausencia de rechazo y JSON estricto (`replyText`, `nextStage`, `extractedFields`) antes de WhatsApp. Los datos desconocidos son `null` y se normalizan a `undefined`; el JSON final no contiene tools.
8. Guarda la respuesta local con el ID Responses y su marca de sincronización: OpenAI ya almacenó esa salida, por lo que no se reenvía como historial.

El reemplazo del ID remoto y el reinicio de las marcas locales ocurren en una transacción. Solo se marcan los lotes confirmados por OpenAI. Si la comprobación inicial del ID devuelve `404`, se reconstruye la memoria; otros errores conservan el ID y se propagan. Un turno que ya ejecutó funciones no se reproduce automáticamente. Los logs de Responses contienen ID, modelo, duración, estado y consumo, sin textos del cliente ni argumentos de funciones.

`assistantThreadId` queda como referencia histórica. No se consulta la API de Assistants. La memoria se reconstruye desde los mensajes locales; datos que existieran únicamente en un thread antiguo no se importan.

## Control humano, cierre y eliminación

La IA comprueba el control al procesar cada lote, antes de las funciones y antes de enviar WhatsApp. Tomar y liberar control durante una generación también cancela ese turno. Las escrituras de stage de la IA no pueden sobrescribir `PENDING_HUMAN`.

Un inquiry cerrado sigue recibiendo respuestas a dudas en la misma conversación, sin crear otro lead, modificar su calificación ni repetir notificaciones. Al liberar control humano, la conversación vuelve a `COMPLETED` si el inquiry asociado está cerrado; en los demás casos vuelve a `QUALIFYING`.

Al eliminar un contacto, se bloquean turnos nuevos y se espera a que terminen los turnos en curso; después se borran primero todos los items y las conversaciones remotas asociadas, fuera de la transacción local. Un `404` cuenta como eliminación realizada. Cualquier otro fallo conserva los datos locales y devuelve error para permitir reintento; la limpieza remota puede haber avanzado parcialmente. Después se eliminan los registros locales y se emite el evento existente de Socket.IO.

La cola y las comprobaciones de control operan en una sola instancia del backend. Las respuestas son completas, sin streaming. La migración a Responses conserva los contratos REST y Socket.IO existentes.

## Catálogo y calificación comercial

`src/application/catalog/contaMagnoCommercialCatalog.ts` centraliza los servicios, precios y alcances que usan tanto el prompt como el contexto de cada turno: contabilidad inteligente con IA, CFO Externo, asesoría fiscal y consultoría empresarial. Los paquetes de personas físicas conservan sus rangos y alcances: Básico $800–$1,000 MXN, Intermedio $1,200–$1,500 MXN y Premium $1,800–$2,500 MXN, sin añadir supuestos sobre IVA. Una declaración anual u otra solicitud puntual requiere cotización del contador.

La recomendación depende de la necesidad. Una persona física con negocio también puede interesarse en CFO Externo. Su calificación breve recoge problema financiero, giro, tamaño, equipo contable e interés en la inversión, aprovechando lo conocido y preguntando cada dato faltante por separado. La estructura comercial confirmada el 17 de noviembre de 2026 sustituye los rangos anteriores con estos precios mensuales sugeridos, más IVA y sujetos a evaluación de necesidades y propuesta personalizada:

- **CFO Esencial: $8,000 MXN/mes.** Diagnóstico inicial de necesidades, análisis de estados financieros, indicadores de liquidez y rentabilidad, tablero de KPIs y reporte financiero mensual.
- **CFO Estratégico: $15,000 MXN/mes.** Incluye Esencial y añade flujo de efectivo proyectado, presupuestos, desviaciones, costos, gastos, capital de trabajo y recomendaciones financieras. Seguimiento quincenal.
- **CFO Integral: $25,000 MXN/mes.** Incluye Estratégico y añade planeación financiera estratégica, acompañamiento a la dirección, supervisión financiera del equipo interno y análisis de decisiones de inversión. Seguimiento semanal.

El diagnóstico financiero tiene una tarifa de referencia de **$15,000 MXN más IVA**. En Esencial se contrata por separado. En Estratégico existe la posibilidad de bonificar $7,500 con contrato mínimo de seis meses; no es una bonificación automática ni garantizada. En Integral se incluye con contrato mínimo de seis meses. No se acumulan los beneficios de diagnóstico entre niveles ni se añade una tarifa de implementación no confirmada. El diagnóstico inicial de necesidades incluido en los paquetes y la llamada inicial de evaluación no equivalen a contratar el diagnóstico financiero.

La metodología comprende cuatro etapas: diagnóstico inicial, planeación e implementación de indicadores, seguimiento financiero mensual y evaluación estratégica periódica. Los entregables y la frecuencia dependen del paquete, respetando su seguimiento quincenal o semanal; esa periodicidad no fija por sí sola un número de reuniones. La tabla general de nueve entregables de las imágenes se conserva como referencia, con su contenido y periodicidades alternativas, sin ampliar lo incluido en cada paquete. Los alcances específicos quedan sujetos a propuesta comercial.

Quedan excluidos contabilidad operativa, declaraciones fiscales, nómina, auditorías, cobranza directa, ejecución de pagos, trámites legales, licencias de software, implementaciones tecnológicas complejas y estudios especializados de inversión; se cotizan por separado. La supervisión del equipo no añade contabilidad operativa, y analizar decisiones de inversión no incluye estudios especializados de inversión.

`mainNeed` guarda la necesidad, `recommendedPlan` el servicio o paquete determinado por el agente y `specialtyProfile` el resumen acumulado del negocio y su interés, incluido el paquete CFO elegido y el interés en la llamada inicial. El plazo de seis meses solo se registra si el prospecto lo expresa; aceptar la llamada no implica aceptar un contrato. `budgetRange` se usa únicamente para presupuestos expresados por el prospecto. Guardar datos parciales ya no asigna un paquete por palabras clave; la recomendación permanece pendiente hasta que se determine. Una recomendación explícita de CFO se guarda como `CFO Externo`, también en las notificaciones; el nivel Esencial, Estratégico o Integral se conserva en `specialtyProfile`.

El objetivo comercial de CFO es conseguir una llamada de diagnóstico inicial con el responsable de Conta Magno para evaluar al prospecto y preparar una propuesta personalizada. Se propone la llamada tras explicar la inversión de referencia; el equipo la coordina por este chat, sin reservas automáticas. No se afirma precio, gratuidad ni duración de esa llamada, porque no están definidos.

Tras confirmar interés se solicitan nombre, correo y confirmación de WhatsApp, uno por mensaje. El régimen se registra solo cuando el prospecto lo indica; se aceptan `NO_LO_SE_AUN` y `NO_INSCRITO_EN_HACIENDA` sin impedir el cierre. El mensaje final de CFO es:

> Gracias por compartir tus datos. El equipo de Conta Magno se pondrá en contacto contigo por este mismo chat para coordinar una llamada de diagnóstico inicial con el responsable de Conta Magno, evaluar tus necesidades y preparar una propuesta personalizada.

Para los demás servicios se conserva:

> Gracias por compartir tus datos. El equipo de Conta Magno se pondrá en contacto contigo por este mismo chat para revisar tus necesidades y continuar la atención.

`SCHEDULING` permanece en el enum y en los datos históricos, pero se excluye del esquema de salida y de las funciones activas. El router rechaza `listAvailableSlots` y `createTentativeAppointment` y no ejecuta reservas. Los registros históricos pueden continuar en etapas activas sin eliminar sus citas anteriores. Se conservan el control humano, la memoria, los contratos REST y Socket.IO y las protecciones de conversaciones completadas. Estos cambios no requieren columnas ni migraciones.

## Avisos de mensajes entrantes por WhatsApp

La plantilla aprobada para los avisos es `nombre_aviso_mensaje_recibido`. Se configura desde el entorno del backend; el panel **Settings / Configuración** permite únicamente guardar hasta 10 números destinatarios y enviar una prueba. Con números guardados, los avisos están activos. Guardar una lista vacía los desactiva. La configuración se conserva en PostgreSQL y sobrevive a reinicios.

En el `.env` que utiliza producción añade:

```env
META_INCOMING_MESSAGE_TEMPLATE_NAME="nombre_aviso_mensaje_recibido"
META_INCOMING_MESSAGE_TEMPLATE_LANG="es_MX"
```

El idioma debe coincidir exactamente con la aprobación de Meta: `es_MX` para Español (México), `es` para Español genérico. El valor preparado es `es_MX`, según la guía inicial. También se necesitan las credenciales existentes `META_WHATSAPP_TOKEN` y `META_WHATSAPP_PHONE_NUMBER_ID`; conserva sus valores actuales. Docker Compose lee `.env`. Los scripts locales de desarrollo y producción copian `.env.development` y `.env.production` a `.env`, respectivamente, por lo que las dos variables se incluyen también en esos archivos. `.env.example` contiene el ejemplo sin credenciales.

El aviso envía exactamente dos parámetros de cuerpo, en orden: **nombre del contacto** (`{{1}}`) y **WhatsApp con código de país** (`{{2}}`). El nombre, idioma y formato se toman del backend; la configuración anterior de plantilla propia o de solicitud en PostgreSQL y los campos enviados por clientes antiguos no pueden sustituir la plantilla del entorno. La plantilla de solicitud de prospecto completado sigue siendo independiente y usa las variables existentes `META_OWNER_LEAD_TEMPLATE_NAME` y `META_OWNER_LEAD_TEMPLATE_LANG`.

Se genera **un solo aviso inicial por contacto y ciclo**, enviado a los destinatarios configurados. Los siguientes mensajes del mismo contacto no generan otro aviso. Cuando un inquiry se marca por primera vez como `QUALIFIED` o `CLOSED` (también al completar la calificación automática), se habilita el siguiente ciclo: el primer mensaje posterior podrá generar otro aviso. Guardar repetidamente esos estados, pasar de `QUALIFIED` a `CLOSED`, tomar/liberar control humano o borrar/restaurar destinatarios no reinicia el ciclo.

El aviso funciona con texto y archivos y durante control humano. Se envía junto al procesamiento de la IA: un fallo de envío no impide que responda. El remitente se excluye si está entre los destinatarios. Los estados de entrega de WhatsApp y las respuestas salientes no generan avisos. No se reenvía el texto del cliente.

El ciclo y su consumo se guardan en `Contact` y se reclaman de forma atómica; cada mensaje entrante guarda el ciclo en que llegó. Los mensajes simultáneos generan un solo aviso y el trabajo retrasado de un ciclo antiguo no consume el siguiente. El primer cambio a calificado/completado se registra en `Inquiry.incomingNotificationResetAt` y reinicia el ciclo en la misma transacción.

Los intentos se registran en `IncomingMessageNotification`, con restricción única por mensaje y destinatario y estados `PENDING`, `SENT` o `FAILED`. `SENT` significa aceptación por Meta y un ID devuelto, no entrega al teléfono. Se hace un intento por ciclo sin reenvíos automáticos. Los logs incluyen IDs locales, tipo de error y código de Meta cuando está disponible, sin texto del cliente ni números destinatarios. La eliminación de un contacto espera sus avisos en curso y borra estos registros al eliminar sus mensajes; los números globales se conservan.

Para probar, guarda los números con código de país (México: +52 y los 10 dígitos), uno por línea, y pulsa **Enviar prueba**. Se envía un WhatsApp real a todos los destinatarios guardados con el nombre “Contacto de prueba” y un número ficticio; no crea contactos, inquiries ni conversaciones y no consume ningún ciclo. Comprueba la recepción en los teléfonos.

Este ajuste no requiere una migración adicional si ya se aplicaron las migraciones de memoria, notificaciones y ciclos. Para desplegar, descarga los cambios, añade las variables al `.env` del servidor, reconstruye/recrea el backend y publica el frontend actualizado. Los campos antiguos de plantilla y activación se conservan en la base como históricos; la activación efectiva depende de que haya destinatarios guardados.

## Verificación

```sh
pnpm test
pnpm build
pnpm exec prisma validate
```

Las pruebas simuladas cubren memoria nueva/importada, turnos sin duplicados, mensajes humanos y concurrentes, funciones, argumentos inválidos, límite de rondas, respuestas incompletas/rechazadas, cierre, control humano y limpieza remota previa a la eliminación local. No utilizan OpenAI ni envían WhatsApp.

Las pruebas de avisos verifican números, autenticación, duplicados, errores por destinatario, control humano, archivos y que una notificación lenta o fallida no bloquee la respuesta de la IA. También cubren un aviso por ciclo, persistencia al reiniciar, trabajo retrasado, activación al guardar números y la plantilla fija de dos variables, incluyendo configuraciones históricas que intenten sustituirla. La prueba de PostgreSQL comprueba la actualización desde avisos anteriores, reinicios de ciclo por calificación manual/automática, números persistidos, campos históricos ignorados, restricciones únicas y limpieza por cascada.

Para probar la migración con registros existentes, crea una base PostgreSQL local **vacía y desechable**, cuyo nombre termine en `_test`, y ejecuta:

```sh
TEST_DATABASE_URL='postgresql://usuario:clave@127.0.0.1:5432/conta_magno_test' pnpm exec tsx --test tests/migration.test.ts
```

La prueba aplica primero las migraciones antiguas, inserta historial de prueba y aplica la migración nueva. Sin `TEST_DATABASE_URL`, `pnpm test` omite esa prueba y nunca usa `DATABASE_URL` para ella.

Prueba aislada con la API real, datos sintéticos y limpieza remota al terminar:

```sh
pnpm env:use:dev
pnpm responses:smoke
pnpm responses:qualification
```

Requieren una clave con acceso al modelo y consumen tokens. No importan la base de datos ni clientes WhatsApp. `responses:smoke` valida el JSON y reporta metadatos sin imprimir la respuesta completa. `responses:qualification` revisa catorce conversaciones sintéticas: los tres paquetes contables, una declaración anual, captura sin RFC, CFO para persona física y empresa, los tres niveles CFO y sus precios sugeridos, entregables y periodicidades, condiciones del diagnóstico y contratos de seis meses, metodología, exclusiones, captura secuencial, régimen desconocido, seguimiento después del cierre y llamada inicial coordinada por humanos sin agenda automática. Valida las respuestas con aserciones y guarda el diálogo sintético en un archivo temporal cuya ruta reporta al terminar, también ante fallos; elimina cada conversación remota en un bloque `finally`.

Para repetir escenarios concretos se puede usar una expresión regular, por ejemplo `RESPONSES_QUALIFICATION_FILTER='CFO Integral|Diagnóstico CFO|Llamada inicial' pnpm responses:qualification`. Un filtro sin coincidencias produce un error.

## Despliegue

La implementación no aplica la migración a producción ni reinicia servicios. Para desplegarla, configura `OPENAI_MODEL=gpt-6-luna` y la clave en `.env.production`, conserva el mecanismo habitual de respaldo de la base y detén la instancia anterior mientras cambias el backend:

```sh
pnpm install --frozen-lockfile
pnpm prisma:deploy
pnpm prisma:generate
pnpm build
pnpm start
```

Si utilizas un gestor de procesos, reinicia el backend compilado con el procedimiento habitual después de la migración y generación. No ejecutes `prisma migrate dev` contra producción. La migración `20261004000000_add_responses_memory` es aditiva: añade dos columnas nullable y un índice único; no borra registros ni modifica threads históricos.

Comprueba `/health`, realiza una prueba controlada de dos turnos y verifica el panel y las notificaciones. La documentación oficial describe [la migración de Assistants a Responses/Conversations](https://developers.openai.com/api/docs/assistants/migration) y [las capacidades de GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).

## REST y pruebas HTTP

- `POST /webhooks/whatsapp/meta`
- `POST /webhooks/whatsapp/twilio`
- `GET /api/inquiries` y `GET /api/inquiries/:id`
- `POST /api/inquiries/:id/status` y `POST /api/inquiries/:id/notes`
- `GET /api/conversations` y `GET /api/conversations/:id`
- `POST /api/conversations/:id/take-control` y `POST /api/conversations/:id/release-control`
- `POST /api/conversations/:id/messages`
- `GET /api/contacts` y `DELETE /api/contacts/:id`
- `GET /api/settings/incoming-notifications` y `PATCH /api/settings/incoming-notifications` (autenticación administrativa)
- `POST /api/settings/incoming-notifications/test` (envío real a todos los números guardados sin consumir el ciclo)
- `GET /health`

Usa `http/auth.http` para iniciar sesión en el panel. Los archivos `http/meta-webhook.http`, `http/twilio-webhook.http`, `http/admin.http`, `http/contacts.http` y `http/settings.http` incluyen ejemplos. Los webhooks, el envío humano y las pruebas de avisos pueden enviar WhatsApp real.

Las siete functions registradas son `getContactByWaId`, `upsertContact`, `getActiveConversation`, `updateConversationStage`, `createOrGetOpenInquiry`, `updateInquiryFields` y `closeInquiry`. Cada definición usa `strict: false` para preservar argumentos opcionales y validación por DTO. El prompt propone una llamada inicial para CFO que coordina el equipo por chat; no reserva fechas ni horarios.

## Archivos, moderación y control temporal

La migración `20261118000000_chat_capabilities` añade adjuntos, enlaces temporales, políticas de números, sesiones de control y trabajos persistentes. Aplicarla antes de arrancar el backend actualizado. Las funciones multimedia y el bloqueo remoto se habilitan para Meta; las rutas de texto de Twilio se conservan. Publicar también el frontend hermano `conta-magno-assistant-frontend`.

Configurar `PUBLIC_API_URL` con la URL HTTPS pública del backend, `MEDIA_STORAGE_DIR` con un directorio privado persistente, `META_GRAPH_API_VERSION` (predeterminado `v27.0`) y `OPENAI_TRANSCRIPTION_MODEL` (predeterminado `gpt-transcribe`). Docker incluye FFmpeg y monta el volumen `conta_magno_media`. Fuera de Docker deben instalarse `ffmpeg` y `ffprobe`. Respaldar el volumen junto con PostgreSQL; no montar el directorio como contenido público. Los archivos se conservan hasta eliminar el contacto.

El panel permite adjuntar hasta cinco archivos: PDF, Word, Excel, imágenes, CSV, XML y texto. Límite por archivo: 16 MB; imágenes: 5 MB. Los audios entrantes admiten hasta 16 MB y diez minutos; se guardan original, reproducción MP3 y transcripción. No hay grabación ni envío de audio. Los CSV/XML salientes se comparten mediante enlaces de descarga de 24 horas; “Solicitar archivo” copia un enlace de carga de un solo uso y 24 horas para enviarlo al prospecto. Los documentos se leen con `readConversationAttachment`, que devuelve contenido multimodal al modelo, nunca inferencias por palabras clave. Las hojas grandes pueden tener lectura parcial y no deben utilizarse para inventar totales completos.

El webhook Meta guarda cada mensaje y su trabajo antes de confirmar recepción. Un worker procesa la cola de una instancia de backend, con deduplicación por ID de WhatsApp. Los trabajos pendientes sobreviven a reinicios; los que estaban ejecutándose se marcan fallidos para revisión porque podrían haber generado efectos externos. No se reenvían automáticamente mensajes de resultado incierto. Los errores quedan visibles en el panel.

El filtro de IA evalúa cada entrada no autorizada explícitamente por un operador antes de crear leads, avisos o respuestas. Publicidad, dudas y fallos de clasificación quedan en revisión silenciosa. Autorizar un número habilita su atención futura y evalúa si hay pendientes; bloquearlo desactiva la atención local inmediatamente e intenta sincronizarlo con Meta. Un fallo remoto mantiene el bloqueo local y muestra `FAILED` para reintentar. La lista de bloqueos no se elimina al borrar un contacto. No se envían solicitudes automáticas de baja a terceros.

Tomar control crea una sesión de 120 segundos; escribir y enviar renueva el vencimiento. Abrir la conversación no lo renueva. La actividad se confirma por Socket.IO con respaldo HTTP; el servidor es la autoridad y una sesión vencida no puede enviar. Al liberar o vencer el control se evalúan los pendientes mediante IA, sin responder si el operador ya resolvió todo. Los escalamientos de la IA sin sesión manual no vencen automáticamente. Los envíos marcados `UNKNOWN` requieren revisión humana antes de reanudar automáticamente.

Nuevas rutas autenticadas: `GET /api/conversations/:id/capabilities`, `POST /api/conversations/:id/activity`, `POST /api/conversations/:id/attachments` (multipart, campo `files`), `POST /api/conversations/:id/file-links`, `GET /api/attachments/:id/content`, `GET /api/chat-policies`, `POST /api/chat-policies/:waId` y `POST /api/conversations/:id/policy`. Las acciones y envíos humanos incluyen `controlSessionId`. Los enlaces de `/chat-files/:token` conceden acceso temporal únicamente al recurso de su token; no acceden al historial.

La prueba adicional `tests/chat-runtime.integration.test.ts` usa exclusivamente `CHAT_TEST_DATABASE_URL`, apuntando a una base local desechable cuyo nombre termine en `_test`, previamente migrada y vacía de datos. Utiliza dobles de OpenAI, Meta y WhatsApp: no realiza envíos reales. La prueba de migraciones anterior sigue usando una base separada con `TEST_DATABASE_URL`.

Prueba real de IA sin WhatsApp: `pnpm exec tsx src/scripts/chatAiSmoke.ts /ruta/audio-sintetico.mp3`. El argumento de audio es opcional; siempre comprueba lectura de XML mediante una tool multimodal. Solo usar archivos sintéticos. El script elimina sus archivos y conversación de OpenAI al terminar.

### Actualización con Docker Compose

En el servidor del backend, conservar las credenciales actuales en `.env` y configurar `PUBLIC_API_URL` con la URL HTTPS pública de la API, incluido cualquier prefijo de proxy (el mismo valor base de `VITE_API_URL` del panel). Añadir `OPENAI_TRANSCRIPTION_MODEL=gpt-transcribe` y `META_GRAPH_API_VERSION=v27.0`. Si un valor contiene `$`, usar comillas simples para impedir interpolación de Docker Compose.

```sh
git pull --ff-only origin main
docker compose build
docker compose stop conta-magno
docker compose run --rm --no-deps conta-magno node node_modules/prisma/build/index.js migrate deploy
docker compose up -d --no-deps conta-magno
docker compose logs --tail=100 conta-magno
curl --fail http://127.0.0.1:4000/health
```

Conservar el respaldo habitual de PostgreSQL antes de la migración. El volumen `conta_magno_media` conserva archivos entre reconstrucciones; no usar `docker compose down -v` para actualizar. No es necesario ejecutar `pnpm start` dentro del contenedor: el `CMD` arranca el backend compilado directamente.

El frontend está configurado en su repositorio para Firebase Hosting (`conta-magno-admin-panel`). Actualizar ese repositorio, comprobar `VITE_API_URL` en `.env.production`, ejecutar `pnpm install --frozen-lockfile`, `pnpm build` y `firebase deploy --only hosting`. Los cambios de archivos y control requieren publicar también ese frontend.

### Correcciones de bloqueo y recepción de documentos

`OPENAI_TRANSCRIPTION_MODEL` debe contener el identificador del modelo, por ejemplo `gpt-transcribe`, no el nombre de la variable. Para evitar que esa equivocación rompa los audios, el backend usa el valor predeterminado si recibe literalmente el nombre de configuración. Una denegación real de acceso al modelo sigue requiriendo revisar la cuenta y el identificador configurado.

Bloquear conserva siempre la protección local. Cuando Meta rechaza el bloqueo remoto, la API devuelve el resultado local con `remoteStatus: FAILED` y `warning`, y el panel muestra la restricción informada por Meta; no se presenta como un error interno 500 ni como un bloqueo remoto confirmado. Desbloquear conserva la protección si Meta no confirma la operación.

Los PDF entrantes admiten redirecciones verificadas de las CDN de Meta y se suben a OpenAI con la extensión correspondiente a su tipo real. `POST /api/attachments/:id/retry` permite recuperar archivos fallidos sin reenviar mensajes al prospecto. Conserva la descarga del original aunque falle la transcripción o lectura de IA. El panel evita la página intermedia de ngrok y verifica que la respuesta de medios no sea HTML.

Las acciones de bloqueo están en los menús de opciones de la conversación y de la lista. El clip para adjuntar está junto al campo de texto. Ya no se ofrece “Solicitar archivo” en el panel; los enlaces previamente emitidos conservan su compatibilidad hasta vencer.


### Control de alcance del chat

El modelo evalúa cada mensaje antes de la calificación. Una primera desviación genera un aviso; la insistencia silencia la IA hasta recibir una consulta pertinente. El estado persiste por conversación y no modifica el bloqueo de WhatsApp ni el control humano.

Esta versión requiere la migración `20261119000000_conversation_scope` antes de iniciar el backend actualizado. Desde el repositorio del servidor:

```sh
git pull --ff-only
docker compose build conta-magno
docker compose stop conta-magno
docker compose run --rm conta-magno node node_modules/prisma/build/index.js migrate deploy
docker compose up -d conta-magno
```

Prueba sintética del control de rol y bienvenida, sin WhatsApp ni escritura de leads: `pnpm exec tsx src/scripts/scopeSmoke.ts`. La prueba utiliza Responses y elimina su conversación remota al terminar. La integración requiere una base local desechable con `CHAT_TEST_DATABASE_URL` y todas las migraciones aplicadas.
