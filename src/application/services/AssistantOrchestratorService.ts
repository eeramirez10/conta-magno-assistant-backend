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

type PendingIncomingItem = {
  provider: IWhatsAppProvider;
  incoming: UnifiedIncomingMessage;
};

type ConversationQueueState = {
  isProcessing: boolean;
  pending: PendingIncomingItem[];
};

export class AssistantOrchestratorService {
  private static readonly queueByConversationId = new Map<string, ConversationQueueState>();

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
    const conversation = await this.conversationService.createOrGetActive(contact.id, incoming.provider);
    const queue = this.getQueueState(conversation.id);

    queue.pending.push({ provider, incoming });

    if (queue.isProcessing) {
      return { ok: true, replyText: "queued_while_busy", folio: "QUEUED" };
    }

    queue.isProcessing = true;
    let firstResult: { ok: boolean; replyText: string; folio: string } | null = null;

    try {
      while (queue.pending.length > 0) {
        await this.waitForQueueWindow();
        const currentBatch = queue.pending.splice(0);
        if (currentBatch.length === 0) {
          continue;
        }

        const batchResult = await this.processBatch(conversation.id, contact.id, currentBatch);
        if (!firstResult) {
          firstResult = batchResult;
        }
      }
    } finally {
      queue.isProcessing = false;
      if (queue.pending.length === 0) {
        AssistantOrchestratorService.queueByConversationId.delete(conversation.id);
      }
    }

    return firstResult ?? { ok: true, replyText: "duplicate_ignored", folio: "DUPLICATE" };
  }

  private async processBatch(
    conversationId: string,
    contactId: string,
    batch: PendingIncomingItem[]
  ): Promise<{ ok: boolean; replyText: string; folio: string }> {
    let conversation = await this.conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Conversación no encontrada");
    }

    let contact = await this.contactService.getById(contactId);
    if (!contact) {
      throw new Error("Contacto no encontrado");
    }

    const acceptedBatch: PendingIncomingItem[] = [];
    for (const item of batch) {
      if (item.incoming.providerMessageId) {
        const existing = await this.conversationService.findMessageByProviderMessageId(item.incoming.providerMessageId);
        if (existing) {
          continue;
        }
      }

      await this.conversationService.addInboundMessage({
        conversationId: conversation.id,
        providerMessageId: item.incoming.providerMessageId,
        text: item.incoming.text,
        rawPayload: item.incoming.rawPayload
      });
      acceptedBatch.push(item);
    }

    if (acceptedBatch.length === 0) {
      return { ok: true, replyText: "duplicate_ignored", folio: "DUPLICATE" };
    }

    const latestItem = acceptedBatch[acceptedBatch.length - 1];

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

    const toolContext = {
      waId: latestItem.incoming.waId,
      contactId: contact.id,
      conversationId: conversation.id,
      inquiryId: inquiry.id,
      folio: inquiry.folio
    };

    const assistantResult = await this.assistantClient.runAssistant({
      assistantId: Env.openAiAssistantId,
      threadId: conversation.assistantThreadId,
      prompt: contaMagnoAssistantPrompt,
      contextJson,
      onToolCall: async (toolCall) => this.toolRouterService.executeNativeTool(toolCall, toolContext)
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
        const updatedContact = await this.contactService.upsert(dto);
        contact = updatedContact;
      }
    }

    const combinedInboundText = acceptedBatch.map((item) => item.incoming.text).join("\n");
    const inferredClientType = extracted.clientType ?? this.inferClientTypeFromMessage(combinedInboundText);

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
      const legacyResults = await this.toolRouterService.executeMany(assistantResult.output.toolCalls, toolContext);
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
    const sent = await latestItem.provider.sendTextMessage(latestItem.incoming.waId, replyText);

    await this.conversationService.addOutboundMessage({
      conversationId: conversation.id,
      providerMessageId: sent.providerMessageId,
      text: replyText,
      rawPayload: {
        provider: latestItem.incoming.provider,
        toolResults,
        batchSize: acceptedBatch.length
      }
    });

    return {
      ok: true,
      replyText,
      folio: inquiry.folio
    };
  }

  private getQueueState(conversationId: string): ConversationQueueState {
    const existing = AssistantOrchestratorService.queueByConversationId.get(conversationId);
    if (existing) {
      return existing;
    }

    const created: ConversationQueueState = {
      isProcessing: false,
      pending: []
    };
    AssistantOrchestratorService.queueByConversationId.set(conversationId, created);
    return created;
  }

  private async waitForQueueWindow(): Promise<void> {
    const queueWindowMs = Env.assistantQueueWindowMs;
    if (queueWindowMs <= 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, queueWindowMs));
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
