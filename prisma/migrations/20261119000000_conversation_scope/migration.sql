CREATE TABLE "ConversationScopeControl" (
  "conversationId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'ACTIVE',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConversationScopeControl_pkey" PRIMARY KEY ("conversationId"),
  CONSTRAINT "ConversationScopeControl_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
