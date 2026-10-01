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
  const { moves } = planCategoryMoves([{ slug: "chicken-pie", category: "Savoury", sortOrder: 4 }], mapping, keys);
  assert.deepEqual(moves, [{ slug: "chicken-pie", from: "Savoury", to: "Baked", sortOrder: 1 }]);
});

test("unlisted products fall back to their old category's default", () => {
  const { moves } = planCategoryMoves([{ slug: "samosa", category: "Savoury", sortOrder: 2 }], mapping, keys);
  assert.equal(moves[0].to, "Fried");
});

test("merged categories renumber by old category order, then old sortOrder", () => {
  const { moves } = planCategoryMoves(
    [
      { slug: "lamb-wrap", category: "Savoury", sortOrder: 1 },
      { slug: "wrap-meal", category: "Meal", sortOrder: 2 },
      { slug: "tikka", category: "Meal", sortOrder: 1 },
    ],
    mapping,
    keys,
  );
  assert.deepEqual(
    moves.map((m) => [m.slug, m.sortOrder]),
    [["tikka", 1], ["wrap-meal", 2], ["lamb-wrap", 3]],
  );
});

test("a target missing from categories.json is reported", () => {
  const { unknownTargets } = planCategoryMoves([{ slug: "x", category: "Mystery", sortOrder: 1 }], mapping, keys);
  assert.deepEqual(unknownTargets.map((m) => m.slug), ["x"]);
});
