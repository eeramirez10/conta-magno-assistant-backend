import { Request, Response } from "express";
import { MetaIncomingMessageRequestDTO } from "../../../application/dtos/request/whatsapp/MetaIncomingMessageRequestDTO.js";
import { AssistantOrchestratorService } from "../../../application/services/AssistantOrchestratorService.js";
import { IWhatsAppProvider } from "../../../infrastructure/adapters/messaging/IWhatsAppProvider.js";
import { Env } from "../../../infrastructure/config/env.js";

export class WhatsAppMetaWebhookController {
  constructor(
    private readonly provider: IWhatsAppProvider,
    private readonly orchestratorService: AssistantOrchestratorService
  ) { }

  public verify(req: Request, res: Response): void {
    const mode = req.query["hub.mode"];
    const verifyToken = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && verifyToken === Env.metaWebhookVerifyToken) {
      res.status(200).send(challenge as string);
      return;
    }

    res.status(403).send("Forbidden");
  }

  public async handle(req: Request, res: Response): Promise<void> {
    const [error, dto] = MetaIncomingMessageRequestDTO.validate(req.body);

    const value = (req.body as any)?.entry?.[0]?.changes?.[0]?.value;
    const contact = value?.contacts?.[0];
    const message = value?.messages?.[0];

    if (message) {
      console.log({
        contactName: contact?.profile?.name ?? null,
        contactWaId: contact?.wa_id ?? message?.from ?? null,
        messageText: message?.text?.body ?? "",
        messageType: message?.type ?? null
      });
    }

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
