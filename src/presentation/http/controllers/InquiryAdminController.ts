import { Request, Response } from "express";
import { UpdateInquiryNotesRequestDTO } from "../../../application/dtos/request/inquiries/UpdateInquiryNotesRequestDTO.js";
import { UpdateInquiryStatusRequestDTO } from "../../../application/dtos/request/inquiries/UpdateInquiryStatusRequestDTO.js";
import { InquiryDetailResponseDTO } from "../../../application/dtos/response/inquiries/InquiryDetailResponseDTO.js";
import { InquiryListResponseDTO } from "../../../application/dtos/response/inquiries/InquiryListResponseDTO.js";
import { ApiErrorResponseDTO } from "../../../application/dtos/response/common/ApiErrorResponseDTO.js";
import { InquiryApplicationService } from "../../../application/services/InquiryApplicationService.js";

export class InquiryAdminController {
  constructor(private readonly inquiryService: InquiryApplicationService) {}

  public async list(req: Request, res: Response): Promise<void> {
    const limit = Number(req.query.limit ?? 100);
    const inquiries = await this.inquiryService.list(Number.isNaN(limit) ? 100 : limit);
    res.json(InquiryListResponseDTO.fromEntities(inquiries));
  }

  public async detail(req: Request, res: Response): Promise<void> {
    const inquiry = await this.inquiryService.detail(req.params.id);
    if (!inquiry) {
      res.status(404).json(ApiErrorResponseDTO.fromMessage("Inquiry no encontrada"));
      return;
    }

    res.json(InquiryDetailResponseDTO.fromEntity(inquiry));
  }

  public async updateStatus(req: Request, res: Response): Promise<void> {
    const [error, dto] = UpdateInquiryStatusRequestDTO.validate({
      inquiryId: req.params.id,
      status: req.body?.status
    });

    if (error || !dto) {
      res.status(400).json(ApiErrorResponseDTO.fromMessage(error ?? "Payload inválido"));
      return;
    }

    const inquiry = await this.inquiryService.updateStatus(dto);
    res.json(InquiryDetailResponseDTO.fromEntity(inquiry));
  }

  public async updateNotes(req: Request, res: Response): Promise<void> {
    const [error, dto] = UpdateInquiryNotesRequestDTO.validate({
      inquiryId: req.params.id,
      notes: req.body?.notes
    });

    if (error || !dto) {
      res.status(400).json(ApiErrorResponseDTO.fromMessage(error ?? "Payload inválido"));
      return;
    }

    const inquiry = await this.inquiryService.updateNotes(dto);
    res.json(InquiryDetailResponseDTO.fromEntity(inquiry));
  }
}
