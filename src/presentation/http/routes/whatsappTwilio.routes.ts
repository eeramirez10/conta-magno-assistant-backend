import { Router } from "express";
import { WhatsAppTwilioWebhookController } from "../controllers/WhatsAppTwilioWebhookController.js";

export function buildWhatsAppTwilioRouter(controller: WhatsAppTwilioWebhookController): Router {
  const router = Router();

  router.post("/webhooks/whatsapp/twilio", (req, res, next) => {
    controller.handle(req, res).catch(next);
  });

  return router;
}
