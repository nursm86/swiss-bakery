// Publishes src/lib/pricing.js unbundled at /js/pricing.js, so /menu's inline
// script and the admin pages use the exact same price formatting as the build.
import pricingSource from "../../lib/pricing.js?raw";

export const GET = () =>
  new Response(pricingSource, { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
