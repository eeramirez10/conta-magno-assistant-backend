import { randomInt } from "crypto";
import { Appointment } from "../../domain/entities/Appointment.js";
import { AvailabilitySlot } from "../../domain/entities/AvailabilitySlot.js";
import { Inquiry } from "../../domain/entities/Inquiry.js";
import { InquiryStatus } from "../../domain/enums/InquiryStatus.js";
import { IAppointmentRepository } from "../../domain/repositories/IAppointmentRepository.js";
import { IInquiryRepository } from "../../domain/repositories/IInquiryRepository.js";
import { ISlotRepository } from "../../domain/repositories/ISlotRepository.js";
import { InquiryDomainService } from "../../domain/services/InquiryDomainService.js";
import { CloseInquiryRequestDTO } from "../dtos/request/tools/CloseInquiryRequestDTO.js";
import { CreateOrGetOpenInquiryRequestDTO } from "../dtos/request/tools/CreateOrGetOpenInquiryRequestDTO.js";
import { UpdateInquiryFieldsRequestDTO } from "../dtos/request/tools/UpdateInquiryFieldsRequestDTO.js";
import { UpdateInquiryNotesRequestDTO } from "../dtos/request/inquiries/UpdateInquiryNotesRequestDTO.js";
import { UpdateInquiryStatusRequestDTO } from "../dtos/request/inquiries/UpdateInquiryStatusRequestDTO.js";

export class InquiryApplicationService {
  constructor(
    private readonly inquiryRepository: IInquiryRepository,
    private readonly slotRepository: ISlotRepository,
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly inquiryDomainService: InquiryDomainService
  ) {}

  public async createOrGetOpen(dto: CreateOrGetOpenInquiryRequestDTO): Promise<{ inquiry: Inquiry; created: boolean }> {
    const open = await this.inquiryRepository.getOpenByContactId(dto.contactId);
    if (open) {
      return { inquiry: open, created: false };
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const folio = this.generateFolio();
      try {
        const inquiry = await this.inquiryRepository.createOpen({
          contactId: dto.contactId,
          conversationId: dto.conversationId,
          folio
        });
        return { inquiry, created: true };
      } catch {
        // retry unique folio collision
      }
    }

    throw new Error("No fue posible generar folio único para inquiry");
  }

  public async updateFields(dto: UpdateInquiryFieldsRequestDTO): Promise<Inquiry> {
    const updated = await this.inquiryRepository.updateFields(dto.inquiryId, {
      clientType: dto.clientType,
      specialtyProfile: dto.specialtyProfile,
      mainNeed: dto.mainNeed,
      urgency: dto.urgency,
      budgetRange: dto.budgetRange,
      recommendedPlan: dto.recommendedPlan,
      notes: dto.notes
    });

    if (!updated.recommendedPlan) {
      const recommended = this.inquiryDomainService.recommendPlan({
        mainNeed: updated.mainNeed,
        specialtyProfile: updated.specialtyProfile,
        urgency: updated.urgency
      });
      return this.inquiryRepository.updateFields(dto.inquiryId, { recommendedPlan: recommended });
    }

    return updated;
  }

  public async updateStatus(dto: UpdateInquiryStatusRequestDTO): Promise<Inquiry> {
    return this.inquiryRepository.updateStatus(dto.inquiryId, dto.status);
  }

  public async updateNotes(dto: UpdateInquiryNotesRequestDTO): Promise<Inquiry> {
    return this.inquiryRepository.updateFields(dto.inquiryId, { notes: dto.notes });
  }

  public async close(dto: CloseInquiryRequestDTO): Promise<Inquiry> {
    return this.inquiryRepository.updateStatus(dto.inquiryId, InquiryStatus.CLOSED);
  }

  public async list(limit = 100): Promise<Inquiry[]> {
    return this.inquiryRepository.list(limit);
  }

  public async detail(id: string): Promise<Inquiry | null> {
    return this.inquiryRepository.findById(id);
  }

  public async listAvailableSlots(fromDate: string, limit: number): Promise<AvailabilitySlot[]> {
    return this.slotRepository.listAvailable(fromDate, limit);
  }

  public async createTentativeAppointment(inquiryId: string, slotId: string): Promise<Appointment> {
    const reserved = await this.slotRepository.reserve(slotId);
    if (!reserved) {
      throw new Error("Horario no disponible");
    }

    const appointment = await this.appointmentRepository.createTentative(inquiryId, slotId);
    await this.inquiryRepository.updateStatus(inquiryId, InquiryStatus.APPOINTMENT_TENTATIVE);
    return appointment;
  }

  public async latestAppointment(inquiryId: string): Promise<Appointment | null> {
    return this.appointmentRepository.findLatestByInquiryId(inquiryId);
  }

  private generateFolio(): string {
    const now = new Date();
    const seq = randomInt(0, 999999);
    return this.inquiryDomainService.generateFolio(now, seq);
  }
}
