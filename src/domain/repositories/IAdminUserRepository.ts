import { AdminUser } from "../entities/AdminUser.js";

export interface IAdminUserRepository {
  findById(id:string):Promise<AdminUser| null>
  findByUsername(username:string):Promise<AdminUser | null>
  create(payload:{username:string, passwordHash:string}/*  */):Promise<AdminUser>
  updateLastLogin(id:string):Promise<void>
}