
import bcrypt from 'bcryptjs';
import { IAdminUserRepository } from '../../domain/repositories/IAdminUserRepository.js';
import { Env } from '../../infrastructure/config/env.js';
import { jwtVerify, SignJWT } from 'jose';

export type AuthenticatedAdminUser = {
  id: string
  username: string

}

export class AuthApplicationService {
  private readonly secret: Uint8Array

  constructor(private readonly adminUserRepository: IAdminUserRepository) {

    if (Env.authJwtSecret.length < 32) {
      throw new Error('AUTH_JWT_SECRET debe tener al menos 32 caracteres')
    }

    this.secret = new TextEncoder().encode(Env.authJwtSecret);
  }

  public async login(username: string, password: string): Promise<{ token: string, user: AuthenticatedAdminUser }> {

    const user = await this.adminUserRepository.findByUsername(username.trim().toLocaleLowerCase());

    if (!user || !user.isActive) throw new Error('Invalid credentials');

    const passworsMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passworsMatches) throw new Error('Invalid credentials')

    const now = Math.floor(Date.now() / 1000);

    const token = await new SignJWT({ username: user.username })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt(now)
      .setExpirationTime(now + Env.authSessionTtlSeconds)
      .sign(this.secret)

    await this.adminUserRepository.updateLastLogin(user.id)

    return {
      token,
      user: {
        id: user.id,
        username: user.username
      }
    }

  }

      public async getAuthenticatedUser(
      token: string
    ): Promise<AuthenticatedAdminUser | null> {
      try {
        const { payload } = await jwtVerify(token, this.secret, {
          algorithms: ["HS256"]
        });

        if (!payload.sub) {
          return null;
        }

        const user = await this.adminUserRepository.findById(payload.sub);

        if (!user || !user.isActive) {
          return null;
        }

        return {
          id: user.id,
          username: user.username
        };
      } catch {
        return null;
      }
    }

}
