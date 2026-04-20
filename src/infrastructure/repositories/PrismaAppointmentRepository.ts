import { AppointmentStatus as PrismaAppointmentStatus } from "@prisma/client";
import { Appointment } from "../../domain/entities/Appointment.js";
import { IAppointmentRepository } from "../../domain/repositories/IAppointmentRepository.js";
import { prisma } from "../database/prisma.js";

function mapAppointment(row: {
  id: string;
  inquiryId: string;
  slotId: string;
  status: PrismaAppointmentStatus;
  meetingLink: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): Appointment {
  return new Appointment(
    row.id,
    row.inquiryId,
    row.slotId,
    row.status as Appointment["status"],
    row.meetingLink,
    row.createdBy as Appointment["createdBy"],
    row.createdAt,
    row.updatedAt
  );
}

export class PrismaAppointmentRepository implements IAppointmentRepository {
  public async createTentative(inquiryId: string, slotId: string): Promise<Appointment> {
    const row = await prisma.appointment.create({
      data: {
        inquiryId,
        slotId,
        status: PrismaAppointmentStatus.TENTATIVE,
        createdBy: "ASSISTANT"
      }
    });

    return mapAppointment(row);
  }

  public async updateStatus(id: string, status: Appointment["status"]): Promise<Appointment> {
    const row = await prisma.appointment.update({
      where: { id },
      data: { status: status as PrismaAppointmentStatus }
    });

    return mapAppointment(row);
  }

  public async attachMeetingLink(id: string, meetingLink: string): Promise<Appointment> {
    const row = await prisma.appointment.update({
      where: { id },
      data: { meetingLink }
    });

    return mapAppointment(row);
  }

  public async findLatestByInquiryId(inquiryId: string): Promise<Appointment | null> {
    const row = await prisma.appointment.findFirst({
      where: { inquiryId },
      orderBy: { createdAt: "desc" }
    });

    return row ? mapAppointment(row) : null;
  }
}
