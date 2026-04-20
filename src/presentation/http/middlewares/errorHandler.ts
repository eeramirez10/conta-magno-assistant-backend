import { NextFunction, Request, Response } from "express";
import { ApiErrorResponseDTO } from "../../../application/dtos/response/common/ApiErrorResponseDTO.js";
import { logger } from "../../../infrastructure/logging/logger.js";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const message = error instanceof Error ? error.message : "Error interno";
  logger.error(
    {
      err: error,
      method: _req.method,
      path: _req.path
    },
    "Unhandled error"
  );

  if (res.headersSent) {
    return;
  }

  res.status(500).json(ApiErrorResponseDTO.fromMessage(message));
}
