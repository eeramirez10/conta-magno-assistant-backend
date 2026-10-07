import { Prisma } from "@prisma/client";
import { defaultIncomingNotificationSettings, IIncomingNotificationRepository, IncomingNotificationSettings } from "../../domain/repositories/IIncomingNotificationRepository.js";
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
      create: { id: this.settingsId, recipients: settings.recipients, enabled: settings.recipients.length > 0 },
      update: { recipients: settings.recipients, enabled: settings.recipients.length > 0 }
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

  public async claimCycleForMessage(messageId: string): Promise<boolean> {
    return prisma.$transaction(async (transaction) => {
      const message = await transaction.message.findUniqueOrThrow({
        where: { id: messageId },
        select: { direction: true, incomingNotificationCycle: true, conversation: { select: { contactId: true } } }
      });
      if (message.direction !== "IN" || message.incomingNotificationCycle === null) return false;
      const cycle = message.incomingNotificationCycle;
      // The message carries its ingestion cycle. Delayed old work cannot consume
      // the next cycle after qualification, and concurrent messages claim once.
      const claimed = await transaction.contact.updateMany({
        where: { id: message.conversation.contactId, incomingNotificationCycle: cycle, incomingNotificationClaimedCycle: { not: cycle } },
        data: { incomingNotificationClaimedCycle: cycle }
      });
      return claimed.count > 0;
    });
  }

  public async markSent(id: string, providerMessageId: string): Promise<void> {
    await prisma.incomingMessageNotification.update({ where: { id }, data: { status: "SENT", providerMessageId, sentAt: new Date() } });
  }

  public async markFailed(id: string): Promise<void> {
    await prisma.incomingMessageNotification.update({ where: { id }, data: { status: "FAILED" } });
  }

  private toSettings(row: IncomingNotificationSettings): IncomingNotificationSettings {
    return { recipients: row.recipients };
  }
}
