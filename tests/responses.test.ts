import assert from "node:assert/strict";
import test from "node:test";
import { fakeOpenAi, finalOutput, response } from "./helpers.js";
import { parseAssistantOutput } from "../src/infrastructure/integrations/openai/responseOutput.js";
import { AssistantTurnStoppedError } from "../src/infrastructure/integrations/openai/ResponsesClient.js";

const turn = { conversationId: "conv_test", prompt: "Instructions", contextJson: {}, shouldContinue: async () => true, onToolCall: async () => ({ ok: true }) };
const history = (messages: any[] = []) => ({ conversationId: null as string | null, messages, onConversationCreated: async (_id: string) => {}, onMessagesSynced: async (_ids: string[], _at: Date) => {}, shouldContinue: async () => true });

test("new memory imports chronological roles and marks only accepted messages", async () => {
  const f = fakeOpenAi(); const marked: string[] = [];
  const payload = history([{ id: "one", direction: "IN", text: "Hola", openAiSyncedAt: null }, { id: "two", direction: "OUT", text: "Bienvenido", openAiSyncedAt: new Date() }]);
  payload.onMessagesSynced = async (ids) => { marked.push(...ids); };
  assert.equal(await f.client.syncHistory(payload), "conv_1");
  assert.deepEqual(f.appended[0].items.map((item) => item.role), ["user", "assistant"]);
  assert.deepEqual(marked, ["one", "two"]);
});

test("existing memory appends only unsynced messages and supports history over 100 items", async () => {
  const f = fakeOpenAi(); const payload = history(Array.from({ length: 206 }, (_, i) => ({ id: String(i), direction: "IN", text: String(i), openAiSyncedAt: i < 5 ? new Date() : null })));
  payload.conversationId = "conv_existing";
  await f.client.syncHistory(payload);
  assert.deepEqual(f.appended.map((batch) => batch.items.length), [...Array(10).fill(20), 1]);
  assert.equal(f.createdCount, 0);
});

test("404 reconstructs full history; other errors keep remote ID and propagate", async () => {
  const f = fakeOpenAi(); const payload = history([{ id: "old", direction: "IN", text: "Old", openAiSyncedAt: new Date() }]);
  payload.conversationId = "conv_missing";
  f.sdk.conversations.retrieve = async () => { throw { status: 404 }; };
  await f.client.syncHistory(payload);
  assert.equal(f.appended[0].items.length, 1);
  f.sdk.conversations.retrieve = async () => { throw { status: 503 }; };
  await assert.rejects(f.client.syncHistory(payload), (error: any) => error.status === 503);
  assert.equal(f.createdCount, 1);
});

test("failed import doesn't mark messages; accepted earlier chunks remain marked", async () => {
  const f = fakeOpenAi(); const marked: string[] = [];
  const original = f.sdk.conversations.items.create;
  let calls = 0;
  f.sdk.conversations.items.create = async (id, data) => { if (++calls === 2) throw new Error("unavailable"); return original(id, data); };
  const payload = history(Array.from({ length: 21 }, (_, i) => ({ id: String(i), direction: "IN", text: "Hi", openAiSyncedAt: null })));
  payload.onMessagesSynced = async (ids) => { marked.push(...ids); };
  await assert.rejects(f.client.syncHistory(payload));
  assert.equal(marked.length, 20);
});

test("function calls execute sequentially across rounds with matching call IDs", async () => {
  const f = fakeOpenAi(); let generation = 0; const executed: string[] = [];
  f.setGeneration(async () => ++generation === 1
    ? response(finalOutput(), [{ name: "one", arguments: "{}", call_id: "call_one" }, { name: "two", arguments: "{}", call_id: "call_two" }])
    : generation === 2 ? response(finalOutput(), [{ name: "three", arguments: "{}", call_id: "call_three" }]) : response());
  await f.client.runResponse({ ...turn, onToolCall: async (call) => { executed.push(call.name); return { ok: true }; } });
  assert.deepEqual(executed, ["one", "two", "three"]);
  assert.deepEqual(f.appended.flatMap((batch) => batch.items.map((item) => item.call_id)), ["call_one", "call_two", "call_three"]);
  for (const request of f.requests) {
    assert.equal(request.model, "gpt-6-luna"); assert.equal(request.reasoning.effort, "low");
    assert.equal(request.max_output_tokens, 8192); assert.equal(request.text.format.strict, true);
    assert.equal(request.tools.length, 7); assert.ok(request.tools.every((tool: any) => tool.strict === false));
    assert.equal(request.conversation, "conv_test"); assert.deepEqual(request.input, []);
  }
});

