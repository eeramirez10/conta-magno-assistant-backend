import { Contact } from "../entities/Contact.js";

export interface IContactRepository {
  findById(id: string): Promise<Contact | null>;
  findByWaId(waId: string): Promise<Contact | null>;
  upsertByWaId(payload: {
    waId: string;
    fullName: string;
    phoneE164: string;
    email?: string | null;
    timezone?: string;
    consentPrivacy?: boolean;
  }): Promise<Contact>;
}
