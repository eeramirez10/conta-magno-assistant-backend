import { InquiryStatus } from "../enums/InquiryStatus.js";
import { ContribuyenteType } from "../enums/ContribuyenteType.js";

export class Inquiry {
  constructor(
    public readonly id: string,
    public readonly folio: string,
    public readonly contactId: string,
    public readonly conversationId: string,
    public status: InquiryStatus,
    public clientType: ContribuyenteType | null,
    public specialtyProfile: string | null,
    public mainNeed: string | null,
    public urgency: string | null,
    public budgetRange: string | null,
    public recommendedPlan: string | null,
    public notes: string | null,
    public createdAt: Date,
    public updatedAt: Date
  ) {}
}
