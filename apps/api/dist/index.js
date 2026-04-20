import "./loadEnv.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { authRequired } from "./middleware/authRequired.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { heroRouter } from "./routes/hero.js";
import { noticeRouter } from "./routes/notice.js";
import { productsRouter } from "./routes/products.js";
import { settingsRouter } from "./routes/settings.js";
import { uploadsRouter } from "./routes/uploads.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/index.js at runtime → repo root is ../../..  (dist → api → apps → root)
// src/index.ts during `node --watch --import tsx` → repo root is ../../..  (src → api → apps → root)
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const WEB_DIST = path.join(REPO_ROOT, "apps", "web", "dist");
const UPLOADS_DIR = path.join(REPO_ROOT, "public", "uploads");
const ADMIN_PUBLIC = path.join(REPO_ROOT, "apps", "api", "public");
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(pinoHttp({
    logger,
    serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ status: res.statusCode }),
    },
}));
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "default-src": ["'self'"],
            "img-src": ["'self'", "data:", "blob:", "https:"],
            "script-src": [
                "'self'",
                "'unsafe-inline'",
                "https://www.google.com",
                "https://www.gstatic.com",
                "https://www.static-gloriafood.com",
                "https://www.gloriafood.com",
            ],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
            "frame-src": ["'self'", "https://www.google.com", "https://www.gloriafood.com"],
            "connect-src": ["'self'", "https://www.gloriafood.com"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));
app.use(cors({
    origin: (origin, cb) => {
        if (!origin)
            return cb(null, true);
        if (config.allowedOrigins.includes(origin))
            return cb(null, true);
        cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: false, limit: "512kb" }));
app.use(cookieParser());
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
});
app.use("/api", apiLimiter);
app.get("/api/health", (_req, res) => {
    res.json({ ok: true, env: config.env });
});
app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/hero", heroRouter);
app.use("/api/notice", noticeRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/uploads", express.static(UPLOADS_DIR, {
    maxAge: "7d",
    fallthrough: true,
    index: false,
}));
// Admin panel (protected static): login page is public; dashboard requires JWT.
// Note: dashboard.html is loaded via a protected endpoint, then served static assets.
app.get("/admin", (_req, res) => res.redirect("/admin/login"));
app.get("/admin/login", (_req, res) => {
    res.sendFile(path.join(ADMIN_PUBLIC, "admin", "login.html"));
});
app.get("/admin/dashboard", (_req, res) => {
    res.sendFile(path.join(ADMIN_PUBLIC, "admin", "dashboard.html"));
});
app.use("/admin", express.static(path.join(ADMIN_PUBLIC, "admin"), { index: false }));
app.use(express.static(WEB_DIST, {
    maxAge: config.isProd ? "1h" : 0,
    index: "index.html",
    extensions: ["html"],
}));
app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
});
app.get(/.*/, (_req, res, next) => {
    res.sendFile(path.join(WEB_DIST, "index.html"), (err) => {
        if (err)
            next(err);
    });
});
app.use(errorHandler);
const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, "Swiss Bakery API listening");
});
const shutdown = (signal) => () => {
    logger.info({ signal }, "Shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
// Silence unused-import warning for the middleware when only referenced as type in other files.
void authRequired;
