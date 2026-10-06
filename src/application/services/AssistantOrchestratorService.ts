import { ConversationStage } from "../../domain/enums/ConversationStage.js";
import { InquiryStatus } from "../../domain/enums/InquiryStatus.js";
import { CONTRIBUYENTE_TYPE_OPTIONS } from "../../domain/enums/ContribuyenteType.js";
import { IWhatsAppProvider, UnifiedIncomingMessage } from "../../infrastructure/adapters/messaging/IWhatsAppProvider.js";
import { Env } from "../../infrastructure/config/env.js";
import { ResponsesClient, AssistantTurnStoppedError } from "../../infrastructure/integrations/openai/ResponsesClient.js";
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
import { Inquiry } from "../../domain/entities/Inquiry.js";
import { IncomingNotificationApplicationService } from "./IncomingNotificationApplicationService.js";

type PendingIncomingItem = {
  provider: IWhatsAppProvider;
  incoming: UnifiedIncomingMessage;
  messageId: string;
};

type ConversationQueueState = {
  isProcessing: boolean;
  pending: PendingIncomingItem[];
};

export class AssistantOrchestratorService {
  private static readonly queueByConversationId = new Map<string, ConversationQueueState>();
  private static readonly unsupportedNonTextReply =
    "Por el momento solo puedo recibir mensajes de texto. ¿Podrías enviarme tu mensaje por escrito, por favor?";

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
    private readonly responsesClient: ResponsesClient,
    private readonly contactService: ContactApplicationService,
    private readonly conversationService: ConversationApplicationService,
    private readonly inquiryService: InquiryApplicationService,
    private readonly notificationService: NotificationApplicationService,
    private readonly toolRouterService: AssistantToolRouterService,
    private readonly incomingNotifications: Pick<IncomingNotificationApplicationService, "notifyMessage">
  ) { }

  public async processIncoming(provider: IWhatsAppProvider, incoming: UnifiedIncomingMessage): Promise<{ ok: boolean; replyText: string; folio: string }> {
    const [upsertContactError, upsertContactDto] = UpsertContactRequestDTO.validate({
      waId: incoming.waId,
      fullName: "Prospecto Conta Magno",
      phoneE164: incoming.waId
    });

    if (upsertContactError || !upsertContactDto) {
      throw new Error(upsertContactError ?? "No se pudo preparar contacto");
    }

    const contact = await this.contactService.upsert(upsertContactDto);
    return this.contactService.withConversationActivity(contact.id, async () => {
      const conversation = await this.conversationService.createOrGetActive(contact.id, incoming.provider);

      if (incoming.providerMessageId) {
        const existing = await this.conversationService.findMessageByProviderMessageId(incoming.providerMessageId);
        if (existing) {
          return { ok: true, replyText: "duplicate_ignored", folio: "DUPLICATE" };
        }
      }

      const humanControlActive = conversation.stage === ConversationStage.PENDING_HUMAN;
      const message = await this.conversationService.addInboundMessage({
        conversationId: conversation.id,
        providerMessageId: incoming.providerMessageId,
        text: this.isUnsupportedIncomingMessage(incoming) ? this.buildUnsupportedInboundText(incoming.messageType) : incoming.text,
        rawPayload: humanControlActive ? {
          ...((incoming.rawPayload && typeof incoming.rawPayload === "object") ? incoming.rawPayload : {}),
          humanControlActive: true
        } : incoming.rawPayload
      }).catch(async (error: unknown) => {
        // Two deliveries of the same webhook can race the initial lookup.
        if (incoming.providerMessageId && error && typeof error === "object" && "code" in error && error.code === "P2002" &&
          await this.conversationService.findMessageByProviderMessageId(incoming.providerMessageId)) return null;
        throw error;
      });
      if (!message) return { ok: true, replyText: "duplicate_ignored", folio: "DUPLICATE" };

      // Start the alert alongside the assistant; keep it inside the contact activity
      // so deletion waits until its delivery records have settled.
      const notification = this.incomingNotifications.notifyMessage({
        messageId: message.id, senderWaId: incoming.waId, senderName: contact.fullName
      });
      try {
        if (humanControlActive) return { ok: true, replyText: "human_control_active", folio: "HUMAN" };
        if (this.isUnsupportedIncomingMessage(incoming)) {
          return await this.handleUnsupportedIncomingMessage(provider, conversation.id, incoming);
        }

        const queue = this.getQueueState(conversation.id);

        queue.pending.push({ provider, incoming, messageId: message.id });

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
      } finally {
        await notification;
      }
    });
  }

  private async processBatch(
    conversationId: string,
    contactId: string,
    batch: PendingIncomingItem[]
  ): Promise<{ ok: boolean; replyText: string; folio: string }> {
    const conversation = await this.conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Conversación no encontrada");
    }

    if (conversation.stage === ConversationStage.PENDING_HUMAN) {
      return { ok: true, replyText: "human_control_active", folio: "HUMAN" };
    }
    const controlVersion = this.conversationService.getHumanControlVersion(conversationId);
    const shouldContinue = async () => {
      const current = await this.conversationService.getConversation(conversationId);
      return Boolean(!this.contactService.isDeleting(contactId) && current && current.stage !== ConversationStage.PENDING_HUMAN &&
        this.conversationService.getHumanControlVersion(conversationId) === controlVersion);
    };

    let contact = await this.contactService.getById(contactId);
    if (!contact) {
      throw new Error("Contacto no encontrado");
    }

    if (batch.length === 0) {
      return { ok: true, replyText: "duplicate_ignored", folio: "DUPLICATE" };
    }

    const acceptedBatch = batch;
    const latestItem = acceptedBatch[acceptedBatch.length - 1];

    const associatedInquiry = await this.inquiryService.getLatestByConversationId(conversation.id);
    const isCompletedFlow = conversation.stage === ConversationStage.COMPLETED || associatedInquiry?.status === InquiryStatus.CLOSED;
    let inquiry: Inquiry;

    if (isCompletedFlow) {
      const completedInquiry = associatedInquiry;
      if (!completedInquiry) {
        throw new Error("La conversación completada no tiene un inquiry asociado");
      }
      inquiry = completedInquiry;
    } else {
      const [openInquiryError, openInquiryDto] = CreateOrGetOpenInquiryRequestDTO.validate({
        contactId: contact.id,
        conversationId: conversation.id
      });

      if (openInquiryError || !openInquiryDto) {
        throw new Error(openInquiryError ?? "No se pudo preparar inquiry");
      }

      if (!await shouldContinue()) return { ok: true, replyText: "human_control_active", folio: "HUMAN" };
      const openInquiryResult = await this.inquiryService.createOrGetOpen(openInquiryDto);
      inquiry = openInquiryResult.inquiry;

      if (openInquiryResult.created && await shouldContinue()) {
        await this.notificationService.notifyLeadCreated({
          inquiryId: inquiry.id,
          folio: inquiry.folio,
          contactPhone: contact.phoneE164,
          mainNeed: inquiry.mainNeed
        });
      }
    }

    const allMessages = await this.conversationService.listMessages(conversation.id);
    const cutoff = allMessages.findIndex((message) => message.id === latestItem.messageId);
    if (cutoff < 0) throw new Error("Mensaje del lote no encontrado");
    const messages = allMessages.slice(0, cutoff + 1);

    const contextJson = {
      business: "Conta Magno",
      timezone: "America/Mexico_City",
      goals: ["calificar lead", "recomendar paquete", "capturar datos para seguimiento humano"],
      contact,
      conversation: {
        id: conversation.id,
        stage: conversation.stage,
        status: conversation.status,
        flowCompleted: isCompletedFlow
      },
      inquiry,
      packages: {
        basico: "$800-$1,000",
        intermedio: "$1,200-$1,500",
        premium: "$1,800-$2,500"
      },
      contribuyenteTypes: CONTRIBUYENTE_TYPE_OPTIONS
    };

    const toolContext = {
      waId: latestItem.incoming.waId,
      contactId: contact.id,
      conversationId: conversation.id,
      inquiryId: inquiry.id,
      folio: inquiry.folio
    };

    let assistantResult: Awaited<ReturnType<ResponsesClient["runResponse"]>>;
    try {
      const remoteId = await this.responsesClient.syncHistory({
        conversationId: conversation.openAiConversationId,
        messages,
        shouldContinue,
        onConversationCreated: async (id) => {
          await this.conversationService.setOpenAiConversationId(conversationId, id);
        },
        onMessagesSynced: (ids, at) => this.conversationService.markOpenAiSynced(ids, at)
      });
      assistantResult = await this.responsesClient.runResponse({
        conversationId: remoteId,
        prompt: contaMagnoAssistantPrompt,
        contextJson,
        shouldContinue,
        onToolCall: async (toolCall) => {
          if (!await shouldContinue()) throw new AssistantTurnStoppedError();
          return this.toolRouterService.executeNativeTool(toolCall, toolContext);
        }
      });
    } catch (error) {
      if (error instanceof AssistantTurnStoppedError) return { ok: true, replyText: "human_control_active", folio: inquiry.folio };
      throw error;
    }
    if (!await shouldContinue()) return { ok: true, replyText: "human_control_active", folio: inquiry.folio };
    const inquiryAfterTools = await this.inquiryService.detail(inquiry.id);
    const canUpdateInquiry = !isCompletedFlow && inquiryAfterTools?.status !== InquiryStatus.CLOSED;

    const extracted = assistantResult.output.extractedFields;

    if (canUpdateInquiry && await shouldContinue() && (extracted.fullName || extracted.email || extracted.phoneWhatsApp)) {
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

    let latestInquiry = inquiryAfterTools ?? inquiry;

    if (canUpdateInquiry && await shouldContinue()) {
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
        latestInquiry = await this.inquiryService.updateFields(updateFieldsDto);
      }
    }

    const hasOwnerLeadTemplateData =
      Boolean(contact.fullName?.trim()) &&
      Boolean(contact.phoneE164?.trim()) &&
      Boolean(contact.email?.trim()) &&
      Boolean(latestInquiry.mainNeed?.trim()) &&
      Boolean(latestInquiry.recommendedPlan?.trim());

    const toolResults = assistantResult.toolResults;

    const nextStage = this.conversationService.stageFromString(assistantResult.output.nextStage);
    const finalStage = isCompletedFlow || !canUpdateInquiry ? ConversationStage.COMPLETED : nextStage;
    if (canUpdateInquiry && nextStage && await shouldContinue()) {
      if (nextStage === ConversationStage.COMPLETED) {
        const [statusErr, statusDto] = UpdateInquiryStatusRequestDTO.validate({
          inquiryId: inquiry.id,
          status: InquiryStatus.CLOSED
        });
        if (!statusErr && statusDto && await shouldContinue()) {
          await this.inquiryService.updateStatus(statusDto);
        }

        if (hasOwnerLeadTemplateData && await shouldContinue()) {
          await this.notificationService.notifyOwnerLeadTemplate({
            inquiryId: latestInquiry.id,
            folio: latestInquiry.folio,
            fullName: contact.fullName.trim(),
            phoneE164: contact.phoneE164.trim(),
            email: (contact.email ?? "").trim(),
            mainNeed: latestInquiry.mainNeed!.trim(),
            recommendedPlan: latestInquiry.recommendedPlan!.trim()
          });
        }
      }

      if (nextStage === ConversationStage.PENDING_HUMAN && await shouldContinue()) {
        await this.notificationService.notifyLeadUpdated({
          inquiryId: inquiry.id,
          folio: inquiry.folio,
          summary: "Escalado a atención humana por complejidad o solicitud explícita."
        });
      }
    }

    if (!await shouldContinue()) return { ok: true, replyText: "human_control_active", folio: inquiry.folio };
    const replyText = this.sanitizeAssistantReplyText(assistantResult.output.replyText);
    const sent = await latestItem.provider.sendTextMessage(latestItem.incoming.waId, replyText);

    await this.conversationService.addOutboundMessage({
      conversationId: conversation.id,
      providerMessageId: sent.providerMessageId,
      text: replyText,
      openAiSyncedAt: assistantResult.syncedAt,
      rawPayload: {
        openAiResponseId: assistantResult.responseId,
        provider: latestItem.incoming.provider,
        toolResults,
        batchSize: acceptedBatch.length
      }
    });

    if (finalStage && await shouldContinue()) {
      const [error, dto] = UpdateConversationStageRequestDTO.validate({ conversationId, stage: finalStage });
      if (!error && dto) await this.conversationService.updateStage(dto);
    }

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

  private isUnsupportedIncomingMessage(incoming: UnifiedIncomingMessage): boolean {
    return Boolean(incoming.messageType && incoming.messageType !== "text");
  }

  private async handleUnsupportedIncomingMessage(
    provider: IWhatsAppProvider,
    conversationId: string,
    incoming: UnifiedIncomingMessage
  ): Promise<{ ok: boolean; replyText: string; folio: string }> {
    const current = await this.conversationService.getConversation(conversationId);
    if (!current || current.stage === ConversationStage.PENDING_HUMAN) {
      return { ok: true, replyText: "human_control_active", folio: "HUMAN" };
    }
    const replyText = AssistantOrchestratorService.unsupportedNonTextReply;
    const sent = await provider.sendTextMessage(incoming.waId, replyText);

    await this.conversationService.addOutboundMessage({
      conversationId,
      providerMessageId: sent.providerMessageId,
      text: replyText,
      rawPayload: {
        provider: incoming.provider,
        unsupportedMessageType: incoming.messageType ?? null
      }
    });

    return {
      ok: true,
      replyText,
      folio: "UNSUPPORTED_MEDIA"
    };
  }

  private buildUnsupportedInboundText(messageType?: string): string {
    const label = messageType?.trim().toLowerCase() || "unsupported";
    return `[${label} message]`;
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
