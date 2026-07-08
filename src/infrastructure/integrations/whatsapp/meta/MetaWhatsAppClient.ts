import { Env } from "../../../config/env.js";


type sendTemplatePayload = {
  toWaId: string
  templateName: string
  languageCode: string
  bodyParameters: string[]
}

export class MetaWhatsAppClient {

  private readonly endpoint: string = `https://graph.facebook.com/v21.0/${Env.metaWhatsAppPhoneNumberId}/messages`;

  public async sendText(toWaId: string, text: string): Promise<{ id: string | null }> {


    const response = await fetch(this.endpoint, {
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

  public async sendTemplate(payload: sendTemplatePayload): Promise<{ id: string | null }> {
    const {
      toWaId,
      templateName,
      languageCode,
      bodyParameters,
    } = payload

    const body = {
      messaging_product: "whatsapp",
      to: toWaId,
      type: "template",
      template: {
        name: templateName,
        language: {
          policy: "deterministic",
          code:languageCode
        },
        components: [
          {
            type: "body",
            parameters: bodyParameters.map((text) => ({
              type: "text",
              text
            }))
          }
        ]
      }
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Env.metaWhatsAppToken}`
      },
      body: JSON.stringify(body),
    })

    const data = await response.json() as { messages: Array<{ id: string, }>; error?: { message: string } }

    if (!response.ok) {
      throw new Error(data.error?.message ?? "Error enviando template de WhatsApp");
    }

    return { id: data.messages?.[0]?.id ?? null };
  }
}
