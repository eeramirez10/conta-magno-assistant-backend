import { RequestValidator, ValidationTuple } from "./_base.js";

export class ListAvailableSlotsRequestDTO {
  constructor(
    public readonly fromDate: string,
    public readonly limit: number
  ) {}

  public static validate(payload: unknown): ValidationTuple<ListAvailableSlotsRequestDTO> {
    if (!RequestValidator.isObject(payload)) {
      return ["Payload inválido"];
    }

    const fromDate = RequestValidator.requiredString(payload, "fromDate");
    const limit = Number(payload.limit ?? 5);

    if (!fromDate || Number.isNaN(limit) || limit < 1 || limit > 20) {
      return ["fromDate y limit válido son obligatorios"];
    }

    return [undefined, new ListAvailableSlotsRequestDTO(fromDate, limit)];
  }
}
