  import bcrypt from "bcryptjs";
  import { PrismaAdminUserRepository } from "../infrastructure/repositories/PrismaAdminUserRepository.js";
  import { prisma } from "../infrastructure/database/prisma.js";

  async function run(): Promise<void> {
    const [rawUsername, password] = process.argv.slice(2);
    const username = rawUsername?.trim().toLowerCase();

    if (!username || !password || password.length < 8) {
      throw new Error(
        "Uso: pnpm exec tsx src/scripts/createAdminUser.ts usuario password-de-12-caracteres"
      );
    }

    const repository = new PrismaAdminUserRepository();
    const existingUser = await repository.findByUsername(username);

    if (existingUser) {
      throw new Error("Ese usuario ya existe");
    }

    const passwordHash = await bcrypt.hash(password, 8);
    await repository.create({ username, passwordHash });

    console.log(`Administrador ${username} creado`);
  }

  run()
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });