import { MetaWhatsAppClient } from "../../integrations/whatsapp/meta/MetaWhatsAppClient.js";
import { IWhatsAppProvider, UnifiedIncomingMessage } from "./IWhatsAppProvider.js";

export class MetaWhatsAppProviderAdapter implements IWhatsAppProvider {
  constructor(private readonly client: MetaWhatsAppClient) {}

  public parseIncoming(payload: unknown): UnifiedIncomingMessage | null {
    const body = payload as any;
    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) {
      return null;
    }

    return {
      provider: "META",
      waId: message.from,
      providerMessageId: message.id ?? null,
      text: message.text?.body ?? "",
      rawPayload: payload
    };
  }

  public async sendTextMessage(toWaId: string, text: string): Promise<{ providerMessageId: string | null }> {
    const sent = await this.client.sendText(toWaId, text);
    return { providerMessageId: sent.id };
  }
}
