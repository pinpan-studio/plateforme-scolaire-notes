import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL est requis (voir .env.example).");
  }

  const client = postgres(databaseUrl, {
    max: 1,
    onnotice: () => {},
  });
  const db = drizzle(client, { schema });
  return { client, db };
}
