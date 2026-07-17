import { Router } from "express";
import { ConversationAdminController } from "../controllers/ConversationAdminController.js";
import { InquiryAdminController } from "../controllers/InquiryAdminController.js";
import { NotificationAdminController } from "../controllers/NotificationAdminController.js";
import { requiredAdminAuth } from "../middlewares/requiredAdminAuth.js";
import { AuthApplicationService } from "../../../application/services/AuthApplicationService.js";
import { ContactAdminController } from "../controllers/ContactAdminController.js";

export function buildAdminRouter(
  inquiryController: InquiryAdminController,
  conversationController: ConversationAdminController,
  notificationController: NotificationAdminController,
  contactController: ContactAdminController,
  authService: AuthApplicationService
): Router {
  const router = Router();

  router.use('/api', requiredAdminAuth(authService))

  router.get("/api/inquiries", (req, res, next) => inquiryController.list(req, res).catch(next));
  router.get("/api/inquiries/:id", (req, res, next) => inquiryController.detail(req, res).catch(next));
  router.post("/api/inquiries/:id/status", (req, res, next) => inquiryController.updateStatus(req, res).catch(next));
  router.post("/api/inquiries/:id/notes", (req, res, next) => inquiryController.updateNotes(req, res).catch(next));

  router.get("/api/contacts", (req, res, next) => contactController.list(req, res).catch(next));
  router.delete("/api/contacts/:id", (req, res, next) => contactController.deletePermanently(req, res).catch(next));

  router.get("/api/conversations", (req, res, next) => conversationController.list(req, res).catch(next));
  router.get("/api/conversations/:id", (req, res, next) => conversationController.detail(req, res).catch(next));
  router.post("/api/admin/notifications/test-owner-template", (req, res, next) =>
    notificationController.sendOwnerLeadTemplateTest(req, res).catch(next)
  );

    router.post("/api/conversations/:id/take-control", (req, res, next) =>
    conversationController.takeControl(req, res).catch(next)
  );

  router.post("/api/conversations/:id/release-control", (req, res, next) =>
    conversationController.releaseControl(req, res).catch(next)
  );

  router.post("/api/conversations/:id/messages", (req, res, next) =>
    conversationController.sendMessage(req, res).catch(next)
  );



  return router;
}
