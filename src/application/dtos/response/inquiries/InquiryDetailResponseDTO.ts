import { Inquiry } from "../../../../domain/entities/Inquiry.js";

export class InquiryDetailResponseDTO {
  constructor(
    public readonly ok: boolean,
    public readonly data: {
      id: string;
      folio: string;
      status: string;
      clientType: string | null;
      specialtyProfile: string | null;
      mainNeed: string | null;
      urgency: string | null;
      budgetRange: string | null;
      recommendedPlan: string | null;
      notes: string | null;
      createdAt: string;
      updatedAt: string;
    }
  ) {}

  public static fromEntity(entity: Inquiry): InquiryDetailResponseDTO {
    return new InquiryDetailResponseDTO(true, {
      id: entity.id,
      folio: entity.folio,
      status: entity.status,
      clientType: entity.clientType,
      specialtyProfile: entity.specialtyProfile,
      mainNeed: entity.mainNeed,
      urgency: entity.urgency,
      budgetRange: entity.budgetRange,
      recommendedPlan: entity.recommendedPlan,
      notes: entity.notes,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    });
  }
}
