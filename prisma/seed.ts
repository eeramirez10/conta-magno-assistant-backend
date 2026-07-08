import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run(): Promise<void> {
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);

  await prisma.availabilitySlot.createMany({
    data: [
      { date: isoDate, startTime: "19:00", endTime: "19:30", timezone: "America/Mexico_City" },
      { date: isoDate, startTime: "19:30", endTime: "20:00", timezone: "America/Mexico_City" },
      { date: isoDate, startTime: "20:00", endTime: "20:30", timezone: "America/Mexico_City" }
    ],
    skipDuplicates: true
  });

  console.log("Seed completed");
}

run()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
