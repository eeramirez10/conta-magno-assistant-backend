import { TwilioWhatsAppClient } from "../../integrations/whatsapp/twilio/TwilioWhatsAppClient.js";
import { IWhatsAppProvider, UnifiedIncomingMessage } from "./IWhatsAppProvider.js";

export class TwilioWhatsAppProviderAdapter implements IWhatsAppProvider {
  constructor(private readonly client: TwilioWhatsAppClient) {}

  public parseIncoming(payload: unknown): UnifiedIncomingMessage | null {
    const body = payload as Record<string, string>;
    const numMedia = Number(body?.NumMedia ?? "0");
    if (!body?.From || (!body?.Body && numMedia === 0)) {
      return null;
    }

    const mediaContentType = body.MediaContentType0 ?? "";
    const messageType =
      numMedia > 0
        ? this.mapMediaContentTypeToMessageType(mediaContentType)
        : "text";

    return {
      provider: "TWILIO",
      waId: body.From.replace(/^whatsapp:/, ""),
      providerMessageId: body.MessageSid || null,
      text: body.Body ?? "",
      rawPayload: payload,
      messageType
    };
  }

  public async sendTextMessage(toWaId: string, text: string): Promise<{ providerMessageId: string | null }> {
    const sent = await this.client.sendText(toWaId, text);
    return { providerMessageId: sent.sid };
  }

  private mapMediaContentTypeToMessageType(mediaContentType: string): string {
    if (mediaContentType.startsWith("audio/")) {
      return "audio";
    }
    if (mediaContentType.startsWith("image/")) {
      return "image";
    }
    if (mediaContentType.startsWith("video/")) {
      return "video";
    }
    if (mediaContentType.startsWith("application/")) {
      return "document";
    }

    return "media";
  }
}
