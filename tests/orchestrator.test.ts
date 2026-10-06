import assert from "node:assert/strict";
import test from "node:test";
import { fixture, response, finalOutput, deferred } from "./helpers.js";
import { ConversationStage } from "../src/domain/enums/ConversationStage.js";
import { InquiryStatus } from "../src/domain/enums/InquiryStatus.js";

test("two turns preserve memory without duplicating automatically stored replies", async () => {
  const f = fixture(); await f.orchestrator.processIncoming(f.provider, f.incoming("first"));
  await f.orchestrator.processIncoming(f.provider, f.incoming("second"));
  assert.equal(f.remote.createdCount, 1);
  assert.deepEqual(f.remote.appended.flatMap((batch) => batch.items.map((item) => item.content)), ["first", "second"]);
  assert.ok(f.messages.every((message) => message.openAiSyncedAt));
  assert.equal(f.messages[1].rawPayload.openAiResponseId, "resp_test");
  const duplicate = await f.orchestrator.processIncoming(f.provider, f.incoming("second"));
  assert.equal(duplicate.replyText, "duplicate_ignored"); assert.equal(f.sent.length, 2);
});

test("messages arriving during generation belong to the next batch", async () => {
  const f = fixture(); const entered = deferred(); const release = deferred(); let n = 0;
  f.remote.setGeneration(async () => { if (++n === 1) { entered.resolve(); await release.promise; } return response(); });
  const first = f.orchestrator.processIncoming(f.provider, f.incoming("first")); await entered.promise;
  assert.equal((await f.orchestrator.processIncoming(f.provider, f.incoming("second"))).replyText, "queued_while_busy");
  assert.equal(f.messages.find((message) => message.text === "second").openAiSyncedAt, null);
  release.resolve(); await first;
  assert.deepEqual(f.remote.appended.map((batch) => batch.items.map((item) => item.content)), [["first"], ["second"]]);
  assert.equal(f.sent.length, 2);
});

test("batch cutoff excludes messages saved before the history snapshot but after the batch", async () => {
  const f = fixture(); const original = f.conversationService.listMessages.bind(f.conversationService); let injected = false;
  f.conversationService.listMessages = async (id) => {
    if (!injected) { injected = true; await f.orchestrator.processIncoming(f.provider, f.incoming("later")); }
    return original(id);
  };
  await f.orchestrator.processIncoming(f.provider, f.incoming("first"));
  assert.deepEqual(f.remote.appended.map((batch) => batch.items.map((item) => item.content)), [["first"], ["later"]]);
});

test("messages sent and received under human control are synchronized after release", async () => {
  const f = fixture(); await f.orchestrator.processIncoming(f.provider, f.incoming("first"));
  await f.conversationService.takeHumanControl(f.conversation.id);
  const result = await f.orchestrator.processIncoming(f.provider, f.incoming("during_human"));
  assert.equal(result.replyText, "human_control_active");
  await f.conversationService.sendHumanMessage({ conversationId: f.conversation.id, text: "Operador responde" });
  await f.conversationService.releaseHumanControl(f.conversation.id);
  await f.orchestrator.processIncoming(f.provider, f.incoming("after_release"));
  assert.deepEqual(f.remote.appended[1].items.map((item) => [item.role, item.content]), [["user", "during_human"], ["assistant", "Operador responde"], ["user", "after_release"]]);
});

test("completed inquiry answers subsequent questions without another lead or template, including control release", async () => {
  const f = fixture(); f.remote.setGeneration(async () => response(finalOutput("COMPLETED")));
  await f.orchestrator.processIncoming(f.provider, f.incoming("complete"));
  assert.equal(f.effects.ownerTemplates, 1); assert.equal(f.inquiry.status, InquiryStatus.CLOSED);
  const fieldUpdates = f.effects.fieldUpdates;
  await f.orchestrator.processIncoming(f.provider, f.incoming("followup"));
  await f.conversationService.takeHumanControl(f.conversation.id);
  await f.conversationService.releaseHumanControl(f.conversation.id);
  assert.equal(f.conversation.stage, ConversationStage.COMPLETED);
  await f.orchestrator.processIncoming(f.provider, f.incoming("another_question"));
  assert.equal(f.effects.createdInquiries, 1); assert.equal(f.effects.ownerTemplates, 1);
  assert.equal(f.effects.fieldUpdates, fieldUpdates); assert.equal(f.sent.length, 3);
  assert.equal(f.remote.requests[2].instructions.includes('"flowCompleted":true'), true);
});

test("closed inquiry is reused even if stored stage is QUALIFYING", async () => {
  const f = fixture(); f.inquiry.status = InquiryStatus.CLOSED; f.conversation.stage = ConversationStage.QUALIFYING;
  await f.orchestrator.processIncoming(f.provider, f.incoming("question"));
  assert.equal(f.effects.createdInquiries, 0); assert.equal(f.effects.fieldUpdates, 0); assert.equal(f.effects.ownerTemplates, 0);
  assert.equal(f.conversation.stage, ConversationStage.COMPLETED); assert.equal(f.sent.length, 1);
});

test("operator takeover during generation stops tools, data updates and WhatsApp", async () => {
  const f = fixture(); f.remote.setGeneration(async () => {
    await f.conversationService.takeHumanControl(f.conversation.id);
    return response(finalOutput("COMPLETED", { fullName: "Must not save" }), [{ name: "updateInquiryFields", arguments: JSON.stringify({ mainNeed: "Must not save" }), call_id: "write" }]);
  });
  const result = await f.orchestrator.processIncoming(f.provider, f.incoming("first"));
  assert.equal(result.replyText, "human_control_active"); assert.equal(f.sent.length, 0);
  assert.equal(f.effects.fieldUpdates, 0); assert.equal(f.effects.ownerTemplates, 0);
  assert.equal(f.contact.fullName, "Nombre Prueba");
});

