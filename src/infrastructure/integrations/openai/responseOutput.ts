import { ConversationStage } from "../../../domain/enums/ConversationStage.js";

const stringFields = ["fullName", "email", "phoneWhatsApp", "clientType", "specialtyProfile", "mainNeed", "urgency", "budgetRange", "recommendedPlan", "preferredDate", "preferredTime"] as const;
export type AssistantStructuredOutput = {
  replyText: string;
  nextStage: ConversationStage;
  extractedFields: Partial<Record<typeof stringFields[number], string>> & { needsHuman?: boolean };
};

export const assistantOutputFormat = {
  type: "json_schema" as const,
  name: "conta_magno_reply",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["replyText", "nextStage", "extractedFields"],
    properties: {
      replyText: { type: "string" },
      nextStage: { type: "string", enum: Object.values(ConversationStage) },
      extractedFields: {
        type: "object",
        additionalProperties: false,
        required: [...stringFields, "needsHuman"],
        properties: {
          ...Object.fromEntries(stringFields.map((field) => [field, { type: ["string", "null"] }])),
          needsHuman: { type: ["boolean", "null"] }
        }
      }
    }
  }
};

export function parseAssistantOutput(raw: string): AssistantStructuredOutput {
  let output: Record<string, unknown>;
  try { output = JSON.parse(raw) as Record<string, unknown>; }
  catch { throw new Error("Respuesta JSON inválida del asistente"); }
  if (!output || typeof output !== "object" || Array.isArray(output) ||
    Object.keys(output).sort().join() !== "extractedFields,nextStage,replyText" ||
    typeof output.replyText !== "string" || !output.replyText.trim() ||
    !Object.values(ConversationStage).includes(output.nextStage as ConversationStage) ||
    !output.extractedFields || typeof output.extractedFields !== "object" || Array.isArray(output.extractedFields)) {
    throw new Error("Respuesta JSON inválida del asistente");
  }
  const fields = output.extractedFields as Record<string, unknown>;
  const expected = [...stringFields, "needsHuman"];
  if (Object.keys(fields).sort().join() !== expected.sort().join()) {
    throw new Error("Campos extraídos inválidos");
  }
  for (const key of stringFields) {
    if (fields[key] !== null && typeof fields[key] !== "string") throw new Error("Campo extraído inválido");
  }
  if (fields.needsHuman !== null && typeof fields.needsHuman !== "boolean") throw new Error("needsHuman inválido");
  return {
    replyText: output.replyText,
    nextStage: output.nextStage as ConversationStage,
    extractedFields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value ?? undefined]))
  };
}
