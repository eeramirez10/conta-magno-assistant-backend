import OpenAI from "openai";
import { ResponsesClient } from "../src/infrastructure/integrations/openai/ResponsesClient.js";
import { ConversationApplicationService } from "../src/application/services/ConversationApplicationService.js";
import { ContactApplicationService } from "../src/application/services/ContactApplicationService.js";
import { InquiryApplicationService } from "../src/application/services/InquiryApplicationService.js";
import { AssistantToolRouterService } from "../src/application/services/AssistantToolRouterService.js";
import { AssistantOrchestratorService } from "../src/application/services/AssistantOrchestratorService.js";
import { ConversationDomainService } from "../src/domain/services/ConversationDomainService.js";
import { ContactDomainService } from "../src/domain/services/ContactDomainService.js";
import { InquiryDomainService } from "../src/domain/services/InquiryDomainService.js";
import { ConversationStage } from "../src/domain/enums/ConversationStage.js";
import { InquiryStatus } from "../src/domain/enums/InquiryStatus.js";
import { Env } from "../src/infrastructure/config/env.js";

export function finalOutput(stage = "QUALIFYING", fields: Record<string, unknown> = {}) {
  return { replyText: "Respuesta de prueba", nextStage: stage, extractedFields: {
    fullName: null, email: null, phoneWhatsApp: null, clientType: null, specialtyProfile: null,
    mainNeed: null, urgency: null, budgetRange: null, recommendedPlan: null, preferredDate: null,
    preferredTime: null, needsHuman: null, ...fields
  } };
}
export function response(output = finalOutput(), calls: Array<{ name: string; arguments: string; call_id: string }> = []) {
  return { id: "resp_test", status: "completed", model: "gpt-6-luna", usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 }, output_text: JSON.stringify(output),
    output: calls.map((call) => ({ type: "function_call", ...call })) };
}
export function fakeOpenAi() {
  const appended: Array<{ id: string; items: any[] }> = [];
  const requests: any[] = [];
  const deleted: string[] = [];
  let count = 0;
  let listedItems = [{ id: "item_one" }, { id: "item_two" }];
  let generation: (payload: any) => Promise<any> = async () => response();
  const sdk = {
    conversations: {
      create: async () => ({ id: `conv_${++count}` }),
      retrieve: async (id: string) => ({ id }),
      delete: async (id: string) => { deleted.push(id); },
      items: {
        create: async (id: string, payload: { items: any[] }) => {
          if (payload.items.length > 20) throw new Error("Items API limit exceeded");
          appended.push({ id, items: payload.items });
          return { data: payload.items.map((item, index) => ({ ...item, id: `item_${index}` })) };
        },
        list: async () => ({ data: [...listedItems] }),
        delete: async (id: string) => { deleted.push(id); listedItems = listedItems.filter((item) => item.id !== id); }
      }
    },
    responses: { create: async (payload: any) => { requests.push(payload); return generation(payload); } }
  };
  const client = new ResponsesClient(sdk as unknown as OpenAI);
  return { client, sdk, appended, requests, deleted, setGeneration: (fn: typeof generation) => { generation = fn; }, get createdCount() { return count; } };
}

