import { Request, Response } from 'express';
import { MetaWhatsAppClient } from '../../../infrastructure/integrations/whatsapp/meta/MetaWhatsAppClient.js';
import { TestOwnerLeadTemplateRequestDTO } from '../../../application/dtos/request/notifications/TestOwnerLeadTemplateRequestDTO.js';
import { ApiErrorResponseDTO } from '../../../application/dtos/response/common/ApiErrorResponseDTO.js';
import { Env } from '../../../infrastructure/config/env.js';
import { ContactDomainService } from '../../../domain/services/ContactDomainService.js';

export class NotificationAdminController {
  constructor(
    private readonly metaClient: MetaWhatsAppClient,
    private readonly contactDomainService: ContactDomainService
  ) {}


  public async sendOwnerLeadTemplateTest(req: Request, res: Response): Promise<void> {
    const [error, dto] = TestOwnerLeadTemplateRequestDTO.validate(req.body);

    if (error || !dto) {
      res.status(400).json(ApiErrorResponseDTO.fromMessage(error ?? "Payload inválido"));
      return;
    }



    if (!Env.metaOwnerLeadTemplateName) {
      res.status(400).json(ApiErrorResponseDTO.fromMessage("Falta META_OWNER_LEAD_TEMPLATE_NAME en variables de entorno"));
      return;
    }

    const sent = await this.metaClient.sendTemplate({
      toWaId: this.contactDomainService.normalizePhone(dto.toWaId).replace(/^\+/, ""),
      templateName: Env.metaOwnerLeadTemplateName,
      languageCode: Env.metaOwnerLeadTemplateLang,
      bodyParameters: [
        dto.folio,
        dto.fullName,
        this.contactDomainService.normalizePhone(dto.leadPhoneE164),
        dto.email,
        dto.mainNeed,
        dto.recommendedPlan
      ]
    });

    res.status(200).json({
      ok: true,
      sentTo: this.contactDomainService.normalizePhone(dto.toWaId),
      templateName: Env.metaOwnerLeadTemplateName,
      languageCode: Env.metaOwnerLeadTemplateLang,
      providerMessageId: sent.id
    });
  }
}
