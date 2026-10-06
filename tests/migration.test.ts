import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { InquiryStatus } from "../src/domain/enums/InquiryStatus.js";

const testUrl = process.env.TEST_DATABASE_URL;
test("additive migrations preserve history and persist notification settings with unique deliveries and cascade cleanup", { skip: !testUrl }, async () => {
  const url = new URL(testUrl!);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname.endsWith("_test"), "Use a disposable local database ending in _test");
  const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
  const temp = await mkdtemp(join(tmpdir(), "conta-magno-migration-"));
  const deploy = (schema: string) => execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy", "--schema", schema], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: testUrl }, stdio: "pipe"
  });
  try {
    const tables: any[] = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    assert.equal(tables.length, 0, "Migration test requires an empty database");
    await cp("prisma", temp, { recursive: true });
    await rm(join(temp, "migrations/20261004000000_add_responses_memory"), { recursive: true });
    await rm(join(temp, "migrations/20261004010000_add_incoming_notifications"), { recursive: true });
    await rm(join(temp, "migrations/20261005000000_incoming_notification_cycles"), { recursive: true });
    const schema = (await readFile(join(temp, "schema.prisma"), "utf8"))
      .replace(/^.*openAiConversationId.*\n/m, "").replace(/^.*openAiSyncedAt.*\n/m, "")
      .replace(/^.*incomingNotifications.*\n/m, "")
      .replace(/^.*incomingNotification(?:Cycle|ClaimedCycle|ResetAt).*\n/gm, "")
      .replace(/\nenum IncomingNotificationTemplateMode \{[^}]*\}/, "")
      .replace(/\nmodel IncomingNotificationSettings \{[^}]*\}/, "")
      .replace(/\nmodel IncomingMessageNotification \{[^}]*\}/, "");
    await writeFile(join(temp, "schema.prisma"), schema);
    deploy(join(temp, "schema.prisma"));
    await prisma.$executeRaw`INSERT INTO "Contact" (id, "waId", "fullName", "phoneE164", "updatedAt") VALUES ('legacy_contact', '525555555555', 'Prueba', '525555555555', now())`;
    await prisma.$executeRaw`INSERT INTO "Conversation" (id, "contactId", provider, "assistantThreadId", "updatedAt") VALUES ('legacy_conversation', 'legacy_contact', 'META', 'thread_preserved', now())`;
    await prisma.$executeRaw`INSERT INTO "Message" (id, "conversationId", direction, text, "rawPayload") VALUES ('legacy_message', 'legacy_conversation', 'IN', 'Historial preservado', '{}')`;
    await cp("prisma/migrations/20261004000000_add_responses_memory", join(temp, "migrations/20261004000000_add_responses_memory"), { recursive: true });
    await cp("prisma/migrations/20261004010000_add_incoming_notifications", join(temp, "migrations/20261004010000_add_incoming_notifications"), { recursive: true });
    deploy(join(temp, "schema.prisma"));
    await prisma.$executeRaw`INSERT INTO "IncomingMessageNotification" (id, "messageId", recipient, status) VALUES ('legacy_alert', 'legacy_message', '525544444444', 'SENT')`;
    await prisma.$executeRaw`INSERT INTO "Inquiry" (id, folio, "contactId", "conversationId", status, "updatedAt") VALUES ('legacy_inquiry', 'CM-LEGACY', 'legacy_contact', 'legacy_conversation', 'QUALIFIED', now())`;
    deploy(resolve("prisma/schema.prisma"));
    const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: "legacy_conversation" } });
    assert.equal(conversation.assistantThreadId, "thread_preserved");
    assert.equal(conversation.openAiConversationId, null);
    const message = await prisma.message.findUniqueOrThrow({ where: { id: "legacy_message" } });
    assert.equal(message.text, "Historial preservado"); assert.equal(message.openAiSyncedAt, null);
    await prisma.conversation.update({ where: { id: conversation.id }, data: { openAiConversationId: "conv_unique" } });
    await assert.rejects(prisma.conversation.create({ data: { contactId: "legacy_contact", provider: "META", openAiConversationId: "conv_unique" } }), (error: any) => error.code === "P2002");
    const at = new Date();
    await prisma.message.updateMany({ where: { id: message.id }, data: { openAiSyncedAt: at } });
    assert.equal((await prisma.message.findUniqueOrThrow({ where: { id: message.id } })).openAiSyncedAt?.getTime(), at.getTime());
    process.env.DATABASE_URL = testUrl!;
    const { PrismaConversationRepository } = await import("../src/infrastructure/repositories/PrismaConversationRepository.js");
    const { PrismaMessageRepository } = await import("../src/infrastructure/repositories/PrismaMessageRepository.js");
    const { prisma: repositoryClient } = await import("../src/infrastructure/database/prisma.js");
    try {
      const conversationRepo = new PrismaConversationRepository();
      const messageRepo = new PrismaMessageRepository();
      await conversationRepo.setOpenAiConversationId(conversation.id, "conv_rebuilt");
      const rebuilt = await conversationRepo.findById(conversation.id);
      assert.equal(rebuilt?.openAiConversationId, "conv_rebuilt");
      assert.equal(rebuilt?.assistantThreadId, "thread_preserved");
      assert.equal((await messageRepo.listByConversationId(conversation.id))[0].openAiSyncedAt, null);
      await messageRepo.markOpenAiSynced([message.id], at);
      assert.equal((await messageRepo.listByConversationId(conversation.id))[0].openAiSyncedAt?.getTime(), at.getTime());
      await conversationRepo.updateStage(conversation.id, "PENDING_HUMAN" as any);
      assert.equal((await conversationRepo.updateStageUnlessHumanControls(conversation.id, "COMPLETED" as any)).stage, "PENDING_HUMAN");
      const { PrismaIncomingNotificationRepository } = await import("../src/infrastructure/repositories/PrismaIncomingNotificationRepository.js");
      const notificationRepo = new PrismaIncomingNotificationRepository();
      const defaults = await notificationRepo.getSettings();
      assert.equal(defaults.enabled, false);
      const settings = { ...defaults, enabled: true, recipients: ["525511111111"] };
      await notificationRepo.saveSettings(settings);
      assert.deepEqual(await notificationRepo.getSettings(), settings);
      assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id: "legacy_contact" } })).incomingNotificationClaimedCycle, 0);
      assert.ok((await prisma.inquiry.findUniqueOrThrow({ where: { id: "legacy_inquiry" } })).incomingNotificationResetAt);
      assert.equal(await notificationRepo.claimCycleForMessage(message.id), null);
      const claims = await Promise.all([notificationRepo.claimDelivery(message.id, "525511111111"), notificationRepo.claimDelivery(message.id, "525511111111")]);
      assert.equal(claims.filter(Boolean).length, 1);
      await notificationRepo.markSent(claims.find(Boolean)!, "wamid_accepted");
      assert.equal((await prisma.incomingMessageNotification.findUniqueOrThrow({ where: { id: claims.find(Boolean)! } })).status, "SENT");
      const { PrismaInquiryRepository } = await import("../src/infrastructure/repositories/PrismaInquiryRepository.js");
      const inquiryRepo = new PrismaInquiryRepository();
      await inquiryRepo.updateStatus("legacy_inquiry", InquiryStatus.CLOSED);
      assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id: "legacy_contact" } })).incomingNotificationCycle, 0);
      const next = await inquiryRepo.createOpen({ contactId: "legacy_contact", conversationId: conversation.id, folio: "CM-NEXT" });
      const before = await messageRepo.create({ conversationId: conversation.id, direction: "IN", providerMessageId: "before_qualification", text: "Before qualification", rawPayload: {} });
      await inquiryRepo.updateStatus(next.id, InquiryStatus.QUALIFIED);
      assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id: "legacy_contact" } })).incomingNotificationCycle, 1);
      // Delayed old messages cannot consume the rearmed cycle.
      assert.equal(await notificationRepo.claimCycleForMessage(before.id), null);
      const first = await messageRepo.create({ conversationId: conversation.id, direction: "IN", providerMessageId: "first_followup", text: "Followup", rawPayload: {} });
      const second = await messageRepo.create({ conversationId: conversation.id, direction: "IN", providerMessageId: "second_followup", text: "Another message", rawPayload: {} });
      const cycleClaims = await Promise.all([notificationRepo.claimCycleForMessage(first.id), notificationRepo.claimCycleForMessage(second.id)]);
      assert.equal(cycleClaims.filter(Boolean).length, 1);
      assert.equal(await new PrismaIncomingNotificationRepository().claimCycleForMessage(second.id), null);
      await inquiryRepo.updateStatus(next.id, InquiryStatus.QUALIFIED);
      await inquiryRepo.updateStatus(next.id, InquiryStatus.CLOSED);
      assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id: "legacy_contact" } })).incomingNotificationCycle, 1);
      const automatic = await inquiryRepo.createOpen({ contactId: "legacy_contact", conversationId: conversation.id, folio: "CM-AUTO" });
      await Promise.all([inquiryRepo.updateStatus(automatic.id, InquiryStatus.CLOSED), inquiryRepo.updateStatus(automatic.id, InquiryStatus.CLOSED)]);
      assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id: "legacy_contact" } })).incomingNotificationCycle, 2);
      const afterAutomatic = await messageRepo.create({ conversationId: conversation.id, direction: "IN", text: "After automatic completion", rawPayload: {} });
      assert.ok(await notificationRepo.claimCycleForMessage(afterAutomatic.id));
      assert.equal(await notificationRepo.claimCycleForMessage(afterAutomatic.id), null);
      await prisma.contact.create({ data: { id: "independent_contact", waId: "525566666666", fullName: "Otro contacto", phoneE164: "+525566666666" } });
      const independent = await prisma.conversation.create({ data: { contactId: "independent_contact", provider: "META" } });
      const independentMessage = await messageRepo.create({ conversationId: independent.id, direction: "IN", text: "Independent contact", rawPayload: {} });
      assert.ok(await notificationRepo.claimCycleForMessage(independentMessage.id));
      const { PrismaContactRepository } = await import("../src/infrastructure/repositories/PrismaContactRepository.js");
      await new PrismaContactRepository().deleteWithRelations("legacy_contact");
      assert.equal(await prisma.incomingMessageNotification.count(), 0);
      assert.deepEqual(await notificationRepo.getSettings(), settings);
    } finally { await repositoryClient.$disconnect(); }

  } finally {
    await prisma.$disconnect();
    await rm(temp, { recursive: true, force: true });
  }
});
