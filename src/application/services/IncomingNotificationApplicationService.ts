import { IIncomingNotificationRepository, IncomingNotificationSettings } from "../../domain/repositories/IIncomingNotificationRepository.js";
import { Env } from "../../infrastructure/config/env.js";
import { MetaWhatsAppClient, MetaWhatsAppTemplateError } from "../../infrastructure/integrations/whatsapp/meta/MetaWhatsAppClient.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { normalizeNotificationPhone } from "../dtos/request/notifications/IncomingNotificationSettingsRequestDTO.js";

export type IncomingNotificationPayload = { messageId: string; senderWaId: string; senderName: string };
export type NotificationTestResult = { recipient: string; accepted: boolean; error?: string };
export type IncomingMessageTemplate = { name: string; languageCode: string };

export class IncomingNotificationApplicationService {
  constructor(
    private readonly repository: IIncomingNotificationRepository,
    private readonly metaClient: Pick<MetaWhatsAppClient, "sendTemplate">,
    private readonly isMetaConfigured: () => boolean = () => Boolean(Env.metaWhatsAppToken && Env.metaWhatsAppPhoneNumberId),
    private readonly incomingMessageTemplate: () => IncomingMessageTemplate = () => ({
      name: Env.metaIncomingMessageTemplateName, languageCode: Env.metaIncomingMessageTemplateLang
    })
  ) {}

  public getSettings(): Promise<IncomingNotificationSettings> { return this.repository.getSettings(); }
  public saveSettings(settings: IncomingNotificationSettings): Promise<IncomingNotificationSettings> { return this.repository.saveSettings(settings); }
  public canSend(): boolean {
    const template = this.incomingMessageTemplate();
    return this.isMetaConfigured() && /^[a-z0-9_]{1,512}$/.test(template.name) && /^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(template.languageCode);
  }

  public async notifyMessage(payload: IncomingNotificationPayload): Promise<void> {
    // Notification failures must never interrupt storage, human attention or the assistant.
    try {
      const settings = await this.getSettings();
      if (!settings.recipients.length) return;
      if (!this.canSend()) throw new Error("Meta WhatsApp no está configurado");
      const sender = normalizeNotificationPhone(payload.senderWaId);
      const recipients = settings.recipients.filter((recipient) => recipient !== sender);
      if (!recipients.length) return;
      if (!await this.repository.claimCycleForMessage(payload.messageId)) return;
      const bodyParameters = [this.templateValue(payload.senderName, "Contacto de WhatsApp"), `+${sender}`];
      const results = await Promise.allSettled(recipients.map(async (recipient) => {
        const deliveryId = await this.repository.claimDelivery(payload.messageId, recipient);
        if (!deliveryId) return;
        let providerMessageId: string;
        try {
          providerMessageId = await this.send(recipient, bodyParameters);
        } catch (error) {
          await this.repository.markFailed(deliveryId);
          logger.warn({ messageId: payload.messageId, deliveryId, errorType: error instanceof Error ? error.name : "Unknown",
            ...(error instanceof MetaWhatsAppTemplateError ? { metaStatus: error.status, metaCode: error.code } : {})
          }, "Incoming WhatsApp notification failed");
          return;
        }
        // If this update fails, leave the claim intact: never resend a message accepted by Meta.
        await this.repository.markSent(deliveryId, providerMessageId);
      }));
      for (const result of results) {
        if (result.status === "rejected") logger.error({ messageId: payload.messageId }, "Could not record incoming WhatsApp notification");
      }
    } catch (error) {
      logger.error({ messageId: payload.messageId, errorType: error instanceof Error ? error.name : "Unknown" }, "Incoming WhatsApp notification unavailable");
    }
  }

  public async testSavedSettings(): Promise<NotificationTestResult[]> {
    const settings = await this.getSettings();
    if (!this.canSend()) throw new Error("Revisa las credenciales de Meta y las variables META_INCOMING_MESSAGE_TEMPLATE_NAME y META_INCOMING_MESSAGE_TEMPLATE_LANG en el backend");
    if (!settings.recipients.length) throw new Error("Guarda al menos un número destinatario antes de enviar la prueba");
    return Promise.all(settings.recipients.map(async (recipient) => {
      try {
        await this.send(recipient, ["Contacto de prueba", "+525555555555"]);
        return { recipient, accepted: true };
      } catch (error) {
        const code = error instanceof MetaWhatsAppTemplateError && error.code ? ` (código ${error.code})` : "";
        return { recipient, accepted: false, error: `Meta no aceptó el envío${code}. Revisa la plantilla aprobada, el idioma y el número destinatario.` };
      }
    }));
  }

  private async send(recipient: string, bodyParameters: string[]): Promise<string> {
    const template = this.incomingMessageTemplate();
    const sent = await this.metaClient.sendTemplate({ toWaId: recipient, templateName: template.name,
      languageCode: template.languageCode, bodyParameters });
    if (!sent.id) throw new Error("Meta no devolvió un ID de mensaje");
    return sent.id;
  }

  private templateValue(value: string, fallback: string): string {
    return value.replace(/\s+/g, " ").trim().slice(0, 200) || fallback;
  }
}
