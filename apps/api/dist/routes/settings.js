import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/authRequired.js";
import { PUBLIC_SETTING_KEYS, settingsUpdateSchema } from "../schemas.js";
export const settingsRouter = Router();
settingsRouter.get("/", async (_req, res, next) => {
    try {
        const rows = await prisma.siteSetting.findMany({
            where: { key: { in: [...PUBLIC_SETTING_KEYS] } },
        });
        const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        res.json({ settings });
    }
    catch (e) {
        next(e);
    }
});
settingsRouter.patch("/", authRequired, async (req, res, next) => {
    try {
        const items = settingsUpdateSchema.parse(req.body);
        await prisma.$transaction(items.map((item) => prisma.siteSetting.upsert({
            where: { key: item.key },
            create: { key: item.key, value: item.value },
            update: { value: item.value },
        })));
        const rows = await prisma.siteSetting.findMany({
            where: { key: { in: [...PUBLIC_SETTING_KEYS] } },
        });
        const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        res.json({ settings });
    }
    catch (e) {
        next(e);
    }
});
