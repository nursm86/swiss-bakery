// Load .env from the repo root (or apps/api/.env fallback) before any
// module that reads process.env is imported. Imported first in index.ts.
// Needed because cPanel's Passenger launches the built dist/index.js directly
// and can't pass the --env-file flag.

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(here, "..", "..", "..", ".env"), // repo root /.env
  path.resolve(here, "..", ".env"),             // apps/api/.env
];

for (const envPath of candidates) {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
    // eslint-disable-next-line no-console
    console.error(`[swiss-bakery] loaded env from ${envPath}`);
    break;
  }
}
