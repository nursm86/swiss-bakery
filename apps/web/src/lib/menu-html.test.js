import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeHtml, itemCount, renderMenuSections, renderProductCard, unitLabel } from "./menu-html.js";
import { buildMenuModel } from "./menu-model.js";

const GST_ON = { enabled: true, ratePercent: 10 };

test("escapes everything that could break out of text or attributes", () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert('1')">&`), "&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;");
  assert.equal(escapeHtml(null), "");
});

test("item counts read naturally", () => {
  assert.equal(itemCount(1), "1 item");
  assert.equal(itemCount(3), "3 items");
});

test("the unit label is hidden when the price already shows the pack size", () => {
  assert.equal(unitLabel({ unit: "kg", qty: 1 }), "kg");
  assert.equal(unitLabel({ unit: "piece", qty: 5 }), "");
});

test("a product card shows the escaped name and the price + GST", () => {
  const html = renderProductCard({ slug: "a", name: "Cha <b>", priceCents: 350, unit: "cup", qty: 1 }, GST_ON);
  assert.match(html, /Cha &lt;b&gt;/);
  assert.match(html, /\$3\.50\/cup \+ GST/);
  assert.doesNotMatch(html, /<b>/);
});

test("sections show subcategory chips and headings only when a category has subcategories", () => {
  const model = buildMenuModel({
    categories: [
      { key: "Drinks", label: "Drinks", slug: "drinks", blurb: "", subcategories: [{ id: 1, label: "Hot", slug: "hot", sortOrder: 1 }] },
      { key: "Sweets", label: "Sweets", slug: "sweets", blurb: "By the kilo" },
    ],
    products: [
      { slug: "chai", name: "Chai", category: "Drinks", subcategoryId: 1, priceCents: 300, unit: "cup", isActive: true },
      { slug: "laddu", name: "Laddu", category: "Sweets", priceCents: 2600, unit: "kg", isActive: true },
    ],
  });
  const staticHtml = renderMenuSections(model, GST_ON);
  const liveHtml = renderMenuSections(model, GST_ON, { isInteractive: true });
  assert.match(staticHtml, /id="cat-drinks--hot"/);
  assert.match(staticHtml, /role="group"[^>]*hidden/);
  assert.doesNotMatch(liveHtml, /role="group"[^>]*hidden/);
  assert.equal((liveHtml.match(/data-sub-filter=/g) ?? []).length, 2);
  const sweets = liveHtml.slice(liveHtml.indexOf('id="cat-sweets"'));
  assert.doesNotMatch(sweets, /data-sub-filter/);
  assert.match(sweets, /1 item</);
});
