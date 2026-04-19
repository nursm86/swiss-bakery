import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/authRequired.js";
import { noticeUpsertSchema } from "../schemas.js";

export const noticeRouter: Router = Router();

noticeRouter.get("/", async (_req, res, next) => {
  try {
    const now = new Date();
    const notice = await prisma.notice.findFirst({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ notice });
  } catch (e) {
    next(e);
  }
});

noticeRouter.get("/all", authRequired, async (_req, res, next) => {
  try {
    const notice = await prisma.notice.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    res.json({ notice });
  } catch (e) {
    next(e);
  }
});

noticeRouter.patch("/", authRequired, async (req, res, next) => {
  try {
    const data = noticeUpsertSchema.parse(req.body);
    const existing = await prisma.notice.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    const notice = existing
      ? await prisma.notice.update({ where: { id: existing.id }, data })
      : await prisma.notice.create({ data });
    res.json({ notice });
  } catch (e) {
    next(e);
  }
});
