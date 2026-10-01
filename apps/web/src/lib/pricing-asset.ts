// pricing.js published unbundled for the scripts that can't import it through
// the build (/menu's inline script, the admin pages). The hashed name changes
// whenever the file does, so Cloudflare's 4-hour .js cache never serves a stale
// copy to /menu; /js/pricing.js stays for the static admin files.
import { createHash } from "node:crypto";
import pricingSource from "./pricing.js?raw";

export const PRICING_SOURCE: string = pricingSource;

export const PRICING_FILE = `pricing.${createHash("sha256").update(pricingSource).digest("hex").slice(0, 10)}.js`;

export const PRICING_URL = `/js/${PRICING_FILE}`;
