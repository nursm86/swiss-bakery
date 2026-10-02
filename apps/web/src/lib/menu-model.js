// How products group into categories and subcategories. Used by the homepage
// (build and live refresh), /menu, the footer and the admin, which loads it
// unbundled as /js/menu-model.js, so it must not import anything.

const byDisplayOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0);

/**
 * Splits products into groups: those without a (known) subcategory first, then
 * one group per subcategory in order. Empty groups are left out, and products
 * keep the order they came in.
 * @template {{ subcategoryId?: number | null }} P
 * @param {P[]} products
 * @param {{ id: number, sortOrder?: number }[]} [subcategories]
 */
export const groupBySubcategory = (products, subcategories = []) => {
  const ordered = [...subcategories].sort(byDisplayOrder);
  const knownIds = new Set(ordered.map((s) => s.id));
  const groups = [
    { subcategory: null, products: products.filter((p) => !knownIds.has(p.subcategoryId)) },
    ...ordered.map((subcategory) => ({
      subcategory,
      products: products.filter((p) => p.subcategoryId === subcategory.id),
    })),
  ];
  return groups.filter((group) => group.products.length > 0);
};

/**
 * The menu as customers see it: categories in order, each with its active
 * products grouped by subcategory. Categories with no active products are left out.
 */
export const buildMenuModel = ({ categories, products }) => {
  const activeProducts = products.filter((p) => p.isActive !== false).sort(byDisplayOrder);
  return [...categories]
    .sort(byDisplayOrder)
    .map((category) => {
      const items = activeProducts.filter((p) => p.category === category.key);
      return { ...category, productCount: items.length, groups: groupBySubcategory(items, category.subcategories) };
    })
    .filter((category) => category.productCount > 0);
};

export const featuredProducts = (products) =>
  products.filter((p) => p.isFeatured && p.isActive !== false).sort(byDisplayOrder);

/** One line on the printed menu card. */
export const toBoardItem = (p) => ({
  name: p.name,
  imagePath: p.imagePath,
  priceCents: p.priceCents,
  unit: p.unit || "",
  qty: Number(p.qty) > 1 ? Number(p.qty) : 1,
});

/** The /menu card payload: one band per category, one block per subcategory group. */
export const toBoardPayload = (model) =>
  model.map((category) => ({
    title: category.menu?.title ?? category.label.toUpperCase(),
    subtitle: category.menu?.subtitle ?? "",
    columns: category.menu?.columns ?? 2,
    showPhotos: true,
    groups: category.groups.map((group) => ({
      label: group.subcategory?.label ?? null,
      items: group.products.map(toBoardItem),
    })),
  }));
