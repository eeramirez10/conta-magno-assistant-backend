import { RequestValidator, ValidationTuple } from "./_base.js";
import { ContribuyenteType, parseContribuyenteType } from "../../../../domain/enums/ContribuyenteType.js";

export class UpdateInquiryFieldsRequestDTO {
  constructor(
    public readonly inquiryId: string,
    public readonly clientType?: ContribuyenteType,
    public readonly specialtyProfile?: string,
    public readonly mainNeed?: string,
    public readonly urgency?: string,
    public readonly budgetRange?: string,
    public readonly recommendedPlan?: string,
    public readonly notes?: string
  ) {}

  public static validate(payload: unknown): ValidationTuple<UpdateInquiryFieldsRequestDTO> {
    if (!RequestValidator.isObject(payload)) {
      return ["Payload inválido"];
    }

    const inquiryId = RequestValidator.requiredString(payload, "inquiryId");
    if (!inquiryId) {
      return ["inquiryId es obligatorio"];
    }

    const rawClientType = RequestValidator.optionalString(payload, "clientType");
    let clientType: ContribuyenteType | undefined;
    if (rawClientType !== undefined && rawClientType !== null) {
      const parsedClientType = parseContribuyenteType(rawClientType);
      if (!parsedClientType) {
        return ["clientType inválido. Debe ser una opción válida del catálogo de contribuyentes"];
      }
      clientType = parsedClientType;
    }
    const specialtyProfile = RequestValidator.optionalString(payload, "specialtyProfile") ?? undefined;
    const mainNeed = RequestValidator.optionalString(payload, "mainNeed") ?? undefined;
    const urgency = RequestValidator.optionalString(payload, "urgency") ?? undefined;
    const budgetRange = RequestValidator.optionalString(payload, "budgetRange") ?? undefined;
    const recommendedPlan = RequestValidator.optionalString(payload, "recommendedPlan") ?? undefined;
    const notes = RequestValidator.optionalString(payload, "notes") ?? undefined;

    return [
      undefined,
      new UpdateInquiryFieldsRequestDTO(
        inquiryId,
        clientType,
        specialtyProfile,
        mainNeed,
        urgency,
        budgetRange,
        recommendedPlan,
        notes
      )
    ];
  }
}
