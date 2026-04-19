import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt.js";

declare module "express-serve-static-core" {
  interface Request {
    admin?: { sub: string; role: "admin" };
  }
}

export const authRequired = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.header("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer ?? (req.cookies?.access_token as string | undefined);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    req.admin = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};
