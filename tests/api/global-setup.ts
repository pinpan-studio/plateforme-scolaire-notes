import { execSync } from "node:child_process";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://notes:notes@127.0.0.1:5432/notes_scolaires_test";

export default function setup() {
  const env = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "test" as const };
  execSync("npx tsx src/db/migrate.ts", { env, stdio: "inherit" });
  execSync("npx tsx src/db/seed.ts", { env, stdio: "inherit" });
}
