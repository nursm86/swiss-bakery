// Product categories come from data/categories.json, the same file the web
// build reads. Loaded once at boot and validated, so a malformed file stops
// the app starting instead of silently rejecting every product save.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/categories.js or src/categories.ts → repo root is 3 levels up.
const CATEGORIES_JSON_PATH = path.resolve(__dirname, "..", "..", "..", "data", "categories.json");
const MAX_MENU_COLUMNS = 3;
const categorySchema = z.object({
    key: z
        .string()
        .max(40)
        .regex(/^[A-Za-z][A-Za-z0-9]*$/, "letters and digits only, starting with a letter"),
    label: z.string().min(1).max(80),
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    blurb: z.string().max(300),
    menu: z.object({
        title: z.string().min(1).max(80),
        subtitle: z.string().max(120),
        columns: z.number().int().min(1).max(MAX_MENU_COLUMNS),
        order: z.number().int(),
        defaultUnit: z.string().max(20),
    }),
});
const categoriesFileSchema = z
    .object({ categories: z.array(categorySchema).min(1) })
    .superRefine(({ categories }, ctx) => {
    for (const field of ["key", "slug"]) {
        const values = categories.map((c) => c[field]);
        const duplicates = values.filter((v, i) => values.indexOf(v) !== i);
        if (duplicates.length > 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate category ${field}: ${duplicates.join(", ")}` });
        }
    }
});
export const CATEGORIES = categoriesFileSchema.parse(JSON.parse(readFileSync(CATEGORIES_JSON_PATH, "utf-8"))).categories;
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
