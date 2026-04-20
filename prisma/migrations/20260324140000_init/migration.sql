-- This migration mirrors prisma/schema.prisma initial models
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');
CREATE TYPE "ConversationStage" AS ENUM ('GREETING', 'QUALIFYING', 'INFORMATION', 'PLAN_RECOMMENDATION', 'SCHEDULING', 'PENDING_HUMAN', 'COMPLETED');
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'QUALIFIED', 'PENDING_FOLLOWUP', 'APPOINTMENT_TENTATIVE', 'APPOINTMENT_CONFIRMED', 'CLOSED');
CREATE TYPE "NotificationEventType" AS ENUM ('LEAD_CREATED', 'LEAD_UPDATED', 'APPOINTMENT_REQUESTED', 'APPOINTMENT_CONFIRMED');
CREATE TYPE "AppointmentStatus" AS ENUM ('TENTATIVE', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED');

CREATE TABLE "Contact" (
  "id" TEXT PRIMARY KEY,
  "waId" TEXT NOT NULL UNIQUE,
  "fullName" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "email" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
  "consentPrivacy" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "Conversation" (
  "id" TEXT PRIMARY KEY,
  "contactId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "assistantThreadId" TEXT,
  "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
  "stage" "ConversationStage" NOT NULL DEFAULT 'GREETING',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "Conversation_assistantThreadId_key" ON "Conversation"("assistantThreadId");
CREATE INDEX "Conversation_contactId_status_idx" ON "Conversation"("contactId", "status");

CREATE TABLE "Message" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "providerMessageId" TEXT UNIQUE,
  "text" TEXT NOT NULL,
  "rawPayload" JSONB NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT
);
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

CREATE TABLE "Inquiry" (
  "id" TEXT PRIMARY KEY,
  "folio" TEXT NOT NULL UNIQUE,
  "contactId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
  "clientType" TEXT,
  "specialtyProfile" TEXT,
  "mainNeed" TEXT,
  "urgency" TEXT,
  "budgetRange" TEXT,
  "recommendedPlan" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Inquiry_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT,
  CONSTRAINT "Inquiry_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT
);
CREATE INDEX "Inquiry_contactId_status_idx" ON "Inquiry"("contactId", "status");

CREATE TABLE "NotificationEvent" (
  "id" TEXT PRIMARY KEY,
  "inquiryId" TEXT NOT NULL,
  "eventType" "NotificationEventType" NOT NULL,
  "channel" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "sentAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "NotificationEvent_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE RESTRICT
);
CREATE INDEX "NotificationEvent_inquiryId_eventType_idx" ON "NotificationEvent"("inquiryId", "eventType");

CREATE TABLE "AvailabilitySlot" (
  "id" TEXT PRIMARY KEY,
  "date" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "bookedCount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX "AvailabilitySlot_date_isActive_idx" ON "AvailabilitySlot"("date", "isActive");
CREATE UNIQUE INDEX "AvailabilitySlot_date_startTime_endTime_timezone_key" ON "AvailabilitySlot"("date", "startTime", "endTime", "timezone");

CREATE TABLE "Appointment" (
  "id" TEXT PRIMARY KEY,
  "inquiryId" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'TENTATIVE',
  "meetingLink" TEXT,
  "createdBy" TEXT NOT NULL DEFAULT 'ASSISTANT',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Appointment_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE RESTRICT,
  CONSTRAINT "Appointment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AvailabilitySlot"("id") ON DELETE RESTRICT
);
CREATE INDEX "Appointment_inquiryId_status_idx" ON "Appointment"("inquiryId", "status");
