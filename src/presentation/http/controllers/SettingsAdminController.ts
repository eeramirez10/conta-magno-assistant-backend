import { Request, Response } from "express";
import { IncomingNotificationSettingsRequestDTO } from "../../../application/dtos/request/notifications/IncomingNotificationSettingsRequestDTO.js";
import { IncomingNotificationApplicationService } from "../../../application/services/IncomingNotificationApplicationService.js";

export class SettingsAdminController {
  constructor(private readonly notifications: IncomingNotificationApplicationService) {}

  public async get(_req: Request, res: Response): Promise<void> {
    res.json({ data: await this.notifications.getSettings(), metaConfigured: this.notifications.canSend() });
  }

  public async update(req: Request, res: Response): Promise<void> {
    const [error, settings] = IncomingNotificationSettingsRequestDTO.validate(req.body);
    if (error || !settings) { res.status(400).json({ message: error }); return; }
    res.json({ data: await this.notifications.saveSettings(settings), metaConfigured: this.notifications.canSend() });
  }

  public async test(req: Request, res: Response): Promise<void> {
    if (!this.notifications.canSend()) { res.status(400).json({ message: "Meta WhatsApp no está configurado en el backend" }); return; }
    const settings = await this.notifications.getSettings();
    if (!settings.recipients.length) { res.status(400).json({ message: "Guarda al menos un destinatario antes de enviar una prueba" }); return; }
    res.json({ results: await this.notifications.testSavedSettings() });
  }
}
