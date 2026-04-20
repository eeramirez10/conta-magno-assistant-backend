import { ConversationStage } from "../../domain/enums/ConversationStage.js";
import { InquiryStatus } from "../../domain/enums/InquiryStatus.js";
import { CONTRIBUYENTE_TYPE_OPTIONS } from "../../domain/enums/ContribuyenteType.js";
import { IWhatsAppProvider, UnifiedIncomingMessage } from "../../infrastructure/adapters/messaging/IWhatsAppProvider.js";
import { Env } from "../../infrastructure/config/env.js";
import { AssistantClient } from "../../infrastructure/integrations/openai/AssistantClient.js";
import { contaMagnoAssistantPrompt } from "../prompts/contaMagnoAssistantPrompt.js";
import { CreateOrGetOpenInquiryRequestDTO } from "../dtos/request/tools/CreateOrGetOpenInquiryRequestDTO.js";
import { UpdateConversationStageRequestDTO } from "../dtos/request/tools/UpdateConversationStageRequestDTO.js";
import { UpdateInquiryFieldsRequestDTO } from "../dtos/request/tools/UpdateInquiryFieldsRequestDTO.js";
import { UpsertContactRequestDTO } from "../dtos/request/tools/UpsertContactRequestDTO.js";
import { UpdateInquiryStatusRequestDTO } from "../dtos/request/inquiries/UpdateInquiryStatusRequestDTO.js";
import { ContactApplicationService } from "./ContactApplicationService.js";
import { ConversationApplicationService } from "./ConversationApplicationService.js";
import { InquiryApplicationService } from "./InquiryApplicationService.js";
import { NotificationApplicationService } from "./NotificationApplicationService.js";
import { AssistantToolRouterService } from "./AssistantToolRouterService.js";
import { logger } from "../../infrastructure/logging/logger.js";

export class AssistantOrchestratorService {

  
  private static readonly contribuyenteTypeLabelByCode: Record<string, string> = {
    PF_RESICO: "Persona Física - RESICO",
    PF_ACTIVIDAD_EMPRESARIAL_Y_PROFESIONAL: "Persona Física - Actividad Empresarial y Profesional",
    PF_SUELDOS_Y_SALARIOS: "Persona Física - Sueldos y Salarios",
    PF_ARRENDAMIENTO: "Persona Física - Arrendamiento",
    PF_PLATAFORMAS_TECNOLOGICAS: "Persona Física - Plataformas Tecnológicas/Digitales",
    PF_OTROS_INGRESOS: "Persona Física - Otros ingresos",
    PM_REGIMEN_GENERAL: "Persona Moral - Régimen General",
    PM_RESICO: "Persona Moral - RESICO",
    PM_SIN_FINES_DE_LUCRO: "Persona Moral - Sin fines de lucro",
    NO_LO_SE_AUN: "No lo sé aún",
    NO_INSCRITO_EN_HACIENDA: "No inscrito en Hacienda/SAT (sin RFC)"
  };

  constructor(
    private readonly assistantClient: AssistantClient,
    private readonly contactService: ContactApplicationService,
    private readonly conversationService: ConversationApplicationService,
    private readonly inquiryService: InquiryApplicationService,
    private readonly notificationService: NotificationApplicationService,
    private readonly toolRouterService: AssistantToolRouterService
  ) {}

