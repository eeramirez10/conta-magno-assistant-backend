import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { IncomingNotificationApplicationService } from "../src/application/services/IncomingNotificationApplicationService.js";
import { IncomingNotificationSettingsRequestDTO } from "../src/application/dtos/request/notifications/IncomingNotificationSettingsRequestDTO.js";
import { defaultIncomingNotificationSettings, IIncomingNotificationRepository, IncomingNotificationSettings } from "../src/domain/repositories/IIncomingNotificationRepository.js";
import { SettingsAdminController } from "../src/presentation/http/controllers/SettingsAdminController.js";
import { buildAdminRouter } from "../src/presentation/http/routes/admin.routes.js";
import { fixture, deferred } from "./helpers.js";
import { ConversationStage } from "../src/domain/enums/ConversationStage.js";
import { MetaWhatsAppClient, MetaWhatsAppTemplateError } from "../src/infrastructure/integrations/whatsapp/meta/MetaWhatsAppClient.js";

function notificationsFixture() {
  let settings: IncomingNotificationSettings = { ...defaultIncomingNotificationSettings, recipients: [] };
  const deliveries = new Map<string, { id: string; status: string; providerId?: string }>();
  const sent: any[] = [];
  let configured = true;
  let cycle = 0;
  let claimedCycle = -1;
  const messageCycles = new Map<string, number>();
  let template = { name: "nombre_aviso_mensaje_recibido", languageCode: "es_MX" };
  let send: (payload: any) => Promise<{ id: string | null }> = async () => ({ id: "wamid_test" });
  const repository: IIncomingNotificationRepository = {
    getSettings: async () => settings,
    saveSettings: async (next) => { settings = next; return settings; },
    claimCycleForMessage: async (messageId) => {
      const messageCycle = messageCycles.get(messageId) ?? cycle;
      messageCycles.set(messageId, messageCycle);
      if (messageCycle !== cycle || claimedCycle === cycle) return false;
      claimedCycle = cycle;
      return true;
    },
    claimDelivery: async (messageId, recipient) => {
      const key = `${messageId}:${recipient}`;
      if (deliveries.has(key)) return null;
      deliveries.set(key, { id: key, status: "PENDING" });
      return key;
    },
    markSent: async (id, providerId) => { Object.assign(deliveries.get(id)!, { status: "SENT", providerId }); },
    markFailed: async (id) => { deliveries.get(id)!.status = "FAILED"; }
  };
  const metaClient = { sendTemplate: async (payload: any) => { sent.push(payload); return send(payload); } };
  const service = new IncomingNotificationApplicationService(repository, metaClient, () => configured, () => template);
  const activate = () => service.saveSettings({ recipients: ["525511111111", "525522222222"] });
  return { service, repository, activate, deliveries, sent, metaClient,
    resetCycle: () => { cycle++; }, recordMessage: (id: string) => { messageCycles.set(id, cycle); },
    setTemplate: (value: typeof template) => { template = value; },
    setSend: (fn: typeof send) => { send = fn; }, setConfigured: (value: boolean) => { configured = value; } };
}

const message = { messageId: "message_test", senderWaId: "525533333333", senderName: "María Pérez" };

test("incoming notifications are disabled by default and retain a saved configuration", async () => {
  const f = notificationsFixture();
  assert.deepEqual(await f.service.getSettings(), { recipients: [] });
  await f.service.notifyMessage(message);
  assert.equal(f.sent.length, 0);
  await f.activate();
  assert.deepEqual((await f.service.getSettings()).recipients, ["525511111111", "525522222222"]);
});

test("concurrent delivery attempts notify each recipient only once and use the two template parameters", async () => {
  const f = notificationsFixture(); await f.activate();
  await Promise.all([f.service.notifyMessage(message), f.service.notifyMessage(message)]);
  assert.equal(f.sent.length, 2);
  assert.deepEqual(f.sent.map((item) => item.toWaId), ["525511111111", "525522222222"]);
  assert.deepEqual(f.sent[0].bodyParameters, ["María Pérez", "+525533333333"]);
  assert.equal(f.sent[0].templateName, "nombre_aviso_mensaje_recibido");
  assert.ok([...f.deliveries.values()].every((delivery) => delivery.status === "SENT"));
});

test("provider failures do not reject the notification or stop other recipients and are not replayed", async () => {
  const f = notificationsFixture(); await f.activate();
  f.setSend(async (payload) => { if (payload.toWaId === "525511111111") throw new Error("simulated failure"); return { id: "wamid_ok" }; });
  await f.service.notifyMessage(message);
  assert.deepEqual([...f.deliveries.values()].map((delivery) => delivery.status), ["FAILED", "SENT"]);
  await f.service.notifyMessage(message); assert.equal(f.sent.length, 2);
});

