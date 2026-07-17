import { Request, Response } from "express";

import { ContactApplicationService } from "../../../application/services/ContactApplicationService.js";
import { ContactListResponseDTO } from "../../../application/dtos/response/contacts/ContactListResponseDTO.js";
import { ApiErrorResponseDTO } from "../../../application/dtos/response/common/ApiErrorResponseDTO.js";

export class ContactAdminController {
  constructor(private readonly contactService: ContactApplicationService) {}

  public async list(req: Request, res: Response): Promise<void> {
    const requestedLimit = Number(req.query.limit ?? 100)
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100
    const contacts = await this.contactService.list(limit)
    res.json(ContactListResponseDTO.fromSummaries(contacts))
  }

  public async deletePermanently(req: Request, res: Response): Promise<void> {
    const result = await this.contactService.deletePermanently(req.params.id)
    if (!result) {
      res.status(404).json(ApiErrorResponseDTO.fromMessage("Contacto no encontrado"))
      return
    }

    res.json({ ok: true, data: result })
  }
}
