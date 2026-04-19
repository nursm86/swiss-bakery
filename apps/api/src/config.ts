const required = (name: string): string => {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
};

const optional = (name: string, fallback: string): string =>
  process.env[name] && process.env[name]!.length > 0 ? process.env[name]! : fallback;

export const config = {
  env: optional("NODE_ENV", "development"),
  port: Number.parseInt(optional("PORT", "3000"), 10),
  publicOrigin: optional("PUBLIC_ORIGIN", "http://localhost:3000"),
  databaseUrl: required("DATABASE_URL"),
  adminEmail: required("ADMIN_EMAIL"),
  adminPasswordHash: required("ADMIN_PASSWORD_HASH"),
  jwtSecret: required("JWT_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  allowedOrigins: optional("ALLOWED_ORIGINS", "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  isProd: optional("NODE_ENV", "development") === "production",
} as const;

if (config.jwtSecret.length < 32 || config.jwtRefreshSecret.length < 32) {
  throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must each be at least 32 bytes.");
}
if (config.jwtSecret === config.jwtRefreshSecret) {
  throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must not be equal.");
}
