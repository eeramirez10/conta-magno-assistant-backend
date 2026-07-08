import { Conversation } from "../../../../domain/entities/Conversation.js";
import { Contact } from "../../../../domain/entities/Contact.js";

export class ConversationListItemResponseDTO {
  constructor(
    public readonly id: string,
    public readonly contactId: string,
    public readonly contactName: string | null,
    public readonly contactPhone: string | null,
    public readonly displayName: string,
    public readonly provider: string,
    public readonly stage: string,
    public readonly status: string,
    public readonly updatedAt: string
  ) {}

  private static resolveDisplayName(contact: Contact | null): string {
    if (!contact) {
      return "Sin contacto";
    }

    const normalizedName = contact.fullName.trim();
    const hasConfirmedName = normalizedName.length > 0 && !/^prospecto conta magno$/i.test(normalizedName);
    if (hasConfirmedName) {
      return normalizedName;
    }

    return contact.phoneE164 || contact.waId;
  }

  public static fromEntity(entity: Conversation, contact: Contact | null): ConversationListItemResponseDTO {
    return new ConversationListItemResponseDTO(
      entity.id,
      entity.contactId,
      contact?.fullName ?? null,
      contact?.phoneE164 ?? contact?.waId ?? null,
      ConversationListItemResponseDTO.resolveDisplayName(contact),
      entity.provider,
      entity.stage,
      entity.status,
      entity.updatedAt.toISOString()
    );
  }
}
