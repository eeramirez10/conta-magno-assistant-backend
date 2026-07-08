import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import OpenAI from "openai";
import { contaMagnoAssistantPrompt } from "../application/prompts/contaMagnoAssistantPrompt.js";
import { Env } from "../infrastructure/config/env.js";
import { contaMagnoAssistantFunctions } from "../infrastructure/integrations/openai/assistantTools.js";

const ENV_FILE = ".env";

async function main(): Promise<void> {
  if (!Env.openAiApiKey) {
    throw new Error("Falta OPENAI_API_KEY en .env");
  }

  const client = new OpenAI({ apiKey: Env.openAiApiKey });

  const payload = {
    name: Env.openAiAssistantName,
    model: Env.openAiAssistantModel,
    instructions: contaMagnoAssistantPrompt,
    tools: contaMagnoAssistantFunctions as Array<Record<string, unknown>>
  };

  let assistantId = Env.openAiAssistantId;

  if (assistantId) {
    try {
      await client.beta.assistants.retrieve(assistantId);
      await client.beta.assistants.update(assistantId, payload as any);
      console.log(`Assistant actualizado: ${assistantId}`);
    } catch {
      const created = await client.beta.assistants.create(payload as any);
      assistantId = created.id;
      console.log(`Assistant anterior inválido, se creó uno nuevo: ${assistantId}`);
    }
  } else {
    const created = await client.beta.assistants.create(payload as any);
    assistantId = created.id;
    console.log(`Assistant creado: ${assistantId}`);
  }

  await upsertEnvValue(ENV_FILE, "OPENAI_ASSISTANT_ID", assistantId);
  console.log(`OPENAI_ASSISTANT_ID guardado en ${ENV_FILE}`);
}

async function upsertEnvValue(path: string, key: string, value: string): Promise<void> {
  let content = "";

  if (existsSync(path)) {
    content = await readFile(path, "utf-8");
  }

  const pattern = new RegExp(`^${escapeRegex(key)}=.*$`, "m");
  const line = `${key}="${value}"`;

  if (pattern.test(content)) {
    content = content.replace(pattern, line);
  } else {
    const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
    content = `${content}${separator}${line}\n`;
  }

  await writeFile(path, content, "utf-8");
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
