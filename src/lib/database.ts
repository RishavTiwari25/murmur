import { Pool } from "pg";

const globalForDatabase = globalThis as unknown as { murmurPgPool?: Pool };

/** Shared PostgreSQL adapter for identity and billing repositories. */
export const database =
  globalForDatabase.murmurPgPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://murmur:murmur@localhost:5432/murmur",
    max: Number(process.env.AUTH_DB_POOL_SIZE ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.murmurPgPool = database;
}

export async function pingDatabase() {
  await database.query("select 1");
}
