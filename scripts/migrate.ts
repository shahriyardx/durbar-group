/**
 * Applies the SQL files in `drizzle/` to DATABASE_URL, then exits.
 *
 * This deliberately uses drizzle-orm's own migrator rather than drizzle-kit:
 * drizzle-kit is a dev dependency and is not present in the production image,
 * while `drizzle-orm/node-postgres/migrator` ships with the runtime driver the
 * app already depends on. It records what it has applied in a migrations
 * table, so running it on every container start is a no-op once the database
 * is up to date.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("migrate: database is up to date.");
} catch (error) {
  console.error(
    "migrate: failed —",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
} finally {
  await pool.end();
}
