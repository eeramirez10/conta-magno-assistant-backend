import { RequestValidator, ValidationTuple } from "./_base.js";

export class CreateOrGetOpenInquiryRequestDTO {
  constructor(
    public readonly contactId: string,
    public readonly conversationId: string
  ) {}

  public static validate(payload: unknown): ValidationTuple<CreateOrGetOpenInquiryRequestDTO> {
    if (!RequestValidator.isObject(payload)) {
      return ["Payload inválido"];
    }

    const contactId = RequestValidator.requiredString(payload, "contactId");
    const conversationId = RequestValidator.requiredString(payload, "conversationId");

    if (!contactId || !conversationId) {
      return ["contactId y conversationId son obligatorios"];
    }

    return [undefined, new CreateOrGetOpenInquiryRequestDTO(contactId, conversationId)];
  }
}
