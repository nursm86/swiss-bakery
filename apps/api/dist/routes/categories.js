import { Router } from "express";
import { CATEGORIES } from "../categories.js";
export const categoriesRouter = Router();
// Public: the admin builds its category dropdown and product grouping from this.
categoriesRouter.get("/", (_req, res) => {
    res.json({ categories: CATEGORIES });
});
