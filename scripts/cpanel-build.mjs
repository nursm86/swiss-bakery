#!/usr/bin/env node
// Build helper for cPanel deploy.
// Invoked via `npm run cpanel:build` from cPanel's "Run JS Script" UI.
// Uses absolute paths so it works regardless of the shell cwd cPanel picks.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APPS = [
  { name: "web", dir: path.join(ROOT, "apps", "web") },
  { name: "api", dir: path.join(ROOT, "apps", "api") },
];

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const run = (cmd, args, cwd) => {
  process.stdout.write(`\n▶ ${cmd} ${args.join(" ")}  (cwd: ${cwd})\n`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (r.status !== 0) {
    process.stderr.write(`\n✗ command failed with exit ${r.status}\n`);
    process.exit(r.status ?? 1);
  }
};

process.stdout.write(`Swiss Bakery build — ROOT=${ROOT}\n`);

for (const { name, dir } of APPS) {
  if (!existsSync(dir)) {
    process.stderr.write(`\n✗ missing app dir: ${dir}\n`);
    process.exit(1);
  }
  if (!existsSync(path.join(dir, "node_modules"))) {
    run(npmCmd, ["install", "--no-audit", "--no-fund"], dir);
  }
  run(npmCmd, ["run", "build"], dir);
  process.stdout.write(`\n✓ built ${name}\n`);
}

process.stdout.write("\n✓ All builds complete.\n");
