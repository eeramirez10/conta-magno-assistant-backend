import { NotificationEvent } from "../entities/NotificationEvent.js";
import { NotificationEventType } from "../enums/NotificationEventType.js";

type HasEventPayload = {
  inquiryid: string
  eventType: NotificationEventType
  channel: "EMAIL" | "WHATSAPP"
}

export interface INotificationRepository {
  create(payload: {
    inquiryId: string;
    eventType: NotificationEventType;
    channel: "EMAIL" | "WHATSAPP";
    payload: Record<string, unknown>;
  }): Promise<NotificationEvent>;
  markSent(id: string): Promise<void>;

  hasEvent(payload: HasEventPayload): Promise<boolean>;
}
