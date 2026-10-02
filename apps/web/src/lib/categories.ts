// Build-time snapshot of the product categories (data/categories.json). The
// live list is in the database, edited in the admin's Categories tab; the
// homepage, footer and /menu re-render from GET /api/categories on load.
import categoriesJson from "../../../../data/categories.json" with { type: "json" };

export type Subcategory = { id: number; label: string; slug: string; sortOrder: number };

export type Category = {
  key: string;
  label: string;
  slug: string;
  blurb: string;
  menu: { title: string; subtitle: string; columns: number };
  subcategories?: Subcategory[];
};

export const CATEGORIES: readonly Category[] = categoriesJson.categories;
