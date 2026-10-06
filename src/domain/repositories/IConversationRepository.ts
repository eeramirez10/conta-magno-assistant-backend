
import { Conversation } from "../entities/Conversation.js";
import { ConversationStage } from "../enums/ConversationStage.js";
import { ConversationStatus } from "../enums/ConversationStatus.js";

export interface IConversationRepository {
  getActiveByContactId(contactId: string): Promise<Conversation | null>;
  createOpen(contactId: string, provider: string): Promise<Conversation>;
  updateStage(conversationId: string, stage: ConversationStage): Promise<Conversation>;
  updateStageUnlessHumanControls(conversationId: string, stage: ConversationStage): Promise<Conversation>;
  setOpenAiConversationId(conversationId: string, openAiConversationId: string): Promise<Conversation>;
  listByContactId(contactId: string): Promise<Conversation[]>;
  list(limit?: number): Promise<Conversation[]>;
  findById(id: string): Promise<Conversation | null>;
  updateStatus(conversationId: string, status: ConversationStatus): Promise<Conversation>
}
