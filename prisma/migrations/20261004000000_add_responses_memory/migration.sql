ALTER TABLE "Conversation" ADD COLUMN "openAiConversationId" TEXT;
ALTER TABLE "Message" ADD COLUMN "openAiSyncedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Conversation_openAiConversationId_key" ON "Conversation"("openAiConversationId");
