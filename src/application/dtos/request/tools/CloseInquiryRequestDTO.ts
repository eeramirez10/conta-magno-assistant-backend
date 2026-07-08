import { RequestValidator, ValidationTuple } from "./_base.js";

export class CloseInquiryRequestDTO {
  constructor(public readonly inquiryId: string) {}

  public static validate(payload: unknown): ValidationTuple<CloseInquiryRequestDTO> {
    if (!RequestValidator.isObject(payload)) {
      return ["Payload inválido"];
    }

    const inquiryId = RequestValidator.requiredString(payload, "inquiryId");
    if (!inquiryId) {
      return ["inquiryId es obligatorio"];
    }

    return [undefined, new CloseInquiryRequestDTO(inquiryId)];
  }
}
