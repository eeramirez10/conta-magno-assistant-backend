import { Contact } from "../../domain/entities/Contact.js";
import { IContactRepository } from "../../domain/repositories/IContactRepository.js";
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

  public async upsertByWaId(payload: {
    waId: string;
    fullName: string;
    phoneE164: string;
    email?: string | null;
    timezone?: string;
    consentPrivacy?: boolean;
  }): Promise<Contact> {
    const row = await prisma.contact.upsert({
      where: { waId: payload.waId },
      update: {
        fullName: payload.fullName,
        phoneE164: payload.phoneE164,
        email: payload.email ?? null,
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
