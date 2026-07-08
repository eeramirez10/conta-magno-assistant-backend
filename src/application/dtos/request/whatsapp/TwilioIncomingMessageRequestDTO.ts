import { ValidationTuple } from "../tools/_base.js";

export class TwilioIncomingMessageRequestDTO {
  constructor(public readonly payload: unknown) {}

  public static validate(payload: unknown): ValidationTuple<TwilioIncomingMessageRequestDTO> {
    if (!payload || typeof payload !== "object") {
      return ["Payload de Twilio inválido"];
    }
    return [undefined, new TwilioIncomingMessageRequestDTO(payload)];
  }
}
