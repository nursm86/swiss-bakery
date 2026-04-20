#!/usr/bin/env node
// Build helper for cPanel deploy.
// Invoked via `npm run cpanel:build` from cPanel's "Run JS Script" UI.
//
// cPanel's npm install at the repo root doesn't reliably hoist workspace
// binaries into root node_modules/.bin, and its shell doesn't add parent
// node_modules/.bin to PATH inside workspaces. So we:
//   1. Install each app's deps as a standalone (non-workspace) package
//   2. Invoke its binaries by absolute path from that app's own .bin

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_WEB = path.join(ROOT, "apps", "web");
const APP_API = path.join(ROOT, "apps", "api");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const run = (cmd, args, cwd) => {
  process.stdout.write(`\n▶ ${cmd} ${args.join(" ")}  (cwd: ${cwd})\n`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (r.status !== 0) {
    process.stderr.write(`\n✗ command failed with exit ${r.status}\n`);
    process.exit(r.status ?? 1);
  }
};

const resolveBin = (appDir, rootFirst, names) => {
  const dirs = rootFirst
    ? [path.join(ROOT, "node_modules", ".bin"), path.join(appDir, "node_modules", ".bin")]
    : [path.join(appDir, "node_modules", ".bin"), path.join(ROOT, "node_modules", ".bin")];
  for (const d of dirs) {
    for (const n of names) {
      const p = path.join(d, n);
      if (existsSync(p)) return p;
    }
  }
  return null;
};

const ensureDepsInstalled = (appDir) => {
  const nm = path.join(appDir, "node_modules");
  if (!existsSync(nm)) {
    process.stdout.write(`\n⟳ node_modules missing in ${appDir}, installing standalone…\n`);
    run(
      npmCmd,
      ["install", "--no-audit", "--no-fund", "--install-strategy=nested"],
      appDir,
    );
  }
};

process.stdout.write(`Swiss Bakery build — ROOT=${ROOT}\n`);

// Ensure each app has its own deps (standalone). This fixes cases where
// cPanel's workspace install didn't create the expected .bin links.
ensureDepsInstalled(APP_WEB);
ensureDepsInstalled(APP_API);

// Resolve binaries. Prefer the app's own .bin (guaranteed after standalone
// install); fall back to root for workspace-hoisted setups.
const astro = resolveBin(APP_WEB, false, ["astro"]);
const prisma = resolveBin(APP_API, false, ["prisma"]);
const tsc = resolveBin(APP_API, false, ["tsc"]);

for (const [name, p] of [["astro", astro], ["prisma", prisma], ["tsc", tsc]]) {
  if (!p) {
    process.stderr.write(`\n✗ ${name} binary not found after install.\n`);
    process.exit(1);
  }
  process.stdout.write(`  ${name} -> ${p}\n`);
}

// 1. Astro static build → apps/web/dist
run(astro, ["build"], APP_WEB);

// 2. Prisma client generation
run(prisma, ["generate", "--schema", path.join(APP_API, "prisma", "schema.prisma")], APP_API);

// 3. API TypeScript compile → apps/api/dist
run(tsc, ["-p", path.join(APP_API, "tsconfig.json")], APP_API);

process.stdout.write("\n✓ All builds complete.\n");
