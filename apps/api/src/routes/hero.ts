import { Router } from "express";
import { parseIdParam } from "../lib/ids.js";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/authRequired.js";
import { heroCreateSchema, heroUpdateSchema } from "../schemas.js";

export const heroRouter: Router = Router();

heroRouter.get("/", async (_req, res, next) => {
  try {
    const banners = await prisma.heroBanner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    res.json({ banners });
  } catch (e) {
    next(e);
  }
});

heroRouter.get("/all", authRequired, async (_req, res, next) => {
  try {
    const banners = await prisma.heroBanner.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    res.json({ banners });
  } catch (e) {
    next(e);
  }
});

heroRouter.post("/", authRequired, async (req, res, next) => {
  try {
    const data = heroCreateSchema.parse(req.body);
    const banner = await prisma.heroBanner.create({ data });
    res.status(201).json({ banner });
  } catch (e) {
    next(e);
  }
});

heroRouter.patch("/:id", authRequired, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const data = heroUpdateSchema.parse(req.body);
    const banner = await prisma.heroBanner.update({ where: { id }, data });
    res.json({ banner });
  } catch (e) {
    next(e);
  }
});

heroRouter.delete("/:id", authRequired, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    await prisma.heroBanner.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
