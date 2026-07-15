import { IRealtimePublisher } from '../../application/ports/IRealtimePublisher.js'
import { Message } from '../../domain/entities/Message.js'
import type { RealtimeServer } from './buildRealtimeServer.js'

export class SocketIoRealtimePublisher implements IRealtimePublisher {
  constructor(private readonly io: RealtimeServer) {}

  public messageCreated(message: Message): void {
    this.io.to(`conversation:${message.conversationId}`).emit('message:created', {
      conversationId: message.conversationId,
      message: {
        id: message.id,
        direction: message.direction,
        text: message.text,
        createdAt: message.createdAt.toISOString(),
      },
    })
  }

  public conversationUpdated(conversationId: string): void {
    this.io.to('admins').emit('conversation:updated', { conversationId })
  }
}
