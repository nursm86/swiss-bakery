import { Router } from "express";
import { createCategory, deleteCategory, listCategories, reorderCategories, updateCategory } from "../categories.js";
import { authRequired } from "../middleware/authRequired.js";
import { categoryCreateSchema, categoryOrderSchema, categoryUpdateSchema } from "../schemas.js";
export const categoriesRouter = Router();
// Public: the website, /menu and the admin all build their category lists from this.
categoriesRouter.get("/", async (_req, res, next) => {
    try {
        res.json({ categories: await listCategories() });
    }
    catch (e) {
        next(e);
    }
});
categoriesRouter.post("/", authRequired, async (req, res, next) => {
    try {
        const key = await createCategory(categoryCreateSchema.parse(req.body));
        const categories = await listCategories();
        res.status(201).json({ category: categories.find((c) => c.key === key), categories });
    }
    catch (e) {
        next(e);
    }
});
categoriesRouter.put("/order", authRequired, async (req, res, next) => {
    try {
        await reorderCategories(categoryOrderSchema.parse(req.body).keys);
        res.json({ categories: await listCategories() });
    }
    catch (e) {
        next(e);
    }
});
categoriesRouter.patch("/:key", authRequired, async (req, res, next) => {
    try {
        const key = String(req.params.key);
        await updateCategory(key, categoryUpdateSchema.parse(req.body));
        const categories = await listCategories();
        res.json({ category: categories.find((c) => c.key === key), categories });
    }
    catch (e) {
        next(e);
    }
});
categoriesRouter.delete("/:key", authRequired, async (req, res, next) => {
    try {
        await deleteCategory(String(req.params.key));
        res.json({ categories: await listCategories() });
    }
    catch (e) {
        next(e);
    }
});
