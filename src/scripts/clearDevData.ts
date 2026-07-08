import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function assertDevelopmentEnvironment(): void {
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  if (nodeEnv !== "development") {
    throw new Error(`Abortado: db:clear:dev solo puede ejecutarse en NODE_ENV=development (actual: "${nodeEnv || "undefined"}").`);
  }
}

async function run(): Promise<void> {
  assertDevelopmentEnvironment();

  const notificationEvents = await prisma.notificationEvent.deleteMany();
  const appointments = await prisma.appointment.deleteMany();
  const messages = await prisma.message.deleteMany();
  const inquiries = await prisma.inquiry.deleteMany();
  const conversations = await prisma.conversation.deleteMany();
  const contacts = await prisma.contact.deleteMany();
  const slots = await prisma.availabilitySlot.deleteMany();

  console.log("Data limpiada en desarrollo:");
  console.log(`- NotificationEvent: ${notificationEvents.count}`);
  console.log(`- Appointment: ${appointments.count}`);
  console.log(`- Message: ${messages.count}`);
  console.log(`- Inquiry: ${inquiries.count}`);
  console.log(`- Conversation: ${conversations.count}`);
  console.log(`- Contact: ${contacts.count}`);
  console.log(`- AvailabilitySlot: ${slots.count}`);
}

run()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
