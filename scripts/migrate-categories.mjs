// Moves products into the categories of data/categories.json using
// data/category-migration-2026-10.json. Only the category of products that
// actually move is changed; nothing else is touched (sortOrder included).
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

/** Returns the products whose category changes, as [{ slug, from, to }], plus moves to unknown categories. */
export const planCategoryMoves = (products, mapping, categoryKeys) => {
  const moves = products
    .map((p) => ({ slug: p.slug, from: p.category, to: mapping.bySlug[p.slug] ?? mapping.byOldCategory[p.category] ?? p.category }))
    .filter((m) => m.to !== m.from);
  const unknownTargets = products.filter((p) => !categoryKeys.includes(mapping.bySlug[p.slug] ?? mapping.byOldCategory[p.category] ?? p.category));
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
      if (move) p.category = move.to;
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
    const products = await prisma.product.findMany({ select: { id: true, slug: true, category: true } });
    const { moves, unknownTargets } = planCategoryMoves(products, mapping, categoryKeys);
    if (unknownTargets.length > 0) throw new Error(`no category for: ${unknownTargets.map((m) => m.slug).join(", ")}`);
    console.log(`plan: ${moves.length} of ${products.length} products change category`, summarise(moves));
    const defaulted = moves.filter((m) => !(m.slug in mapping.bySlug) && m.from !== "Meal");
    if (defaulted.length > 0) console.log("moved by old-category default, check these:", defaulted.map((m) => `${m.slug} ${m.from}->${m.to}`).join(", "));
    if (!args.has("--apply")) {
      console.log("dry run - nothing written. Re-run with --apply.");
      return;
    }
    const idBySlug = new Map(products.map((p) => [p.slug, p.id]));
    await prisma.$transaction(
      moves.map((m) => prisma.product.update({ where: { id: idBySlug.get(m.slug) }, data: { category: m.to } })),
    );
    console.log(`applied ${moves.length} updates`);
  } finally {
    await prisma.$disconnect();
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
