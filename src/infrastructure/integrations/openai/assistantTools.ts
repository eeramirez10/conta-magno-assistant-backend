import type { FunctionTool } from "openai/resources/responses/responses";
import { CONTRIBUYENTE_TYPE_VALUES } from "../../../domain/enums/ContribuyenteType.js";
import { ASSISTANT_CONVERSATION_STAGES } from "../../../domain/enums/ConversationStage.js";

export const contaMagnoAssistantFunctions: FunctionTool[] = [
  { type: "function", strict: false, name: "readConversationAttachment", description: "Lee un adjunto de esta conversación; usar antes de responder sobre su contenido. Devuelve imágenes, documentos o transcripción de audio.", parameters: { type: "object", properties: { attachmentId: { type: "string" } }, required: ["attachmentId"], additionalProperties: false } },
  {
    type: "function",
    strict: false,
    name: "getContactByWaId",
    description: "Obtiene un contacto existente por waId de WhatsApp.",
    parameters: {
      type: "object",
      properties: {
        waId: { type: "string" }
      },
      required: ["waId"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    strict: false,
    name: "upsertContact",
    description: "Crea o actualiza datos del contacto lead.",
    parameters: {
      type: "object",
      properties: {
        waId: { type: "string" },
        fullName: { type: "string" },
        phoneE164: { type: "string" },
        email: { type: "string" },
        timezone: { type: "string" },
        consentPrivacy: { type: "boolean" }
      },
      required: ["waId", "fullName", "phoneE164"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    strict: false,
    name: "getActiveConversation",
    description: "Obtiene o crea la conversación activa para un contacto.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string" }
      },
      required: ["contactId"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    strict: false,
    name: "updateConversationStage",
    description: "Actualiza el stage conversacional.",
    parameters: {
      type: "object",
      properties: {
        conversationId: { type: "string" },
        stage: {
          type: "string",
          enum: ASSISTANT_CONVERSATION_STAGES
        }
      },
      required: ["conversationId", "stage"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    strict: false,
    name: "createOrGetOpenInquiry",
    description: "Obtiene o crea la inquiry abierta del lead.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        conversationId: { type: "string" }
      },
      required: ["contactId", "conversationId"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    strict: false,
    name: "updateInquiryFields",
    description: "Actualiza datos de calificación y recomendación de la inquiry.",
    parameters: {
      type: "object",
      properties: {
        inquiryId: { type: "string" },
        clientType: { type: "string", enum: CONTRIBUYENTE_TYPE_VALUES },
        specialtyProfile: { type: "string", description: "Resumen acumulado: actividad, giro, tamaño, equipo contable, paquete CFO recomendado e interés en inversión y llamada inicial. Plazo contractual solo si el prospecto lo expresa; conservar lo conocido sin inventar." },
        mainNeed: { type: "string" },
        urgency: { type: "string" },
        budgetRange: { type: "string", description: "Solo presupuestos expresados por el prospecto; no guardar aquí precios de catálogo." },
        recommendedPlan: { type: "string", description: "Servicio o paquete determinado con el catálogo; usar CFO Externo para dirección financiera. Omitir mientras esté pendiente." },
        notes: { type: "string" }
      },
      required: ["inquiryId"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    strict: false,
    name: "closeInquiry",
    description: "Cierra la inquiry actual cuando el caso se completa.",
    parameters: {
      type: "object",
      properties: {
        inquiryId: { type: "string" }
      },
      required: ["inquiryId"],
      additionalProperties: false
    }
  }
];
