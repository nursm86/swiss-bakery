import { ZodError } from "zod";
import { logger } from "../lib/logger.js";
// Map Prisma error codes that have an obvious HTTP equivalent.
const prismaErrors = {
    P2025: { status: 404, message: "Not found" }, // record to update/delete not found
    P2002: { status: 409, message: "Conflict (already exists)" }, // unique constraint
    P2003: { status: 409, message: "Conflict (linked to another record)" }, // foreign key
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
        const mapped = prismaErrors[code];
        if (mapped) {
            res.status(mapped.status).json({ error: mapped.message, code });
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
