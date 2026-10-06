import { ResponsesClient } from "../infrastructure/integrations/openai/ResponsesClient.js";
import { contaMagnoAssistantPrompt } from "../application/prompts/contaMagnoAssistantPrompt.js";
import { Env } from "../infrastructure/config/env.js";
import { logger } from "../infrastructure/logging/logger.js";

// Uses synthetic data and imports neither WhatsApp clients nor the database.
async function main(): Promise<void> {
  if (!Env.openAiApiKey) throw new Error("Falta OPENAI_API_KEY");
  const client = new ResponsesClient();
  let conversationId: string | null = null;
  try {
    conversationId = await client.syncHistory({
      conversationId: null,
      messages: [{ id: "smoke_user", direction: "IN", text: "¿Qué incluye el paquete básico?", openAiSyncedAt: null }],
      onConversationCreated: async (id) => { conversationId = id; },
      onMessagesSynced: async () => {},
      shouldContinue: async () => true
    });
    const result = await client.runResponse({
      conversationId,
      prompt: contaMagnoAssistantPrompt,
      contextJson: { conversation: { flowCompleted: true }, inquiry: { status: "CLOSED" }, smokeTest: true },
      onToolCall: async () => ({ ok: false, error: "Prueba aislada: funciones sin efectos externos." }),
      shouldContinue: async () => true
    });
    logger.info({ responseId: result.responseId, nextStage: result.output.nextStage, replyLength: result.output.replyText.length }, "Prueba Responses completada sin WhatsApp");
  } finally {
    if (conversationId) await client.deleteConversation(conversationId);
  }
}

main().catch(() => {
  logger.error("Falló la prueba aislada de Responses; revisa las credenciales, el modelo y la conectividad.");
  process.exitCode = 1;
});
