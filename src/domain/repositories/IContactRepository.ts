import { Contact } from "../entities/Contact.js";

export type ContactSummary = {
  contact: Contact;
  conversationCount: number;
  inquiryCount: number;
  messageCount: number;
  latestInquiry: ContactInquirySummary | null;
};

export type ContactInquirySummary = {
  folio: string;
  status: string;
  clientType: string | null;
  rfcStatus: "YES" | "NO" | "UNKNOWN";
  specialtyProfile: string | null;
  mainNeed: string | null;
  urgency: string | null;
  budgetRange: string | null;
  recommendedPlan: string | null;
  notes: string | null;
  updatedAt: Date;
};

export type ContactDeletionResult = {
  contactId: string;
  conversationIds: string[];
  deletedConversationCount: number;
  deletedInquiryCount: number;
  deletedMessageCount: number;
  deletedAppointmentCount: number;
};

export interface IContactRepository {
  findById(id: string): Promise<Contact | null>;
  findByWaId(waId: string): Promise<Contact | null>;
  list(limit?: number): Promise<ContactSummary[]>;
  deleteWithRelations(id: string): Promise<ContactDeletionResult | null>;
  upsertByWaId(payload: {
    waId: string;
    fullName: string;
    phoneE164: string;
    email?: string | null;
    timezone?: string;
    consentPrivacy?: boolean;
  }): Promise<Contact>;
}
