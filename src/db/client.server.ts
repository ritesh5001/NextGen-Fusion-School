import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Server-only Postgres client. Reads DATABASE_URL from process.env at call time.
// Keep as a module-level lazy singleton so we do not open a pool per request.
let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure Postgres.",
    );
  }
  _client = postgres(url, {
    max: 10,
    idle_timeout: 20,
    prepare: false,
  });
  _db = drizzle(_client, { schema });
  return _db;
}

export { schema };
