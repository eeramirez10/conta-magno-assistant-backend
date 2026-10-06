import { Message } from "../entities/Message.js";

export interface IMessageRepository {
  create(payload: {
    conversationId: string;
    direction: "IN" | "OUT";
    providerMessageId?: string | null;
    text: string;
    rawPayload: unknown;
    openAiSyncedAt?: Date;
  }): Promise<Message>;
  markOpenAiSynced(messageIds: string[], at: Date): Promise<void>;
  findByProviderMessageId(providerMessageId: string): Promise<Message | null>;
  listByConversationId(conversationId: string): Promise<Message[]>;
}
