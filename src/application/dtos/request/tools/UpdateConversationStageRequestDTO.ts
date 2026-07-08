import { ConversationStage } from "../../../../domain/enums/ConversationStage.js";
import { RequestValidator, ValidationTuple } from "./_base.js";

export class UpdateConversationStageRequestDTO {
  constructor(
    public readonly conversationId: string,
    public readonly stage: ConversationStage
  ) {}

  public static validate(payload: unknown): ValidationTuple<UpdateConversationStageRequestDTO> {
    if (!RequestValidator.isObject(payload)) {
      return ["Payload inválido"];
    }

    const conversationId = RequestValidator.requiredString(payload, "conversationId");
    const stage = RequestValidator.requiredString(payload, "stage");

    if (!conversationId || !stage) {
      return ["conversationId y stage son obligatorios"];
    }

    if (!(Object.values(ConversationStage) as string[]).includes(stage)) {
      return ["stage inválido"];
    }

    return [undefined, new UpdateConversationStageRequestDTO(conversationId, stage as ConversationStage)];
  }
}
