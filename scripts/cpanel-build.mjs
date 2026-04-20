#!/usr/bin/env node
// Build helper for cPanel deploy.
// Invoked via `npm run cpanel:build` from cPanel's "Run JS Script" UI.
//
// cPanel's npm install + shell PATH handling inside workspaces is flaky:
// .bin/ symlinks aren't always created, and nested `npm install` inside
// an app says "up to date" without creating a local node_modules.
//
// Strategy: locate each tool's installed package directory (astro, prisma,
// typescript), read its package.json's `bin` entry, and invoke the JS file
// with `node` directly. No reliance on PATH or workspace linking.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_WEB = path.join(ROOT, "apps", "web");
const APP_API = path.join(ROOT, "apps", "api");

const run = (cmd, args, cwd) => {
  process.stdout.write(`\n▶ ${path.basename(cmd)} ${args.join(" ")}  (cwd: ${cwd})\n`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (r.status !== 0) {
    process.stderr.write(`\n✗ command failed with exit ${r.status}\n`);
    process.exit(r.status ?? 1);
  }
};

const NODE = process.execPath;

const findPackageJson = (pkgName) => {
  // Search common locations for the installed package (workspace-hoisted
  // or app-local).
  const candidates = [
    path.join(ROOT, "node_modules", pkgName, "package.json"),
    path.join(APP_WEB, "node_modules", pkgName, "package.json"),
    path.join(APP_API, "node_modules", pkgName, "package.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
};

const resolveBinScript = (pkgName, binName) => {
  const pjPath = findPackageJson(pkgName);
  if (!pjPath) {
    process.stderr.write(`\n✗ package "${pkgName}" not installed anywhere in the tree.\n`);
    process.stderr.write("  Expected one of:\n");
    [ROOT, APP_WEB, APP_API].forEach((d) =>
      process.stderr.write(`    ${path.join(d, "node_modules", pkgName)}\n`),
    );
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(pjPath, "utf-8"));
  const pkgDir = path.dirname(pjPath);
  const bin = pkg.bin;
  let binRel = null;
  if (typeof bin === "string") {
    binRel = bin;
  } else if (bin && typeof bin === "object") {
    binRel = bin[binName] ?? Object.values(bin)[0];
  }
  if (!binRel) {
    process.stderr.write(`\n✗ package "${pkgName}" has no bin entry for "${binName}".\n`);
    process.exit(1);
  }
  return path.resolve(pkgDir, binRel);
};

process.stdout.write(`Swiss Bakery build — ROOT=${ROOT}\n`);
process.stdout.write(`node=${NODE}\n`);

const astro = resolveBinScript("astro", "astro");
const prisma = resolveBinScript("prisma", "prisma");
const tsc = resolveBinScript("typescript", "tsc");

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
