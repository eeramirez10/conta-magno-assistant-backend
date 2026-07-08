import OpenAI from "openai";
import { Env } from "../../config/env.js";
import { logger } from "../../logging/logger.js";

export type AssistantToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

export type AssistantStructuredOutput = {
  replyText: string;
  nextStage: "GREETING" | "QUALIFYING" | "INFORMATION" | "PLAN_RECOMMENDATION" | "SCHEDULING" | "PENDING_HUMAN" | "COMPLETED";
  extractedFields: {
    fullName?: string;
    email?: string;
    phoneWhatsApp?: string;
    clientType?: string;
    specialtyProfile?: string;
    mainNeed?: string;
    urgency?: string;
    budgetRange?: string;
    recommendedPlan?: string;
    preferredDate?: string;
    preferredTime?: string;
    needsHuman?: boolean;
  };
  toolCalls?: AssistantToolCall[];
};

export class AssistantClient {
  private readonly client = new OpenAI({ apiKey: Env.openAiApiKey });
  private readonly runConflictBackoffMs = [3000, 6000, 9000];

  public async runAssistant(payload: {
    assistantId: string;
    threadId?: string | null;
    prompt: string;
    contextJson: Record<string, unknown>;
    onToolCall?: (toolCall: AssistantToolCall) => Promise<Record<string, unknown>>;
  }): Promise<{ output: AssistantStructuredOutput; threadId: string; toolResults: Array<Record<string, unknown>> }> {
    const threadId = payload.threadId ?? (await this.client.beta.threads.create()).id;
    const toolResults: Array<Record<string, unknown>> = [];

    await this.createUserMessageWithRetry(
      threadId,
      `${payload.prompt}\n\nCONTEXTO_JSON:\n${JSON.stringify(payload.contextJson)}`
    );

    const initialRun = await this.createRunWithRetry(threadId, payload.assistantId);
    const run = await this.pollRunUntilTerminal(threadId, initialRun.id, payload.onToolCall, toolResults);

    if (run.status !== "completed") {
      throw new Error(`Assistant run status: ${run.status}`);
    }

    const messages = await this.client.beta.threads.messages.list(threadId, { order: "desc", limit: 5 });
    const rawText = this.extractLastText(messages.data);

    try {
      const parsed = JSON.parse(rawText) as AssistantStructuredOutput;
      if (!parsed.replyText || !parsed.nextStage || !parsed.extractedFields) {
        throw new Error("JSON incompleto del asistente");
      }
      if (!Array.isArray(parsed.toolCalls)) {
        parsed.toolCalls = [];
      }
      return { output: parsed, threadId, toolResults };
    } catch (error) {
      logger.error({ error, rawText }, "No se pudo parsear JSON del asistente");
      throw new Error("Respuesta inválida del asistente");
    }
  }

  private async pollRunUntilTerminal(
    threadId: string,
    runId: string,
    onToolCall: ((toolCall: AssistantToolCall) => Promise<Record<string, unknown>>) | undefined,
    toolResults: Array<Record<string, unknown>>
  ): Promise<OpenAI.Beta.Threads.Runs.Run> {
    let run = await this.client.beta.threads.runs.retrieve(threadId, runId);

    while (true) {
      if (run.status === "completed") {
        return run;
      }

      if (run.status === "requires_action") {
        run = await this.handleRequiredAction(threadId, run, onToolCall, toolResults);
        continue;
      }

      if (["failed", "cancelled", "expired", "incomplete"].includes(run.status)) {
        return run;
      }

      await this.sleep(900);
      run = await this.client.beta.threads.runs.retrieve(threadId, runId);
    }
  }

  private async handleRequiredAction(
    threadId: string,
    run: OpenAI.Beta.Threads.Runs.Run,
    onToolCall: ((toolCall: AssistantToolCall) => Promise<Record<string, unknown>>) | undefined,
    toolResults: Array<Record<string, unknown>>
  ): Promise<OpenAI.Beta.Threads.Runs.Run> {
    const toolCalls = (run as unknown as { required_action?: { submit_tool_outputs?: { tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }> } } })
      .required_action?.submit_tool_outputs?.tool_calls ?? [];

    const toolOutputs: Array<{ tool_call_id: string; output: string }> = [];

    for (const toolCall of toolCalls) {
      const name = toolCall.function?.name ?? "";
      const argsText = toolCall.function?.arguments ?? "{}";
      const args = this.safeParseObject(argsText);

      let result: Record<string, unknown>;
      try {
        if (!onToolCall) {
          result = { ok: false, error: "No hay handler de tools en backend." };
        } else {
          result = await onToolCall({ name, arguments: args });
        }
      } catch (error) {
        logger.error({ error, name, args }, "Error ejecutando tool call");
        result = { ok: false, error: "Error ejecutando tool call" };
      }

      toolResults.push({ tool: name, args, result });

      toolOutputs.push({
        tool_call_id: toolCall.id,
        output: JSON.stringify(result)
      });
    }

    if (toolOutputs.length === 0) {
      throw new Error("Run en requires_action sin tool calls");
    }

    return this.client.beta.threads.runs.submitToolOutputsAndPoll(threadId, run.id, {
      tool_outputs: toolOutputs
    });
  }

  private safeParseObject(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private extractLastText(items: OpenAI.Beta.Threads.Messages.Message[]): string {
    for (const item of items) {
      if (item.role !== "assistant") {
        continue;
      }

      const part = item.content.find((content) => content.type === "text");
      if (part && part.type === "text") {
        return part.text.value;
      }
    }

    throw new Error("No se encontró respuesta de texto del asistente");
  }

  private async createUserMessageWithRetry(threadId: string, content: string): Promise<void> {
    for (let attempt = 0; attempt <= this.runConflictBackoffMs.length; attempt += 1) {
      try {
        await this.client.beta.threads.messages.create(threadId, {
          role: "user",
          content
        });
        return;
      } catch (error) {
        const isConflict = this.isActiveRunConflict(error);
        if (!isConflict || attempt === this.runConflictBackoffMs.length) {
          throw error;
        }

        const delayMs = this.runConflictBackoffMs[attempt];
        logger.warn(
          {
            threadId,
            delayMs,
            attempt: attempt + 1
          },
          "Thread ocupado por run activo al crear mensaje. Reintentando..."
        );
        await this.sleep(delayMs);
      }
    }
  }

  private async createRunWithRetry(threadId: string, assistantId: string): Promise<OpenAI.Beta.Threads.Runs.Run> {
    for (let attempt = 0; attempt <= this.runConflictBackoffMs.length; attempt += 1) {
      try {
        return await this.client.beta.threads.runs.create(threadId, {
          assistant_id: assistantId,
          response_format: { type: "json_object" }
        });
      } catch (error) {
        const isConflict = this.isActiveRunConflict(error);
        if (!isConflict || attempt === this.runConflictBackoffMs.length) {
          throw error;
        }

        const delayMs = this.runConflictBackoffMs[attempt];
        logger.warn(
          {
            threadId,
            delayMs,
            attempt: attempt + 1
          },
          "Thread ocupado por run activo al iniciar run. Reintentando..."
        );
        await this.sleep(delayMs);
      }
    }

    throw new Error("No se pudo iniciar run del assistant");
  }

  private isActiveRunConflict(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
    const status = "status" in error ? Number((error as { status?: unknown }).status ?? 0) : 0;

    return status === 400 && message.includes("while a run") && message.includes("is active");
  }
}
