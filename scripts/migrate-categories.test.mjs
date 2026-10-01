import assert from "node:assert/strict";
import { test } from "node:test";
import { planCategoryMoves } from "./migrate-categories.mjs";

const mapping = {
  oldCategoryOrder: ["Meal", "Savoury"],
  byOldCategory: { Meal: "Kebab", Savoury: "Fried" },
  bySlug: { "chicken-pie": "Baked", "lamb-wrap": "Kebab" },
};
const keys = ["Kebab", "Fried", "Baked"];

test("slug mapping wins over the old-category default", () => {
  const { moves } = planCategoryMoves([{ slug: "chicken-pie", category: "Savoury" }], mapping, keys);
  assert.deepEqual(moves, [{ slug: "chicken-pie", from: "Savoury", to: "Baked" }]);
});

test("unlisted products fall back to their old category's default", () => {
  const { moves } = planCategoryMoves([{ slug: "samosa", category: "Savoury" }], mapping, keys);
  assert.equal(moves[0].to, "Fried");
});

test("products already in their target category are left out of the plan", () => {
  const { moves } = planCategoryMoves([{ slug: "rasgulla", category: "Kebab" }], mapping, keys);
  assert.deepEqual(moves, []);
});

test("a target missing from categories.json is reported", () => {
  const { unknownTargets } = planCategoryMoves([{ slug: "x", category: "Mystery" }], mapping, keys);
  assert.deepEqual(unknownTargets.map((p) => p.slug), ["x"]);
});
