import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { hashPassword } from "better-auth/crypto";
import { promptHidden } from "../src/lib/prompt-hidden";

dotenv.config({ path: [".env.local", ".env"] });

async function main() {
  // Imported after dotenv so DATABASE_URL is set when the client is created.
  const { prisma } = await import("../src/lib/prisma");

  try {
    await seedAdmin(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function seedAdmin(prisma: typeof import("../src/lib/prisma").prisma) {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!name || !email) {
    throw new Error("Set ADMIN_NAME and ADMIN_EMAIL in your local environment.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role !== "admin") {
      throw new Error("That email already belongs to a non-admin account. Refusing to promote it.");
    }

    console.log(`Administrator access is already enabled for ${email}.`);
    return;
  }

  const password = await promptHidden("Create administrator password (at least 10 characters): ");
  if (password.length < 10 || password.length > 128) {
    throw new Error("Administrator password must be between 10 and 128 characters.");
  }

  // Public sign-up is disabled in Better Auth, so create the user and its credential account directly
  // (the same way the admin "add staff" API route does).
  const passwordHash = await hashPassword(password);
  const id = randomUUID().replaceAll("-", "");
  await prisma.user.create({
    data: {
      id,
      name,
      email,
      emailVerified: true,
      role: "admin",
      accounts: { create: { id: randomUUID().replaceAll("-", ""), accountId: id, providerId: "credential", password: passwordHash } },
    },
  });

  console.log(`Administrator access enabled for ${email}.`);
}

main().catch((error: unknown) => {
  console.error("Administrator setup failed:", error);
  process.exitCode = 1;
});
