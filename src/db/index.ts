import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/env";
import * as schema from "./schema";

// Reuse the pool across HMR reloads in dev, otherwise every edit leaks
// connections until Postgres refuses new ones.
const globalForDb = globalThis as unknown as { __durbarPool?: Pool };

const pool =
  globalForDb.__durbarPool ?? new Pool({ connectionString: env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") globalForDb.__durbarPool = pool;

export const db = drizzle(pool, { schema });
// Exported for the few places that need a *session*-scoped connection, e.g.
// pg_try_advisory_lock held across an operation that is not one transaction.
export { pool, schema };
