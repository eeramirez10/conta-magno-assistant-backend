import { Conversation } from "../../domain/entities/Conversation.js";
import { Message } from "../../domain/entities/Message.js";
import { ConversationStage } from "../../domain/enums/ConversationStage.js";
import { ConversationDomainService } from "../../domain/services/ConversationDomainService.js";
import { IConversationRepository } from "../../domain/repositories/IConversationRepository.js";
import { IMessageRepository } from "../../domain/repositories/IMessageRepository.js";
import { UpdateConversationStageRequestDTO } from "../dtos/request/tools/UpdateConversationStageRequestDTO.js";
import { IContactRepository } from "../../domain/repositories/IContactRepository.js";
import { MetaWhatsAppClient } from '../../infrastructure/integrations/whatsapp/meta/MetaWhatsAppClient.js';

export class ConversationApplicationService {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly contactRepository: IContactRepository,
    private readonly metaClient: MetaWhatsAppClient,
    private readonly domainService: ConversationDomainService
  ) { }

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

  public async takeHumanControl(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error('Conversation not found')
    }

    return this.conversationRepository
      .updateStage(conversationId, ConversationStage.PENDING_HUMAN);
  }

  public async releaseHumanControl(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error('Conversation not found')
    }

    return this.conversationRepository
      .updateStage(conversationId, ConversationStage.QUALIFYING);
  }

  public async sendHumanMessage(payload: { conversationId: string, text: string }): Promise<Message> {

    const conversation = await this.conversationRepository.findById(payload.conversationId);

    if (!conversation) throw new Error(`Conversation not found with id ${payload.conversationId}`)

    if (conversation.stage !== ConversationStage.PENDING_HUMAN) throw new Error("You must take control first");

    const contact = await this.contactRepository.findById(conversation.contactId);

    if (!contact) throw new Error("Contact not found")

    const toWaId = contact.waId || contact.phoneE164;

    if (!toWaId) throw new Error("Contact dont have wa number")

    const sent = await this.metaClient.sendText(toWaId, payload.text);

    return this.addOutboundMessage({
      conversationId: conversation.id,
      providerMessageId: sent.id,
      text: payload.text,
      rawPayload: {
        source: "admin_panel",
        provider: "META",
        sentAt: new Date().toISOString()
      }
    });

  }
}
