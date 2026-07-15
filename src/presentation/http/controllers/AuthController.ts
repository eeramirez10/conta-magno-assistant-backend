import { Request, Response } from "express"
import { AuthApplicationService } from "../../../application/services/AuthApplicationService.js"
import { ApiErrorResponseDTO } from "../../../application/dtos/response/common/ApiErrorResponseDTO.js";
import { Env } from "../../../infrastructure/config/env.js";

export class AuthController {

  constructor(private readonly authService: AuthApplicationService) { }

  login = async (req: Request, res: Response): Promise<void> => {

    const username = typeof req.body?.username === 'string'
      ? req.body.username.trim()
      : "";
    const password = typeof req.body?.password === "string"
      ? req.body.password
      : "";

    if (!username || !password) {
      res.status(400).json(
        ApiErrorResponseDTO.fromMessage("username y password son obligatorios")
      );
      return;
    }


    try {
      const session = await this.authService.login(username, password);

      res.cookie(Env.authCookieName, session.token, {
        httpOnly: true,
        secure: Env.isProduction,
        sameSite: Env.isProduction ? "none" : "lax",
        maxAge: Env.authSessionTtlSeconds * 1000,
        path: "/"
      })

      res.json({
        ok: true,
        data: {
          user: session.user
        }
      })
    } catch (error) {
      res.status(401).json(ApiErrorResponseDTO.fromMessage("Credenciales inválidas"));/*  */
    }

  }

  logout = async (_req: Request, res: Response): Promise<void> => {
    res.clearCookie(Env.authCookieName, {
      httpOnly: true,
      secure: Env.isProduction,
      sameSite: Env.isProduction ? "none" : "lax",
      path: "/"
    })

    res.json({ ok: true })
  }

  me = async(_req: Request, res: Response):Promise<void> => {
    res.json({
      ok:true,
      data:{
        user: res.locals.adminUser
      }
    })
  }
}