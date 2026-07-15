import { Message } from '../../domain/entities/Message.js'

export interface IRealtimePublisher {
  messageCreated(message: Message): void
  conversationUpdated(conversationId: string): void
}
