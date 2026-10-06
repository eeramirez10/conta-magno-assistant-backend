CREATE TABLE "IncomingNotificationSettings" (
    "id" TEXT NOT NULL DEFAULT 'incoming-whatsapp',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "recipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "templateName" TEXT NOT NULL DEFAULT 'aviso_mensaje_recibido',
    "languageCode" TEXT NOT NULL DEFAULT 'es_MX',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IncomingNotificationSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncomingMessageNotification" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "IncomingMessageNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IncomingMessageNotification_messageId_recipient_key" ON "IncomingMessageNotification"("messageId", "recipient");
ALTER TABLE "IncomingMessageNotification" ADD CONSTRAINT "IncomingMessageNotification_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
