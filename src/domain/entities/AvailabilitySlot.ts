export class AvailabilitySlot {
  constructor(
    public readonly id: string,
    public date: string,
    public startTime: string,
    public endTime: string,
    public timezone: string,
    public capacity: number,
    public bookedCount: number,
    public isActive: boolean,
    public createdAt: Date,
    public updatedAt: Date
  ) {}
}
