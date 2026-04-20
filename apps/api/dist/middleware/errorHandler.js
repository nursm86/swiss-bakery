import { ZodError } from "zod";
import { logger } from "../lib/logger.js";
export const errorHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
        res.status(400).json({ error: "Validation failed", issues: err.issues });
        return;
    }
    if (err instanceof Error && "status" in err && typeof err.status === "number") {
        res.status(err.status).json({ error: err.message });
        return;
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
