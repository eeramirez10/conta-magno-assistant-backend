
export class AdminUser {
  constructor(
    public readonly id: string,
    public readonly username: string,
    public readonly passwordHash: string,
    public readonly isActive: boolean,
    public readonly lastLoginAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) { }

}