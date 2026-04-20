import { InquiryStatus } from "../../../../domain/enums/InquiryStatus.js";
import { RequestValidator, ValidationTuple } from "../tools/_base.js";

export class UpdateInquiryStatusRequestDTO {
  constructor(
    public readonly inquiryId: string,
    public readonly status: InquiryStatus
  ) {}

  public static validate(payload: unknown): ValidationTuple<UpdateInquiryStatusRequestDTO> {
    if (!RequestValidator.isObject(payload)) {
      return ["Payload inválido"];
    }

    const inquiryId = RequestValidator.requiredString(payload, "inquiryId");
    const status = RequestValidator.requiredString(payload, "status");

    if (!inquiryId || !status) {
      return ["inquiryId y status son obligatorios"];
    }

    if (!(Object.values(InquiryStatus) as string[]).includes(status)) {
      return ["status inválido"];
    }

    return [undefined, new UpdateInquiryStatusRequestDTO(inquiryId, status as InquiryStatus)];
  }
}
