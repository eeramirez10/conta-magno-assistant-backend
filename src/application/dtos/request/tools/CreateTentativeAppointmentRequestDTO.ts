import { RequestValidator, ValidationTuple } from "./_base.js";

export class CreateTentativeAppointmentRequestDTO {
  constructor(
    public readonly inquiryId: string,
    public readonly slotId: string
  ) {}

  public static validate(payload: unknown): ValidationTuple<CreateTentativeAppointmentRequestDTO> {
    if (!RequestValidator.isObject(payload)) {
      return ["Payload inválido"];
    }

    const inquiryId = RequestValidator.requiredString(payload, "inquiryId");
    const slotId = RequestValidator.requiredString(payload, "slotId");

    if (!inquiryId || !slotId) {
      return ["inquiryId y slotId son obligatorios"];
    }

    return [undefined, new CreateTentativeAppointmentRequestDTO(inquiryId, slotId)];
  }
}
