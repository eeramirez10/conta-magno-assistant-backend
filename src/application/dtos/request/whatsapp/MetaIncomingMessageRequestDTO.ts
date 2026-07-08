import { ValidationTuple } from "../tools/_base.js";

export class MetaIncomingMessageRequestDTO {
  constructor(public readonly payload: unknown) {}

  public static validate(payload: unknown): ValidationTuple<MetaIncomingMessageRequestDTO> {
    if (!payload || typeof payload !== "object") {
      return ["Payload de Meta inválido"];
    }
    return [undefined, new MetaIncomingMessageRequestDTO(payload)];
  }
}
