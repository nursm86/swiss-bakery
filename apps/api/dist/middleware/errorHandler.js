import { ZodError } from "zod";
import { logger } from "../lib/logger.js";
// Map Prisma error codes that have an obvious HTTP equivalent.
// P2025 = "Record to update/delete not found" → 404
// P2002 = "Unique constraint failed"           → 409
const prismaCodeToStatus = {
    P2025: 404,
    P2002: 409,
};
export const errorHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
        res.status(400).json({ error: "Validation failed", issues: err.issues });
        return;
    }
    if (err instanceof Error && "status" in err && typeof err.status === "number") {
        res.status(err.status).json({ error: err.message });
        return;
    }
    // Prisma error → friendly HTTP status
    if (err &&
        typeof err === "object" &&
        "code" in err &&
        typeof err.code === "string") {
        const code = err.code;
        const mapped = prismaCodeToStatus[code];
        if (mapped) {
            const msg = mapped === 404
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
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