test("missing provider IDs count as failures and missing credentials never cause a send", async () => {
  const f = notificationsFixture(); await f.activate(); f.setSend(async () => ({ id: null }));
  await f.service.notifyMessage(message);
  assert.ok([...f.deliveries.values()].every((delivery) => delivery.status === "FAILED"));
  f.setConfigured(false); await f.service.notifyMessage({ ...message, messageId: "second" });
  assert.equal(f.sent.length, 2);
});

test("recipient matching the sender is excluded, including legacy Mexico numbers", async () => {
  const f = notificationsFixture(); await f.activate();
  await f.service.notifyMessage({ ...message, senderWaId: "5215511111111" });
  assert.deepEqual(f.sent.map((item) => item.toWaId), ["525522222222"]);
});

test("saved numbers can be tested without consuming the notification cycle or creating delivery records", async () => {
  const f = notificationsFixture(); await f.activate();
  f.setSend(async (payload) => { if (payload.toWaId === "525511111111") throw new Error("template missing"); return { id: "wamid_test" }; });
  const results = await f.service.testSavedSettings();
  assert.deepEqual(results.map((result) => result.accepted), [false, true]);
  assert.equal(f.deliveries.size, 0);
  assert.deepEqual(f.sent[0].bodyParameters, ["Contacto de prueba", "+525555555555"]);
  assert.equal(f.sent[0].templateName, "nombre_aviso_mensaje_recibido");
  await f.service.notifyMessage(message); assert.equal(f.sent.length, 4);
});

test("repository errors are contained so the assistant can continue", async () => {
  const f = notificationsFixture();
  f.repository.getSettings = async () => { throw new Error("database unavailable"); };
  await f.service.notifyMessage(message); assert.equal(f.sent.length, 0);
});

test("an accepted alert is not resent if its database status update fails", async () => {
  const f = notificationsFixture(); await f.activate();
  f.repository.markSent = async () => { throw new Error("status write failed"); };
  await f.service.notifyMessage(message); await f.service.notifyMessage(message);
  assert.equal(f.sent.length, 2);
  assert.ok([...f.deliveries.values()].every((delivery) => delivery.status === "PENDING"));
});

test("Meta requests use positional body parameters and a timeout, and expose rejection codes without a successful send", async () => {
  const originalFetch = globalThis.fetch;
  const bodies: any[] = [];
  globalThis.fetch = async (_url, options) => {
    assert.ok(options?.signal instanceof AbortSignal);
    bodies.push(JSON.parse(options?.body as string));
    if (bodies.length === 1) return new Response(JSON.stringify({ messages: [{ id: "wamid_mock" }] }), { status: 200 });
    return new Response(JSON.stringify({ error: { code: 132001, message: "Template missing" } }), { status: 400 });
  };
  try {
    const client = new MetaWhatsAppClient();
    const payload = { toWaId: "525511111111", templateName: "nombre_aviso_mensaje_recibido", languageCode: "es_MX", bodyParameters: ["María Pérez", "+525533333333"] };
    assert.equal((await client.sendTemplate(payload)).id, "wamid_mock");
    assert.deepEqual(bodies[0].template.components, [{ type: "body", parameters: [{ type: "text", text: "María Pérez" }, { type: "text", text: "+525533333333" }] }]);
    await assert.rejects(client.sendTemplate(payload), (error: unknown) => error instanceof MetaWhatsAppTemplateError && error.code === 132001 && error.status === 400);
  } finally { globalThis.fetch = originalFetch; }
});

test("settings reject malformed numbers, missing recipients and excessive recipients; equivalent numbers are deduplicated", () => {
  const valid = { recipients: ["+52 (55) 1111-1111", "525511111111", "00525511111111"] };
  const [error, settings] = IncomingNotificationSettingsRequestDTO.validate(valid);
  assert.equal(error, undefined); assert.deepEqual(settings?.recipients, ["525511111111"]);
  for (const patch of [
    { recipients: undefined }, { recipients: "525511111111" }, { recipients: ["email@example.com"] },
    { recipients: ["555"] }, { recipients: Array(11).fill("525511111111") }
  ]) assert.ok(IncomingNotificationSettingsRequestDTO.validate({ ...valid, ...patch })[0]);
  assert.deepEqual(IncomingNotificationSettingsRequestDTO.validate({ recipients: [] })[1], { recipients: [] });
  // Old clients cannot override the server's approved template or activation policy.
  assert.deepEqual(IncomingNotificationSettingsRequestDTO.validate({ ...valid, enabled: false, templateMode: "OWNER_LEAD", templateName: "legacy", languageCode: "en" })[1], { recipients: ["525511111111"] });
});

