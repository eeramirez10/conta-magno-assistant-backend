# Conta Magno Assistant Backend

Backend en Node.js + TypeScript con Clean Architecture para asistente conversacional de WhatsApp (Meta y Twilio) integrado con OpenAI Assistants API.

## Arquitectura

- `domain`: entidades, enums, interfaces de repositorio y reglas de dominio.
- `infrastructure`: Prisma, repositorios concretos, integraciones externas (OpenAI/WhatsApp/email), logging y adapters.
- `application`: DTOs request/response, servicios de orquestación y prompt del asistente.
- `presentation`: server Express, controladores, rutas HTTP y middlewares.

## Regla de validación DTO (tuple)

Todos los Request DTO exponen:

`validate(payload: unknown): [string?, RequestDTO?]`

- índice `0`: mensaje de error
- índice `1`: DTO válido

No se usa Zod.

## Endpoints

- `POST /webhooks/whatsapp/meta`
- `POST /webhooks/whatsapp/twilio`
- `GET /api/inquiries`
- `GET /api/inquiries/:id`
- `POST /api/inquiries/:id/status`
- `POST /api/inquiries/:id/notes`
- `GET /api/conversations`
- `GET /api/conversations/:id`
- `GET /health`

## Flujo webhook unificado

1. Parsea payload por proveedor.
2. Convierte a formato interno común.
3. Obtiene/crea conversación activa.
4. Guarda mensaje IN.
5. Obtiene/crea inquiry abierta (con folio).
6. Construye contexto y ejecuta Assistant.
7. Parsea JSON obligatorio (`replyText`, `nextStage`, `extractedFields`).
8. Ejecuta functions nativas (`requires_action`) en `AssistantToolRouterService`.
9. Actualiza stage/estado.
10. Envía respuesta por proveedor correcto.
11. Guarda mensaje OUT.
12. Emite notificaciones internas (email/WhatsApp).

## Modelo de datos (Prisma)

- `Contact`
- `Conversation` (incluye `assistantThreadId`)
- `Message`
- `Inquiry` (incluye `folio` único)
- `NotificationEvent`
- `AvailabilitySlot`
- `Appointment`

## Variables de entorno

Archivos disponibles:
- `.env.development`
- `.env.production`
- `.env.example`

Atajos:
- `npm run env:use:dev`
- `npm run env:use:prod`
- `npm run dev` ya ejecuta `env:use:dev` automáticamente.
- `npm run start` ya ejecuta `env:use:prod` automáticamente.
- `npm run prisma:migrate` y `npm run seed` usan `env:use:dev` automáticamente.
- `npm run prisma:deploy` usa `env:use:prod` automáticamente.

## Ejecución

1. `npm install`
2. `npm run env:use:dev` (o `npm run env:use:prod`)
3. Ajustar credenciales.
4. `npm run assistant:bootstrap` (crea/actualiza assistant y guarda `OPENAI_ASSISTANT_ID` en `.env`)
5. `npm run prisma:generate`
6. `npm run prisma:migrate`
7. `npm run seed`
8. `npm run dev`

## Pruebas manuales

- `http/meta-webhook.http`
- `http/twilio-webhook.http`
- `http/admin.http`

## Nota sobre cita por video llamada

El asistente propone horarios desde `AvailabilitySlot`, puede reservar cita tentativa y notifica al equipo de Conta Magno para que envíe el enlace final de video llamada al prospecto.

## Functions nativas en OpenAI

El bootstrap registra estas functions en el Assistant:
- `getContactByWaId`
- `upsertContact`
- `getActiveConversation`
- `updateConversationStage`
- `createOrGetOpenInquiry`
- `updateInquiryFields`
- `closeInquiry`
- `listAvailableSlots`
- `createTentativeAppointment`
