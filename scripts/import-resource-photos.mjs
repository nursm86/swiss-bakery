#!/usr/bin/env node
// One-off importer for photos dropped into Other_resource/.
// Maps each "Pretty Name.jpeg" to its product slug, resizes with sharp
// (max 1600px, JPEG q85, EXIF-rotated), and writes to public/uploads/seed/.
// Re-runnable - safe to overwrite existing seed images.

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "Other_resource");
const DEST_DIR = path.join(ROOT, "public", "uploads", "seed");

// Filename (in Other_resource/) → product slug (file written to seed/<slug>.jpg)
const FILE_TO_SLUG = {
  "Beef Patties.jpeg": "beef-patty",
  "Chicken Patties.jpeg": "chicken-patty",
  "Chicken Roll.jpeg": "chicken-roll",
  "Chicken Samdwich.jpeg": "chicken-sandwich",
  "Chicken Somusa.jpeg": "chicken-samosa",
  "Daal Puri.jpeg": "dal-puri",
  "Moglai.jpeg": "mughlai-paratha",
  "Mushroom Pie.jpeg": "mushroom-pie",
  "Piyaju.jpeg": "piyaju",
  "Shingara.jpeg": "veg-singara",
  "Swiss Twister.jpeg": "swiss-twister",
};

const exists = async (p) => stat(p).then(() => true).catch(() => false);

const main = async () => {
  if (!(await exists(SRC_DIR))) {
    process.stderr.write(`Source not found: ${SRC_DIR}\n`);
    process.exit(1);
  }
  if (!(await exists(DEST_DIR))) {
    process.stderr.write(`Dest not found: ${DEST_DIR}\n`);
    process.exit(1);
  }

  const present = new Set(await readdir(SRC_DIR));
  let done = 0;
  let skipped = 0;

  for (const [file, slug] of Object.entries(FILE_TO_SLUG)) {
    if (!present.has(file)) {
      process.stdout.write(`  - skip ${file} (not in Other_resource/)\n`);
      skipped++;
      continue;
    }
    const src = path.join(SRC_DIR, file);
    const dst = path.join(DEST_DIR, `${slug}.jpg`);
    await sharp(src)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true, mozjpeg: true })
      .toFile(dst);
    const { size } = await stat(dst);
    process.stdout.write(`  ✓ ${file.padEnd(28)} → seed/${slug}.jpg  (${(size / 1024).toFixed(0)} KB)\n`);
    done++;
  }

  process.stdout.write(`\nDone. ${done} written, ${skipped} skipped.\n`);
};

main().catch((e) => {
  process.stderr.write(`Failed: ${e?.message ?? e}\n`);
  process.exit(1);
});
