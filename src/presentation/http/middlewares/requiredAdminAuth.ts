import { Request, Response, NextFunction } from "express"
import { AuthApplicationService } from "../../../application/services/AuthApplicationService.js"
import { ApiErrorResponseDTO } from "../../../application/dtos/response/common/ApiErrorResponseDTO.js"

function getBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null

  const [scheme, token] = authorization.trim().split(/\s+/, 2)
  return scheme === 'Bearer' && token ? token : null
}

export const requiredAdminAuth = (authService: AuthApplicationService) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = getBearerToken(req.headers.authorization)
    if (!token) {
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