test("administrative settings and real test sends require authentication and validation", async () => {
  const f = notificationsFixture(); const app = express(); app.use(express.json());
  app.use(buildAdminRouter({} as any, {} as any, {} as any, {} as any,
    { getAuthenticatedUser: async (token: string) => token === "test_token" ? { id: "admin" } : null } as any,
    new SettingsAdminController(f.service)));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address === "object");
  const endpoint = `http://127.0.0.1:${address.port}/api/settings/incoming-notifications`;
  const headers = { Authorization: "Bearer test_token", "Content-Type": "application/json" };
  try {
    for (const method of ["GET", "PATCH", "POST"]) {
      const response = await fetch(method === "POST" ? `${endpoint}/test` : endpoint, { method });
      assert.equal(response.status, 401);
    }
    const get = await fetch(endpoint, { headers }); const initial = await get.json() as any;
    assert.deepEqual(initial, { data: { recipients: [] }, metaConfigured: true });
    const invalid = await fetch(endpoint, { method: "PATCH", headers, body: JSON.stringify({ recipients: "not-a-list" }) });
    assert.equal(invalid.status, 400);
    const saved = await fetch(endpoint, { method: "PATCH", headers, body: JSON.stringify({ ...defaultIncomingNotificationSettings, recipients: ["+525511111111"] }) });
    assert.equal(saved.status, 200); assert.deepEqual((await saved.json() as any).data.recipients, ["525511111111"]);
    const tested = await fetch(`${endpoint}/test`, { method: "POST", headers });
    assert.equal(tested.status, 200); assert.equal((await tested.json() as any).results[0].accepted, true);
    f.setConfigured(false);
    assert.equal((await fetch(endpoint, { method: "PATCH", headers, body: JSON.stringify({ recipients: ["+525522222222"] }) })).status, 200);
    assert.equal((await fetch(`${endpoint}/test`, { method: "POST", headers })).status, 400);
    const cleared = await fetch(endpoint, { method: "PATCH", headers, body: JSON.stringify({ recipients: [] }) });
    assert.equal(cleared.status, 200); assert.deepEqual((await cleared.json() as any).data, { recipients: [] });
    f.setConfigured(true);
    assert.equal((await fetch(`${endpoint}/test`, { method: "POST", headers })).status, 400);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});

test("the orchestrator submits new inbound messages during AI and human control, excluding duplicate webhooks", async () => {
  const f = fixture(); await f.orchestrator.processIncoming(f.provider, f.incoming("first"));
  await f.orchestrator.processIncoming(f.provider, f.incoming("first"));
  await f.conversationService.takeHumanControl(f.conversation.id);
  await f.orchestrator.processIncoming(f.provider, f.incoming("human"));
  await f.orchestrator.processIncoming(f.provider, f.incoming("human"));
  assert.equal(f.incomingAlerts.length, 2); assert.equal(f.sent.length, 1);
  assert.deepEqual(f.incomingAlerts.map((alert) => alert.messageId), f.messages.filter((entry) => entry.direction === "IN").map((entry) => entry.id));
});

test("a queued message is submitted for alerting while the previous AI response is still being generated", async () => {
  const f = fixture(); const entered = deferred(); const release = deferred();
  const originalGeneration = f.remote.sdk.responses.create;
  let generationCount = 0;
  f.remote.sdk.responses.create = async (payload) => {
    if (++generationCount === 1) { entered.resolve(); await release.promise; }
    return originalGeneration(payload);
  };
  const first = f.orchestrator.processIncoming(f.provider, f.incoming("first")); await entered.promise;
  assert.equal((await f.orchestrator.processIncoming(f.provider, f.incoming("second"))).folio, "QUEUED");
  assert.equal(f.incomingAlerts.length, 2); assert.equal(f.sent.length, 0);
  release.resolve(); await first;
  assert.equal(f.sent.length, 2);
});

test("distinct inbound messages produce only one alert per contact cycle, including after service restart", async () => {
  const f = notificationsFixture(); await f.activate();
  await Promise.all([f.service.notifyMessage(message), f.service.notifyMessage({ ...message, messageId: "second" })]);
  const restarted = new IncomingNotificationApplicationService(f.repository, f.metaClient, () => true);
  await restarted.notifyMessage({ ...message, messageId: "third" });
  assert.equal(f.sent.length, 2);
  f.resetCycle();
  await restarted.notifyMessage({ ...message, messageId: "after_qualification" });
  await restarted.notifyMessage({ ...message, messageId: "another_followup" });
  assert.equal(f.sent.length, 4);
});

test("delayed messages from before qualification cannot consume the next cycle", async () => {
  const f = notificationsFixture(); await f.activate(); f.recordMessage(message.messageId); f.resetCycle();
  await f.service.notifyMessage(message); assert.equal(f.sent.length, 0);
  await f.service.notifyMessage({ ...message, messageId: "after_qualification" }); assert.equal(f.sent.length, 2);
});

