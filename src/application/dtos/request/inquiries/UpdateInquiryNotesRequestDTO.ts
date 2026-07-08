import { RequestValidator, ValidationTuple } from "../tools/_base.js";

export class UpdateInquiryNotesRequestDTO {
  constructor(
    public readonly inquiryId: string,
    public readonly notes: string
  ) {}

  public static validate(payload: unknown): ValidationTuple<UpdateInquiryNotesRequestDTO> {
    if (!RequestValidator.isObject(payload)) {
      return ["Payload inválido"];
    }

    const inquiryId = RequestValidator.requiredString(payload, "inquiryId");
    const notes = RequestValidator.requiredString(payload, "notes");

    if (!inquiryId || !notes) {
      return ["inquiryId y notes son obligatorios"];
    }

    return [undefined, new UpdateInquiryNotesRequestDTO(inquiryId, notes)];
  }
}
