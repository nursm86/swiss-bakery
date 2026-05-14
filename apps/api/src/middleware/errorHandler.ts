import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";

// Map Prisma error codes that have an obvious HTTP equivalent.
// P2025 = "Record to update/delete not found" → 404
// P2002 = "Unique constraint failed"           → 409
const prismaCodeToStatus: Record<string, number> = {
  P2025: 404,
  P2002: 409,
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", issues: err.issues });
    return;
  }
  if (err instanceof Error && "status" in err && typeof err.status === "number") {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Prisma error → friendly HTTP status
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  ) {
    const code = (err as { code: string }).code;
    const mapped = prismaCodeToStatus[code];
    if (mapped) {
      const msg =
        mapped === 404
          ? "Not found"
          : mapped === 409
            ? "Conflict (already exists)"
            : "Database error";
      res.status(mapped).json({ error: msg, code });
      return;
    }
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
};

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
