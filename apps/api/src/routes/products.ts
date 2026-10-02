import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { z } from "zod";
import { resolveProductPlacement } from "../categories.js";
import { parseIdParam } from "../lib/ids.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/authRequired.js";
import { HttpError } from "../middleware/errorHandler.js";
import { productCreateSchema, productUpdateSchema } from "../schemas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/routes/products.js or src/routes/products.ts → repo root is 4 levels up.
const SEED_JSON_PATH = path.resolve(__dirname, "..", "..", "..", "..", "data", "products.seed.json");

const seedProductSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9_-]*$/),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(40),
  priceCents: z.number().int().nonnegative().nullable(),
  unit: z.enum(["piece", "pack", "kg", "cup", "pound", "serve"]),
  qty: z.number().int().min(1).max(999).default(1),
  description: z.string().max(1000).nullable(),
  imagePath: z.string().max(500).nullable(),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});

const seedFileSchema = z.object({ products: z.array(seedProductSchema).min(1) });

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
    const placement = await resolveProductPlacement(data.category, data.subcategoryId ?? null);
    const product = await prisma.product.create({ data: { ...data, ...placement } });
    res.status(201).json({ product });
  } catch (e) {
    next(e);
  }
});

productsRouter.patch("/:id", authRequired, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const data = productUpdateSchema.parse(req.body);
    if (data.category !== undefined || data.subcategoryId !== undefined) {
      const current = await prisma.product.findUnique({ where: { id }, select: { category: true, subcategoryId: true } });
      if (!current) throw new HttpError(404, "Not found");
      const category = data.category ?? current.category;
      // Moving to another category drops the old subcategory unless a new one is sent.
      const isMovingCategory = data.category !== undefined && data.category !== current.category;
      const subcategoryId =
        data.subcategoryId !== undefined ? data.subcategoryId : isMovingCategory ? null : current.subcategoryId;
      Object.assign(data, await resolveProductPlacement(category, subcategoryId));
    }
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

// Reseed the product catalog from data/products.seed.json.
// Overwrites every field on existing slugs (full reset) and creates missing ones.
// Wipes any manual edits the admin made - that's the contract of "Restore".
productsRouter.post("/restore", authRequired, async (_req, res, next) => {
  try {
    let raw: string;
    try {
      raw = await readFile(SEED_JSON_PATH, "utf-8");
    } catch (err) {
      logger.error({ err, path: SEED_JSON_PATH }, "seed file unreadable");
      throw new HttpError(500, "Seed file not found on server");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new HttpError(500, "Seed file is not valid JSON");
    }
    const result = seedFileSchema.safeParse(parsed);
    if (!result.success) {
      logger.warn({ issues: result.error.issues }, "seed file failed schema");
      throw new HttpError(500, "Seed file failed validation");
    }
    const items = result.data.products;
    const knownKeys = new Set((await prisma.category.findMany({ select: { key: true } })).map((c) => c.key));
    const unknownKeys = [...new Set(items.map((p) => p.category))].filter((key) => !knownKeys.has(key));
    if (unknownKeys.length > 0) {
      throw new HttpError(409, `The seed file uses categories that no longer exist: ${unknownKeys.join(", ")}`);
    }

    let created = 0;
    let updated = 0;
    for (const p of items) {
      const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
      await prisma.product.upsert({
        where: { slug: p.slug },
        create: p,
        update: {
          name: p.name,
          category: p.category,
          priceCents: p.priceCents,
          unit: p.unit,
          qty: p.qty,
          description: p.description,
          imagePath: p.imagePath,
          isFeatured: p.isFeatured,
          isActive: p.isActive,
          sortOrder: p.sortOrder,
          // The seed has no subcategories: keep the product's one unless it changes category.
          ...(existing && existing.category !== p.category ? { subcategoryId: null } : {}),
        },
      });
      if (existing) updated++;
      else created++;
    }
    res.json({ ok: true, total: items.length, created, updated });
  } catch (e) {
    next(e);
  }
});
