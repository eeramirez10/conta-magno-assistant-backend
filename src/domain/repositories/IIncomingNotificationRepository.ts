export type IncomingNotificationSettings = {
  enabled: boolean;
  recipients: string[];
  templateName: string;
  languageCode: string;
  templateMode: "INCOMING_MESSAGE" | "OWNER_LEAD";
};

export const defaultIncomingNotificationSettings: IncomingNotificationSettings = {
  enabled: false,
  recipients: [],
  templateName: "aviso_mensaje_recibido",
  languageCode: "es_MX",
  templateMode: "INCOMING_MESSAGE"
};

export type IncomingLeadTemplateData = {
  folio: string | null;
  fullName: string;
  phoneE164: string;
  email: string | null;
  mainNeed: string | null;
  recommendedPlan: string | null;
};

export interface IIncomingNotificationRepository {
  getSettings(): Promise<IncomingNotificationSettings>;
  saveSettings(settings: IncomingNotificationSettings): Promise<IncomingNotificationSettings>;
  claimCycleForMessage(messageId: string): Promise<IncomingLeadTemplateData | null>;
  claimDelivery(messageId: string, recipient: string): Promise<string | null>;
  markSent(id: string, providerMessageId: string): Promise<void>;
  markFailed(id: string): Promise<void>;
}
