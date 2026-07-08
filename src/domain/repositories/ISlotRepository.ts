import { AvailabilitySlot } from "../entities/AvailabilitySlot.js";

export interface ISlotRepository {
  listAvailable(fromDate: string, limit: number): Promise<AvailabilitySlot[]>;
  reserve(slotId: string): Promise<AvailabilitySlot | null>;
}