let fixtureCount = 0;
export function fixture() {
  const fixtureId = ++fixtureCount;
  Object.defineProperty(Env, "assistantQueueWindowMs", { value: 0, configurable: true });
  const remote = fakeOpenAi();
  const now = new Date();
  const contact: any = { id: "contact_test", waId: "525555555555", phoneE164: "525555555555", fullName: "Nombre Prueba", email: "prueba@example.com", createdAt: now, updatedAt: now };
  const conversation: any = { id: `conversation_test_${fixtureId}`, contactId: contact.id, provider: "META", stage: ConversationStage.GREETING, status: "OPEN", assistantThreadId: "thread_historical", openAiConversationId: null, createdAt: now, updatedAt: now };
  const inquiry: any = { id: "inquiry_test", contactId: contact.id, conversationId: conversation.id, folio: "CM-TEST", status: InquiryStatus.NEW, mainNeed: "Asesoría", recommendedPlan: "Básico" };
  const messages: any[] = [];
  const effects = { createdInquiries: 0, fieldUpdates: 0, ownerTemplates: 0, leads: 0, updatedNotifications: 0, deletedLocally: false };
  const realtime: any = { conversationUpdated() {}, messageCreated() {}, conversationDeleted() {} };
  let contactExists = true;
  const contactRepo: any = {
    findById: async () => contactExists ? contact : null,
    findByWaId: async () => contact,
    upsertByWaId: async (data: any) => { if (data.fullName !== "Prospecto Conta Magno") Object.assign(contact, data); return contact; },
    deleteWithRelations: async () => { effects.deletedLocally = true; contactExists = false; return { contactId: contact.id, conversationIds: [conversation.id] }; }
  };
  const conversationRepo: any = {
    findById: async () => contactExists ? { ...conversation } : null,
    getActiveByContactId: async () => ({ ...conversation }),
    listByContactId: async () => [{ ...conversation }],
    updateStage: async (_id: string, stage: string) => { conversation.stage = stage; return { ...conversation }; },
    updateStageUnlessHumanControls: async (_id: string, stage: string) => { if (conversation.stage !== ConversationStage.PENDING_HUMAN) conversation.stage = stage; return { ...conversation }; },
    setOpenAiConversationId: async (_id: string, id: string) => { conversation.openAiConversationId = id; for (const message of messages) message.openAiSyncedAt = null; return { ...conversation }; }
  };
  const messageRepo: any = {
    create: async (data: any) => { const message = { id: `message_${messages.length}`, createdAt: new Date(), ...data, openAiSyncedAt: data.openAiSyncedAt ?? null }; messages.push(message); return message; },
    findByProviderMessageId: async (id: string) => messages.find((message) => message.providerMessageId === id) ?? null,
    listByConversationId: async () => messages.map((message) => ({ ...message })),
    markOpenAiSynced: async (ids: string[], at: Date) => { for (const message of messages) if (ids.includes(message.id)) message.openAiSyncedAt = at; },
    resetOpenAiSync: async () => { for (const message of messages) message.openAiSyncedAt = null; }
  };
  const inquiryRepo: any = {
    getLatestByConversationId: async () => ({ ...inquiry }),
    getOpenByContactId: async () => { effects.createdInquiries++; return inquiry.status !== InquiryStatus.CLOSED ? { ...inquiry } : null; },
    findById: async () => ({ ...inquiry }),
    updateFields: async (_id: string, fields: any) => { effects.fieldUpdates++; for (const [key, value] of Object.entries(fields)) if (value !== undefined) inquiry[key] = value; return { ...inquiry }; },
    updateStatus: async (_id: string, status: string) => { inquiry.status = status; return { ...inquiry }; }
  };
  const metaClient: any = { sendText: async () => ({ id: `human_${messages.length}` }) };
  const contactService = new ContactApplicationService(contactRepo, new ContactDomainService(), realtime, conversationRepo, remote.client);
  const conversationService = new ConversationApplicationService(conversationRepo, messageRepo, contactRepo, metaClient, new ConversationDomainService(), realtime, inquiryRepo);
  const inquiryService = new InquiryApplicationService(inquiryRepo, {} as any, {} as any, new InquiryDomainService());
  const notifications: any = {
    notifyLeadCreated: async () => { effects.leads++; },
    notifyLeadUpdated: async () => { effects.updatedNotifications++; },
    notifyOwnerLeadTemplate: async () => { effects.ownerTemplates++; }
  };
  const router = new AssistantToolRouterService(contactService, conversationService, inquiryService, notifications);
  const incomingAlerts: Array<{ messageId: string; senderWaId: string; senderName: string }> = [];
  const incomingNotifications = { notifyMessage: async (payload: typeof incomingAlerts[number]) => { incomingAlerts.push(payload); } };
  const orchestrator = new AssistantOrchestratorService(remote.client, contactService, conversationService, inquiryService, notifications, router, incomingNotifications);
  const sent: string[] = [];
  const provider: any = { sendTextMessage: async (_wa: string, text: string) => { sent.push(text); return { providerMessageId: `sent_${sent.length}` }; } };
  const incoming = (id: string, text = id): any => ({ waId: contact.waId, text, provider: "META", providerMessageId: id, rawPayload: {}, messageType: "text" });
  return { remote, contact, conversation, inquiry, messages, effects, contactService, conversationService, router, orchestrator, provider, incoming, sent, incomingAlerts, incomingNotifications };
}

export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
