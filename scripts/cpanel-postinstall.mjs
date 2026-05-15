#!/usr/bin/env node
// cPanel post-install hook - intentionally a no-op.
//
// Previously this ran `prisma generate` on the server, but CloudLinux LVE was
// SIGABRT-killing the WASM generator engine on shared hosting. The Prisma
// client is now pre-generated locally and committed at apps/api/prisma-client/
// with both native + rhel-openssl-3.0.x engines (see schema.prisma).
//
// Left as a runnable script so the npm script "cpanel:postinstall" still
// exists; future cPanel-only setup steps can be added here.

process.stdout.write("✓ post-install: nothing to do (Prisma client is pre-generated).\n");
