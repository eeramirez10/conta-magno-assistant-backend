import dotenv from "dotenv";

dotenv.config();

export class Env {
  private static toInt(rawValue: string | undefined, fallback: number): number {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  public static readonly port: number = Number(process.env.PORT || 4000);
  public static readonly databaseUrl: string = process.env.DATABASE_URL || "";
  public static readonly openAiApiKey: string = process.env.OPENAI_API_KEY || "";
  public static readonly openAiAssistantId: string = process.env.OPENAI_ASSISTANT_ID || "";
  public static readonly openAiAssistantName: string = process.env.OPENAI_ASSISTANT_NAME || "Conta Magno AI Advisor";
  public static readonly openAiAssistantModel: string = process.env.OPENAI_ASSISTANT_MODEL || "gpt-4o-mini";
  public static readonly metaWhatsAppToken: string = process.env.META_WHATSAPP_TOKEN || "";
  public static readonly metaWhatsAppPhoneNumberId: string = process.env.META_WHATSAPP_PHONE_NUMBER_ID || "";
  public static readonly metaWebhookVerifyToken: string = process.env.META_WEBHOOK_VERIFY_TOKEN || "";
  public static readonly twilioAccountSid: string = process.env.TWILIO_ACCOUNT_SID || "";
  public static readonly twilioAuthToken: string = process.env.TWILIO_AUTH_TOKEN || "";
  public static readonly twilioWhatsAppFrom: string = process.env.TWILIO_WHATSAPP_FROM || "";
  public static readonly adminWhatsAppTo: string = process.env.ADMIN_WHATSAPP_TO || "";
  public static readonly adminEmailTo: string = process.env.ADMIN_EMAIL_TO || "";
  public static readonly smtpHost: string = process.env.SMTP_HOST || "";
  public static readonly smtpPort: number = Number(process.env.SMTP_PORT || 587);
  public static readonly smtpSecure: boolean = (process.env.SMTP_SECURE || "false") === "true";
  public static readonly smtpUser: string = process.env.SMTP_USER || "";
  public static readonly smtpPass: string = process.env.SMTP_PASS || "";
  public static readonly smtpFrom: string = process.env.SMTP_FROM || "Conta Magno <no-reply@contamagno.com>";
  public static readonly assistantQueueWindowMs: number = Math.max(0, Env.toInt(process.env.ASSISTANT_QUEUE_WINDOW_MS, 8000));
}
