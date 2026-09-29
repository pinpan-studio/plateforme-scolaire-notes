import { defineConfig, devices } from "@playwright/test";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://notes:notes@127.0.0.1:5432/notes_scolaires";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command:
      "npx tsx src/db/migrate.ts && npx tsx src/db/seed.ts && npx next start --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "local-dev-auth-secret-at-least-32-characters",
      APP_URL: "http://127.0.0.1:3000",
      AUTH_URL: "http://127.0.0.1:3000",
    },
  },
});
