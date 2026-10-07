export type IncomingNotificationSettings = {
  recipients: string[];
};

export const defaultIncomingNotificationSettings: IncomingNotificationSettings = {
  recipients: []
};

export interface IIncomingNotificationRepository {
  getSettings(): Promise<IncomingNotificationSettings>;
  saveSettings(settings: IncomingNotificationSettings): Promise<IncomingNotificationSettings>;
  claimCycleForMessage(messageId: string): Promise<boolean>;
  claimDelivery(messageId: string, recipient: string): Promise<string | null>;
  markSent(id: string, providerMessageId: string): Promise<void>;
  markFailed(id: string): Promise<void>;
}
