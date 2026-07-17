import { ContactSummary } from "../../../../domain/repositories/IContactRepository.js";
import { ContactListItemResponseDTO } from "./ContactListItemResponseDTO.js";

export class ContactListResponseDTO {
  constructor(
    public readonly ok: boolean,
    public readonly items: ContactListItemResponseDTO[]
  ) {}

  public static fromSummaries(items: ContactSummary[]): ContactListResponseDTO {
    return new ContactListResponseDTO(true, items.map(ContactListItemResponseDTO.fromSummary))
  }
}
