import { RequestValidator, ValidationTuple } from "../tools/_base.js";

export class TestOwnerLeadTemplateRequestDTO {
  constructor(
    public readonly toWaId: string,
    public readonly folio: string,
    public readonly fullName: string,
    public readonly leadPhoneE164: string,
    public readonly email: string,
    public readonly mainNeed: string,
    public readonly recommendedPlan: string
  ) {}

  public static validate(payload: unknown): ValidationTuple<TestOwnerLeadTemplateRequestDTO> {
    if (!RequestValidator.isObject(payload)) {
      return ["Payload inválido"];
    }

    const toWaId = RequestValidator.requiredString(payload, "toWaId");
    const folio = RequestValidator.requiredString(payload, "folio");
    const fullName = RequestValidator.requiredString(payload, "fullName");
    const leadPhoneE164 = RequestValidator.requiredString(payload, "leadPhoneE164");
    const email = RequestValidator.requiredString(payload, "email");
    const mainNeed = RequestValidator.requiredString(payload, "mainNeed");
    const recommendedPlan = RequestValidator.requiredString(payload, "recommendedPlan");

    if (!toWaId || !folio || !fullName || !leadPhoneE164 || !email || !mainNeed || !recommendedPlan) {
      return ["toWaId, folio, fullName, leadPhoneE164, email, mainNeed y recommendedPlan son obligatorios"];
    }

    return [
      undefined,
      new TestOwnerLeadTemplateRequestDTO(
        toWaId,
        folio,
        fullName,
        leadPhoneE164,
        email,
        mainNeed,
        recommendedPlan
      )
    ];
  }
}
