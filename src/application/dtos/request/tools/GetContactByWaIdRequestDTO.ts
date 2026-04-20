import { RequestValidator, ValidationTuple } from "./_base.js";

export class GetContactByWaIdRequestDTO {
  constructor(public readonly waId: string) {}

  public static validate(payload: unknown): ValidationTuple<GetContactByWaIdRequestDTO> {
    if (!RequestValidator.isObject(payload)) {
      return ["Payload inválido"];
    }

    const waId = RequestValidator.requiredString(payload, "waId");
    if (!waId) {
      return ["waId es obligatorio"];
    }

    return [undefined, new GetContactByWaIdRequestDTO(waId)];
  }
}
