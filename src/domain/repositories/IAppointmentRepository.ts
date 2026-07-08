import { Appointment } from "../entities/Appointment.js";

export interface IAppointmentRepository {
  createTentative(inquiryId: string, slotId: string): Promise<Appointment>;
  updateStatus(id: string, status: Appointment["status"]): Promise<Appointment>;
  attachMeetingLink(id: string, meetingLink: string): Promise<Appointment>;
  findLatestByInquiryId(inquiryId: string): Promise<Appointment | null>;
}
