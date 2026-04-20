import { Conversation } from "../../../../domain/entities/Conversation.js";
import { Contact } from "../../../../domain/entities/Contact.js";
import { Message } from "../../../../domain/entities/Message.js";
import { ConversationMessageResponseDTO } from "./ConversationMessageResponseDTO.js";

export class ConversationDetailResponseDTO {
  constructor(
    public readonly ok: boolean,
    public readonly data: {
      id: string;
      contactId: string;
      contactName: string | null;
      contactPhone: string | null;
      displayName: string;
      provider: string;
      stage: string;
      status: string;
      createdAt: string;
      updatedAt: string;
      messages: ConversationMessageResponseDTO[];
    }
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

  public static fromEntities(
    conversation: Conversation,
    messages: Message[],
    contact: Contact | null
  ): ConversationDetailResponseDTO {
    return new ConversationDetailResponseDTO(true, {
      id: conversation.id,
      contactId: conversation.contactId,
      contactName: contact?.fullName ?? null,
      contactPhone: contact?.phoneE164 ?? contact?.waId ?? null,
      displayName: ConversationDetailResponseDTO.resolveDisplayName(contact),
      provider: conversation.provider,
      stage: conversation.stage,
      status: conversation.status,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: messages.map(ConversationMessageResponseDTO.fromEntity)
    });
  }
}
