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
}): Message {
  return new Message(
    row.id,
    row.conversationId,
    row.direction as Message["direction"],
    row.providerMessageId,
    row.text,
    row.rawPayload,
    row.createdAt
  );
}

export class PrismaMessageRepository implements IMessageRepository {
  public async create(payload: {
    conversationId: string;
    direction: "IN" | "OUT";
    providerMessageId?: string | null;
    text: string;
    rawPayload: unknown;
  }): Promise<Message> {
    const row = await prisma.message.create({
      data: {
        conversationId: payload.conversationId,
        direction: payload.direction,
        providerMessageId: payload.providerMessageId ?? null,
        text: payload.text,
        rawPayload: payload.rawPayload as object
      }
    });

    return mapMessage(row);
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
      orderBy: { createdAt: "asc" }
    });

    return rows.map(mapMessage);
  }
}
