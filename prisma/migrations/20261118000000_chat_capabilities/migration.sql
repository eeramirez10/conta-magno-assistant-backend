-- CreateTable
CREATE TABLE "ChatControl" (
    "conversationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatControl_pkey" PRIMARY KEY ("conversationId")
);

-- CreateTable
CREATE TABLE "NumberPolicy" (
    "waId" TEXT NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'AUTO',
    "reason" TEXT,
    "remoteStatus" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberPolicy_pkey" PRIMARY KEY ("waId")
);

-- CreateTable
CREATE TABLE "ChatAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "path" TEXT,
    "playbackPath" TEXT,
    "providerMediaId" TEXT,
    "openAiFileId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transcript" TEXT,
    "error" TEXT,

    CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatShareLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "attachmentId" TEXT,
    "mode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "ChatShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatJob" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatShareLink_tokenHash_key" ON "ChatShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ChatJob_status_createdAt_idx" ON "ChatJob"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatControl" ADD CONSTRAINT "ChatControl_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatShareLink" ADD CONSTRAINT "ChatShareLink_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatShareLink" ADD CONSTRAINT "ChatShareLink_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "ChatAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatJob" ADD CONSTRAINT "ChatJob_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
