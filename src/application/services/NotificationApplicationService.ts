import { NotificationEventType } from "../../domain/enums/NotificationEventType.js";
import { INotificationRepository } from "../../domain/repositories/INotificationRepository.js";
import { Env } from "../../infrastructure/config/env.js";
import { EmailClient } from "../../infrastructure/integrations/email/EmailClient.js";
import { TwilioWhatsAppClient } from "../../infrastructure/integrations/whatsapp/twilio/TwilioWhatsAppClient.js";
import { logger } from "../../infrastructure/logging/logger.js";

export class NotificationApplicationService {
  constructor(
    private readonly notificationRepository: INotificationRepository,
    private readonly emailClient: EmailClient,
    private readonly twilioClient: TwilioWhatsAppClient
  ) {}

  public async notifyLeadCreated(payload: {
    inquiryId: string;
    folio: string;
    contactPhone: string;
    mainNeed: string | null;
  }): Promise<void> {
    const message = `Nuevo lead ${payload.folio}. Tel: ${payload.contactPhone}. Necesidad: ${payload.mainNeed ?? "pendiente"}.`;
    await this.dispatch(NotificationEventType.LEAD_CREATED, payload.inquiryId, message);
  }

  public async notifyLeadUpdated(payload: {
    inquiryId: string;
    folio: string;
    summary: string;
  }): Promise<void> {
    const message = `Lead actualizado ${payload.folio}. ${payload.summary}`;
    await this.dispatch(NotificationEventType.LEAD_UPDATED, payload.inquiryId, message);
  }

  public async notifyAppointmentRequested(payload: {
    inquiryId: string;
    folio: string;
    slotText: string;
  }): Promise<void> {
    const message = `Cita solicitada ${payload.folio}: ${payload.slotText}. Enviar link de video llamada.`;
    await this.dispatch(NotificationEventType.APPOINTMENT_REQUESTED, payload.inquiryId, message);
  }

  private async dispatch(eventType: NotificationEventType, inquiryId: string, text: string): Promise<void> {
    const waEvent = await this.notificationRepository.create({
      inquiryId,
      eventType,
      channel: "WHATSAPP",
      payload: { text }
    });

    try {
      if (Env.adminWhatsAppTo) {
        await this.twilioClient.sendText(Env.adminWhatsAppTo, text);
      }
      await this.notificationRepository.markSent(waEvent.id);
    } catch (error) {
      logger.error({ error }, "Error enviando notificación WhatsApp");
    }

    const emailEvent = await this.notificationRepository.create({
      inquiryId,
      eventType,
      channel: "EMAIL",
      payload: { text }
    });

    try {
      const sent = await this.emailClient.sendLeadNotification(
        `[Conta Magno] ${eventType}`,
        `<p>${text}</p>`,
        Env.adminEmailTo
      );
      if (sent) {
        await this.notificationRepository.markSent(emailEvent.id);
      }
    } catch (error) {
      logger.error({ error }, "Error enviando notificación email");
    }
  }
}
