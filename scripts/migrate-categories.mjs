// Moves products into the categories of data/categories.json using
// data/category-migration-2026-10.json, renumbering sortOrder 1..n inside each
// new category (old relative order kept).
//
//   node scripts/migrate-categories.mjs --seed          rewrite data/products.seed.json
//   node scripts/migrate-categories.mjs                 live DB, dry run (prints the plan)
//   node scripts/migrate-categories.mjs --apply         live DB, write in one transaction
//
// Live mode runs from the repo root on the server and uses the app's own
// committed Prisma client and .env. Over SSH set PRISMA_QUERY_ENGINE_LIBRARY to
// apps/api/prisma-client/libquery_engine-debian-openssl-1.0.x.so.node.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATEGORIES_PATH = path.join(REPO_ROOT, "data", "categories.json");
const MAPPING_PATH = path.join(REPO_ROOT, "data", "category-migration-2026-10.json");
const SEED_PATH = path.join(REPO_ROOT, "data", "products.seed.json");

const readJson = (file) => JSON.parse(readFileSync(file, "utf-8"));

/** Returns [{ slug, from, to, sortOrder }] for every product, plus slugs whose target is unknown. */
export const planCategoryMoves = (products, mapping, categoryKeys) => {
  const targetOf = (p) => mapping.bySlug[p.slug] ?? mapping.byOldCategory[p.category] ?? p.category;
  const oldRank = (category) => {
    const rank = mapping.oldCategoryOrder.indexOf(category);
    return rank === -1 ? mapping.oldCategoryOrder.length : rank;
  };
  const byTarget = new Map();
  for (const p of products) {
    const to = targetOf(p);
    if (!byTarget.has(to)) byTarget.set(to, []);
    byTarget.get(to).push(p);
  }
  const moves = [];
  for (const [to, list] of byTarget) {
    list.sort((a, b) => oldRank(a.category) - oldRank(b.category) || a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
    list.forEach((p, i) => moves.push({ slug: p.slug, from: p.category, to, sortOrder: i + 1 }));
  }
  const unknownTargets = moves.filter((m) => !categoryKeys.includes(m.to));
  return { moves, unknownTargets };
};

const summarise = (moves) => {
  const counts = {};
  for (const m of moves) counts[m.to] = (counts[m.to] ?? 0) + 1;
  return counts;
};

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const categoryKeys = readJson(CATEGORIES_PATH).categories.map((c) => c.key);
  const mapping = readJson(MAPPING_PATH);

  if (args.has("--seed")) {
    const seed = readJson(SEED_PATH);
    const { moves, unknownTargets } = planCategoryMoves(seed.products, mapping, categoryKeys);
    if (unknownTargets.length > 0) throw new Error(`no category for: ${unknownTargets.map((m) => m.slug).join(", ")}`);
    const bySlug = new Map(moves.map((m) => [m.slug, m]));
    for (const p of seed.products) {
      const move = bySlug.get(p.slug);
      p.category = move.to;
      p.sortOrder = move.sortOrder;
    }
    writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2) + "\n");
    console.log("seed rewritten:", summarise(moves));
    return;
  }

  process.loadEnvFile(path.join(REPO_ROOT, ".env"));
  const clientUrl = pathToFileURL(path.join(REPO_ROOT, "apps", "api", "prisma-client", "index.js")).href;
  const { PrismaClient } = await import(clientUrl);
  const prisma = new PrismaClient();
  try {
    const products = await prisma.product.findMany({ select: { id: true, slug: true, category: true, sortOrder: true } });
    const { moves, unknownTargets } = planCategoryMoves(products, mapping, categoryKeys);
    if (unknownTargets.length > 0) throw new Error(`no category for: ${unknownTargets.map((m) => m.slug).join(", ")}`);
    const fallbacks = products.filter((p) => !(p.slug in mapping.bySlug) && p.category !== mapping.byOldCategory[p.category]);
    console.log("plan:", summarise(moves));
    if (fallbacks.length > 0) console.log("moved by old-category default (not in bySlug):", fallbacks.map((p) => `${p.slug} (${p.category})`).join(", "));
    if (!args.has("--apply")) {
      console.log("dry run - nothing written. Re-run with --apply.");
      return;
    }
    const idBySlug = new Map(products.map((p) => [p.slug, p.id]));
    await prisma.$transaction(
      moves.map((m) => prisma.product.update({ where: { id: idBySlug.get(m.slug) }, data: { category: m.to, sortOrder: m.sortOrder } })),
    );
    console.log(`applied ${moves.length} updates`);
  } finally {
    await prisma.$disconnect();
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
