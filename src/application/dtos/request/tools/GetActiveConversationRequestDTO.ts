import { RequestValidator, ValidationTuple } from "./_base.js";

export class GetActiveConversationRequestDTO {
  constructor(public readonly contactId: string) {}

  public static validate(payload: unknown): ValidationTuple<GetActiveConversationRequestDTO> {
    if (!RequestValidator.isObject(payload)) {
      return ["Payload inválido"];
    }

    const contactId = RequestValidator.requiredString(payload, "contactId");
    if (!contactId) {
      return ["contactId es obligatorio"];
    }

    return [undefined, new GetActiveConversationRequestDTO(contactId)];
  }
}
