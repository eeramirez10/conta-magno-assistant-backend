export class Appointment {
  constructor(
    public readonly id: string,
    public readonly inquiryId: string,
    public readonly slotId: string,
    public status: "TENTATIVE" | "CONFIRMED" | "RESCHEDULED" | "CANCELLED",
    public meetingLink: string | null,
    public createdBy: "ASSISTANT" | "ADMIN",
    public createdAt: Date,
    public updatedAt: Date
  ) {}
}
