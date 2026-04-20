import { verifyAccessToken } from "../lib/jwt.js";
export const authRequired = (req, res, next) => {
    const header = req.header("authorization");
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const token = bearer ?? req.cookies?.access_token;
    if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        req.admin = verifyAccessToken(token);
        next();
    }
    catch {
        res.status(401).json({ error: "Unauthorized" });
    }
};
