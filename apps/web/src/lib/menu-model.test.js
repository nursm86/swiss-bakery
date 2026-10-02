import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMenuModel, featuredProducts, groupBySubcategory, toBoardPayload } from "./menu-model.js";

const SUBS = [
  { id: 2, label: "Cold", slug: "cold", sortOrder: 2 },
  { id: 1, label: "Hot", slug: "hot", sortOrder: 1 },
];
const product = (slug, extra = {}) => ({ slug, name: slug, category: "Drinks", isActive: true, sortOrder: 0, ...extra });

test("groups: no-subcategory products first, then subcategories in their order, empty ones dropped", () => {
  const groups = groupBySubcategory(
    [product("chai", { subcategoryId: 1 }), product("water"), product("cola", { subcategoryId: 2 })],
    [...SUBS, { id: 3, label: "Juice", slug: "juice", sortOrder: 3 }],
  );
  assert.deepEqual(
    groups.map((g) => [g.subcategory?.label ?? null, g.products.map((p) => p.slug)]),
    [[null, ["water"]], ["Hot", ["chai"]], ["Cold", ["cola"]]],
  );
});

test("a product pointing at an unknown subcategory falls back to the ungrouped list", () => {
  const groups = groupBySubcategory([product("lassi", { subcategoryId: 99 })], SUBS);
  assert.deepEqual(groups, [{ subcategory: null, products: [product("lassi", { subcategoryId: 99 })] }]);
});

test("model: category order, active products only, sorted, empty categories left out", () => {
  const categories = [
    { key: "Sweets", label: "Sweets", slug: "sweets", sortOrder: 2 },
    { key: "Drinks", label: "Drinks", slug: "drinks", sortOrder: 1, subcategories: SUBS },
    { key: "Empty", label: "Empty", slug: "empty", sortOrder: 3 },
  ];
  const products = [
    product("cola", { subcategoryId: 2, sortOrder: 2 }),
    product("chai", { subcategoryId: 1, sortOrder: 1 }),
    product("draft", { isActive: false }),
    product("laddu", { category: "Sweets" }),
  ];
  const model = buildMenuModel({ categories, products });
  assert.deepEqual(model.map((c) => [c.key, c.productCount]), [["Drinks", 2], ["Sweets", 1]]);
  assert.deepEqual(model[0].groups.map((g) => g.subcategory.slug), ["hot", "cold"]);
});

test("featured: featured active products in sort order", () => {
  const products = [product("b", { isFeatured: true, sortOrder: 2 }), product("a", { isFeatured: true, sortOrder: 1 }), product("c", { isFeatured: true, isActive: false })];
  assert.deepEqual(featuredProducts(products).map((p) => p.slug), ["a", "b"]);
});

test("board payload: one block per group, labelled by subcategory", () => {
  const model = buildMenuModel({
    categories: [{ key: "Drinks", label: "Drinks", slug: "drinks", menu: { title: "DRINKS", subtitle: "Cold and hot", columns: 3 }, subcategories: SUBS }],
    products: [product("water", { priceCents: 200, unit: "piece", qty: 1 }), product("chai", { subcategoryId: 1, priceCents: 350, unit: "cup", qty: 2 })],
  });
  assert.deepEqual(toBoardPayload(model), [
    {
      title: "DRINKS",
      subtitle: "Cold and hot",
      columns: 3,
      showPhotos: true,
      groups: [
        { label: null, items: [{ name: "water", imagePath: undefined, priceCents: 200, unit: "piece", qty: 1 }] },
        { label: "Hot", items: [{ name: "chai", imagePath: undefined, priceCents: 350, unit: "cup", qty: 2 }] },
      ],
    },
  ]);
});
