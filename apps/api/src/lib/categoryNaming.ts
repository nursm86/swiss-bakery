// Identifiers for categories and subcategories created in the admin. A
// category's key (stored in Product.category) and slug (the #cat-<slug>
// anchor) are made once from its label and never change afterwards, so
// renaming a label can't orphan products or break links.

export const MAX_CATEGORY_KEY_LENGTH = 40;
export const MAX_SLUG_LENGTH = 80;
const FALLBACK_KEY = "Category";
const FALLBACK_SLUG = "category";

const labelWords = (label: string): string[] =>
  label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

/** "Bread & Cake Items" → "BreadCakeItems". Always starts with a letter. */
export const toCategoryKey = (label: string): string => {
  const pascal = labelWords(label)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  if (!pascal) return FALLBACK_KEY;
  return (/^[A-Za-z]/.test(pascal) ? pascal : `C${pascal}`).slice(0, MAX_CATEGORY_KEY_LENGTH);
};

/** "Bread & Cake Items" → "bread-cake-items". */
export const toSlug = (label: string): string =>
  labelWords(label).join("-").toLowerCase().slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "") || FALLBACK_SLUG;

/**
 * base if it's free, otherwise base2, base3… (base-2 with separator "-").
 * Compared case-insensitively, like the database collation.
 */
export const pickUnique = (base: string, taken: Iterable<string>, maxLength: number, separator = ""): string => {
  const takenLower = new Set([...taken].map((value) => value.toLowerCase()));
  if (!takenLower.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const suffix = `${separator}${n}`;
    const candidate = `${base.slice(0, maxLength - suffix.length)}${suffix}`;
    if (!takenLower.has(candidate.toLowerCase())) return candidate;
  }
};
