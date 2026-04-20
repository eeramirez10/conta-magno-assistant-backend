import { TwilioWhatsAppClient } from "../../integrations/whatsapp/twilio/TwilioWhatsAppClient.js";
import { IWhatsAppProvider, UnifiedIncomingMessage } from "./IWhatsAppProvider.js";

export class TwilioWhatsAppProviderAdapter implements IWhatsAppProvider {
  constructor(private readonly client: TwilioWhatsAppClient) {}

  public parseIncoming(payload: unknown): UnifiedIncomingMessage | null {
    const body = payload as Record<string, string>;
    if (!body?.From || !body?.Body) {
      return null;
    }

    return {
      provider: "TWILIO",
      waId: body.From.replace(/^whatsapp:/, ""),
      providerMessageId: body.MessageSid || null,
      text: body.Body,
      rawPayload: payload
    };
  }

  public async sendTextMessage(toWaId: string, text: string): Promise<{ providerMessageId: string | null }> {
    const sent = await this.client.sendText(toWaId, text);
    return { providerMessageId: sent.sid };
  }
}
