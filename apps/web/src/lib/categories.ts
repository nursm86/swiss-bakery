// Product categories, from the same data/categories.json the API validates
// against. Array order is the homepage order; menu.order is the /menu card order.
import categoriesJson from "../../../../data/categories.json" with { type: "json" };

export type CategoryMenuConfig = {
  title: string;
  subtitle: string;
  columns: number;
  order: number;
  defaultUnit: string;
};

export type Category = {
  key: string;
  label: string;
  slug: string;
  blurb: string;
  menu: CategoryMenuConfig;
};

export const CATEGORIES: readonly Category[] = categoriesJson.categories;

export const MENU_CATEGORIES: readonly Category[] = [...CATEGORIES].sort((a, b) => a.menu.order - b.menu.order);
