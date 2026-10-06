import { Message } from "../../domain/entities/Message.js";
import { IMessageRepository } from "../../domain/repositories/IMessageRepository.js";
import { prisma } from "../database/prisma.js";

function mapMessage(row: {
  id: string;
  conversationId: string;
  direction: string;
  providerMessageId: string | null;
  text: string;
  rawPayload: unknown;
  createdAt: Date;
  openAiSyncedAt: Date | null;
}): Message {
  return new Message(
    row.id,
    row.conversationId,
    row.direction as Message["direction"],
    row.providerMessageId,
    row.text,
    row.rawPayload,
    row.createdAt,
    row.openAiSyncedAt
  );
}

export class PrismaMessageRepository implements IMessageRepository {
  public async create(payload: {
    conversationId: string;
    direction: "IN" | "OUT";
    providerMessageId?: string | null;
    text: string;
    rawPayload: unknown;
    openAiSyncedAt?: Date;
  }): Promise<Message> {
    const row = await prisma.$transaction(async (transaction) => {
      const conversation = payload.direction === "IN" ? await transaction.conversation.findUniqueOrThrow({
        where: { id: payload.conversationId }, select: { contact: { select: { incomingNotificationCycle: true } } }
      }) : null;
      const createdMessage = await transaction.message.create({
        data: {
          conversationId: payload.conversationId,
          direction: payload.direction,
          providerMessageId: payload.providerMessageId ?? null,
          text: payload.text,
          openAiSyncedAt: payload.openAiSyncedAt,
          incomingNotificationCycle: conversation?.contact.incomingNotificationCycle ?? null,
          rawPayload: payload.rawPayload as object
        }
      });

      await transaction.conversation.update({
        where: { id: payload.conversationId },
        data: { updatedAt: createdMessage.createdAt }
      });

      return createdMessage;
    });

    return mapMessage(row);
  }

  public async markOpenAiSynced(messageIds: string[], at: Date): Promise<void> {
    await prisma.message.updateMany({ where: { id: { in: messageIds } }, data: { openAiSyncedAt: at } });
  }

  public async findByProviderMessageId(providerMessageId: string): Promise<Message | null> {
    const row = await prisma.message.findUnique({
      where: { providerMessageId }
    });

    return row ? mapMessage(row) : null;
  }

  public async listByConversationId(conversationId: string): Promise<Message[]> {
    const rows = await prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });

    return rows.map(mapMessage);
  }
}