test("malformed arguments and handler failures return errors to the model", async () => {
  const f = fakeOpenAi(); let n = 0;
  f.setGeneration(async () => ++n === 1 ? response(finalOutput(), [{ name: "bad", arguments: "not json", call_id: "bad_json" }, { name: "failure", arguments: "{}", call_id: "failure" }]) : response());
  await f.client.runResponse({ ...turn, onToolCall: async () => { throw new Error("sensitive details"); } });
  assert.ok(f.appended[0].items.every((item) => JSON.parse(item.output).ok === false));
  assert.ok(!JSON.stringify(f.appended).includes("sensitive details"));
});

test("eight tool rounds limit side effects and resolve the final pending call", async () => {
  const f = fakeOpenAi(); let executed = 0;
  f.setGeneration(async () => response(finalOutput(), [{ name: "loop", arguments: "{}", call_id: `call_${f.requests.length}` }]));
  await assert.rejects(f.client.runResponse({ ...turn, onToolCall: async () => { executed++; return { ok: true }; } }), /ocho rondas/);
  assert.equal(executed, 8); assert.equal(f.requests.length, 9); assert.equal(f.appended.length, 9);
});

for (const [name, invalid] of [
  ["incomplete", { ...response(), status: "incomplete" }],
  ["refusal", { ...response(), output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] }],
  ["invalid JSON", { ...response(), output_text: "not json" }],
  ["invalid stage", response(finalOutput("INVALID"))],
  ["empty reply", response({ ...finalOutput(), replyText: " " })],
  ["embedded tools", response({ ...finalOutput(), toolCalls: [] } as any)]
] as const) test(`rejects ${name} before delivery`, async () => {
  const f = fakeOpenAi(); f.setGeneration(async () => invalid);
  await assert.rejects(f.client.runResponse(turn)); assert.equal(f.requests.length, 1);
});

test("unknown fields normalize to undefined and incorrect extracted fields fail", () => {
  const output = parseAssistantOutput(JSON.stringify(finalOutput()));
  assert.equal(output.extractedFields.fullName, undefined);
  assert.equal(output.extractedFields.needsHuman, undefined);
  assert.throws(() => parseAssistantOutput(JSON.stringify(finalOutput("QUALIFYING", { email: 123 }))));
});

test("human takeover resolves native calls without executing them", async () => {
  const f = fakeOpenAi(); let active = true; let executed = false;
  f.setGeneration(async () => { active = false; return response(finalOutput(), [{ name: "write", arguments: "{}", call_id: "blocked" }]); });
  await assert.rejects(f.client.runResponse({ ...turn, shouldContinue: async () => active, onToolCall: async () => { executed = true; return { ok: true }; } }), AssistantTurnStoppedError);
  assert.equal(executed, false); assert.equal(JSON.parse(f.appended[0].items[0].output).ok, false);
});

test("deletes all remote items before conversation and tolerates missing resources", async () => {
  const f = fakeOpenAi(); await f.client.deleteConversation("conv_delete");
  assert.deepEqual(f.deleted, ["item_one", "item_two", "conv_delete"]);
  f.sdk.conversations.items.list = async () => { throw { status: 404 }; };
  await f.client.deleteConversation("conv_missing");
  f.sdk.conversations.items.list = async () => { throw { status: 500 }; };
  await assert.rejects(f.client.deleteConversation("conv_delete"));
});

test("remote cleanup handles multiple pages without a cursor pointing at a deleted item", async () => {
  const f = fakeOpenAi(); let remaining = Array.from({ length: 205 }, (_, i) => ({ id: `item_${i}` }));
  f.sdk.conversations.items.list = async () => ({ data: remaining.slice(0, 100) });
  f.sdk.conversations.items.delete = async (id) => { f.deleted.push(id); remaining = remaining.filter((item) => item.id !== id); };
  await f.client.deleteConversation("conv_many");
  assert.equal(f.deleted.length, 206); assert.equal(f.deleted.at(-1), "conv_many"); assert.equal(remaining.length, 0);
});

test("all outputs are persisted in batches permitted by the items endpoint", async () => {
  const f = fakeOpenAi(); let n = 0;
  f.setGeneration(async () => ++n === 1 ? response(finalOutput(), Array.from({ length: 21 }, (_, i) => ({ name: "read", arguments: "{}", call_id: `call_${i}` }))) : response());
  await f.client.runResponse(turn);
  assert.deepEqual(f.appended.map((batch) => batch.items.length), [20, 1]);
});
