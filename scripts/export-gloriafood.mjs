#!/usr/bin/env node
// Export Swiss Bakery products from data/products.seed.json in three formats
// to make GloriaFood menu entry fast:
//
//   exports/gloriafood-menu.csv
//     5-column CSV — open in Google Sheets / Excel. Use as a reference while
//     filling GloriaFood's menu UI (they have no bulk CSV import as of Apr 2026).
//
//   exports/gloriafood-menu.txt
//     Structured text — one category block at a time, clean and copyable.
//
//   exports/gloriafood-cheatsheet.html
//     Open this in a browser. Shows every item with image + price +
//     description. Lets you match items visually while uploading photos
//     to GloriaFood.
//
// Run:  npm run export:gloriafood

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SEED = path.join(ROOT, "data", "products.seed.json");
const OUT = path.join(ROOT, "exports");
mkdirSync(OUT, { recursive: true });

const data = JSON.parse(readFileSync(SEED, "utf-8"));

const CATEGORY_LABEL = {
  Savoury: "Savoury Bites",
  Bakery: "Bakery & Breads",
  Sweets: "Traditional Sweets",
  Beverages: "Beverages & Sides",
};

const grouped = {};
for (const p of data.products) {
  if (!p.isActive) continue;
  grouped[p.category] ||= [];
  grouped[p.category].push(p);
}
for (const cat of Object.keys(grouped)) {
  grouped[cat].sort((a, b) => a.sortOrder - b.sortOrder);
}

const priceStr = (p) =>
  p.priceCents == null ? "TBC" : (p.priceCents / 100).toFixed(2);

