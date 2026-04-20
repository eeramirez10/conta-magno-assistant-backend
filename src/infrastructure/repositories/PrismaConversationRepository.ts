import { ConversationStage as PrismaConversationStage, ConversationStatus as PrismaConversationStatus } from "@prisma/client";
import { Conversation } from "../../domain/entities/Conversation.js";
import { ConversationStage } from "../../domain/enums/ConversationStage.js";
import { IConversationRepository } from "../../domain/repositories/IConversationRepository.js";
import { prisma } from "../database/prisma.js";

function mapConversation(row: {
  id: string;
  contactId: string;
  provider: string;
  assistantThreadId: string | null;
  status: PrismaConversationStatus;
  stage: PrismaConversationStage;
  createdAt: Date;
  updatedAt: Date;
}): Conversation {
  return new Conversation(
    row.id,
    row.contactId,
    row.provider,
    row.assistantThreadId,
    row.status as Conversation["status"],
    row.stage as Conversation["stage"],
    row.createdAt,
    row.updatedAt
  );
}

export class PrismaConversationRepository implements IConversationRepository {
  public async getActiveByContactId(contactId: string): Promise<Conversation | null> {
    const row = await prisma.conversation.findFirst({
      where: { contactId, status: PrismaConversationStatus.OPEN },
      orderBy: { updatedAt: "desc" }
    });

    return row ? mapConversation(row) : null;
  }

  public async createOpen(contactId: string, provider: string): Promise<Conversation> {
    const row = await prisma.conversation.create({
      data: {
        contactId,
        provider,
        status: PrismaConversationStatus.OPEN,
        stage: PrismaConversationStage.GREETING
      }
    });

    return mapConversation(row);
  }

  public async updateStage(conversationId: string, stage: ConversationStage): Promise<Conversation> {
    const row = await prisma.conversation.update({
      where: { id: conversationId },
      data: { stage: stage as PrismaConversationStage }
    });

    return mapConversation(row);
  }

  public async setAssistantThreadId(conversationId: string, assistantThreadId: string): Promise<Conversation> {
    const row = await prisma.conversation.update({
      where: { id: conversationId },
      data: { assistantThreadId }
    });

    return mapConversation(row);
  }

  public async list(limit = 50): Promise<Conversation[]> {
    const rows = await prisma.conversation.findMany({
      take: limit,
      orderBy: { updatedAt: "desc" }
    });

    return rows.map(mapConversation);
  }

  public async findById(id: string): Promise<Conversation | null> {
    const row = await prisma.conversation.findUnique({ where: { id } });
    return row ? mapConversation(row) : null;
  }
}
