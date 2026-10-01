import { PRICING_FILE, PRICING_SOURCE } from "../../lib/pricing-asset";

export const getStaticPaths = () => [{ params: { file: "pricing.js" } }, { params: { file: PRICING_FILE } }];

export const GET = () =>
  new Response(PRICING_SOURCE, { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
