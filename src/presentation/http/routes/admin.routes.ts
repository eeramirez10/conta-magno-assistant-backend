import { Router } from "express";
import { ConversationAdminController } from "../controllers/ConversationAdminController.js";
import { InquiryAdminController } from "../controllers/InquiryAdminController.js";

export function buildAdminRouter(
  inquiryController: InquiryAdminController,
  conversationController: ConversationAdminController
): Router {
  const router = Router();

  router.get("/api/inquiries", (req, res, next) => inquiryController.list(req, res).catch(next));
  router.get("/api/inquiries/:id", (req, res, next) => inquiryController.detail(req, res).catch(next));
  router.post("/api/inquiries/:id/status", (req, res, next) => inquiryController.updateStatus(req, res).catch(next));
  router.post("/api/inquiries/:id/notes", (req, res, next) => inquiryController.updateNotes(req, res).catch(next));

  router.get("/api/conversations", (req, res, next) => conversationController.list(req, res).catch(next));
  router.get("/api/conversations/:id", (req, res, next) => conversationController.detail(req, res).catch(next));

  return router;
}
