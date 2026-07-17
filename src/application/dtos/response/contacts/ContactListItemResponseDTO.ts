import { ContactSummary } from "../../../../domain/repositories/IContactRepository.js";

type ContactInquiryResponse = Omit<NonNullable<ContactSummary["latestInquiry"]>, "updatedAt"> & {
  updatedAt: string;
};

export class ContactListItemResponseDTO {
  constructor(
    public readonly id: string,
    public readonly fullName: string,
    public readonly waId: string,
    public readonly phoneE164: string,
    public readonly email: string | null,
    public readonly timezone: string,
    public readonly consentPrivacy: boolean,
    public readonly conversationCount: number,
    public readonly inquiryCount: number,
    public readonly messageCount: number,
    public readonly latestInquiry: ContactInquiryResponse | null,
    public readonly createdAt: string,
    public readonly updatedAt: string
  ) {}

  public static fromSummary(summary: ContactSummary): ContactListItemResponseDTO {
    const { contact } = summary
    return new ContactListItemResponseDTO(
      contact.id,
      contact.fullName,
      contact.waId,
      contact.phoneE164,
      contact.email,
      contact.timezone,
      contact.consentPrivacy,
      summary.conversationCount,
      summary.inquiryCount,
      summary.messageCount,
      summary.latestInquiry
        ? {
            ...summary.latestInquiry,
            updatedAt: summary.latestInquiry.updatedAt.toISOString()
          }
        : null,
      contact.createdAt.toISOString(),
      contact.updatedAt.toISOString()
    )
  }
}
