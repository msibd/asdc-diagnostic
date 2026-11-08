import { Client } from "pg";

// Start every run from empty tables. Migrations must already be applied to the test database
// (pnpm test:db:prepare), which also creates sequences and constraints this suite relies on.
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/\/[^/?]*_test(\?|$)/.test(url)) {
    throw new Error("TEST_DATABASE_URL must point at a database whose name ends in \"_test\".");
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (!rows.length) throw new Error("The test database has no tables. Run: pnpm test:db:prepare");
    await client.query(`TRUNCATE ${rows.map((row) => `"${row.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
}
