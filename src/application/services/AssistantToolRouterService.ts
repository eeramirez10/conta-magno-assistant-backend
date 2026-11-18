import { GetContactByWaIdRequestDTO } from "../dtos/request/tools/GetContactByWaIdRequestDTO.js";
import { UpsertContactRequestDTO } from "../dtos/request/tools/UpsertContactRequestDTO.js";
import { GetActiveConversationRequestDTO } from "../dtos/request/tools/GetActiveConversationRequestDTO.js";
import { UpdateConversationStageRequestDTO } from "../dtos/request/tools/UpdateConversationStageRequestDTO.js";
import { CreateOrGetOpenInquiryRequestDTO } from "../dtos/request/tools/CreateOrGetOpenInquiryRequestDTO.js";
import { UpdateInquiryFieldsRequestDTO } from "../dtos/request/tools/UpdateInquiryFieldsRequestDTO.js";
import { CloseInquiryRequestDTO } from "../dtos/request/tools/CloseInquiryRequestDTO.js";
import { InquiryStatus } from "../../domain/enums/InquiryStatus.js";
import { ConversationStage } from "../../domain/enums/ConversationStage.js";
import { ContactApplicationService } from "./ContactApplicationService.js";
import { ConversationApplicationService } from "./ConversationApplicationService.js";
import { InquiryApplicationService } from "./InquiryApplicationService.js";
import { NotificationApplicationService } from "./NotificationApplicationService.js";

export type ToolCallInput = {
  name: string;
  arguments: Record<string, unknown>;
};

export class AssistantToolRouterService {
  constructor(
    private readonly contactService: ContactApplicationService,
    private readonly conversationService: ConversationApplicationService,
    private readonly inquiryService: InquiryApplicationService,
    private readonly notificationService: NotificationApplicationService
  ) {}

  public readAttachment?: (id: string, conversationId: string) => Promise<any>;

  public async executeNativeTool(
    toolCall: ToolCallInput,
    fallback: { waId: string; contactId?: string; conversationId?: string; inquiryId?: string; folio?: string }
  ): Promise<any> {
    if (["listAvailableSlots", "createTentativeAppointment"].includes(toolCall.name)) {
      return { tool: toolCall.name, ok: false, error: "La agenda está deshabilitada. El equipo continuará la atención por este mismo chat." };
    }
    if (fallback.conversationId) {
      const conversation = await this.conversationService.getConversation(fallback.conversationId);
      if (!conversation || conversation.stage === ConversationStage.PENDING_HUMAN) {
        return { ok: false, error: "Control humano activo" };
      }
      const inquiry = await this.inquiryService.getLatestByConversationId(fallback.conversationId);
      if (inquiry?.status === InquiryStatus.CLOSED && !["getContactByWaId", "getActiveConversation", "readConversationAttachment"].includes(toolCall.name)) {
        return { ok: false, error: "El inquiry está cerrado y no puede modificarse." };
      }
    }
    // Keep native tool calls scoped to the conversation that initiated the turn.
    for (const key of ["waId", "contactId", "conversationId", "inquiryId"] as const) {
      if (toolCall.arguments[key] !== undefined && toolCall.arguments[key] !== fallback[key]) {
        return { ok: false, error: "La función debe usar los IDs del contexto actual." };
      }
    }
    if (toolCall.name === "readConversationAttachment" && this.readAttachment && fallback.conversationId) {
      return this.readAttachment(String(toolCall.arguments.attachmentId ?? ""), fallback.conversationId);
    }
    return this.executeOne(toolCall, fallback);
  }

  private async executeOne(
    toolCall: ToolCallInput,
    fallback: { waId: string; contactId?: string; conversationId?: string; inquiryId?: string; folio?: string }
  ): Promise<Record<string, unknown>> {
    switch (toolCall.name) {
      case "getContactByWaId": {
        const [error, dto] = GetContactByWaIdRequestDTO.validate({ waId: toolCall.arguments.waId ?? fallback.waId });
        if (error || !dto) return { tool: toolCall.name, ok: false, error: error ?? "DTO inválido" };
        const contact = await this.contactService.getByWaId(dto);
        return { tool: toolCall.name, ok: true, contactId: contact?.id ?? null };
      }

      case "upsertContact": {
        const [error, dto] = UpsertContactRequestDTO.validate({
          waId: toolCall.arguments.waId ?? fallback.waId,
          fullName: toolCall.arguments.fullName ?? "Prospecto Conta Magno",
          phoneE164: toolCall.arguments.phoneE164 ?? fallback.waId,
          email: toolCall.arguments.email ?? null
        });
        if (error || !dto) return { tool: toolCall.name, ok: false, error: error ?? "DTO inválido" };
        const contact = await this.contactService.upsert(dto);
        return { tool: toolCall.name, ok: true, contactId: contact.id };
      }

      case "getActiveConversation": {
        const [error, dto] = GetActiveConversationRequestDTO.validate({
          contactId: toolCall.arguments.contactId ?? fallback.contactId
        });
        if (error || !dto) return { tool: toolCall.name, ok: false, error: error ?? "DTO inválido" };
        const conversation = await this.conversationService.createOrGetActive(dto.contactId, "META");
        return { tool: toolCall.name, ok: true, conversationId: conversation.id };
      }

      case "updateConversationStage": {
        const [error, dto] = UpdateConversationStageRequestDTO.validate({
          conversationId: toolCall.arguments.conversationId ?? fallback.conversationId,
          stage: toolCall.arguments.stage
        });
        if (error || !dto) return { tool: toolCall.name, ok: false, error: error ?? "DTO inválido" };
        const conversation = await this.conversationService.updateStage(dto);
        return { tool: toolCall.name, ok: true, stage: conversation.stage };
      }

      case "createOrGetOpenInquiry": {
        const [error, dto] = CreateOrGetOpenInquiryRequestDTO.validate({
          contactId: toolCall.arguments.contactId ?? fallback.contactId,
          conversationId: toolCall.arguments.conversationId ?? fallback.conversationId
        });
        if (error || !dto) return { tool: toolCall.name, ok: false, error: error ?? "DTO inválido" };
        const result = await this.inquiryService.createOrGetOpen(dto);
        return { tool: toolCall.name, ok: true, inquiryId: result.inquiry.id, folio: result.inquiry.folio, created: result.created };
      }

      case "updateInquiryFields": {
        const [error, dto] = UpdateInquiryFieldsRequestDTO.validate({
          ...toolCall.arguments,
          inquiryId: toolCall.arguments.inquiryId ?? fallback.inquiryId
        });
        if (error || !dto) return { tool: toolCall.name, ok: false, error: error ?? "DTO inválido" };
        const inquiry = await this.inquiryService.updateFields(dto);
        if (fallback.folio) {
          await this.notificationService.notifyLeadUpdated({
            inquiryId: inquiry.id,
            folio: fallback.folio,
            summary: `Necesidad: ${inquiry.mainNeed ?? "pendiente"}, plan: ${inquiry.recommendedPlan ?? "pendiente"}.`
          });
        }
        return { tool: toolCall.name, ok: true, inquiryId: inquiry.id };
      }

      case "closeInquiry": {
        const [error, dto] = CloseInquiryRequestDTO.validate({
          inquiryId: toolCall.arguments.inquiryId ?? fallback.inquiryId
        });
        if (error || !dto) return { tool: toolCall.name, ok: false, error: error ?? "DTO inválido" };
        const inquiry = await this.inquiryService.close(dto);
        return { tool: toolCall.name, ok: true, status: inquiry.status };
      }

      default:
        return { tool: toolCall.name, ok: false, error: "Tool no soportada" };
    }
  }
}
