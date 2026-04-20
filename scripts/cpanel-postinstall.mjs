#!/usr/bin/env node
// cPanel post-install hook: runs `prisma generate` after CloudLinux's
// NodeJS Selector finishes installing root deps to its virtualenv.
// Assumes node_modules/.bin/prisma is reachable via the CL symlink.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCHEMA = path.join(ROOT, "apps", "api", "prisma", "schema.prisma");

const run = (cmd, args) => {
  process.stdout.write(`\n▶ ${cmd} ${args.join(" ")}\n`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const prismaCli = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
run(process.execPath, [prismaCli, "generate", "--schema", SCHEMA]);
process.stdout.write("\n✓ prisma client generated.\n");
