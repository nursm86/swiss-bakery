import { HttpError } from "../middleware/errorHandler.js";
export const parseIdParam = (raw) => {
    if (typeof raw !== "string")
        throw new HttpError(400, "Invalid id");
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0)
        throw new HttpError(400, "Invalid id");
    return n;
};
