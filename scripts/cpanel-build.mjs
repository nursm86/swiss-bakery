#!/usr/bin/env node
// Post-deploy setup for Swiss Bakery on cPanel.
// Runs via "Run JS Script" → cpanel:build after "Run NPM Install".
//
// Deploy strategy: everything is pre-built and committed to the repo
// (apps/web/dist for the static site, apps/api/dist for compiled API,
//  apps/api/prisma-client for the pre-generated Prisma client).
// cPanel only needs to install apps/api runtime deps - no astro/tsc/prisma
// compile happens on the server. The Prisma client is pre-generated locally
// with the rhel-openssl-3.0.x engine baked in (see schema.prisma).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_API = path.join(ROOT, "apps", "api");
const NODE = process.execPath;
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const run = (cmd, args, cwd) => {
  process.stdout.write(`\n▶ ${path.basename(cmd)} ${args.join(" ")}  (cwd: ${cwd})\n`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (r.status !== 0) {
    process.stderr.write(`\n✗ command failed with exit ${r.status}\n`);
    process.exit(r.status ?? 1);
  }
};

const resolveBinScript = (appDir, pkgName, binName) => {
  const pjPath = path.join(appDir, "node_modules", pkgName, "package.json");
  if (!existsSync(pjPath)) {
    process.stderr.write(`\n✗ package "${pkgName}" not installed at ${pjPath}\n`);
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(pjPath, "utf-8"));
  const bin = pkg.bin;
  let binRel = null;
  if (typeof bin === "string") binRel = bin;
  else if (bin && typeof bin === "object") binRel = bin[binName] ?? Object.values(bin)[0];
  if (!binRel) {
    process.stderr.write(`\n✗ package "${pkgName}" has no bin entry for "${binName}"\n`);
    process.exit(1);
  }
  return path.resolve(path.dirname(pjPath), binRel);
};

process.stdout.write(`Swiss Bakery cPanel post-install — ROOT=${ROOT}\n`);
process.stdout.write(`node=${NODE}\n`);

// Clean any stale root-level install state from older deploys
for (const p of [path.join(ROOT, "node_modules"), path.join(ROOT, "package-lock.json")]) {
  if (existsSync(p)) {
    process.stdout.write(`\n✗ removing stale ${p}\n`);
    rmSync(p, { recursive: true, force: true });
  }
}

// Verify pre-built artifacts are present (they must be committed to git)
const WEB_DIST = path.join(ROOT, "apps", "web", "dist", "index.html");
const API_DIST = path.join(APP_API, "dist", "index.js");
const PRISMA_CLIENT = path.join(APP_API, "prisma-client", "libquery_engine-rhel-openssl-3.0.x.so.node");
for (const [name, p] of [
  ["apps/web/dist", WEB_DIST],
  ["apps/api/dist", API_DIST],
  ["apps/api/prisma-client (rhel engine)", PRISMA_CLIENT],
]) {
  if (!existsSync(p)) {
    process.stderr.write(`\n✗ pre-built artifact missing: ${p}\n`);
    process.stderr.write(`  Locally:  npx prisma generate --schema apps/api/prisma/schema.prisma\n`);
    process.stderr.write(`            git add apps/api/prisma-client && git commit && git push\n`);
    process.exit(1);
  }
  process.stdout.write(`  ✓ ${name} present\n`);
}

// Install API runtime deps (Prisma, Express, etc.)
// Force a clean install by removing any existing node_modules + lockfile.
// cPanel's npm otherwise says "up to date in <1s" and installs nothing.
process.stdout.write(`\n⟳ forcing clean install of apps/api deps…\n`);
for (const p of [path.join(APP_API, "node_modules"), path.join(APP_API, "package-lock.json")]) {
  if (existsSync(p)) {
    process.stdout.write(`  ✗ removing ${p}\n`);
    rmSync(p, { recursive: true, force: true });
  }
}
run(npmCmd, ["install", "--no-audit", "--no-fund", "--omit=dev"], APP_API);

// No server-side `prisma generate` - the client is pre-generated and lives at
// apps/api/prisma-client/ with both native and rhel-openssl-3.0.x engines.

process.stdout.write("\n✓ Post-install complete.\n");
process.stdout.write("  Next: run `npm run prisma:deploy` to apply migrations, then restart the app.\n");
