import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/authRequired.js";
import { HttpError } from "../middleware/errorHandler.js";
import { pageCreateSchema, pageUpdateSchema } from "../schemas.js";
export const pagesRouter = Router();
// Public: list all published pages (lightweight — no content)
pagesRouter.get("/", async (_req, res, next) => {
    try {
        const pages = await prisma.page.findMany({
            where: { isPublished: true },
            select: { slug: true, title: true, updatedAt: true },
            orderBy: { slug: "asc" },
        });
        res.json({ pages });
    }
    catch (e) {
        next(e);
    }
});
// Admin: list ALL pages (draft + published) with content
pagesRouter.get("/all", authRequired, async (_req, res, next) => {
    try {
        const pages = await prisma.page.findMany({ orderBy: { slug: "asc" } });
        res.json({ pages });
    }
    catch (e) {
        next(e);
    }
});
// Public: fetch one page by slug
pagesRouter.get("/:slug", async (req, res, next) => {
    try {
        const slug = String(req.params.slug);
        const page = await prisma.page.findUnique({ where: { slug } });
        if (!page || !page.isPublished) {
            res.status(404).json({ error: "Not found" });
            return;
        }
        res.json({ page });
    }
    catch (e) {
        next(e);
    }
});
// Admin: create
pagesRouter.post("/", authRequired, async (req, res, next) => {
    try {
        const data = pageCreateSchema.parse(req.body);
        const page = await prisma.page.create({ data });
        res.status(201).json({ page });
    }
    catch (e) {
        next(e);
    }
});
// Admin: update by slug (upsert-ish — the common flow is "edit existing")
pagesRouter.patch("/:slug", authRequired, async (req, res, next) => {
    try {
        const slug = String(req.params.slug);
        const data = pageUpdateSchema.parse(req.body);
        const existing = await prisma.page.findUnique({ where: { slug } });
        if (!existing)
            throw new HttpError(404, "Page not found");
        const page = await prisma.page.update({ where: { slug }, data });
        res.json({ page });
    }
    catch (e) {
        next(e);
    }
});
// Admin: delete
pagesRouter.delete("/:slug", authRequired, async (req, res, next) => {
    try {
        const slug = String(req.params.slug);
        await prisma.page.delete({ where: { slug } });
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
