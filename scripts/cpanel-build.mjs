#!/usr/bin/env node
// Build helper for cPanel deploy.
// Invoked via `npm run cpanel:build` from cPanel's "Run JS Script" UI.
//
// cPanel's shell doesn't add the workspace-hoisted node_modules/.bin to PATH
// when `npm run build` is invoked inside apps/*. So we invoke each binary by
// its absolute path in the root node_modules/.bin.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BIN = path.join(ROOT, "node_modules", ".bin");
const APP_WEB = path.join(ROOT, "apps", "web");
const APP_API = path.join(ROOT, "apps", "api");

const binPath = (name) => {
  const p = path.join(BIN, name);
  if (!existsSync(p)) {
    process.stderr.write(`\n✗ binary not found: ${p}\n`);
    process.stderr.write("  Run `npm install` from the repo root first.\n");
    process.exit(1);
  }
  return p;
};

const run = (cmd, args, cwd) => {
  process.stdout.write(`\n▶ ${cmd} ${args.join(" ")}  (cwd: ${cwd})\n`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (r.status !== 0) {
    process.stderr.write(`\n✗ command failed with exit ${r.status}\n`);
    process.exit(r.status ?? 1);
  }
};

process.stdout.write(`Swiss Bakery build — ROOT=${ROOT}\n`);

const ASTRO = binPath("astro");
const PRISMA = binPath("prisma");
const TSC = binPath("tsc");

// 1. Build Astro public site → apps/web/dist
run(ASTRO, ["build"], APP_WEB);

// 2. Generate Prisma client → node_modules/@prisma/client
run(PRISMA, ["generate", "--schema", path.join(APP_API, "prisma", "schema.prisma")], APP_API);

// 3. Compile API TypeScript → apps/api/dist
run(TSC, ["-p", path.join(APP_API, "tsconfig.json")], APP_API);

process.stdout.write("\n✓ All builds complete.\n");
