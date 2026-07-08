export class Contact {
  constructor(
    public readonly id: string,
    public readonly waId: string,
    public fullName: string,
    public phoneE164: string,
    public email: string | null,
    public timezone: string,
    public consentPrivacy: boolean,
    public createdAt: Date,
    public updatedAt: Date
  ) {}
}
