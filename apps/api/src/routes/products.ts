import { Router } from "express";
import { parseIdParam } from "../lib/ids.js";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/authRequired.js";
import { productCreateSchema, productUpdateSchema } from "../schemas.js";

export const productsRouter: Router = Router();

productsRouter.get("/", async (req, res, next) => {
  try {
    const includeInactive = req.query.all === "1";
    const where = includeInactive ? {} : { isActive: true };
    const products = await prisma.product.findMany({
      where,
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    });
    res.json({ products });
  } catch (e) {
    next(e);
  }
});

productsRouter.get("/:id", async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ product });
  } catch (e) {
    next(e);
  }
});

productsRouter.post("/", authRequired, async (req, res, next) => {
  try {
    const data = productCreateSchema.parse(req.body);
    const product = await prisma.product.create({ data });
    res.status(201).json({ product });
  } catch (e) {
    next(e);
  }
});

productsRouter.patch("/:id", authRequired, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const data = productUpdateSchema.parse(req.body);
    const product = await prisma.product.update({ where: { id }, data });
    res.json({ product });
  } catch (e) {
    next(e);
  }
});

productsRouter.delete("/:id", authRequired, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    await prisma.product.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
