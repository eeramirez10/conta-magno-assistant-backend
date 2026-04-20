import { Request, Response } from "express";
import { ConversationDetailResponseDTO } from "../../../application/dtos/response/conversations/ConversationDetailResponseDTO.js";
import { ConversationListItemResponseDTO } from "../../../application/dtos/response/conversations/ConversationListItemResponseDTO.js";
import { ApiErrorResponseDTO } from "../../../application/dtos/response/common/ApiErrorResponseDTO.js";
import { ConversationApplicationService } from "../../../application/services/ConversationApplicationService.js";
import { ContactApplicationService } from "../../../application/services/ContactApplicationService.js";

export class ConversationAdminController {
  constructor(
    private readonly conversationService: ConversationApplicationService,
    private readonly contactService: ContactApplicationService
  ) {}

  public async list(req: Request, res: Response): Promise<void> {
    const limit = Number(req.query.limit ?? 100);
    const conversations = await this.conversationService.listConversations(Number.isNaN(limit) ? 100 : limit);
    const items = await Promise.all(
      conversations.map(async (conversation) => {
        const contact = await this.contactService.getById(conversation.contactId);
        return ConversationListItemResponseDTO.fromEntity(conversation, contact);
      })
    );

    res.json({
      ok: true,
      items
    });
  }

  public async detail(req: Request, res: Response): Promise<void> {
    const conversation = await this.conversationService.getConversation(req.params.id);
    if (!conversation) {
      res.status(404).json(ApiErrorResponseDTO.fromMessage("Conversación no encontrada"));
      return;
    }

    const messages = await this.conversationService.listMessages(conversation.id);
    const contact = await this.contactService.getById(conversation.contactId);
    res.json(ConversationDetailResponseDTO.fromEntities(conversation, messages, contact));
  }
}
