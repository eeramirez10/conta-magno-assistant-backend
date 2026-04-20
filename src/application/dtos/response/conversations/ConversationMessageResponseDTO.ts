import { Message } from "../../../../domain/entities/Message.js";

export class ConversationMessageResponseDTO {
  constructor(
    public readonly id: string,
    public readonly direction: "IN" | "OUT",
    public readonly text: string,
    public readonly createdAt: string
  ) {}

  public static fromEntity(entity: Message): ConversationMessageResponseDTO {
    return new ConversationMessageResponseDTO(entity.id, entity.direction, entity.text, entity.createdAt.toISOString());
  }
}
