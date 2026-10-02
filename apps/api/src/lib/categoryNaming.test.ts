import assert from "node:assert/strict";
import { test } from "node:test";
import { pickUnique, toCategoryKey, toSlug } from "./categoryNaming.js";
import { planSubcategoryChanges } from "./subcategoryPlan.js";

test("keys are PascalCase, start with a letter and drop punctuation", () => {
  assert.equal(toCategoryKey("Bread & Cake Items"), "BreadCakeItems");
  assert.equal(toCategoryKey("Special - Evening (5.00pm - 9.00pm)"), "SpecialEvening500pm900pm");
  assert.equal(toCategoryKey("7 Day Deals"), "C7DayDeals");
  assert.equal(toCategoryKey("  ¡¿  "), "Category");
  assert.equal(toCategoryKey("Crème brûlée"), "CremeBrulee");
});

test("slugs are lowercase words joined by hyphens", () => {
  assert.equal(toSlug("Bread & Cake Items"), "bread-cake-items");
  assert.equal(toSlug("TV Snacks / Miscellaneous"), "tv-snacks-miscellaneous");
  assert.equal(toSlug("!!!"), "category");
});

test("pickUnique adds a number when taken, ignoring case", () => {
  assert.equal(pickUnique("Drinks", ["Fried"], 40), "Drinks");
  assert.equal(pickUnique("Drinks", ["drinks", "Drinks2"], 40), "Drinks3");
  assert.equal(pickUnique("drinks", ["drinks"], 80, "-"), "drinks-2");
  assert.equal(pickUnique("abcd", ["abcd"], 4), "abc2");
});

const EXISTING = [
  { id: 1, label: "Hot", slug: "hot" },
  { id: 2, label: "Cold", slug: "cold" },
];

test("subcategory plan: rename, reorder, add and remove in one go", () => {
  const result = planSubcategoryChanges(EXISTING, [{ id: 2, label: "Cold drinks" }, { label: "Juices" }]);
  assert.deepEqual(result, {
    ok: true,
    plan: {
      create: [{ label: "Juices", slug: "juices", sortOrder: 2 }],
      update: [{ id: 2, label: "Cold drinks", sortOrder: 1 }],
      remove: [1],
    },
  });
});

test("subcategory plan: a new one never reuses a kept slug", () => {
  const result = planSubcategoryChanges(EXISTING, [{ id: 1, label: "Hot" }, { label: "HOT!" }]);
  assert.equal(result.ok && result.plan.create[0].slug, "hot-2");
  const renamed = planSubcategoryChanges(EXISTING, [{ id: 1, label: "Warm" }, { label: "Hot" }]);
  assert.ok(renamed.ok);
  assert.equal(renamed.ok && renamed.plan.create[0].slug, "hot-2");
});

test("subcategory plan rejects repeated names and ids from another category", () => {
  assert.equal(planSubcategoryChanges([], [{ label: "Tea" }, { label: " tea " }]).ok, false);
  assert.equal(planSubcategoryChanges(EXISTING, [{ id: 99, label: "Tea" }]).ok, false);
  assert.equal(planSubcategoryChanges(EXISTING, [{ id: 1, label: "A" }, { id: 1, label: "B" }]).ok, false);
});
