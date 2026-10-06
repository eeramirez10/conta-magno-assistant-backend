import OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { Env } from "../../config/env.js";
import { logger } from "../../logging/logger.js";
import { contaMagnoAssistantFunctions } from "./assistantTools.js";
import { assistantOutputFormat, parseAssistantOutput } from "./responseOutput.js";

export type AssistantToolCall = { name: string; arguments: Record<string, unknown> };
export type HistoryMessage = { id: string; direction: "IN" | "OUT"; text: string; openAiSyncedAt: Date | null };
export class AssistantTurnStoppedError extends Error {
  constructor() { super("El operador tomó control de la conversación"); }
}

export class ResponsesClient {
  constructor(private readonly client = new OpenAI({ apiKey: Env.openAiApiKey, timeout: 90_000, maxRetries: 0 })) {}

  public static isNotFound(error: unknown): boolean {
    return typeof error === "object" && error !== null && "status" in error && error.status === 404;
  }

  // Recovery is restricted to this preflight: a tool-bearing turn is never replayed.
  public async syncHistory(payload: {
    conversationId: string | null;
    messages: HistoryMessage[];
    onConversationCreated: (id: string) => Promise<void>;
    onMessagesSynced: (ids: string[], at: Date) => Promise<void>;
    shouldContinue: () => Promise<boolean>;
  }): Promise<string> {
    let conversationId = payload.conversationId;
    if (conversationId) {
      try { await this.client.conversations.retrieve(conversationId); }
      catch (error) {
        if (!ResponsesClient.isNotFound(error)) throw error;
        conversationId = null;
      }
    }
    await this.assertContinue(payload.shouldContinue);
    const rebuilding = !conversationId;
    if (!conversationId) {
      conversationId = (await this.client.conversations.create()).id;
      await payload.onConversationCreated(conversationId);
    }
    const pending = payload.messages.filter((message) => rebuilding || !message.openAiSyncedAt);
    // The items endpoint accepts at most 20 items per request.
    for (let offset = 0; offset < pending.length; offset += 20) {
      await this.assertContinue(payload.shouldContinue);
      const batch = pending.slice(offset, offset + 20);
      const accepted = await this.client.conversations.items.create(conversationId, {
        items: batch.map((message) => ({ type: "message", role: message.direction === "IN" ? "user" : "assistant", content: message.text }))
      });
      if (accepted.data.length !== batch.length) throw new Error("OpenAI no confirmó todos los mensajes enviados");
      await payload.onMessagesSynced(batch.map((message) => message.id), new Date());
    }
    return conversationId;
  }

  public async runResponse(payload: {
    conversationId: string;
    prompt: string;
    contextJson: Record<string, unknown>;
    onToolCall: (call: AssistantToolCall) => Promise<Record<string, unknown>>;
    shouldContinue: () => Promise<boolean>;
  }) {
    const toolResults: Array<Record<string, unknown>> = [];
    for (let round = 0; round <= 8; round += 1) {
      await this.assertContinue(payload.shouldContinue);
      const startedAt = Date.now();
      const response = await this.client.responses.create({
        model: Env.openAiModel,
        conversation: payload.conversationId,
        instructions: `${payload.prompt}\n\nCONTEXTO_JSON:\n${JSON.stringify(payload.contextJson)}`,
        input: [],
        tools: contaMagnoAssistantFunctions,
        parallel_tool_calls: false,
        reasoning: { effort: "low" },
        max_output_tokens: 8192,
        text: { format: assistantOutputFormat }
      });
      logger.info({ responseId: response.id, model: response.model, durationMs: Date.now() - startedAt, usage: response.usage, status: response.status }, "OpenAI response");
      if (response.status !== "completed") throw new Error(`Respuesta OpenAI ${response.status}`);
      if (response.output.some((item) => item.type === "message" && item.content.some((part) => part.type === "refusal"))) {
        throw new Error("OpenAI rechazó la solicitud");
      }
      const calls = response.output.filter((item) => item.type === "function_call");
      if (!calls.length) {
        await this.assertContinue(payload.shouldContinue);
        return { output: parseAssistantOutput(response.output_text), responseId: response.id, toolResults, syncedAt: new Date() };
      }
      if (round === 8) {
        // Resolve pending calls so a later turn doesn't inherit unanswered tool calls.
        await this.storeToolOutputs(payload.conversationId, calls.map((call) => ({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ ok: false, error: "Límite de ocho rondas alcanzado" }) })));
        throw new Error("Límite de ocho rondas de funciones alcanzado");
      }
      const outputs: ResponseInputItem[] = [];
      let stopped = false;
      for (const call of calls) {
        stopped = stopped || !await payload.shouldContinue();
        let result: Record<string, unknown>;
        try {
          if (stopped) throw new AssistantTurnStoppedError();
          const args: unknown = JSON.parse(call.arguments);
          if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Argumentos inválidos");
          result = await payload.onToolCall({ name: call.name, arguments: args as Record<string, unknown> });
        } catch (error) {
          if (error instanceof AssistantTurnStoppedError) {
            stopped = true;
            result = { ok: false, error: "Turno detenido por control humano o eliminación del contacto." };
          } else {
            logger.warn({ tool: call.name }, "Error ejecutando función OpenAI");
            // DTO errors are returned by the router; don't expose integration errors or customer data.
            result = { ok: false, error: "Error ejecutando función; revisa los argumentos o solicita atención humana." };
          }
        }
        toolResults.push({ tool: call.name, ok: result.ok });
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
      }
      // Persist tool results before the next generation, including when control changes.
      await this.storeToolOutputs(payload.conversationId, outputs);
      if (stopped) throw new AssistantTurnStoppedError();
    }
    throw new Error("No se obtuvo respuesta final");
  }

  public async deleteConversation(conversationId: string): Promise<void> {
    try {
      // Read the first page again after deleting it; deleted item IDs cannot serve as cursors.
      while (true) {
        const items = await this.client.conversations.items.list(conversationId, { limit: 100 });
        if (!items.data.length) break;
        for (const item of items.data) {
          if (!item.id) throw new Error("Item remoto sin identificador; no se eliminó la conversación");
          try { await this.client.conversations.items.delete(item.id, { conversation_id: conversationId }); }
          catch (error) { if (!ResponsesClient.isNotFound(error)) throw error; }
        }
      }
      await this.client.conversations.delete(conversationId);
    } catch (error) {
      if (!ResponsesClient.isNotFound(error)) throw error;
    }
  }

  private async storeToolOutputs(conversationId: string, items: ResponseInputItem[]): Promise<void> {
    for (let offset = 0; offset < items.length; offset += 20) {
      await this.client.conversations.items.create(conversationId, { items: items.slice(offset, offset + 20) });
    }
  }

  private async assertContinue(shouldContinue: () => Promise<boolean>): Promise<void> {
    if (!await shouldContinue()) throw new AssistantTurnStoppedError();
  }
}
