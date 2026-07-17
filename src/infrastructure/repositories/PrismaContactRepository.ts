import { Contact } from "../../domain/entities/Contact.js";
import { ContactDeletionResult, ContactSummary, IContactRepository } from "../../domain/repositories/IContactRepository.js";
import { prisma } from "../database/prisma.js";

export class PrismaContactRepository implements IContactRepository {
  private toEntity(row: {
    id: string;
    waId: string;
    fullName: string;
    phoneE164: string;
    email: string | null;
    timezone: string;
    consentPrivacy: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Contact {
    return new Contact(
      row.id,
      row.waId,
      row.fullName,
      row.phoneE164,
      row.email,
      row.timezone,
      row.consentPrivacy,
      row.createdAt,
      row.updatedAt
    );
  }

  public async findById(id: string): Promise<Contact | null> {
    const row = await prisma.contact.findUnique({ where: { id } });
    if (!row) {
      return null;
    }

    return this.toEntity(row);
  }

  public async findByWaId(waId: string): Promise<Contact | null> {
    const row = await prisma.contact.findUnique({ where: { waId } });
    if (!row) {
      return null;
    }

    return this.toEntity(row);
  }

  public async list(limit = 100): Promise<ContactSummary[]> {
    const rows = await prisma.contact.findMany({
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { inquiries: true }
        },
        conversations: {
          select: {
            _count: {
              select: { messages: true }
            }
          }
        },
        inquiries: {
          take: 1,
          orderBy: { updatedAt: "desc" },
          select: {
            folio: true,
            status: true,
            clientType: true,
            specialtyProfile: true,
            mainNeed: true,
            urgency: true,
            budgetRange: true,
            recommendedPlan: true,
            notes: true,
            updatedAt: true
          }
        }
      }
    });

    return rows.map((row) => {
      const latestInquiry = row.inquiries[0] ?? null;
      const rfcStatus = latestInquiry?.clientType === "NO_INSCRITO_EN_HACIENDA"
        ? "NO"
        : !latestInquiry?.clientType || latestInquiry.clientType === "NO_LO_SE_AUN"
          ? "UNKNOWN"
          : "YES";

      return {
        contact: this.toEntity(row),
        conversationCount: row.conversations.length,
        inquiryCount: row._count.inquiries,
        messageCount: row.conversations.reduce((total, conversation) => total + conversation._count.messages, 0),
        latestInquiry: latestInquiry
          ? {
              ...latestInquiry,
              rfcStatus
            }
          : null
      };
    });
  }

  public async deleteWithRelations(id: string): Promise<ContactDeletionResult | null> {
    return prisma.$transaction(async (transaction) => {
      const contact = await transaction.contact.findUnique({ where: { id } });
      if (!contact) return null;

      const [conversations, inquiries] = await Promise.all([
        transaction.conversation.findMany({ where: { contactId: id }, select: { id: true } }),
        transaction.inquiry.findMany({ where: { contactId: id }, select: { id: true } })
      ]);

      const conversationIds = conversations.map((conversation) => conversation.id);
      const inquiryIds = inquiries.map((inquiry) => inquiry.id);

      const appointments = await transaction.appointment.findMany({
        where: { inquiryId: { in: inquiryIds } },
        select: { id: true, slotId: true }
      });

      const slotDeletionCount = new Map<string, number>();
      for (const appointment of appointments) {
        slotDeletionCount.set(appointment.slotId, (slotDeletionCount.get(appointment.slotId) ?? 0) + 1);
      }

      const slots = await transaction.availabilitySlot.findMany({
        where: { id: { in: [...slotDeletionCount.keys()] } },
        select: { id: true, bookedCount: true }
      });

      await transaction.notificationEvent.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
      await transaction.appointment.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
      await transaction.inquiry.deleteMany({ where: { contactId: id } });
      const deletedMessages = await transaction.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
      await transaction.conversation.deleteMany({ where: { contactId: id } });

      for (const slot of slots) {
        const deletedAppointmentsForSlot = slotDeletionCount.get(slot.id) ?? 0;
        await transaction.availabilitySlot.update({
          where: { id: slot.id },
          data: { bookedCount: Math.max(0, slot.bookedCount - deletedAppointmentsForSlot) }
        });
      }

      await transaction.contact.delete({ where: { id } });

      return {
        contactId: id,
        conversationIds,
        deletedConversationCount: conversationIds.length,
        deletedInquiryCount: inquiryIds.length,
        deletedMessageCount: deletedMessages.count,
        deletedAppointmentCount: appointments.length
      };
    });
  }

  public async upsertByWaId(payload: {
    waId: string;
    fullName: string;
    phoneE164: string;
    email?: string | null;
    timezone?: string;
    consentPrivacy?: boolean;
  }): Promise<Contact> {
    const hasConfirmedName = !/^prospecto conta magno$/i.test(payload.fullName);

    const row = await prisma.contact.upsert({
      where: { waId: payload.waId },
      update: {
        fullName: hasConfirmedName ? payload.fullName : undefined,
        phoneE164: payload.phoneE164,
        email: payload.email ?? undefined,
        timezone: payload.timezone ?? "America/Mexico_City",
        consentPrivacy: payload.consentPrivacy ?? false
      },
      create: {
        waId: payload.waId,
        fullName: payload.fullName,
        phoneE164: payload.phoneE164,
        email: payload.email ?? null,
        timezone: payload.timezone ?? "America/Mexico_City",
        consentPrivacy: payload.consentPrivacy ?? false
      }
    });

    return this.toEntity(row);
  }
}
