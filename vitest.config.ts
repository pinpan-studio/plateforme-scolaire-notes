import path from "node:path";
import { defineConfig } from "vitest/config";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://notes:notes@127.0.0.1:5432/notes_scolaires_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Les connexions incrémentent session_version : les fichiers API partagent
    // les comptes de démo et ne doivent pas tourner en parallèle.
    fileParallelism: false,
    maxWorkers: 1,
    projects: [
      {
        test: {
          name: "grading",
          environment: "node",
          include: ["src/lib/grading/__tests__/**/*.test.ts"],
        },
      },
      {
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "src"),
          },
        },
        test: {
          name: "api",
          environment: "node",
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
      },
      {
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "src"),
          },
        },
        test: {
          name: "ui",
          environment: "jsdom",
          setupFiles: ["./tests/ui/setup.ts"],
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: ["src/lib/grading/**"],
        },
      },
    ],
  },
});
