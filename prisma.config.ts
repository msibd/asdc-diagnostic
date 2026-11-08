import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

dotenv.config({ path: [".env.local", ".env"] });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a session connection (DIRECT_URL); fall back to DATABASE_URL locally.
    url: process.env.DIRECT_URL ?? env("DATABASE_URL"),
  },
});
