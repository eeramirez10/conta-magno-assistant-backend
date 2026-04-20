import { Env } from "../../../config/env.js";

export class MetaWhatsAppClient {
  public async sendText(toWaId: string, text: string): Promise<{ id: string | null }> {
    const endpoint = `https://graph.facebook.com/v21.0/${Env.metaWhatsAppPhoneNumberId}/messages`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Env.metaWhatsAppToken}`
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toWaId,
        type: "text",
        text: { body: text }
      })
    });

    const data = (await response.json()) as { messages?: Array<{ id: string }> };
    return { id: data.messages?.[0]?.id ?? null };
  }
}
