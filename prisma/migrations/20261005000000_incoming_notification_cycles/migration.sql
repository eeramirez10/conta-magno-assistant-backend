CREATE TYPE "IncomingNotificationTemplateMode" AS ENUM ('INCOMING_MESSAGE', 'OWNER_LEAD');
ALTER TABLE "IncomingNotificationSettings" ADD COLUMN "templateMode" "IncomingNotificationTemplateMode" NOT NULL DEFAULT 'INCOMING_MESSAGE';
ALTER TABLE "Contact" ADD COLUMN "incomingNotificationCycle" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "incomingNotificationClaimedCycle" INTEGER NOT NULL DEFAULT -1;
ALTER TABLE "Message" ADD COLUMN "incomingNotificationCycle" INTEGER;
ALTER TABLE "Inquiry" ADD COLUMN "incomingNotificationResetAt" TIMESTAMP(3);

-- Preserve previous alerts as consumed cycles rather than notifying again on upgrade.
UPDATE "Contact" AS contact SET "incomingNotificationClaimedCycle" = 0
WHERE EXISTS (
    SELECT 1 FROM "IncomingMessageNotification" AS notification
    JOIN "Message" AS message ON message.id = notification."messageId"
    JOIN "Conversation" AS conversation ON conversation.id = message."conversationId"
    WHERE conversation."contactId" = contact.id
);
UPDATE "Message" SET "incomingNotificationCycle" = 0 WHERE direction = 'IN';
-- Historical qualifications must not rearm alerts when their status is saved again.
UPDATE "Inquiry" SET "incomingNotificationResetAt" = "updatedAt" WHERE status IN ('QUALIFIED', 'CLOSED');
