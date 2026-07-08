import { Contact } from "../../domain/entities/Contact.js";
import { ContactDomainService } from "../../domain/services/ContactDomainService.js";
import { GetContactByWaIdRequestDTO } from "../dtos/request/tools/GetContactByWaIdRequestDTO.js";
import { UpsertContactRequestDTO } from "../dtos/request/tools/UpsertContactRequestDTO.js";
import { IContactRepository } from "../../domain/repositories/IContactRepository.js";

export class ContactApplicationService {
  constructor(
    private readonly contactRepository: IContactRepository,
    private readonly contactDomainService: ContactDomainService
  ) {}

  public async getByWaId(dto: GetContactByWaIdRequestDTO): Promise<Contact | null> {
    return this.contactRepository.findByWaId(dto.waId);
  }

  public async getById(id: string): Promise<Contact | null> {
    return this.contactRepository.findById(id);
  }

  public async upsert(dto: UpsertContactRequestDTO): Promise<Contact> {
    const phone = this.contactDomainService.normalizePhone(dto.phoneE164);
    const fullName = this.contactDomainService.normalizeName(dto.fullName);

    return this.contactRepository.upsertByWaId({
      waId: dto.waId,
      fullName,
      phoneE164: phone,
      email: dto.email,
      timezone: dto.timezone,
      consentPrivacy: dto.consentPrivacy
    });
  }
}
