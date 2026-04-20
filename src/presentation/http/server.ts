import cors from "cors";
import express, { Request, Response } from "express";
import pinoHttp from "pino-http";
import { ContactDomainService } from "../../domain/services/ContactDomainService.js";
import { ConversationDomainService } from "../../domain/services/ConversationDomainService.js";
import { InquiryDomainService } from "../../domain/services/InquiryDomainService.js";
import { ContactApplicationService } from "../../application/services/ContactApplicationService.js";
import { ConversationApplicationService } from "../../application/services/ConversationApplicationService.js";
import { InquiryApplicationService } from "../../application/services/InquiryApplicationService.js";
import { NotificationApplicationService } from "../../application/services/NotificationApplicationService.js";
import { AssistantToolRouterService } from "../../application/services/AssistantToolRouterService.js";
import { AssistantOrchestratorService } from "../../application/services/AssistantOrchestratorService.js";
import { MetaWhatsAppProviderAdapter } from "../../infrastructure/adapters/messaging/MetaWhatsAppProviderAdapter.js";
import { TwilioWhatsAppProviderAdapter } from "../../infrastructure/adapters/messaging/TwilioWhatsAppProviderAdapter.js";
import { Env } from "../../infrastructure/config/env.js";
import { EmailClient } from "../../infrastructure/integrations/email/EmailClient.js";
import { AssistantClient } from "../../infrastructure/integrations/openai/AssistantClient.js";
import { MetaWhatsAppClient } from "../../infrastructure/integrations/whatsapp/meta/MetaWhatsAppClient.js";
import { TwilioWhatsAppClient } from "../../infrastructure/integrations/whatsapp/twilio/TwilioWhatsAppClient.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { PrismaAppointmentRepository } from "../../infrastructure/repositories/PrismaAppointmentRepository.js";
import { PrismaContactRepository } from "../../infrastructure/repositories/PrismaContactRepository.js";
import { PrismaConversationRepository } from "../../infrastructure/repositories/PrismaConversationRepository.js";
import { PrismaInquiryRepository } from "../../infrastructure/repositories/PrismaInquiryRepository.js";
import { PrismaMessageRepository } from "../../infrastructure/repositories/PrismaMessageRepository.js";
import { PrismaNotificationRepository } from "../../infrastructure/repositories/PrismaNotificationRepository.js";
import { PrismaSlotRepository } from "../../infrastructure/repositories/PrismaSlotRepository.js";
import { ConversationAdminController } from "./controllers/ConversationAdminController.js";
import { InquiryAdminController } from "./controllers/InquiryAdminController.js";
import { WhatsAppMetaWebhookController } from "./controllers/WhatsAppMetaWebhookController.js";
import { WhatsAppTwilioWebhookController } from "./controllers/WhatsAppTwilioWebhookController.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { buildAdminRouter } from "./routes/admin.routes.js";
import { buildWhatsAppMetaRouter } from "./routes/whatsappMeta.routes.js";
import { buildWhatsAppTwilioRouter } from "./routes/whatsappTwilio.routes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
// app.use(pinoHttp({ logger }));



const contactRepository = new PrismaContactRepository();
const conversationRepository = new PrismaConversationRepository();
const messageRepository = new PrismaMessageRepository();
const inquiryRepository = new PrismaInquiryRepository();
const notificationRepository = new PrismaNotificationRepository();
const slotRepository = new PrismaSlotRepository();
const appointmentRepository = new PrismaAppointmentRepository();

const contactService = new ContactApplicationService(contactRepository, new ContactDomainService());
const conversationService = new ConversationApplicationService(
  conversationRepository,
  messageRepository,
  new ConversationDomainService()
);
const inquiryService = new InquiryApplicationService(
  inquiryRepository,
  slotRepository,
  appointmentRepository,
  new InquiryDomainService()
);
const notificationService = new NotificationApplicationService(
  notificationRepository,
  new EmailClient(),
  new TwilioWhatsAppClient()
);

const toolRouterService = new AssistantToolRouterService(
  contactService,
  conversationService,
  inquiryService,
  notificationService
);

const orchestratorService = new AssistantOrchestratorService(
  new AssistantClient(),
  contactService,
  conversationService,
  inquiryService,
  notificationService,
  toolRouterService
);

const metaController = new WhatsAppMetaWebhookController(
  new MetaWhatsAppProviderAdapter(new MetaWhatsAppClient()),
  orchestratorService
);
const twilioController = new WhatsAppTwilioWebhookController(
  new TwilioWhatsAppProviderAdapter(new TwilioWhatsAppClient()),
  orchestratorService
);
const inquiryController = new InquiryAdminController(inquiryService);
const conversationController = new ConversationAdminController(conversationService, contactService);

app.use(buildWhatsAppMetaRouter(metaController));
app.use(buildWhatsAppTwilioRouter(twilioController));
app.use(buildAdminRouter(inquiryController, conversationController));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "conta-magno-assistant-backend",
    date: new Date().toISOString()
  });
});

app.use(errorHandler);

app.listen(Env.port, () => {
  logger.info({ port: Env.port }, "Assistant backend listening");
});
