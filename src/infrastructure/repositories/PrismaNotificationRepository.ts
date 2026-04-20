import { NotificationEvent } from "../../domain/entities/NotificationEvent.js";
import { NotificationEventType } from "../../domain/enums/NotificationEventType.js";
import { INotificationRepository } from "../../domain/repositories/INotificationRepository.js";
import { prisma } from "../database/prisma.js";

function mapEvent(row: {
  id: string;
  inquiryId: string;
  eventType: string;
  channel: string;
  payload: unknown;
  sentAt: Date | null;
  createdAt: Date;
}): NotificationEvent {
  return new NotificationEvent(
    row.id,
    row.inquiryId,
    row.eventType as NotificationEventType,
    row.channel as NotificationEvent["channel"],
    row.payload as Record<string, unknown>,
    row.sentAt,
    row.createdAt
  );
}

export class PrismaNotificationRepository implements INotificationRepository {
  public async create(payload: {
    inquiryId: string;
    eventType: NotificationEventType;
    channel: "EMAIL" | "WHATSAPP";
    payload: Record<string, unknown>;
  }): Promise<NotificationEvent> {
    const row = await prisma.notificationEvent.create({
      data: {
        inquiryId: payload.inquiryId,
        eventType: payload.eventType,
        channel: payload.channel,
        payload: payload.payload
      }
    });

    return mapEvent(row);
  }

  public async markSent(id: string): Promise<void> {
    await prisma.notificationEvent.update({
      where: { id },
      data: { sentAt: new Date() }
    });
  }
}
