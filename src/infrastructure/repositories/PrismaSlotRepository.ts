import { AvailabilitySlot } from "../../domain/entities/AvailabilitySlot.js";
import { ISlotRepository } from "../../domain/repositories/ISlotRepository.js";
import { prisma } from "../database/prisma.js";

function mapSlot(row: {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  capacity: number;
  bookedCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AvailabilitySlot {
  return new AvailabilitySlot(
    row.id,
    row.date,
    row.startTime,
    row.endTime,
    row.timezone,
    row.capacity,
    row.bookedCount,
    row.isActive,
    row.createdAt,
    row.updatedAt
  );
}

export class PrismaSlotRepository implements ISlotRepository {
  public async listAvailable(fromDate: string, limit: number): Promise<AvailabilitySlot[]> {
    const rows = await prisma.availabilitySlot.findMany({
      where: {
        isActive: true,
        date: { gte: fromDate }
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: limit * 2
    });

    return rows
      .filter((row) => row.bookedCount < row.capacity)
      .slice(0, limit)
      .map(mapSlot);
  }

  public async reserve(slotId: string): Promise<AvailabilitySlot | null> {
    const current = await prisma.availabilitySlot.findUnique({ where: { id: slotId } });
    if (!current || !current.isActive || current.bookedCount >= current.capacity) {
      return null;
    }

    const row = await prisma.availabilitySlot.update({
      where: { id: slotId },
      data: { bookedCount: { increment: 1 } }
    });

    return mapSlot(row);
  }
}
