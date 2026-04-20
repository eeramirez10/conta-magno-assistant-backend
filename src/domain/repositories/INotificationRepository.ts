import { NotificationEvent } from "../entities/NotificationEvent.js";
import { NotificationEventType } from "../enums/NotificationEventType.js";

export interface INotificationRepository {
  create(payload: {
    inquiryId: string;
    eventType: NotificationEventType;
    channel: "EMAIL" | "WHATSAPP";
    payload: Record<string, unknown>;
  }): Promise<NotificationEvent>;
  markSent(id: string): Promise<void>;
}
