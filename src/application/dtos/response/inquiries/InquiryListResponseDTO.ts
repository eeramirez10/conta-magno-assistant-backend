import { Inquiry } from "../../../../domain/entities/Inquiry.js";
import { InquiryListItemResponseDTO } from "./InquiryListItemResponseDTO.js";

export class InquiryListResponseDTO {
  constructor(
    public readonly ok: boolean,
    public readonly items: InquiryListItemResponseDTO[]
  ) {}

  public static fromEntities(items: Inquiry[]): InquiryListResponseDTO {
    return new InquiryListResponseDTO(true, items.map(InquiryListItemResponseDTO.fromEntity));
  }
}
