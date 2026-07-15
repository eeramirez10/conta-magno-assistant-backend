
import { Router } from 'express';
import rateLimit from "express-rate-limit"
import { requiredAdminAuth } from '../middlewares/requiredAdminAuth.js';
import { AuthController } from '../controllers/AuthController.js';
import { AuthApplicationService } from '../../../application/services/AuthApplicationService.js';


export const buildAuthRouter = (authController: AuthController, authService: AuthApplicationService): Router => {

  const router = Router()

  const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      ok: false,
      message: "Demasiados intentos. Intenta de nuevo en unos minutos."
    }
  })


  router.post("/api/auth/login", loginRateLimit, (req, res, next) =>
    authController.login(req, res).catch(next)
  )
  router.post("/api/auth/logout", (req, res, next) =>
    authController.logout(req, res).catch(next)
  );

  router.get("/api/auth/me", requiredAdminAuth(authService), (req, res, next) =>
    authController.me(req, res).catch(next)
  );

  return router;

}