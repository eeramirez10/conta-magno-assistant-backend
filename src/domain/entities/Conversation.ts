import { ConversationStage } from "../enums/ConversationStage.js";
import { ConversationStatus } from "../enums/ConversationStatus.js";

export class Conversation {
  constructor(
    public readonly id: string,
    public readonly contactId: string,
    public provider: string,
    public assistantThreadId: string | null,
    public status: ConversationStatus,
    public stage: ConversationStage,
    public createdAt: Date,
    public updatedAt: Date
  ) {}
}
