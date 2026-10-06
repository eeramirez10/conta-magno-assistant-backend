import { Conversation } from "../../domain/entities/Conversation.js";
import { Message } from "../../domain/entities/Message.js";
import { ConversationStage } from "../../domain/enums/ConversationStage.js";
import { ConversationDomainService } from "../../domain/services/ConversationDomainService.js";
import { IConversationRepository } from "../../domain/repositories/IConversationRepository.js";
import { IMessageRepository } from "../../domain/repositories/IMessageRepository.js";
import { UpdateConversationStageRequestDTO } from "../dtos/request/tools/UpdateConversationStageRequestDTO.js";
import { IInquiryRepository } from "../../domain/repositories/IInquiryRepository.js";
import { InquiryStatus } from "../../domain/enums/InquiryStatus.js";
import { IContactRepository } from "../../domain/repositories/IContactRepository.js";
import { MetaWhatsAppClient } from '../../infrastructure/integrations/whatsapp/meta/MetaWhatsAppClient.js';
import { IRealtimePublisher } from '../ports/IRealtimePublisher.js';

export class ConversationApplicationService {
  private readonly humanControlVersions = new Map<string, number>();

  public getHumanControlVersion(id: string): number {
    return this.humanControlVersions.get(id) ?? 0;
  }
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly contactRepository: IContactRepository,
    private readonly metaClient: MetaWhatsAppClient,
    private readonly domainService: ConversationDomainService,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly inquiryRepository: IInquiryRepository
  ) { }

  public async createOrGetActive(contactId: string, provider: string): Promise<Conversation> {
    const active = await this.conversationRepository.getActiveByContactId(contactId);
    if (active) {
      return active;
    }

    const conversation = await this.conversationRepository.createOpen(contactId, provider);
    this.realtimePublisher.conversationUpdated(conversation.id);
    return conversation;
  }

  public async updateStage(dto: UpdateConversationStageRequestDTO): Promise<Conversation> {
    const current = await this.conversationRepository.findById(dto.conversationId);
    if (!current) {
      throw new Error("Conversación no encontrada");
    }

    if (current.stage === ConversationStage.PENDING_HUMAN || !this.domainService.canMove(current.stage, dto.stage)) {
      return current;
    }

    const conversation = await this.conversationRepository.updateStageUnlessHumanControls(dto.conversationId, dto.stage);
    this.realtimePublisher.conversationUpdated(conversation.id);
    return conversation;
  }

  public async setOpenAiConversationId(conversationId: string, remoteId: string): Promise<Conversation> {
    return this.conversationRepository.setOpenAiConversationId(conversationId, remoteId);
  }

  public async addInboundMessage(payload: {
    conversationId: string;
    providerMessageId?: string | null;
    text: string;
    rawPayload: unknown;
    openAiSyncedAt?: Date;
  }): Promise<Message> {
    const message = await this.messageRepository.create({
      conversationId: payload.conversationId,
      direction: "IN",
      providerMessageId: payload.providerMessageId,
      text: payload.text,
      rawPayload: payload.rawPayload,
      openAiSyncedAt: payload.openAiSyncedAt
    });
    this.publishMessage(message);
    return message;
  }

  public async addOutboundMessage(payload: {
    conversationId: string;
    providerMessageId?: string | null;
    text: string;
    rawPayload: unknown;
    openAiSyncedAt?: Date;
  }): Promise<Message> {
    const message = await this.messageRepository.create({
      conversationId: payload.conversationId,
      direction: "OUT",
      providerMessageId: payload.providerMessageId,
      text: payload.text,
      rawPayload: payload.rawPayload,
      openAiSyncedAt: payload.openAiSyncedAt
    });
    this.publishMessage(message);
    return message;
  }

  public async markOpenAiSynced(ids: string[], at: Date): Promise<void> {
    await this.messageRepository.markOpenAiSynced(ids, at);
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

    this.humanControlVersions.set(conversationId, this.getHumanControlVersion(conversationId) + 1);
    const updated = await this.conversationRepository
      .updateStage(conversationId, ConversationStage.PENDING_HUMAN);
    this.realtimePublisher.conversationUpdated(updated.id);
    return updated;
  }

  public async releaseHumanControl(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error('Conversation not found')
    }

    const inquiry = await this.inquiryRepository.getLatestByConversationId(conversationId);
    const stage = inquiry?.status === InquiryStatus.CLOSED ? ConversationStage.COMPLETED : ConversationStage.QUALIFYING;
    const updated = await this.conversationRepository.updateStage(conversationId, stage);
    this.realtimePublisher.conversationUpdated(updated.id);
    return updated;
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

  private publishMessage(message: Message): void {
    this.realtimePublisher.messageCreated(message);
    this.realtimePublisher.conversationUpdated(message.conversationId);
  }
}
