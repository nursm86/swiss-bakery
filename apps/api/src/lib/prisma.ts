// Pre-generated client lives at apps/api/prisma-client/ (see schema.prisma
// `output`). Import directly from that path so cPanel can skip
// `prisma generate` at deploy time (CloudLinux LVE was SIGABRT-killing it).
// Build locally → commit prisma-client/ → deploy.
import { PrismaClient } from "../../prisma-client/index.js";

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
});
