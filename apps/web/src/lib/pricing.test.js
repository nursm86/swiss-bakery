import assert from "node:assert/strict";
import { test } from "node:test";
import { addGst, formatPriceLines, parseGstSettings } from "./pricing.js";

const GST_ON = { enabled: true, ratePercent: 10 };

test("settings default to GST on at 10%", () => {
  assert.deepEqual(parseGstSettings({}), GST_ON);
  assert.deepEqual(parseGstSettings({ gstRate: "abc" }), GST_ON);
});

test("GST can be switched off, and a 0% rate counts as off", () => {
  assert.equal(parseGstSettings({ gstEnabled: "false" }).enabled, false);
  assert.equal(parseGstSettings({ gstRate: "0" }).enabled, false);
});

test("adds GST and rounds to the cent", () => {
  assert.equal(addGst(500, 10), 550);
  assert.equal(addGst(333, 10), 366);
});

test("GST on shows the ex price + GST and the inclusive total", () => {
  assert.deepEqual(formatPriceLines({ priceCents: 500, unit: "piece", qty: 1 }, GST_ON), ["$5 + GST", "$5.50 inc. GST"]);
});

test("units and pack sizes carry onto both lines", () => {
  assert.deepEqual(formatPriceLines({ priceCents: 2600, unit: "kg", qty: 1 }, GST_ON), ["$26/kg + GST", "$28.60/kg inc. GST"]);
  assert.deepEqual(formatPriceLines({ priceCents: 700, unit: "piece", qty: 5 }, GST_ON), ["$7/5pcs + GST", "$7.70/5pcs inc. GST"]);
});

test("GST off shows the plain price; no price gives no lines", () => {
  assert.deepEqual(formatPriceLines({ priceCents: 350, unit: "cup", qty: 1 }, { enabled: false, ratePercent: 10 }), ["$3.50/cup"]);
  assert.deepEqual(formatPriceLines({ priceCents: null, unit: "piece", qty: 1 }, GST_ON), []);
});
