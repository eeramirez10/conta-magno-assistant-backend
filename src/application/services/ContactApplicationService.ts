import { Contact } from "../../domain/entities/Contact.js";
import { ContactDomainService } from "../../domain/services/ContactDomainService.js";
import { GetContactByWaIdRequestDTO } from "../dtos/request/tools/GetContactByWaIdRequestDTO.js";
import { UpsertContactRequestDTO } from "../dtos/request/tools/UpsertContactRequestDTO.js";
import { ContactDeletionResult, ContactSummary, IContactRepository } from "../../domain/repositories/IContactRepository.js";
import { IRealtimePublisher } from "../ports/IRealtimePublisher.js";

import { IConversationRepository } from "../../domain/repositories/IConversationRepository.js";
import { ResponsesClient } from "../../infrastructure/integrations/openai/ResponsesClient.js";

export class ContactApplicationService {
  private readonly deletingContacts = new Set<string>();
  private readonly activeTurns = new Map<string, Set<Promise<void>>>();

  public isDeleting(id: string): boolean {
    return this.deletingContacts.has(id);
  }

  public async withConversationActivity<T>(id: string, work: () => Promise<T>): Promise<T> {
    if (this.isDeleting(id)) throw new Error("El contacto se está eliminando");
    let release!: () => void;
    const done = new Promise<void>((resolve) => { release = resolve; });
    const turns = this.activeTurns.get(id) ?? new Set<Promise<void>>();
    this.activeTurns.set(id, turns);
    turns.add(done);
    try { return await work(); }
    finally {
      turns.delete(done);
      release();
      if (!turns.size) this.activeTurns.delete(id);
    }
  }

  constructor(
    private readonly contactRepository: IContactRepository,
    private readonly contactDomainService: ContactDomainService,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly conversationRepository: IConversationRepository,
    private readonly responsesClient: Pick<ResponsesClient, "deleteConversation">
  ) {}

  public async getByWaId(dto: GetContactByWaIdRequestDTO): Promise<Contact | null> {
    return this.contactRepository.findByWaId(this.contactDomainService.normalizeWaId(dto.waId));
  }

  public async getById(id: string): Promise<Contact | null> {
    return this.contactRepository.findById(id);
  }

  public async upsert(dto: UpsertContactRequestDTO): Promise<Contact> {
    const waId = this.contactDomainService.normalizeWaId(dto.waId);
    const phone = this.contactDomainService.normalizePhone(dto.phoneE164);
    const fullName = this.contactDomainService.normalizeName(dto.fullName);

    return this.contactRepository.upsertByWaId({
      waId,
      fullName,
      phoneE164: phone,
      email: dto.email,
      timezone: dto.timezone,
      consentPrivacy: dto.consentPrivacy
    });
  }

  public async list(limit = 100): Promise<ContactSummary[]> {
    return this.contactRepository.list(limit)
  }

  public async deletePermanently(id: string): Promise<ContactDeletionResult | null> {
    if (this.isDeleting(id)) throw new Error("El contacto se está eliminando");
    this.deletingContacts.add(id);
    try {
      // Let in-flight Responses settle before removing their remote conversation.
      await Promise.all(this.activeTurns.get(id) ?? []);
      const conversations = await this.conversationRepository.listByContactId(id);
      for (const conversation of conversations) {
        if (conversation.openAiConversationId) await this.responsesClient.deleteConversation(conversation.openAiConversationId);
      }
      const result = await this.contactRepository.deleteWithRelations(id)
      if (!result) return null

      for (const conversationId of result.conversationIds) {
        this.realtimePublisher.conversationDeleted(conversationId)
      }

      return result
    } finally {
      this.deletingContacts.delete(id);
    }
  }
}
