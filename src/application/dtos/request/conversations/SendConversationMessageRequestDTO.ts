import { RequestValidator, ValidationTuple } from "../tools/_base.js";

export class SendConversationMessageRequestDTO {

  constructor(public readonly text: string) { }

  public static validate(payload: unknown): ValidationTuple<SendConversationMessageRequestDTO> {

    if (!RequestValidator.isObject(payload)) {
      return ["Payload inválido"];
    }

    const text = RequestValidator.requiredString(payload, "text");

    if (!text) {
      return ["text es obligatorio"];
    }

    if (text.length > 4000) {
      return ["text no puede exceder 4000 caracteres"];
    }

    return [undefined, new SendConversationMessageRequestDTO(text)];
  }
}