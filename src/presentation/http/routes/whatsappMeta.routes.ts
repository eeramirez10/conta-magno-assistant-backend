import { Router } from "express";
import { WhatsAppMetaWebhookController } from "../controllers/WhatsAppMetaWebhookController.js";

export function buildWhatsAppMetaRouter(controller: WhatsAppMetaWebhookController): Router {
  const router = Router();

  router.get("/webhooks/whatsapp/meta", (req, res) => controller.verify(req, res));
  router.post("/webhooks/whatsapp/meta", (req, res, next) => {
    controller.handle(req, res).catch(next);
  });

  return router;
}
