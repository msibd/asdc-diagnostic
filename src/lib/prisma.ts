import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Add it to your .env file.");
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// On Vercel many function instances run at once; a small pool that closes idle connections keeps them
// all inside the database pooler's client limit (Supabase free: 15 in session mode).
const adapter = new PrismaPg({
  connectionString: databaseUrl,
  ...(process.env.VERCEL ? { max: 3, idleTimeoutMillis: 5_000 } : {}),
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
