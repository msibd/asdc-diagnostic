import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

// Tests run against their own database and wipe it before every run, so they must never be pointed
// at a real one. Set TEST_DATABASE_URL, or the default is the DATABASE_URL name with "_test" added.
const testDatabaseUrl = process.env.TEST_DATABASE_URL
  ?? (process.env.DATABASE_URL ?? "").replace(/\/([^/?]+)(\?|$)/, (_all, name, tail) => `/${name.endsWith("_test") ? name : `${name}_test`}${tail}`);

if (!/\/[^/?]*_test(\?|$)/.test(testDatabaseUrl)) {
  throw new Error(
    "Refusing to run tests: the test database name must end in \"_test\". Set TEST_DATABASE_URL to a dedicated test database.",
  );
}

// Global setup runs in this process (not in the test workers), so export the value for it too.
process.env.TEST_DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // One shared database: run files one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "test-only-secret-that-is-at-least-32-characters",
      BETTER_AUTH_URL: "http://localhost:3000",
      // A fixed test-only key: tests never use the real one.
      EMAIL_ENCRYPTION_KEY: "dGVzdC1vbmx5LWVuY3J5cHRpb24ta2V5LTMyLWJ5dGU=",
    },
  },
});