  public async processIncoming(provider: IWhatsAppProvider, incoming: UnifiedIncomingMessage): Promise<{ ok: boolean; replyText: string; folio: string }> {
    if (!Env.openAiAssistantId) {
      throw new Error("Falta OPENAI_ASSISTANT_ID. Ejecuta: npm run assistant:bootstrap");
    }

    const [upsertContactError, upsertContactDto] = UpsertContactRequestDTO.validate({
      waId: incoming.waId,
      fullName: "Prospecto Conta Magno",
      phoneE164: incoming.waId
    });

    if (upsertContactError || !upsertContactDto) {
      throw new Error(upsertContactError ?? "No se pudo preparar contacto");
    }

    let contact = await this.contactService.upsert(upsertContactDto);
    let conversation = await this.conversationService.createOrGetActive(contact.id, incoming.provider);

    // Meta/Twilio can retry webhook delivery when a previous attempt failed.
    // Ignore already-processed provider message ids to keep the flow idempotent.
    if (incoming.providerMessageId) {
      const existing = await this.conversationService.findMessageByProviderMessageId(incoming.providerMessageId);
      if (existing) {
        return {
          ok: true,
          replyText: "duplicate_ignored",
          folio: "DUPLICATE"
        };
      }
    }

    await this.conversationService.addInboundMessage({
      conversationId: conversation.id,
      providerMessageId: incoming.providerMessageId,
      text: incoming.text,
      rawPayload: incoming.rawPayload
    });

    const [openInquiryError, openInquiryDto] = CreateOrGetOpenInquiryRequestDTO.validate({
      contactId: contact.id,
      conversationId: conversation.id
    });

    if (openInquiryError || !openInquiryDto) {
      throw new Error(openInquiryError ?? "No se pudo preparar inquiry");
    }

    const openInquiryResult = await this.inquiryService.createOrGetOpen(openInquiryDto);
    const inquiry = openInquiryResult.inquiry;

    if (openInquiryResult.created) {
      await this.notificationService.notifyLeadCreated({
        inquiryId: inquiry.id,
        folio: inquiry.folio,
        contactPhone: contact.phoneE164,
        mainNeed: inquiry.mainNeed
      });
    }

    const messages = await this.conversationService.listMessages(conversation.id);

    const contextJson = {
      business: "Conta Magno",
      timezone: "America/Mexico_City",
      goals: ["calificar lead", "recomendar paquete", "agendar video llamada"],
      contact,
      conversation: {
        id: conversation.id,
        stage: conversation.stage,
        status: conversation.status
      },
      inquiry,
      packages: {
        basico: "$800-$1,000",
        intermedio: "$1,200-$1,500",
        premium: "$1,800-$2,500"
      },
      contribuyenteTypes: CONTRIBUYENTE_TYPE_OPTIONS,
      lastMessages: messages.slice(-8).map((m) => ({ direction: m.direction, text: m.text, at: m.createdAt.toISOString() }))
    };

    const assistantResult = await this.assistantClient.runAssistant({
      assistantId: Env.openAiAssistantId,
      threadId: conversation.assistantThreadId,
      prompt: contaMagnoAssistantPrompt,
      contextJson,
      onToolCall: async (toolCall) =>
        this.toolRouterService.executeNativeTool(toolCall, {
          waId: incoming.waId,
          contactId: contact.id,
          conversationId: conversation.id,
          inquiryId: inquiry.id,
          folio: inquiry.folio
        })
    });

    if (!conversation.assistantThreadId) {
      conversation = await this.conversationService.setAssistantThreadId(conversation.id, assistantResult.threadId);
    }

    const extracted = assistantResult.output.extractedFields;

    if (extracted.fullName || extracted.email || extracted.phoneWhatsApp) {
      const [err, dto] = UpsertContactRequestDTO.validate({
        waId: contact.waId,
        fullName: extracted.fullName ?? contact.fullName,
        phoneE164: extracted.phoneWhatsApp ?? contact.phoneE164,
        email: extracted.email ?? contact.email
      });
      if (!err && dto) {
        contact = await this.contactService.upsert(dto);
      }
    }

    const inferredClientType = extracted.clientType ?? this.inferClientTypeFromMessage(incoming.text);

    const [updateFieldsErr, updateFieldsDto] = UpdateInquiryFieldsRequestDTO.validate({
      inquiryId: inquiry.id,
      clientType: inferredClientType,
      specialtyProfile: extracted.specialtyProfile,
      mainNeed: extracted.mainNeed,
      urgency: extracted.urgency,
      budgetRange: extracted.budgetRange,
      recommendedPlan: extracted.recommendedPlan
    });

    if (!updateFieldsErr && updateFieldsDto) {
      await this.inquiryService.updateFields(updateFieldsDto);
    }

    const toolResults = [...assistantResult.toolResults];

    if (assistantResult.output.toolCalls && assistantResult.output.toolCalls.length > 0) {
      const legacyResults = await this.toolRouterService.executeMany(assistantResult.output.toolCalls, {
        waId: incoming.waId,
        contactId: contact.id,
        conversationId: conversation.id,
        inquiryId: inquiry.id,
        folio: inquiry.folio
      });
      toolResults.push(...legacyResults);
    }

    logger.info({ toolResults }, "Assistant tool results");

    const nextStage = this.conversationService.stageFromString(assistantResult.output.nextStage);
    if (nextStage) {
      const [stageErr, stageDto] = UpdateConversationStageRequestDTO.validate({
        conversationId: conversation.id,
        stage: nextStage
      });

      if (!stageErr && stageDto) {
        await this.conversationService.updateStage(stageDto);
      }

      if (nextStage === ConversationStage.COMPLETED) {
        const [statusErr, statusDto] = UpdateInquiryStatusRequestDTO.validate({
          inquiryId: inquiry.id,
          status: InquiryStatus.CLOSED
        });
        if (!statusErr && statusDto) {
          await this.inquiryService.updateStatus(statusDto);
        }
      }

      if (nextStage === ConversationStage.PENDING_HUMAN) {
        await this.notificationService.notifyLeadUpdated({
          inquiryId: inquiry.id,
          folio: inquiry.folio,
          summary: "Escalado a atención humana por complejidad o solicitud explícita."
        });
      }
    }

    const replyText = this.sanitizeAssistantReplyText(assistantResult.output.replyText);
    const sent = await provider.sendTextMessage(incoming.waId, replyText);

    await this.conversationService.addOutboundMessage({
      conversationId: conversation.id,
      providerMessageId: sent.providerMessageId,
      text: replyText,
      rawPayload: {
        provider: incoming.provider,
        toolResults
      }
    });

    return {
      ok: true,
      replyText,
      folio: inquiry.folio
    };
  }

  private sanitizeAssistantReplyText(raw: string): string {
    let text = raw;

    for (const [code, label] of Object.entries(AssistantOrchestratorService.contribuyenteTypeLabelByCode)) {
      const codeWithLabelPattern = new RegExp(`\\b${code}\\b\\s*\\(([^)]*)\\)`, "g");
      text = text.replace(codeWithLabelPattern, label);

      const codeOnlyPattern = new RegExp(`\\b${code}\\b`, "g");
      text = text.replace(codeOnlyPattern, label);
    }

    return text;
  }

  private inferClientTypeFromMessage(text: string): string | undefined {
    const normalized = text
      .trim()
      .toLowerCase()
      .replace(/[áàäâ]/g, "a")
      .replace(/[éèëê]/g, "e")
      .replace(/[íìïî]/g, "i")
      .replace(/[óòöô]/g, "o")
      .replace(/[úùüû]/g, "u");

    const noInscritoSignals = [
      "no estoy dado de alta",
      "aun no estoy dado de alta",
      "todavia no estoy dado de alta",
      "no dado de alta en sat",
      "no dado de alta en hacienda",
      "no estoy en sat",
      "no estoy en hacienda",
      "no tengo rfc",
      "sin rfc"
    ];

    if (noInscritoSignals.some((signal) => normalized.includes(signal))) {
      return "NO_INSCRITO_EN_HACIENDA";
    }

    return undefined;
  }
}
