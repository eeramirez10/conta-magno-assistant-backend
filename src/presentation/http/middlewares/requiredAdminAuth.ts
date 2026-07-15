import { Request, Response, NextFunction } from "express"
import { AuthApplicationService } from "../../../application/services/AuthApplicationService.js"
import { Env } from "../../../infrastructure/config/env.js"
import { ApiErrorResponseDTO } from "../../../application/dtos/response/common/ApiErrorResponseDTO.js"

export const requiredAdminAuth = (authService: AuthApplicationService) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies?.[Env.authCookieName]
    if (typeof token !== 'string' || !token) {
      res.status(401).json(ApiErrorResponseDTO.fromMessage('Sesion no autenticada'))
      return
    }
    const user = await authService.getAuthenticatedUser(token);
    if (!user) {
      res.status(401).json(ApiErrorResponseDTO.fromMessage('invalid or expired session'))
      return
    }

    res.locals.adminUser = user;

    next();
  }