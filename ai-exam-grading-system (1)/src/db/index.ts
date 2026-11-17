import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

/**
 * Managed databases (Supabase, Neon and the rest) require TLS, while a local Postgres does not
 * offer it. node-postgres does not reliably pick sslmode= out of the URL, so decide here.
 */
function sslOptions(): { rejectUnauthorized: boolean } | undefined {
  try {
    const host = new URL(String(databaseUrl)).hostname;
    if (/^(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)$/.test(host)) return undefined;
  } catch {
    return undefined;
  }
  return { rejectUnauthorized: false };
}

/**
 * Serverless platforms run several instances at once and each one owns a pool, so the pool must
 * stay small or the database's connection limit is exhausted. Three is enough for one instance:
 * marking holds one query at a time.
 */
const poolMax = Math.max(1, Math.min(10, Number(process.env.PG_POOL_MAX ?? 3)));

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: sslOptions(),
    max: poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });

// Reuse one pool per process in every environment, not only in development.
globalForDb.__arenaNextJsPostgresqlPool = pool;

export const db = drizzle(pool);