/* ---------- CSV ---------- */
const csvEscape = (s) => {
  const v = String(s ?? "");
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};
const csvRows = ["Category,Item Name,Description,Price (AUD),Unit,Image File"];
for (const cat of ["Savoury", "Bakery", "Sweets", "Beverages"]) {
  for (const p of grouped[cat] ?? []) {
    csvRows.push(
      [
        CATEGORY_LABEL[cat],
        p.name,
        p.description,
        priceStr(p),
        p.unit,
        p.imagePath ? path.basename(p.imagePath) : "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
}
writeFileSync(path.join(OUT, "gloriafood-menu.csv"), csvRows.join("\n") + "\n");

/* ---------- Plain text ---------- */
const textLines = [
  "SWISS BAKERY-MINTO — MENU FOR GLORIAFOOD ENTRY",
  `Generated: ${new Date().toISOString().slice(0, 10)}`,
  "Items with price 'TBC' need a final price before they go live on GloriaFood.",
  "",
];
for (const cat of ["Savoury", "Bakery", "Sweets", "Beverages"]) {
  const items = grouped[cat] ?? [];
  if (items.length === 0) continue;
  textLines.push("=".repeat(60));
  textLines.push(`CATEGORY: ${CATEGORY_LABEL[cat]}  (${items.length} items)`);
  textLines.push("=".repeat(60));
  textLines.push("");
  for (const p of items) {
    textLines.push(`  ${p.name}`);
    textLines.push(`    Price: $${priceStr(p)} / ${p.unit}`);
    textLines.push(`    Description: ${p.description}`);
    textLines.push("");
  }
}
writeFileSync(path.join(OUT, "gloriafood-menu.txt"), textLines.join("\n"));

/* ---------- HTML cheat sheet ---------- */
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const htmlLines = [
  "<!doctype html>",
  '<html lang="en"><head><meta charset="utf-8">',
  "<title>Swiss Bakery-Minto — GloriaFood cheat sheet</title>",
  "<style>",
  `  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;margin:0;background:#f6efe0;color:#0b1426;}`,
  `  header{background:#1a2a4f;color:#fff;padding:1.5rem 2rem;}`,
  `  header h1{margin:0;font-size:1.4rem;font-family:Georgia,serif;}`,
  `  header p{margin:0.25rem 0 0;opacity:0.75;font-size:0.9rem;}`,
  `  .count{display:inline-block;background:#c89a2b;color:#1a2a4f;padding:0.1rem 0.6rem;border-radius:999px;font-size:0.72rem;margin-left:0.5rem;font-weight:700;}`,
  `  h2{background:#ece3cf;color:#1a2a4f;padding:0.75rem 2rem;margin:0;position:sticky;top:0;z-index:2;border-bottom:1px solid #c89a2b;}`,
  `  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem;padding:1.25rem 2rem;}`,
  `  .item{background:#fff;border:1px solid #e6dac4;border-radius:10px;padding:0.9rem;display:flex;gap:0.9rem;}`,
  `  .item img{width:88px;height:88px;object-fit:cover;border-radius:6px;background:#ece3cf;flex-shrink:0;}`,
  `  .name{font-weight:700;color:#1a2a4f;}`,
  `  .price{color:#c89a2b;font-weight:700;font-size:0.95rem;}`,
  `  .tbc{background:#c8102e;color:#fff;padding:0 0.35rem;border-radius:3px;font-size:0.72rem;letter-spacing:0.05em;}`,
  `  .desc{font-size:0.82rem;color:#555;margin-top:0.2rem;line-height:1.4;}`,
  `  .unit{font-size:0.72rem;color:#777;text-transform:uppercase;letter-spacing:0.06em;}`,
  `  .copy{background:#1a2a4f;color:#fff;border:none;padding:0.2rem 0.5rem;border-radius:3px;cursor:pointer;font-size:0.7rem;margin-left:0.4rem;}`,
  `  .copy:hover{background:#24386a;}`,
  "</style>",
  "</head><body>",
  "<header>",
  `  <h1>Swiss Bakery-Minto — GloriaFood menu cheat sheet</h1>`,
  `  <p>Open GloriaFood Menu Manager in another tab and enter items one by one, using this page as a visual reference. Click any field to copy its text.</p>`,
  "</header>",
];
for (const cat of ["Savoury", "Bakery", "Sweets", "Beverages"]) {
  const items = grouped[cat] ?? [];
  if (items.length === 0) continue;
  htmlLines.push(
    `<h2>${esc(CATEGORY_LABEL[cat])} <span class="count">${items.length}</span></h2>`,
  );
  htmlLines.push('<div class="grid">');
  for (const p of items) {
    const imgSrc = p.imagePath
      ? `https://swissbakery.com.au${p.imagePath}`
      : "";
    const priceBadge =
      p.priceCents == null
        ? `<span class="tbc">TBC</span>`
        : `<span class="price">$${priceStr(p)}</span>`;
    htmlLines.push(`
      <div class="item">
        ${imgSrc ? `<img src="${esc(imgSrc)}" alt="${esc(p.name)}" loading="lazy">` : `<div class="item img"></div>`}
        <div style="flex:1;min-width:0">
          <div class="name" onclick="navigator.clipboard.writeText(this.textContent.trim())" title="Click to copy">${esc(p.name)}</div>
          <div>${priceBadge} <span class="unit">per ${esc(p.unit)}</span></div>
          <div class="desc" onclick="navigator.clipboard.writeText(this.textContent.trim())" title="Click to copy">${esc(p.description)}</div>
        </div>
      </div>
    `);
  }
  htmlLines.push("</div>");
}
htmlLines.push(
  `<script>document.querySelectorAll('.name,.desc').forEach(el=>{el.style.cursor='copy';el.addEventListener('click',()=>{const o=el.style.background;el.style.background='#f0e3c0';setTimeout(()=>el.style.background=o,300);});});</script>`,
);
htmlLines.push("</body></html>");
writeFileSync(
  path.join(OUT, "gloriafood-cheatsheet.html"),
  htmlLines.join("\n"),
);

/* ---------- Summary ---------- */
const total = Object.values(grouped).flat().length;
const tbc = Object.values(grouped)
  .flat()
  .filter((p) => p.priceCents == null);

process.stdout.write(`
Swiss Bakery-Minto menu export
  total items: ${total}
  items with 'TBC' price: ${tbc.length}${tbc.length > 0 ? "  (" + tbc.map((p) => p.name).join(", ") + ")" : ""}

Wrote:
  exports/gloriafood-menu.csv       — open in Sheets/Excel
  exports/gloriafood-menu.txt       — plain text, category blocks
  exports/gloriafood-cheatsheet.html — open in a browser, click to copy

Quick-use:
  1. Open exports/gloriafood-cheatsheet.html in your browser
  2. Log in to https://admin.foodbooking.com/ in another tab
  3. Go to Menu Manager → add category → add item → copy/paste fields from the cheat sheet
  4. Upload the owner's real product photos when you add each item

`);
