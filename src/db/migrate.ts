import "dotenv/config";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

function stripLeadingComments(statement: string): string {
  const lines = statement.split("\n");
  while (lines.length > 0) {
    const line = lines[0].trim();
    if (line === "" || line.startsWith("--")) {
      lines.shift();
      continue;
    }
    break;
  }
  return lines.join("\n").trim();
}

async function applyTriggers(client: postgres.Sql) {
  const source = readFileSync(new URL("../../drizzle/triggers.sql", import.meta.url), "utf8");
  const statements = source
    .split(/^\s*-- statement-breakpoint\s*$/m)
    .map(stripLeadingComments)
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    await client.unsafe(statement);
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL est requis (voir .env.example).");
  }

  const client = postgres(databaseUrl, {
    max: 1,
    onnotice: () => {},
  });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await applyTriggers(client);
    console.log("Migrations et triggers appliqués.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
