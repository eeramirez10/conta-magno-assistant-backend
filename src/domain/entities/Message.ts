export class Message {
  constructor(
    public readonly id: string,
    public readonly conversationId: string,
    public readonly direction: "IN" | "OUT",
    public providerMessageId: string | null,
    public text: string,
    public rawPayload: unknown,
    public createdAt: Date,
    public openAiSyncedAt: Date | null = null,
    public attachments: Array<{id:string;name:string;mime:string;size:number;status:string;transcript:string|null;error:string|null}> = []
  ) {}
}
