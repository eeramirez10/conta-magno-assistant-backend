import { Request, Response } from "express";
import { TwilioIncomingMessageRequestDTO } from "../../../application/dtos/request/whatsapp/TwilioIncomingMessageRequestDTO.js";
import { AssistantOrchestratorService } from "../../../application/services/AssistantOrchestratorService.js";
import { IWhatsAppProvider } from "../../../infrastructure/adapters/messaging/IWhatsAppProvider.js";

export class WhatsAppTwilioWebhookController {
  constructor(
    private readonly provider: IWhatsAppProvider,
    private readonly orchestratorService: AssistantOrchestratorService
  ) {}

  public async handle(req: Request, res: Response): Promise<void> {
    const [error, dto] = TwilioIncomingMessageRequestDTO.validate(req.body);
    if (error || !dto) {
      res.status(400).json({ ok: false, message: error ?? "Payload inválido" });
      return;
    }

    const incoming = this.provider.parseIncoming(dto.payload);
    if (!incoming) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const result = await this.orchestratorService.processIncoming(this.provider, incoming);
    res.status(200).json(result);
  }
}
