#!/usr/bin/env node
// For every product in data/products.seed.json that has imagePath:null,
// pull a relevant photo from Pexels (PEXELS_API_KEY in .env), resize via sharp,
// save to public/uploads/seed/<slug>.jpg, and record attribution.
// Also updates products.seed.json so imagePath points at the new file.
//
// Run:  node --env-file=.env scripts/download-pexels-images.mjs

import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const PEXELS_KEY = process.env.PEXELS_API_KEY;
if (!PEXELS_KEY || PEXELS_KEY.length < 20) {
  process.stderr.write("PEXELS_API_KEY missing or empty. Pass via --env-file=.env\n");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SEED_JSON = path.join(ROOT, "data", "products.seed.json");
const OUT_DIR = path.join(ROOT, "public", "uploads", "seed");
const ATTRIB = path.join(OUT_DIR, "_attributions.json");

// Per-slug search query for Pexels. Bengali specialty items get generic
// descriptive terms (mishti / barfi etc.) because Pexels' library is shallow
// on Bengali-specific names.
const QUERY = {
  "chicken-pocket": "chicken pita pocket sandwich",
  "prawn-onton": "prawn wonton dumpling",
  "chicken-momo": "chicken dumpling momo",
  "chicken-pie": "chicken pot pie",
  "pakora": "pakora indian fritter",
  "vegetable-momo": "vegetable dumpling momo",
  "swiss-coconut-biscuit": "coconut biscuit cookie",
  "nemokpara": "salty crackers indian snack",
  "salted-biscuit": "salted cracker biscuit",
  "peanut-biscuit": "peanut cookie biscuit",
  "danish-biscuit": "danish butter cookie",
  "coconut-biscuit": "coconut cookie",
  "morobba-cake-pound": "fruit loaf cake",
  "morobba-cake-small": "small fruit cake",
  "ovaltin-cake-pound": "chocolate sponge loaf cake",
  "ovaltin-cake-small": "small chocolate cake",
  "ghazia": "indian barfi milk sweet",
  "motichur-laddoo": "laddoo indian sweet",
  "coconut-naru": "coconut ladoo sweet",
  "shondesh": "sandesh bengali sweet",
  "amittri": "jalebi indian sweet",
  "milk-cake": "kalakand milk cake sweet",
  "shoan-papri": "soan papdi indian sweet",
  "almond-barfi": "almond barfi indian sweet",
};

// Wikipedia fallback if Pexels returns nothing relevant.
const WIKI_FALLBACK = {
  "pakora": ["Pakora"],
  "swiss-coconut-biscuit": ["Coconut_macaroon"],
  "nemokpara": ["Nimki"],
  "morobba-cake-pound": ["Fruitcake"],
  "morobba-cake-small": ["Fruitcake"],
  "ovaltin-cake-pound": ["Chocolate_cake"],
  "ovaltin-cake-small": ["Chocolate_cake"],
  "ghazia": ["Sandesh_(confectionery)"],
  "motichur-laddoo": ["Motichoor_laddu", "Laddu"],
  "coconut-naru": ["Coconut_ladoo", "Laddu"],
  "shondesh": ["Sandesh_(confectionery)"],
  "amittri": ["Jalebi", "Imarti"],
  "milk-cake": ["Milk_cake", "Kalakand"],
  "shoan-papri": ["Soan_papdi"],
  "almond-barfi": ["Barfi", "Burfi"],
  "chicken-pie": ["Chicken_and_mushroom_pie", "Pot_pie"],
  "prawn-onton": ["Wonton"],
  "chicken-momo": ["Momo_(food)"],
  "vegetable-momo": ["Momo_(food)"],
  "chicken-pocket": ["Pita"],
};

const UA = "SwissBakerySeed/1.0 (contact@swissbakery.com.au)";

const searchPexels = async (q) => {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", q);
  url.searchParams.set("per_page", "5");
  url.searchParams.set("orientation", "square");
  const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
  if (!res.ok) throw new Error(`Pexels ${res.status} for "${q}"`);
  const data = await res.json();
  if (!data.photos || data.photos.length === 0) return null;
  const p = data.photos[0];
  return {
    source: "Pexels",
    imageUrl: p.src.large2x || p.src.large || p.src.original,
    pageUrl: p.url,
    photographer: p.photographer,
    photographerUrl: p.photographer_url,
    license: "Pexels License (https://www.pexels.com/license/)",
  };
};

const wikiSummary = async (title) => {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) return null;
  const d = await res.json();
  if (!d.originalimage?.source) return null;
  return {
    source: "Wikimedia Commons (via Wikipedia)",
    imageUrl: d.originalimage.source,
    pageUrl: d.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${title}`,
    photographer: null,
    photographerUrl: null,
    license: "CC-BY-SA (see Commons file page for canonical licence)",
  };
};

const downloadAndProcess = async (url, outPath) => {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true, mozjpeg: true })
    .toFile(outPath);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const data = JSON.parse(await readFile(SEED_JSON, "utf-8"));
  let attrib;
  try {
    attrib = JSON.parse(await readFile(ATTRIB, "utf-8"));
  } catch {
    attrib = { _license_note: "", images: {} };
  }
  attrib.images ||= {};
  attrib._pexels_note =
    "Images added via scripts/download-pexels-images.mjs are sourced from Pexels (Pexels License — free for commercial use, no attribution required, but credit appreciated). Where Pexels had no match, the Wikimedia Commons fallback was used; those carry CC-BY-SA terms — see each image's page_url before commercial launch.";

  const missing = data.products.filter((p) => !p.imagePath);
  process.stdout.write(`Found ${missing.length} products without images.\n\n`);

  let ok = 0, fail = 0, skip = 0;
  for (const p of missing) {
    const q = QUERY[p.slug];
    if (!q) {
      process.stdout.write(`  - skip ${p.slug} (no query mapping)\n`);
      skip++;
      continue;
    }
    process.stdout.write(`  → ${p.slug.padEnd(28)} "${q}"\n`);
    let hit = null;
    try {
      hit = await searchPexels(q);
    } catch (e) {
      process.stdout.write(`      pexels error: ${e.message}\n`);
    }
    if (!hit) {
      const wikiTitles = WIKI_FALLBACK[p.slug] ?? [];
      for (const t of wikiTitles) {
        try {
          hit = await wikiSummary(t);
          if (hit) {
            process.stdout.write(`      wiki fallback: ${t}\n`);
            break;
          }
        } catch {}
      }
    }
    if (!hit) {
      process.stdout.write(`      ✗ no match anywhere\n`);
      fail++;
      continue;
    }
    try {
      const outPath = path.join(OUT_DIR, `${p.slug}.jpg`);
      await downloadAndProcess(hit.imageUrl, outPath);
      const { size } = await stat(outPath);
      attrib.images[p.slug] = {
        source: hit.source,
        page_url: hit.pageUrl,
        photographer: hit.photographer,
        photographer_url: hit.photographerUrl,
        license: hit.license,
        query: q,
      };
      p.imagePath = `/uploads/seed/${p.slug}.jpg`;
      process.stdout.write(`      ✓ ${hit.source.padEnd(34)} ${(size / 1024).toFixed(0)} KB\n`);
      ok++;
    } catch (e) {
      process.stdout.write(`      ✗ download failed: ${e.message}\n`);
      fail++;
    }
    await sleep(250); // be nice to APIs
  }

  await writeFile(SEED_JSON, JSON.stringify(data, null, 2) + "\n");
  await writeFile(ATTRIB, JSON.stringify(attrib, null, 2) + "\n");

  process.stdout.write(`\nDone. ${ok} downloaded, ${skip} skipped, ${fail} failed.\n`);
  process.stdout.write(`Updated: ${SEED_JSON}\n         ${ATTRIB}\n`);
};

main().catch((e) => {
  process.stderr.write(`Failed: ${e.stack || e.message || e}\n`);
  process.exit(1);
});
