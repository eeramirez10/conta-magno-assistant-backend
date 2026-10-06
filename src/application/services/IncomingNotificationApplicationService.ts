import { IIncomingNotificationRepository, IncomingNotificationSettings, IncomingLeadTemplateData } from "../../domain/repositories/IIncomingNotificationRepository.js";
import { Env } from "../../infrastructure/config/env.js";
import { MetaWhatsAppClient, MetaWhatsAppTemplateError } from "../../infrastructure/integrations/whatsapp/meta/MetaWhatsAppClient.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { normalizeNotificationPhone } from "../dtos/request/notifications/IncomingNotificationSettingsRequestDTO.js";

export type IncomingNotificationPayload = { messageId: string; senderWaId: string; senderName: string };
export type NotificationTestResult = { recipient: string; accepted: boolean; error?: string };
export type OwnerLeadTemplate = { name: string; languageCode: string };

export class IncomingNotificationApplicationService {
  constructor(
    private readonly repository: IIncomingNotificationRepository,
    private readonly metaClient: Pick<MetaWhatsAppClient, "sendTemplate">,
    private readonly isMetaConfigured: () => boolean = () => Boolean(Env.metaWhatsAppToken && Env.metaWhatsAppPhoneNumberId),
    private readonly ownerLeadTemplate: () => OwnerLeadTemplate | null = () => Env.metaOwnerLeadTemplateName
      ? { name: Env.metaOwnerLeadTemplateName, languageCode: Env.metaOwnerLeadTemplateLang } : null
  ) {}

  public getSettings(): Promise<IncomingNotificationSettings> { return this.repository.getSettings(); }
  public saveSettings(settings: IncomingNotificationSettings): Promise<IncomingNotificationSettings> { return this.repository.saveSettings(settings); }
  public canSend(): boolean { return this.isMetaConfigured(); }
  public getOwnerLeadTemplate(): OwnerLeadTemplate | null { return this.ownerLeadTemplate(); }

  public async notifyMessage(payload: IncomingNotificationPayload): Promise<void> {
    // Notification failures must never interrupt storage, human attention or the assistant.
    try {
      const settings = await this.getSettings();
      if (!settings.enabled) return;
      if (!this.canSend()) throw new Error("Meta WhatsApp no está configurado");
      const sender = normalizeNotificationPhone(payload.senderWaId);
      const recipients = settings.recipients.filter((recipient) => recipient !== sender);
      if (!recipients.length) return;
      if (settings.templateMode === "OWNER_LEAD" && !this.getOwnerLeadTemplate()) throw new Error("La plantilla de solicitudes no está configurada");
      const lead = await this.repository.claimCycleForMessage(payload.messageId);
      if (!lead) return;
      const bodyParameters = settings.templateMode === "OWNER_LEAD" ? this.leadParameters(lead)
        : [this.templateValue(payload.senderName, "Contacto de WhatsApp"), `+${sender}`];
      const results = await Promise.allSettled(recipients.map(async (recipient) => {
        const deliveryId = await this.repository.claimDelivery(payload.messageId, recipient);
        if (!deliveryId) return;
        let providerMessageId: string;
        try {
          providerMessageId = await this.send(settings, recipient, bodyParameters);
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
    if (!this.canSend()) throw new Error("Configura META_WHATSAPP_TOKEN y META_WHATSAPP_PHONE_NUMBER_ID en el backend");
    if (!settings.recipients.length) throw new Error("Guarda al menos un número destinatario antes de enviar la prueba");
    return Promise.all(settings.recipients.map(async (recipient) => {
      try {
        const bodyParameters = settings.templateMode === "OWNER_LEAD"
          ? this.leadParameters({ folio: null, fullName: "Contacto de prueba", phoneE164: "+525555555555", email: null, mainNeed: null, recommendedPlan: null })
          : ["Contacto de prueba", "+525555555555"];
        await this.send(settings, recipient, bodyParameters);
        return { recipient, accepted: true };
      } catch (error) {
        const code = error instanceof MetaWhatsAppTemplateError && error.code ? ` (código ${error.code})` : "";
        return { recipient, accepted: false, error: `Meta no aceptó el envío${code}. Revisa la plantilla aprobada, el idioma y el número destinatario.` };
      }
    }));
  }

  private async send(settings: IncomingNotificationSettings, recipient: string, bodyParameters: string[]): Promise<string> {
    const ownerTemplate = settings.templateMode === "OWNER_LEAD" ? this.getOwnerLeadTemplate() : null;
    if (settings.templateMode === "OWNER_LEAD" && !ownerTemplate) throw new Error("La plantilla de solicitudes no está configurada");
    const sent = await this.metaClient.sendTemplate({ toWaId: recipient, templateName: ownerTemplate?.name ?? settings.templateName,
      languageCode: ownerTemplate?.languageCode ?? settings.languageCode, bodyParameters });
    if (!sent.id) throw new Error("Meta no devolvió un ID de mensaje");
    return sent.id;
  }

  private leadParameters(lead: IncomingLeadTemplateData): string[] {
    return [this.templateValue(lead.folio ?? "", "Primer contacto"), this.templateValue(lead.fullName, "Contacto de WhatsApp"),
      this.templateValue(lead.phoneE164, "Pendiente"), this.templateValue(lead.email ?? "", "Pendiente"),
      this.templateValue(lead.mainNeed ?? "", "Pendiente"), this.templateValue(lead.recommendedPlan ?? "", "Pendiente")];
  }

  private templateValue(value: string, fallback: string): string {
    return value.replace(/\s+/g, " ").trim().slice(0, 200) || fallback;
  }
}
