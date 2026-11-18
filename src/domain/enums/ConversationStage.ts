export enum ConversationStage {
  GREETING = "GREETING",
  QUALIFYING = "QUALIFYING",
  INFORMATION = "INFORMATION",
  PLAN_RECOMMENDATION = "PLAN_RECOMMENDATION",
  SCHEDULING = "SCHEDULING",
  PENDING_HUMAN = "PENDING_HUMAN",
  COMPLETED = "COMPLETED"
}

// SCHEDULING remains readable for historical records, but is not an active AI stage.
export const ASSISTANT_CONVERSATION_STAGES = Object.values(ConversationStage).filter(
  (stage) => stage !== ConversationStage.SCHEDULING
);
