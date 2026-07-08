import { NotificationEventType } from "../enums/NotificationEventType.js";

export class NotificationEvent {
  constructor(
    public readonly id: string,
    public readonly inquiryId: string,
    public readonly eventType: NotificationEventType,
    public readonly channel: "EMAIL" | "WHATSAPP",
    public payload: Record<string, unknown>,
    public sentAt: Date | null,
    public createdAt: Date
  ) {}
}
