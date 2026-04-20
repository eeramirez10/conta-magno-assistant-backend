export class Message {
  constructor(
    public readonly id: string,
    public readonly conversationId: string,
    public readonly direction: "IN" | "OUT",
    public providerMessageId: string | null,
    public text: string,
    public rawPayload: unknown,
    public createdAt: Date
  ) {}
}
