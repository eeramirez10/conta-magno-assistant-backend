export type UnifiedIncomingMessage = {
  provider: "META" | "TWILIO";
  waId: string;
  providerMessageId: string | null;
  text: string;
  rawPayload: unknown;
  messageType?: string;
};

export interface IWhatsAppProvider {
  parseIncoming(payload: unknown): UnifiedIncomingMessage | null;
  sendTextMessage(toWaId: string, text: string): Promise<{ providerMessageId: string | null }>;
}
