import argon2 from "argon2";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";
import { issueRefreshToken, refreshCookieOptions, revokeRefreshToken, rotateRefreshToken, signAccessToken, } from "../lib/jwt.js";
import { logger } from "../lib/logger.js";
import { HttpError } from "../middleware/errorHandler.js";
import { loginSchema } from "../schemas.js";
export const authRouter = Router();
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many login attempts. Try again in 15 minutes." },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
authRouter.post("/login", loginLimiter, async (req, res, next) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const expectedEmail = config.adminEmail.toLowerCase();
        const emailMatches = email.toLowerCase() === expectedEmail;
        let passwordMatches = false;
        try {
            passwordMatches = await argon2.verify(config.adminPasswordHash, password);
        }
        catch (e) {
            logger.warn({ err: e }, "argon2.verify threw");
            passwordMatches = false;
        }
        if (!emailMatches || !passwordMatches) {
            await sleep(250);
            throw new HttpError(401, "Invalid email or password");
        }
        const subject = expectedEmail;
        const accessToken = signAccessToken(subject);
        const refreshToken = await issueRefreshToken(subject);
        res.cookie("refresh_token", refreshToken, refreshCookieOptions());
        res.json({ accessToken, email: subject });
    }
    catch (e) {
        next(e);
    }
});
authRouter.post("/refresh", async (req, res, next) => {
    try {
        const token = req.cookies?.refresh_token;
        if (!token)
            throw new HttpError(401, "No refresh token");
        const { subject, newRefresh, newAccess } = await rotateRefreshToken(token);
        res.cookie("refresh_token", newRefresh, refreshCookieOptions());
        res.json({ accessToken: newAccess, email: subject });
    }
    catch (e) {
        if (e instanceof Error) {
            next(new HttpError(401, "Session expired"));
        }
        else {
            next(e);
        }
    }
});
authRouter.post("/logout", async (req, res, next) => {
    try {
        const token = req.cookies?.refresh_token;
        await revokeRefreshToken(token);
        res.clearCookie("refresh_token", { ...refreshCookieOptions(), maxAge: 0 });
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
authRouter.get("/me", async (req, res) => {
    const header = req.header("authorization");
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!bearer) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const { verifyAccessToken } = await import("../lib/jwt.js");
        const payload = verifyAccessToken(bearer);
        res.json({ email: payload.sub });
    }
    catch {
        res.status(401).json({ error: "Unauthorized" });
    }
});