test("takeover and release during one generation still cancels the old turn", async () => {
  const f = fixture(); f.remote.setGeneration(async () => {
    await f.conversationService.takeHumanControl(f.conversation.id); await f.conversationService.releaseHumanControl(f.conversation.id); return response();
  });
  assert.equal((await f.orchestrator.processIncoming(f.provider, f.incoming("first"))).replyText, "human_control_active");
  assert.equal(f.sent.length, 0);
});

test("control checked before processing queued batch", async () => {
  const f = fixture(); const original = f.conversationService.addInboundMessage.bind(f.conversationService);
  f.conversationService.addInboundMessage = async (payload) => { const message = await original(payload); await f.conversationService.takeHumanControl(f.conversation.id); return message; };
  assert.equal((await f.orchestrator.processIncoming(f.provider, f.incoming("first"))).replyText, "human_control_active");
  assert.equal(f.remote.requests.length, 0); assert.equal(f.effects.createdInquiries, 0); assert.equal(f.sent.length, 0);
});

test("incomplete response never reaches WhatsApp and does not replay the turn", async () => {
  const f = fixture(); f.remote.setGeneration(async () => ({ ...response(), status: "incomplete" }));
  await assert.rejects(f.orchestrator.processIncoming(f.provider, f.incoming("first")));
  assert.equal(f.sent.length, 0); assert.equal(f.remote.requests.length, 1);
});

test("DTO validation errors reach model and closed inquiry prevents further writes", async () => {
  const f = fixture();
  assert.equal((await f.router.executeNativeTool({ name: "updateInquiryFields", arguments: { clientType: "INVALID" } }, { waId: f.contact.waId, conversationId: f.conversation.id, inquiryId: f.inquiry.id })).ok, false);
  f.inquiry.status = InquiryStatus.CLOSED;
  for (const name of ["upsertContact", "createOrGetOpenInquiry", "updateInquiryFields", "updateConversationStage", "closeInquiry"]) {
    assert.equal((await f.router.executeNativeTool({ name, arguments: {} }, { waId: f.contact.waId, conversationId: f.conversation.id, inquiryId: f.inquiry.id })).ok, false);
  }
  assert.equal(f.effects.fieldUpdates, 0);
});

test("inquiry closed by a tool cannot be modified by a subsequent tool in the same turn", async () => {
  const f = fixture(); const context = { waId: f.contact.waId, conversationId: f.conversation.id, inquiryId: f.inquiry.id };
  assert.equal((await f.router.executeNativeTool({ name: "closeInquiry", arguments: {} }, context)).ok, true);
  assert.equal((await f.router.executeNativeTool({ name: "updateInquiryFields", arguments: { mainNeed: "Blocked" } }, context)).ok, false);
});

test("remote cleanup finishes before local deletion; failure leaves local data for retry", async () => {
  const f = fixture(); f.conversation.openAiConversationId = "conv_delete";
  const entered = deferred(); const release = deferred();
  f.remote.sdk.conversations.delete = async (id) => { entered.resolve(); await release.promise; f.remote.deleted.push(id); };
  const deleting = f.contactService.deletePermanently(f.contact.id); await entered.promise;
  assert.equal(f.effects.deletedLocally, false); release.resolve(); await deleting;
  assert.equal(f.effects.deletedLocally, true);
  const failed = fixture(); failed.conversation.openAiConversationId = "conv_delete";
  failed.remote.sdk.conversations.items.delete = async () => { throw { status: 503 }; };
  await assert.rejects(failed.contactService.deletePermanently(failed.contact.id));
  assert.equal(failed.effects.deletedLocally, false);
  assert.ok(await failed.contactService.getById(failed.contact.id));
});

test("404 recovery rebuilds old inbound and automatic replies without reusing historical thread", async () => {
  const f = fixture(); await f.orchestrator.processIncoming(f.provider, f.incoming("first"));
  f.remote.sdk.conversations.retrieve = async () => { throw { status: 404 }; };
  await f.orchestrator.processIncoming(f.provider, f.incoming("second"));
  assert.equal(f.conversation.openAiConversationId, "conv_2"); assert.equal(f.conversation.assistantThreadId, "thread_historical");
  assert.deepEqual(f.remote.appended[1].items.map((item) => [item.role, item.content]), [["user", "first"], ["assistant", "Respuesta de prueba"], ["user", "second"]]);
  assert.ok(f.messages.every((message) => message.openAiSyncedAt));
});

test("deletion waits for an active generation and prevents orphaned remote responses", async () => {
  const f = fixture(); const entered = deferred(); const release = deferred();
  f.remote.setGeneration(async () => { entered.resolve(); await release.promise; return response(); });
  const processing = f.orchestrator.processIncoming(f.provider, f.incoming("first")); await entered.promise;
  const deleting = f.contactService.deletePermanently(f.contact.id);
  assert.equal(f.effects.deletedLocally, false); assert.deepEqual(f.remote.deleted, []);
  await assert.rejects(f.orchestrator.processIncoming(f.provider, f.incoming("while_deleting")), /eliminando/);
  release.resolve(); await processing; await deleting;
  assert.equal(f.sent.length, 0); assert.equal(f.effects.deletedLocally, true);
  assert.equal(f.remote.deleted.at(-1), "conv_1");
});
