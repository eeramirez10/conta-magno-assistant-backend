import { Contact } from "../../domain/entities/Contact.js";
import { ContactDomainService } from "../../domain/services/ContactDomainService.js";
import { GetContactByWaIdRequestDTO } from "../dtos/request/tools/GetContactByWaIdRequestDTO.js";
import { UpsertContactRequestDTO } from "../dtos/request/tools/UpsertContactRequestDTO.js";
import { ContactDeletionResult, ContactSummary, IContactRepository } from "../../domain/repositories/IContactRepository.js";
import { IRealtimePublisher } from "../ports/IRealtimePublisher.js";

export class ContactApplicationService {
  constructor(
    private readonly contactRepository: IContactRepository,
    private readonly contactDomainService: ContactDomainService,
    private readonly realtimePublisher: IRealtimePublisher
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
    const result = await this.contactRepository.deleteWithRelations(id)
    if (!result) return null

    for (const conversationId of result.conversationIds) {
      this.realtimePublisher.conversationDeleted(conversationId)
    }

    return result
  }
}
