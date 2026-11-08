// Creates the dedicated test database (if needed) and applies every migration to it.
// Usage: pnpm test:db:prepare
import { execFileSync } from "node:child_process";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

const source = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!source) throw new Error("Set DATABASE_URL (or TEST_DATABASE_URL) first.");

// No TEST_DATABASE_URL: use the main database's name with "_test" added (asdc_diagnostic -> asdc_diagnostic_test).
const testUrl = process.env.TEST_DATABASE_URL ?? source.replace(/\/([^/?]+)(\?|$)/, (_all, name: string, tail: string) => `/${name.endsWith("_test") ? name : `${name}_test`}${tail}`);
const match = /\/([^/?]*_test)(\?|$)/.exec(testUrl);
if (!match) throw new Error('The test database name must end in "_test". Set TEST_DATABASE_URL.');
const databaseName = match[1];

async function main() {
  const admin = new Client({ connectionString: testUrl.replace(`/${databaseName}`, "/postgres") });
  await admin.connect();
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (!exists.rowCount) {
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      console.log(`Created database ${databaseName}.`);
    }
  } finally {
    await admin.end();
  }
  // Run the local Prisma CLI directly (no shell), against the test database only.
  execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
  });
  console.log(`Test database ${databaseName} is ready. Run: pnpm test`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
