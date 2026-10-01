// Price display shared by the web build, the homepage live refresh, /menu and
// the admin (served as /js/pricing.js by src/pages/js/pricing.js.ts).
// Stored prices are ex-GST cents. With GST on, a price shows as two lines,
// "$5 + GST" and "$5.50 inc. GST", the total as prominent as the part-price.

export const DEFAULT_GST_RATE_PERCENT = 10;
const MAX_GST_RATE_PERCENT = 100;
const UNIT_PLURALS = { piece: "pcs", pack: "packs", cup: "cups", serve: "serves", pound: "pounds" };
const UNIT_LABELS = { "half-pound": "½ pound" };

/**
 * gstEnabled / gstRate as stored in site settings (strings). Missing or invalid means on at 10%.
 * @param {Record<string, string>} [settings]
 */
export const parseGstSettings = (settings = {}) => {
  const rate = Number.parseFloat(settings.gstRate);
  const ratePercent = Number.isFinite(rate) && rate >= 0 && rate <= MAX_GST_RATE_PERCENT ? rate : DEFAULT_GST_RATE_PERCENT;
  return { enabled: settings.gstEnabled !== "false" && ratePercent > 0, ratePercent };
};

export const addGst = (cents, ratePercent) => Math.round((cents * (100 + ratePercent)) / 100);

export const formatDollars = (cents) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

export const unitSuffix = (unit, qty) => {
  const label = UNIT_LABELS[unit] ?? unit;
  if (qty > 1) return `/${qty}${UNIT_PLURALS[unit] ?? label}`;
  return label && unit !== "piece" ? `/${label}` : "";
};

/**
 * Display lines for one price: [] when no price is set, otherwise one line (GST off) or two (GST on).
 * @param {{ priceCents: number | null, unit?: string, qty?: number }} item
 * @param {{ enabled: boolean, ratePercent: number }} gst
 * @returns {string[]}
 */
export const formatPriceLines = ({ priceCents, unit, qty }, gst) => {
  if (priceCents == null) return [];
  const suffix = unitSuffix(unit ?? "", Number(qty) > 1 ? Number(qty) : 1);
  if (!gst?.enabled) return [formatDollars(priceCents) + suffix];
  return [
    `${formatDollars(priceCents)}${suffix} + GST`,
    `${formatDollars(addGst(priceCents, gst.ratePercent))}${suffix} inc. GST`,
  ];
};
