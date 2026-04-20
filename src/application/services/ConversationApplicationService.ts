import { Conversation } from "../../domain/entities/Conversation.js";
import { Message } from "../../domain/entities/Message.js";
import { ConversationStage } from "../../domain/enums/ConversationStage.js";
import { ConversationDomainService } from "../../domain/services/ConversationDomainService.js";
import { IConversationRepository } from "../../domain/repositories/IConversationRepository.js";
import { IMessageRepository } from "../../domain/repositories/IMessageRepository.js";
import { UpdateConversationStageRequestDTO } from "../dtos/request/tools/UpdateConversationStageRequestDTO.js";

export class ConversationApplicationService {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly domainService: ConversationDomainService
  ) {}

  public async createOrGetActive(contactId: string, provider: string): Promise<Conversation> {
    const active = await this.conversationRepository.getActiveByContactId(contactId);
    if (active) {
      return active;
    }

    return this.conversationRepository.createOpen(contactId, provider);
  }

  public async updateStage(dto: UpdateConversationStageRequestDTO): Promise<Conversation> {
    const current = await this.conversationRepository.findById(dto.conversationId);
    if (!current) {
      throw new Error("Conversación no encontrada");
    }

    if (!this.domainService.canMove(current.stage, dto.stage)) {
      return current;
    }

    return this.conversationRepository.updateStage(dto.conversationId, dto.stage);
  }

  public async setAssistantThreadId(conversationId: string, threadId: string): Promise<Conversation> {
    return this.conversationRepository.setAssistantThreadId(conversationId, threadId);
  }

  public async addInboundMessage(payload: {
    conversationId: string;
    providerMessageId?: string | null;
    text: string;
    rawPayload: unknown;
  }): Promise<Message> {
    return this.messageRepository.create({
      conversationId: payload.conversationId,
      direction: "IN",
      providerMessageId: payload.providerMessageId,
      text: payload.text,
      rawPayload: payload.rawPayload
    });
  }

  public async addOutboundMessage(payload: {
    conversationId: string;
    providerMessageId?: string | null;
    text: string;
    rawPayload: unknown;
  }): Promise<Message> {
    return this.messageRepository.create({
      conversationId: payload.conversationId,
      direction: "OUT",
      providerMessageId: payload.providerMessageId,
      text: payload.text,
      rawPayload: payload.rawPayload
    });
  }

  public async findMessageByProviderMessageId(providerMessageId: string): Promise<Message | null> {
    return this.messageRepository.findByProviderMessageId(providerMessageId);
  }

  public async listConversations(limit = 100): Promise<Conversation[]> {
    return this.conversationRepository.list(limit);
  }

  public async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.conversationRepository.findById(conversationId);
  }

  public async listMessages(conversationId: string): Promise<Message[]> {
    return this.messageRepository.listByConversationId(conversationId);
  }

  public stageFromString(value: string): ConversationStage | null {
    return (Object.values(ConversationStage) as string[]).includes(value) ? (value as ConversationStage) : null;
  }
}
