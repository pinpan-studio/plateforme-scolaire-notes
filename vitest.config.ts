import path from "node:path";
import { defineConfig } from "vitest/config";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://notes:notes@127.0.0.1:5432/notes_scolaires_test";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    globalSetup: ["./tests/api/global-setup.ts"],
    setupFiles: ["./tests/api/setup.ts"],
    include: ["tests/api/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 120000,
    env: {
      DATABASE_URL: databaseUrl,
      AUTH_SECRET: "test-auth-secret-at-least-32-characters",
      APP_URL: "http://localhost:3000",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
