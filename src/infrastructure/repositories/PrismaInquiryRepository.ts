import { InquiryStatus as PrismaInquiryStatus } from "@prisma/client";
import { Inquiry } from "../../domain/entities/Inquiry.js";
import { ContribuyenteType, parseContribuyenteType } from "../../domain/enums/ContribuyenteType.js";
import { InquiryStatus } from "../../domain/enums/InquiryStatus.js";
import { IInquiryRepository } from "../../domain/repositories/IInquiryRepository.js";
import { prisma } from "../database/prisma.js";

function mapInquiry(row: {
  id: string;
  folio: string;
  contactId: string;
  conversationId: string;
  status: PrismaInquiryStatus;
  clientType: string | null;
  specialtyProfile: string | null;
  mainNeed: string | null;
  urgency: string | null;
  budgetRange: string | null;
  recommendedPlan: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Inquiry {
  return new Inquiry(
    row.id,
    row.folio,
    row.contactId,
    row.conversationId,
    row.status as InquiryStatus,
    row.clientType ? (parseContribuyenteType(row.clientType) ?? (row.clientType as ContribuyenteType)) : null,
    row.specialtyProfile,
    row.mainNeed,
    row.urgency,
    row.budgetRange,
    row.recommendedPlan,
    row.notes,
    row.createdAt,
    row.updatedAt
  );
}

export class PrismaInquiryRepository implements IInquiryRepository {
  public async getOpenByContactId(contactId: string): Promise<Inquiry | null> {
    const row = await prisma.inquiry.findFirst({
      where: {
        contactId,
        status: {
          in: [
            PrismaInquiryStatus.NEW,
            PrismaInquiryStatus.QUALIFIED,
            PrismaInquiryStatus.PENDING_FOLLOWUP,
            PrismaInquiryStatus.APPOINTMENT_TENTATIVE
          ]
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    return row ? mapInquiry(row) : null;
  }

  public async createOpen(payload: { contactId: string; conversationId: string; folio: string }): Promise<Inquiry> {
    const row = await prisma.inquiry.create({
      data: {
        contactId: payload.contactId,
        conversationId: payload.conversationId,
        folio: payload.folio,
        status: PrismaInquiryStatus.NEW
      }
    });

    return mapInquiry(row);
  }

  public async updateFields(
    inquiryId: string,
    fields: Partial<Pick<Inquiry, "clientType" | "specialtyProfile" | "mainNeed" | "urgency" | "budgetRange" | "recommendedPlan" | "notes">>
  ): Promise<Inquiry> {
    const row = await prisma.inquiry.update({
      where: { id: inquiryId },
      data: {
        clientType: fields.clientType,
        specialtyProfile: fields.specialtyProfile,
        mainNeed: fields.mainNeed,
        urgency: fields.urgency,
        budgetRange: fields.budgetRange,
        recommendedPlan: fields.recommendedPlan,
        notes: fields.notes
      }
    });

    return mapInquiry(row);
  }

  public async updateStatus(inquiryId: string, status: InquiryStatus): Promise<Inquiry> {
    const row = await prisma.inquiry.update({
      where: { id: inquiryId },
      data: { status: status as PrismaInquiryStatus }
    });

    return mapInquiry(row);
  }

  public async findById(id: string): Promise<Inquiry | null> {
    const row = await prisma.inquiry.findUnique({ where: { id } });
    return row ? mapInquiry(row) : null;
  }

  public async list(limit = 100): Promise<Inquiry[]> {
    const rows = await prisma.inquiry.findMany({
      take: limit,
      orderBy: { updatedAt: "desc" }
    });

    return rows.map(mapInquiry);
  }
}
