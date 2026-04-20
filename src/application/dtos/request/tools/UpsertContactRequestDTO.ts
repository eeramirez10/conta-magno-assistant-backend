import { RequestValidator, ValidationTuple } from "./_base.js";

export class UpsertContactRequestDTO {
  constructor(
    public readonly waId: string,
    public readonly fullName: string,
    public readonly phoneE164: string,
    public readonly email?: string | null,
    public readonly timezone?: string,
    public readonly consentPrivacy?: boolean
  ) {}

  public static validate(payload: unknown): ValidationTuple<UpsertContactRequestDTO> {
    if (!RequestValidator.isObject(payload)) {
      return ["Payload inválido"];
    }

    const waId = RequestValidator.requiredString(payload, "waId");
    const fullName = RequestValidator.requiredString(payload, "fullName");
    const phoneE164 = RequestValidator.requiredString(payload, "phoneE164");

    if (!waId || !fullName || !phoneE164) {
      return ["waId, fullName y phoneE164 son obligatorios"];
    }

    const email = RequestValidator.optionalString(payload, "email");
    const timezone = RequestValidator.optionalString(payload, "timezone") ?? undefined;
    const consentPrivacy = typeof payload.consentPrivacy === "boolean" ? payload.consentPrivacy : undefined;

    return [undefined, new UpsertContactRequestDTO(waId, fullName, phoneE164, email, timezone, consentPrivacy)];
  }
}
