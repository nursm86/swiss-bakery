import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "./prisma.js";

const ACCESS_TTL = "15m";
const REFRESH_TTL_DAYS = 7;

export type AccessPayload = { sub: string; role: "admin" };

export const signAccessToken = (subject: string): string => {
  const opts: SignOptions = { algorithm: "HS256", expiresIn: ACCESS_TTL };
  return jwt.sign({ sub: subject, role: "admin" }, config.jwtSecret, opts);
};

export const verifyAccessToken = (token: string): AccessPayload => {
  const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Invalid access token");
  }
  return decoded as AccessPayload;
};

export const issueRefreshToken = async (subject: string): Promise<string> => {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { id, subject, expiresAt } });
  const opts: SignOptions = {
    algorithm: "HS256",
    expiresIn: `${REFRESH_TTL_DAYS}d`,
    jwtid: id,
    subject,
  };
  return jwt.sign({}, config.jwtRefreshSecret, opts);
};

export const rotateRefreshToken = async (
  oldToken: string,
): Promise<{ subject: string; newRefresh: string; newAccess: string }> => {
  const decoded = jwt.verify(oldToken, config.jwtRefreshSecret, { algorithms: ["HS256"] });
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Invalid refresh token");
  }
  const jti = (decoded as { jti?: string }).jti;
  const subject = (decoded as { sub?: string }).sub;
  if (!jti || !subject) throw new Error("Malformed refresh token");

  const existing = await prisma.refreshToken.findUnique({ where: { id: jti } });
  if (!existing || existing.revokedAt || existing.subject !== subject) {
    throw new Error("Refresh token revoked or unknown");
  }
  if (existing.expiresAt.getTime() < Date.now()) {
    throw new Error("Refresh token expired");
  }

  await prisma.refreshToken.update({
    where: { id: jti },
    data: { revokedAt: new Date() },
  });

  const newRefresh = await issueRefreshToken(subject);
  const newAccess = signAccessToken(subject);
  return { subject, newRefresh, newAccess };
};

export const revokeRefreshToken = async (token: string | undefined): Promise<void> => {
  if (!token) return;
  try {
    const decoded = jwt.verify(token, config.jwtRefreshSecret, { algorithms: ["HS256"] });
    const jti = (decoded as { jti?: string }).jti;
    if (!jti) return;
    await prisma.refreshToken.update({
      where: { id: jti },
      data: { revokedAt: new Date() },
    });
  } catch {
    /* ignore - invalid cookie */
  }
};

export const refreshCookieOptions = () =>
  ({
    httpOnly: true,
    secure: config.isProd,
    sameSite: "strict" as const,
    path: "/api/auth",
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
