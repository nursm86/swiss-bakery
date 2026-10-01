import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPriceLines, parseGstSettings } from "./pricing.js";

const GST_ON = { enabled: true, ratePercent: 10 };

test("settings default to GST on at 10%", () => {
  assert.deepEqual(parseGstSettings({}), GST_ON);
  assert.deepEqual(parseGstSettings({ gstRate: "abc" }), GST_ON);
});

test("GST can be switched off, and a 0% rate counts as off", () => {
  assert.equal(parseGstSettings({ gstEnabled: "false" }).enabled, false);
  assert.equal(parseGstSettings({ gstRate: "0" }).enabled, false);
});

test("GST on shows the price + GST, with no inclusive total", () => {
  assert.deepEqual(formatPriceLines({ priceCents: 500, unit: "piece", qty: 1 }, GST_ON), ["$5 + GST"]);
});

test("units and pack sizes come before + GST", () => {
  assert.deepEqual(formatPriceLines({ priceCents: 2600, unit: "kg", qty: 1 }, GST_ON), ["$26/kg + GST"]);
  assert.deepEqual(formatPriceLines({ priceCents: 700, unit: "piece", qty: 5 }, GST_ON), ["$7/5pcs + GST"]);
});

test("GST off shows the plain price; no price gives no lines", () => {
  assert.deepEqual(formatPriceLines({ priceCents: 350, unit: "cup", qty: 1 }, { enabled: false, ratePercent: 10 }), ["$3.50/cup"]);
  assert.deepEqual(formatPriceLines({ priceCents: null, unit: "piece", qty: 1 }, GST_ON), []);
});