test("disabling and reenabling alerts does not reset the contact cycle", async () => {
  const f = notificationsFixture(); await f.activate(); await f.service.notifyMessage(message);
  await f.service.saveSettings({ recipients: [] });
  await f.service.notifyMessage({ ...message, messageId: "while_disabled" });
  await f.activate();
  await f.service.notifyMessage({ ...message, messageId: "after_reenabling" });
  assert.equal(f.sent.length, 2);
});

test("legacy prospect-template settings are ignored and notifications always use the approved incoming-message template", async () => {
  const f = notificationsFixture(); await f.activate();
  const recipients = (await f.service.getSettings()).recipients;
  f.repository.getSettings = async () => ({ recipients, enabled: false, templateMode: "OWNER_LEAD", templateName: "legacy_template", languageCode: "en" } as any);
  await f.service.notifyMessage(message);
  assert.equal(f.sent[0].templateName, "nombre_aviso_mensaje_recibido"); assert.equal(f.sent[0].languageCode, "es_MX");
  assert.deepEqual(f.sent[0].bodyParameters, ["María Pérez", "+525533333333"]);
});

test("invalid template environment configuration does not consume a cycle and its configured language is used for tests and alerts", async () => {
  const f = notificationsFixture(); await f.activate();
  f.setTemplate({ name: "invalid template", languageCode: "Español" });
  assert.equal(f.service.canSend(), false);
  await f.service.notifyMessage(message); assert.equal(f.sent.length, 0);
  await assert.rejects(f.service.testSavedSettings());
  f.setTemplate({ name: "nombre_aviso_mensaje_recibido", languageCode: "es" });
  await f.service.testSavedSettings(); await f.service.notifyMessage(message);
  assert.equal(f.sent.length, 4);
  assert.ok(f.sent.every((payload) => payload.languageCode === "es" && payload.bodyParameters.length === 2));
});

test("a duplicate insert race never starts a second alert or assistant turn", async () => {
  const f = fixture(); const add = f.conversationService.addInboundMessage.bind(f.conversationService);
  f.conversationService.addInboundMessage = async (payload) => {
    await add(payload); throw { code: "P2002" };
  };
  const result = await f.orchestrator.processIncoming(f.provider, f.incoming("raced_duplicate"));
  assert.equal(result.folio, "DUPLICATE"); assert.equal(f.incomingAlerts.length, 0); assert.equal(f.sent.length, 0);
});

test("media under AI and human control is stored and alerts once without invoking the model", async () => {
  const f = fixture(); const audio = { ...f.incoming("audio"), messageType: "audio", text: "" };
  assert.equal((await f.orchestrator.processIncoming(f.provider, audio)).folio, "UNSUPPORTED_MEDIA");
  await f.orchestrator.processIncoming(f.provider, audio);
  f.conversation.stage = ConversationStage.PENDING_HUMAN;
  await f.orchestrator.processIncoming(f.provider, { ...audio, providerMessageId: "audio_human" });
  assert.equal(f.incomingAlerts.length, 2); assert.equal(f.remote.requests.length, 0); assert.equal(f.sent.length, 1);
  assert.ok(f.messages.filter((entry) => entry.direction === "IN").every((entry) => entry.text === "[audio message]"));
});

test("a slow alert does not delay the AI reply and contact deletion waits for the pending alert", async () => {
  const f = fixture(); const entered = deferred(); const release = deferred();
  f.incomingNotifications.notifyMessage = async () => { entered.resolve(); await release.promise; };
  const replied = deferred();
  const originalSend = f.provider.sendTextMessage;
  f.provider.sendTextMessage = async (...args: any[]) => { const result = await originalSend(...args); replied.resolve(); return result; };
  const processing = f.orchestrator.processIncoming(f.provider, f.incoming("first"));
  await entered.promise; await replied.promise;
  assert.equal(f.sent.length, 1);
  const deleting = f.contactService.deletePermanently(f.contact.id);
  assert.equal(f.effects.deletedLocally, false);
  release.resolve(); await processing; await deleting;
  assert.equal(f.effects.deletedLocally, true);
});

test("a failed alert provider does not prevent an assistant reply", async () => {
  const f = fixture(); const notifications = notificationsFixture(); await notifications.activate();
  notifications.setSend(async () => { throw new Error("WhatsApp notification unavailable"); });
  f.incomingNotifications.notifyMessage = (payload) => notifications.service.notifyMessage(payload);
  await f.orchestrator.processIncoming(f.provider, f.incoming("first"));
  assert.equal(f.sent.length, 1); assert.equal(notifications.sent.length, 2);
});
