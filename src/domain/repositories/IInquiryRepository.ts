import { Inquiry } from "../entities/Inquiry.js";
import { InquiryStatus } from "../enums/InquiryStatus.js";

export interface IInquiryRepository {
  getOpenByContactId(contactId: string): Promise<Inquiry | null>;
  createOpen(payload: {
    contactId: string;
    conversationId: string;
    folio: string;
  }): Promise<Inquiry>;
  updateFields(inquiryId: string, fields: Partial<Pick<Inquiry, "clientType" | "specialtyProfile" | "mainNeed" | "urgency" | "budgetRange" | "recommendedPlan" | "notes">>): Promise<Inquiry>;
  updateStatus(inquiryId: string, status: InquiryStatus): Promise<Inquiry>;
  findById(id: string): Promise<Inquiry | null>;
  list(limit?: number): Promise<Inquiry[]>;
}
