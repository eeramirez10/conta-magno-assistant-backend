
import { Conversation } from "../entities/Conversation.js";
import { ConversationStage } from "../enums/ConversationStage.js";
import { ConversationStatus } from "../enums/ConversationStatus.js";

export interface IConversationRepository {
  getActiveByContactId(contactId: string): Promise<Conversation | null>;
  createOpen(contactId: string, provider: string): Promise<Conversation>;
  updateStage(conversationId: string, stage: ConversationStage): Promise<Conversation>;
  setAssistantThreadId(conversationId: string, assistantThreadId: string): Promise<Conversation>;
  list(limit?: number): Promise<Conversation[]>;
  findById(id: string): Promise<Conversation | null>;
  updateStatus(conversationId: string, status: ConversationStatus): Promise<Conversation>
}
