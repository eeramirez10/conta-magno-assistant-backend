# Conta Magno Assistant Backend

Backend Node.js + TypeScript para WhatsApp (Meta y Twilio), con OpenAI Responses API, Conversations API y `gpt-6-luna`.

## Arquitectura

- `domain`: entidades, enums, interfaces de repositorio y reglas de dominio.
- `infrastructure`: Prisma, repositorios, OpenAI/WhatsApp/email, logging y adapters.
- `application`: DTOs, orquestación, functions y prompt mantenido en el repositorio.
- `presentation`: Express, controladores, REST y Socket.IO del panel.

Los Request DTO exponen `validate(payload: unknown): [string?, RequestDTO?]`. El primer elemento contiene el error y el segundo el DTO validado. No se usa Zod.

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
```

Requiere una clave con acceso al modelo y consume tokens. No importa la base de datos ni clientes WhatsApp. Valida el JSON y reporta metadatos sin imprimir la respuesta completa.

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

Las siete functions registradas son `getContactByWaId`, `upsertContact`, `getActiveConversation`, `updateConversationStage`, `createOrGetOpenInquiry`, `updateInquiryFields` y `closeInquiry`. Cada definición usa `strict: false` para preservar argumentos opcionales y validación por DTO. El prompt actual no ofrece citas ni videollamadas.
