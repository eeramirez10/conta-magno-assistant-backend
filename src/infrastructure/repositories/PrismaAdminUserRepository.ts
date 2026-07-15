import { AdminUser } from "../../domain/entities/AdminUser.js";
import { IAdminUserRepository } from "../../domain/repositories/IAdminUserRepository.js";
import { prisma } from "../database/prisma.js";



type AdminUserRow = {
  id: string;
  username: string;
  passwordHash: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};



export class PrismaAdminUserRepository implements IAdminUserRepository {


  private toEntity(row: AdminUserRow): AdminUser {

    return new AdminUser(
      row.id,
      row.username,
      row.passwordHash,
      row.isActive,
      row.lastLoginAt,
      row.createdAt,
      row.updatedAt,
    );

  }

  async findById(id: string): Promise<AdminUser | null> {
    const user = await prisma.adminUser.findUnique({ where: { id } })

    return user ? this.toEntity(user) : null;
  }


  async findByUsername(username: string): Promise<AdminUser | null> {
    const row = await prisma.adminUser.findUnique({ where: { username } })

    return row ? this.toEntity(row) : null;
  }
  async create(payload: { username: string, passwordHash: string }): Promise<AdminUser> {
    const newUser = await prisma.adminUser.create({ data: payload })

    return this.toEntity(newUser);
  }
  async updateLastLogin(id: string): Promise<void> {
    await prisma.adminUser.update({
      where: { id },
      data: {
        lastLoginAt: new Date()
      }
    })
  }

}