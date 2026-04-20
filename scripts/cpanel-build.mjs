#!/usr/bin/env node
// Build helper for Swiss Bakery, used for both local dev and cPanel deploy.
// Invoked via `npm run build` (or `cpanel:build`, or `install:all --install-only`).
//
// Installs each app's deps standalone (no workspace hoisting — cPanel's
// `npm install` at the repo root ignores workspace definitions), then runs
// each build tool by resolving its bin entry from its own package.json and
// invoking it via `node` (avoids PATH / .bin symlink issues on cPanel).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_WEB = path.join(ROOT, "apps", "web");
const APP_API = path.join(ROOT, "apps", "api");
const NODE = process.execPath;
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const INSTALL_ONLY = process.argv.includes("--install-only");

const run = (cmd, args, cwd, extraEnv = {}) => {
  process.stdout.write(`\n▶ ${path.basename(cmd)} ${args.join(" ")}  (cwd: ${cwd})\n`);
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (r.status !== 0) {
    process.stderr.write(`\n✗ command failed with exit ${r.status}\n`);
    process.exit(r.status ?? 1);
  }
};

const installIfMissing = (appDir, testPkg) => {
  const probe = path.join(appDir, "node_modules", testPkg, "package.json");
  if (existsSync(probe)) {
    process.stdout.write(`  ${testPkg} already present in ${appDir}/node_modules\n`);
    return;
  }
  process.stdout.write(`\n⟳ installing ${path.basename(appDir)} deps standalone…\n`);
  run(npmCmd, ["install", "--no-audit", "--no-fund"], appDir);
  if (!existsSync(probe)) {
    process.stderr.write(`\n✗ install finished but ${testPkg} still missing in ${appDir}/node_modules\n`);
    process.exit(1);
  }
};

const resolveBinScript = (appDir, pkgName, binName) => {
  const pjPath = path.join(appDir, "node_modules", pkgName, "package.json");
  if (!existsSync(pjPath)) {
    process.stderr.write(`\n✗ package "${pkgName}" not found at ${pjPath}\n`);
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

process.stdout.write(`Swiss Bakery build — ROOT=${ROOT}\n`);
process.stdout.write(`node=${NODE}\n`);

// Clean any leftover root-level install state from the previous
// workspace-based layout. If these exist, `npm install` inside apps/*
// walks up, finds them, and decides everything is "up to date" without
// actually installing the app's deps.
for (const p of [path.join(ROOT, "node_modules"), path.join(ROOT, "package-lock.json")]) {
  if (existsSync(p)) {
    process.stdout.write(`\n✗ removing stale ${p}\n`);
    rmSync(p, { recursive: true, force: true });
  }
}

// Always ensure deps are installed per app
installIfMissing(APP_WEB, "astro");
installIfMissing(APP_API, "prisma");

if (INSTALL_ONLY) {
  process.stdout.write("\n✓ Install complete (build skipped).\n");
  process.exit(0);
}

const astro = resolveBinScript(APP_WEB, "astro", "astro");
const prisma = resolveBinScript(APP_API, "prisma", "prisma");
const tsc = resolveBinScript(APP_API, "typescript", "tsc");

process.stdout.write(`\n  astro   -> ${astro}`);
process.stdout.write(`\n  prisma  -> ${prisma}`);
process.stdout.write(`\n  tsc     -> ${tsc}\n`);

// 1. Astro static build → apps/web/dist
run(NODE, [astro, "build"], APP_WEB);

// 2. Prisma client generation
run(NODE, [prisma, "generate", "--schema", path.join(APP_API, "prisma", "schema.prisma")], APP_API);

// 3. API TypeScript compile → apps/api/dist
run(NODE, [tsc, "-p", path.join(APP_API, "tsconfig.json")], APP_API);

process.stdout.write("\n✓ All builds complete.\n");
