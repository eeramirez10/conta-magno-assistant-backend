import { Prisma } from "@prisma/client";
import { defaultIncomingNotificationSettings, IIncomingNotificationRepository, IncomingNotificationSettings, IncomingLeadTemplateData } from "../../domain/repositories/IIncomingNotificationRepository.js";
import { prisma } from "../database/prisma.js";

export class PrismaIncomingNotificationRepository implements IIncomingNotificationRepository {
  private readonly settingsId = "incoming-whatsapp";

  public async getSettings(): Promise<IncomingNotificationSettings> {
    const row = await prisma.incomingNotificationSettings.findUnique({ where: { id: this.settingsId } });
    return row ? this.toSettings(row) : { ...defaultIncomingNotificationSettings, recipients: [] };
  }

  public async saveSettings(settings: IncomingNotificationSettings): Promise<IncomingNotificationSettings> {
    const row = await prisma.incomingNotificationSettings.upsert({
      where: { id: this.settingsId },
      create: { id: this.settingsId, ...settings },
      update: settings
    });
    return this.toSettings(row);
  }

  public async claimDelivery(messageId: string, recipient: string): Promise<string | null> {
    try {
      const row = await prisma.incomingMessageNotification.create({ data: { messageId, recipient } });
      return row.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
      throw error;
    }
  }

  public async claimCycleForMessage(messageId: string): Promise<IncomingLeadTemplateData | null> {
    return prisma.$transaction(async (transaction) => {
      const message = await transaction.message.findUniqueOrThrow({
        where: { id: messageId },
        include: { conversation: { include: {
          contact: true,
          inquiries: { take: 1, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }
        } } }
      });
      if (message.direction !== "IN" || message.incomingNotificationCycle === null) return null;
      const contact = message.conversation.contact;
      const cycle = message.incomingNotificationCycle;
      // The message carries its ingestion cycle. Delayed old work cannot consume
      // the next cycle after qualification, and concurrent messages claim once.
      const claimed = await transaction.contact.updateMany({
        where: { id: contact.id, incomingNotificationCycle: cycle, incomingNotificationClaimedCycle: { not: cycle } },
        data: { incomingNotificationClaimedCycle: cycle }
      });
      if (!claimed.count) return null;
      const inquiry = message.conversation.inquiries[0];
      return { folio: inquiry?.folio ?? null, fullName: contact.fullName, phoneE164: contact.phoneE164,
        email: contact.email, mainNeed: inquiry?.mainNeed ?? null, recommendedPlan: inquiry?.recommendedPlan ?? null };
    });
  }

  public async markSent(id: string, providerMessageId: string): Promise<void> {
    await prisma.incomingMessageNotification.update({ where: { id }, data: { status: "SENT", providerMessageId, sentAt: new Date() } });
  }

  public async markFailed(id: string): Promise<void> {
    await prisma.incomingMessageNotification.update({ where: { id }, data: { status: "FAILED" } });
  }

  private toSettings(row: IncomingNotificationSettings): IncomingNotificationSettings {
    return { enabled: row.enabled, recipients: row.recipients, templateName: row.templateName, languageCode: row.languageCode, templateMode: row.templateMode };
  }
}
