import { ConversationStage } from "../enums/ConversationStage.js";

export class ConversationDomainService {
  public canMove(from: ConversationStage, to: ConversationStage): boolean {
    if (from === to) {
      return true;
    }

    const order: ConversationStage[] = [
      ConversationStage.GREETING,
      ConversationStage.QUALIFYING,
      ConversationStage.INFORMATION,
      ConversationStage.PLAN_RECOMMENDATION,
      ConversationStage.SCHEDULING,
      ConversationStage.PENDING_HUMAN,
      ConversationStage.COMPLETED
    ];

    return order.indexOf(to) >= order.indexOf(from);
  }
}
