import twilio from "twilio";
import { Env } from "../../../config/env.js";

export class TwilioWhatsAppClient {
  private readonly client = twilio(Env.twilioAccountSid, Env.twilioAuthToken);

  public async sendText(toWaId: string, text: string): Promise<{ sid: string | null }> {
    const to = toWaId.startsWith("whatsapp:") ? toWaId : `whatsapp:${toWaId}`;

    const msg = await this.client.messages.create({
      from: Env.twilioWhatsAppFrom,
      to,
      body: text
    });

    return { sid: msg.sid ?? null };
  }
}
