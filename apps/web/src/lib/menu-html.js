// HTML for the homepage menu (category pills, sections, subcategory groups),
// the product cards and the footer menu links. Astro renders it at build time
// with set:html and the homepage script renders it again from the live API,
// so both always use this one template. Every value goes through escapeHtml.
// Tailwind only sees complete class names, so never build them from pieces.
import { formatPriceLines } from "./pricing.js";

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

export const itemCount = (count) => `${count} ${count === 1 ? "item" : "items"}`;

/** The small unit label beside the price; empty when the price already says it ("$7/5pcs"). */
export const unitLabel = (product) => (Number(product.qty) > 1 ? "" : (product.unit ?? ""));

const categoryAnchor = (category) => `cat-${category.slug}`;
const subcategoryAnchor = (category, subcategory) => `cat-${category.slug}--${subcategory.slug}`;

/**
 * @param {object} product
 * @param {{ enabled: boolean, ratePercent: number }} gst
 * @param {{ size?: "sm" | "md", headingTag?: "h3" | "h4" | "h5" }} [options]
 */
export const renderProductCard = (product, gst, { size = "md", headingTag = "h3" } = {}) => {
  const priceLines = formatPriceLines(product, gst);
  const unit = unitLabel(product);
  const media = product.imagePath
    ? `<img src="${escapeHtml(product.imagePath)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />`
    : `<div class="h-full w-full grid place-items-center text-[color:var(--color-gold)] font-[family-name:var(--font-display)] text-4xl">⚜</div>`;
  return `<article class="${size === "sm" ? "card group flex flex-col min-w-[260px] w-[260px]" : "card group flex flex-col"}" data-slug="${escapeHtml(product.slug)}">
  <div class="relative aspect-square bg-[color:var(--color-cream-200)] overflow-hidden">${media}${product.isFeatured ? `<span class="absolute top-3 left-3 chip chip-gold">House favourite</span>` : ""}</div>
  <div class="p-4 flex flex-col gap-1.5 flex-1">
    <${headingTag} class="font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--color-navy)] leading-snug">${escapeHtml(product.name)}</${headingTag}>
    ${product.description ? `<p class="text-sm text-[color:var(--color-muted)] leading-relaxed line-clamp-3">${escapeHtml(product.description)}</p>` : ""}
    <div class="mt-auto pt-3 flex items-end justify-between gap-2">
      <span data-price class="font-[family-name:var(--font-display)] text-lg leading-snug text-[color:var(--color-navy)]">${(priceLines.length > 0 ? priceLines : ["Visit shop"]).map((line) => `<span class="block">${escapeHtml(line)}</span>`).join("")}</span>
      ${unit ? `<span class="text-xs uppercase tracking-[0.12em] text-[color:var(--color-muted)]">${escapeHtml(unit)}</span>` : ""}
    </div>
  </div>
</article>`;
};

/** One pill per category that has products (the model only holds those). */
export const renderMenuNav = (model) =>
  model
    .map(
      (category) =>
        `<a href="#${escapeHtml(categoryAnchor(category))}" class="px-4 py-2 rounded-full border border-[color:var(--color-cream-200)] hover:bg-[color:var(--color-cream)] transition text-[color:var(--color-navy)] font-medium">${escapeHtml(category.label)}</a>`,
    )
    .join("");

// Filter chips only work with JavaScript, so the build-time HTML keeps them hidden
// and the homepage script shows them when it re-renders.
const renderSubcategoryChips = (category, isInteractive) => {
  const subcategoryGroups = category.groups.filter((group) => group.subcategory);
  if (subcategoryGroups.length === 0) return "";
  const chip = (filter, label, count, isPressed) =>
    `<button type="button" class="menu-sub-chip" data-sub-filter="${escapeHtml(filter)}" aria-pressed="${isPressed}">${escapeHtml(label)}<span class="menu-sub-chip-count">${count}</span></button>`;
  return `<div class="mt-5 flex gap-2 overflow-x-auto pb-1 scroll-x" role="group" aria-label="${escapeHtml(`Filter ${category.label}`)}"${isInteractive ? "" : " hidden"}>${[
    chip("", "All", category.productCount, true),
    ...subcategoryGroups.map((group) => chip(group.subcategory.slug, group.subcategory.label, group.products.length, false)),
  ].join("")}</div>`;
};

const renderProductGrid = (products, gst, headingTag) =>
  `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">${products.map((p) => renderProductCard(p, gst, { headingTag })).join("")}</div>`;

const renderGroup = (category, group, gst) => {
  if (!group.subcategory) {
    return `<div data-sub-group="" class="menu-sub-group mt-6">${renderProductGrid(group.products, gst, "h4")}</div>`;
  }
  const { subcategory } = group;
  return `<div id="${escapeHtml(subcategoryAnchor(category, subcategory))}" data-sub-group="${escapeHtml(subcategory.slug)}" class="menu-sub-group mt-9 scroll-mt-24">
    <div class="flex items-center gap-4">
      <h4 class="font-sans text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--color-orange)]">${escapeHtml(subcategory.label)}</h4>
      <span aria-hidden="true" class="h-px flex-1 bg-[color:var(--color-border)]"></span>
      <span class="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">${itemCount(group.products.length)}</span>
    </div>
    <div class="mt-4">${renderProductGrid(group.products, gst, "h5")}</div>
  </div>`;
};

/**
 * @param {ReturnType<import("./menu-model.js").buildMenuModel>} model
 * @param {{ enabled: boolean, ratePercent: number }} gst
 * @param {{ isInteractive?: boolean }} [options] true when the page script will wire up the chips
 */
export const renderMenuSections = (model, gst, { isInteractive = false } = {}) =>
  model
    .map(
      (category) => `<div id="${escapeHtml(categoryAnchor(category))}" data-category="${escapeHtml(category.key)}" class="mt-16 scroll-mt-24">
  <div class="flex items-end justify-between gap-3 flex-wrap">
    <div>
      <h3 class="font-[family-name:var(--font-display)] text-2xl sm:text-3xl text-[color:var(--color-navy)]">${escapeHtml(category.label)}</h3>
      ${category.blurb ? `<p class="text-[color:var(--color-muted)] mt-1 max-w-xl">${escapeHtml(category.blurb)}</p>` : ""}
    </div>
    <span class="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">${itemCount(category.productCount)}</span>
  </div>
  ${renderSubcategoryChips(category, isInteractive)}
  ${category.groups.map((group) => renderGroup(category, group, gst)).join("")}
</div>`,
    )
    .join("");

/** Footer "Menu" links: give it the categories that have products. */
export const renderFooterMenuLinks = (categories) =>
  categories
    .map(
      (category) =>
        `<li><a href="/#${escapeHtml(categoryAnchor(category))}" class="hover:text-[color:var(--color-orange)] transition">${escapeHtml(category.label)}</a></li>`,
    )
    .join("");
