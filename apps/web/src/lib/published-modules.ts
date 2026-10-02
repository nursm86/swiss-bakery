// Browser modules published unbundled at /js/<name> for the static admin pages,
// which can't import through the Astro build. The website itself bundles them.
// Cloudflare caches .js for 4 hours: when one of these changes, bump the ?v= on
// its imports in apps/api/public/admin.
import menuBoardSource from "./menu-board.js?raw";
import menuModelSource from "./menu-model.js?raw";
import pricingSource from "./pricing.js?raw";

export const PUBLISHED_MODULES: Readonly<Record<string, string>> = {
  "pricing.js": pricingSource,
  "menu-model.js": menuModelSource,
  "menu-board.js": menuBoardSource,
};
