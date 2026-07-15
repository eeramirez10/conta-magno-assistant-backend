export type RealtimeMessage = {
  id: string
  direction: 'IN' | 'OUT'
  text: string
  createdAt: string
}

export type MessageCreatedEvent = {
  conversationId: string
  message: RealtimeMessage
}

export type ConversationUpdatedEvent = {
  conversationId: string
}

export interface ServerToClientEvents {
  'message:created': (event: MessageCreatedEvent) => void
  'conversation:updated': (event: ConversationUpdatedEvent) => void
}

export interface ClientToServerEvents {
  'conversation:join': (conversationId: string) => void
  'conversation:leave': (conversationId: string) => void
}

export interface SocketData {
  adminUser: {
    id: string
    username: string
  }
}
