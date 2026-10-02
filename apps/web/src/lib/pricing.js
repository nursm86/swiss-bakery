// Price display shared by the web build, the homepage live refresh, /menu and
// the admin (published unbundled as /js/pricing.js by lib/published-modules.ts).
// Stored prices are ex-GST cents. With GST on, a price shows as "$5 + GST".

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

export const formatDollars = (cents) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

export const unitSuffix = (unit, qty) => {
  const label = UNIT_LABELS[unit] ?? unit;
  if (qty > 1) return `/${qty}${UNIT_PLURALS[unit] ?? label}`;
  return label && unit !== "piece" ? `/${label}` : "";
};

/**
 * Display lines for one price: [] when no price is set, otherwise one line, with " + GST" when GST is on.
 * @param {{ priceCents: number | null, unit?: string, qty?: number }} item
 * @param {{ enabled: boolean, ratePercent: number }} gst
 * @returns {string[]}
 */
export const formatPriceLines = ({ priceCents, unit, qty }, gst) => {
  if (priceCents == null) return [];
  const suffix = unitSuffix(unit ?? "", Number(qty) > 1 ? Number(qty) : 1);
  return [`${formatDollars(priceCents)}${suffix}${gst?.enabled ? " + GST" : ""}`];
};
