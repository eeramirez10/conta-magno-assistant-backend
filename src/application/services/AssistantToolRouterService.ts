import { GetContactByWaIdRequestDTO } from "../dtos/request/tools/GetContactByWaIdRequestDTO.js";
import { UpsertContactRequestDTO } from "../dtos/request/tools/UpsertContactRequestDTO.js";
import { GetActiveConversationRequestDTO } from "../dtos/request/tools/GetActiveConversationRequestDTO.js";
import { UpdateConversationStageRequestDTO } from "../dtos/request/tools/UpdateConversationStageRequestDTO.js";
import { CreateOrGetOpenInquiryRequestDTO } from "../dtos/request/tools/CreateOrGetOpenInquiryRequestDTO.js";
import { UpdateInquiryFieldsRequestDTO } from "../dtos/request/tools/UpdateInquiryFieldsRequestDTO.js";
import { CloseInquiryRequestDTO } from "../dtos/request/tools/CloseInquiryRequestDTO.js";
import { ListAvailableSlotsRequestDTO } from "../dtos/request/tools/ListAvailableSlotsRequestDTO.js";
import { CreateTentativeAppointmentRequestDTO } from "../dtos/request/tools/CreateTentativeAppointmentRequestDTO.js";
import { ContribuyenteType } from "../../domain/enums/ContribuyenteType.js";
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

  public async executeMany(
    toolCalls: ToolCallInput[],
    fallback: { waId: string; contactId?: string; conversationId?: string; inquiryId?: string; folio?: string }
  ): Promise<Array<Record<string, unknown>>> {
    const output: Array<Record<string, unknown>> = [];

    for (const toolCall of toolCalls) {
      output.push(await this.executeOne(toolCall, fallback));
    }

    return output;
  }

  public async executeNativeTool(
    toolCall: ToolCallInput,
    fallback: { waId: string; contactId?: string; conversationId?: string; inquiryId?: string; folio?: string }
  ): Promise<Record<string, unknown>> {
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

      case "listAvailableSlots": {
        const today = new Date().toISOString().slice(0, 10);
        const [error, dto] = ListAvailableSlotsRequestDTO.validate({
          fromDate: toolCall.arguments.fromDate ?? today,
          limit: toolCall.arguments.limit ?? 5
        });
        if (error || !dto) return { tool: toolCall.name, ok: false, error: error ?? "DTO inválido" };

        const slots = await this.inquiryService.listAvailableSlots(dto.fromDate, dto.limit);
        return {
          tool: toolCall.name,
          ok: true,
          slots: slots.map((s) => ({ id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime, timezone: s.timezone }))
        };
      }

      case "createTentativeAppointment": {
        const inquiry = fallback.inquiryId ? await this.inquiryService.detail(fallback.inquiryId) : null;
        const contact = fallback.contactId ? await this.contactService.getById(fallback.contactId) : null;
        const missingRequiredFields: string[] = [];

        if (!contact || !contact.fullName || /^prospecto conta magno$/i.test(contact.fullName.trim())) {
          missingRequiredFields.push("Nombre completo");
        }
        if (!contact || !contact.phoneE164 || contact.phoneE164.trim().length < 8) {
          missingRequiredFields.push("Número de WhatsApp");
        }
        if (!contact || !contact.email || !contact.email.includes("@")) {
          missingRequiredFields.push("Correo electrónico");
        }
        if (!inquiry || !inquiry.clientType || inquiry.clientType === ContribuyenteType.NO_LO_SE_AUN) {
          missingRequiredFields.push("Tipo de contribuyente");
        }

        if (missingRequiredFields.length > 0) {
          return {
            tool: toolCall.name,
            ok: false,
            error: "Faltan datos obligatorios antes de agendar.",
            missingFields: missingRequiredFields
          };
        }

        const [error, dto] = CreateTentativeAppointmentRequestDTO.validate({
          inquiryId: toolCall.arguments.inquiryId ?? fallback.inquiryId,
          slotId: toolCall.arguments.slotId
        });
        if (error || !dto) return { tool: toolCall.name, ok: false, error: error ?? "DTO inválido" };

        const appointment = await this.inquiryService.createTentativeAppointment(dto.inquiryId, dto.slotId);
        if (fallback.folio) {
          await this.notificationService.notifyAppointmentRequested({
            inquiryId: dto.inquiryId,
            folio: fallback.folio,
            slotText: `slotId=${dto.slotId}`
          });
        }

        return { tool: toolCall.name, ok: true, appointmentId: appointment.id, status: appointment.status };
      }

      default:
        return { tool: toolCall.name, ok: false, error: "Tool no soportada" };
    }
  }
}
