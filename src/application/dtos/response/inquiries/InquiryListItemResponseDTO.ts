import { Inquiry } from "../../../../domain/entities/Inquiry.js";

export class InquiryListItemResponseDTO {
  constructor(
    public readonly id: string,
    public readonly folio: string,
    public readonly status: string,
    public readonly mainNeed: string | null,
    public readonly recommendedPlan: string | null,
    public readonly updatedAt: string
  ) {}

  public static fromEntity(entity: Inquiry): InquiryListItemResponseDTO {
    return new InquiryListItemResponseDTO(
      entity.id,
      entity.folio,
      entity.status,
      entity.mainNeed,
      entity.recommendedPlan,
      entity.updatedAt.toISOString()
    );
  }
}
