import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'

import { AuthApplicationService } from '../../application/services/AuthApplicationService.js'
import { Env } from '../config/env.js'
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from './realtimeEvents.js'

export type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=')
    if (separatorIndex < 0) continue

    const cookieName = cookie.slice(0, separatorIndex).trim()
    if (cookieName !== name) continue

    return decodeURIComponent(cookie.slice(separatorIndex + 1).trim())
  }

  return null
}

function conversationRoom(conversationId: string): string | null {
  const normalizedId = conversationId.trim()
  return /^[a-zA-Z0-9_-]{1,100}$/.test(normalizedId)
    ? `conversation:${normalizedId}`
    : null
}

export function buildRealtimeServer(
  httpServer: HttpServer,
  authService: AuthApplicationService,
): RealtimeServer {
  const io: RealtimeServer = new Server(httpServer, {
    cors: {
      origin: Env.frontendOrigin,
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    const token = readCookie(socket.handshake.headers.cookie, Env.authCookieName)
    if (!token) {
      next(new Error('Sesión no autenticada'))
      return
    }

    const adminUser = await authService.getAuthenticatedUser(token)
    if (!adminUser) {
      next(new Error('Sesión inválida o expirada'))
      return
    }

    socket.data.adminUser = adminUser
    next()
  })

  io.on('connection', (socket) => {
    void socket.join('admins')

    socket.on('conversation:join', (conversationId) => {
      const room = conversationRoom(conversationId)
      if (room) void socket.join(room)
    })

    socket.on('conversation:leave', (conversationId) => {
      const room = conversationRoom(conversationId)
      if (room) void socket.leave(room)
    })
  })

  return io
}
