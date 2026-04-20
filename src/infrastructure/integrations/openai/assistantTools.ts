import { CONTRIBUYENTE_TYPE_VALUES } from "../../../domain/enums/ContribuyenteType.js";

export type AssistantFunctionDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export const contaMagnoAssistantFunctions: AssistantFunctionDefinition[] = [
  {
    type: "function",
    function: {
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
    }
  },
  {
    type: "function",
    function: {
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
    }
  },
  {
    type: "function",
    function: {
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
    }
  },
  {
    type: "function",
    function: {
      name: "updateConversationStage",
      description: "Actualiza el stage conversacional.",
      parameters: {
        type: "object",
        properties: {
          conversationId: { type: "string" },
          stage: {
            type: "string",
            enum: [
              "GREETING",
              "QUALIFYING",
              "INFORMATION",
              "PLAN_RECOMMENDATION",
              "SCHEDULING",
              "PENDING_HUMAN",
              "COMPLETED"
            ]
          }
        },
        required: ["conversationId", "stage"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
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
    }
  },
  {
    type: "function",
    function: {
      name: "updateInquiryFields",
      description: "Actualiza datos de calificación y recomendación de la inquiry.",
      parameters: {
        type: "object",
        properties: {
          inquiryId: { type: "string" },
          clientType: { type: "string", enum: CONTRIBUYENTE_TYPE_VALUES },
          specialtyProfile: { type: "string" },
          mainNeed: { type: "string" },
          urgency: { type: "string" },
          budgetRange: { type: "string" },
          recommendedPlan: { type: "string" },
          notes: { type: "string" }
        },
        required: ["inquiryId"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
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
  },
  {
    type: "function",
    function: {
      name: "listAvailableSlots",
      description: "Lista horarios disponibles para cita por video llamada.",
      parameters: {
        type: "object",
        properties: {
          fromDate: { type: "string", description: "Formato YYYY-MM-DD" },
          limit: { type: "integer", minimum: 1, maximum: 20 }
        },
        required: ["fromDate"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "createTentativeAppointment",
      description: "Reserva una cita tentativa en un slot seleccionado por el lead.",
      parameters: {
        type: "object",
        properties: {
          inquiryId: { type: "string" },
          slotId: { type: "string" }
        },
        required: ["inquiryId", "slotId"],
        additionalProperties: false
      }
    }
  }
];
