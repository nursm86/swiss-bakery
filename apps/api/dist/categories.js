// Product categories live in the database and are edited in the admin's
// Categories tab. Product.category stores Category.key; a product can also
// sit in one of that category's subcategories (Product.subcategoryId).
import { MAX_CATEGORY_KEY_LENGTH, MAX_SLUG_LENGTH, pickUnique, toCategoryKey, toSlug } from "./lib/categoryNaming.js";
import { prisma } from "./lib/prisma.js";
import { planSubcategoryChanges } from "./lib/subcategoryPlan.js";
import { HttpError } from "./middleware/errorHandler.js";
const DISPLAY_ORDER = [{ sortOrder: "asc" }, { id: "asc" }];
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
/** Public list, in display order, with how many active products each category and subcategory has. */
export const listCategories = async () => {
    const [categories, activeCounts] = await Promise.all([
        prisma.category.findMany({ orderBy: DISPLAY_ORDER, include: { subcategories: { orderBy: DISPLAY_ORDER } } }),
        prisma.product.groupBy({ by: ["category", "subcategoryId"], where: { isActive: true }, _count: { _all: true } }),
    ]);
    const countFor = (match) => activeCounts.filter(match).reduce((sum, row) => sum + row._count._all, 0);
    return categories.map((c) => ({
        id: c.id,
        key: c.key,
        label: c.label,
        slug: c.slug,
        blurb: c.blurb,
        sortOrder: c.sortOrder,
        activeProductCount: countFor((row) => row.category === c.key),
        menu: { title: c.label.toUpperCase(), subtitle: c.menuSubtitle, columns: c.menuColumns },
        subcategories: c.subcategories.map((s) => ({
            id: s.id,
            label: s.label,
            slug: s.slug,
            sortOrder: s.sortOrder,
            activeProductCount: countFor((row) => row.subcategoryId === s.id),
        })),
    }));
};
const findCategoryOr404 = async (key) => {
    const category = await prisma.category.findUnique({ where: { key }, include: { subcategories: true } });
    if (!category)
        throw new HttpError(404, "Category not found");
    return category;
};
const assertLabelFree = async (label, exceptId) => {
    const clash = await prisma.category.findFirst({ where: { label, NOT: exceptId ? { id: exceptId } : undefined } });
    if (clash)
        throw new HttpError(409, `A category called "${clash.label}" already exists`);
};
const planOrThrow = (...args) => {
    const result = planSubcategoryChanges(...args);
    if (!result.ok)
        throw new HttpError(400, result.error);
    return result.plan;
};
export const createCategory = async (input) => {
    await assertLabelFree(input.label);
    const existing = await prisma.category.findMany({ select: { key: true, slug: true, sortOrder: true } });
    const key = pickUnique(toCategoryKey(input.label), existing.map((c) => c.key), MAX_CATEGORY_KEY_LENGTH);
    const slug = pickUnique(toSlug(input.label), existing.map((c) => c.slug), MAX_SLUG_LENGTH, "-");
    const plan = planOrThrow([], input.subcategories);
    await prisma.category.create({
        data: {
            key,
            slug,
            label: input.label,
            blurb: input.blurb,
            menuSubtitle: input.menuSubtitle,
            menuColumns: input.menuColumns,
            sortOrder: Math.max(0, ...existing.map((c) => c.sortOrder)) + 1,
            subcategories: { create: plan.create },
        },
    });
    return key;
};
/** Updates the fields sent. subcategories, when sent, is the full ordered list; dropped ones un-assign their products. */
export const updateCategory = async (key, input) => {
    const category = await findCategoryOr404(key);
    if (input.label !== undefined)
        await assertLabelFree(input.label, category.id);
    const plan = input.subcategories ? planOrThrow(category.subcategories, input.subcategories) : null;
    await prisma.$transaction([
        prisma.category.update({
            where: { id: category.id },
            data: { label: input.label, blurb: input.blurb, menuSubtitle: input.menuSubtitle, menuColumns: input.menuColumns },
        }),
        ...(plan
            ? [
                prisma.subcategory.deleteMany({ where: { id: { in: plan.remove } } }),
                ...plan.update.map((s) => prisma.subcategory.update({ where: { id: s.id }, data: { label: s.label, sortOrder: s.sortOrder } })),
                ...plan.create.map((s) => prisma.subcategory.create({ data: { ...s, categoryId: category.id } })),
            ]
            : []),
    ]);
};
export const reorderCategories = async (keys) => {
    const existing = await prisma.category.findMany({ select: { key: true } });
    const isSameSet = keys.length === existing.length && new Set(keys).size === keys.length && existing.every((c) => keys.includes(c.key));
    if (!isSameSet)
        throw new HttpError(400, "Send every category key exactly once (reload and try again)");
    await prisma.$transaction(keys.map((key, index) => prisma.category.update({ where: { key }, data: { sortOrder: index + 1 } })));
};
export const deleteCategory = async (key) => {
    const category = await findCategoryOr404(key);
    const productCount = await prisma.product.count({ where: { category: category.key } });
    if (productCount > 0) {
        throw new HttpError(409, `Move or delete the ${plural(productCount, "product")} in ${category.label} first`);
    }
    await prisma.category.delete({ where: { id: category.id } });
};
/**
 * Checks a product's category and subcategory and returns them as stored
 * (the canonical key, since the database compares keys case-insensitively).
 */
export const resolveProductPlacement = async (categoryKey, subcategoryId) => {
    const category = await prisma.category.findUnique({ where: { key: categoryKey }, select: { id: true, key: true } });
    if (!category)
        throw new HttpError(400, `Unknown category "${categoryKey}"`);
    if (subcategoryId === null)
        return { category: category.key, subcategoryId: null };
    const subcategory = await prisma.subcategory.findUnique({ where: { id: subcategoryId }, select: { categoryId: true } });
    if (subcategory?.categoryId !== category.id) {
        throw new HttpError(400, "That subcategory belongs to another category");
    }
    return { category: category.key, subcategoryId };
};
