import { createDb } from "@/db/client";

const globalForDb = globalThis as unknown as {
  notesDb?: ReturnType<typeof createDb>;
};

export function getDb() {
  if (!globalForDb.notesDb) {
    globalForDb.notesDb = createDb();
  }
  return globalForDb.notesDb.db;
}

export type Database = ReturnType<typeof getDb>;
