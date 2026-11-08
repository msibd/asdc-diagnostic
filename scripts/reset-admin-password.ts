import dotenv from "dotenv";
import { promptHidden } from "../src/lib/prompt-hidden";

dotenv.config({ path: [".env.local", ".env"] });

async function main() {
  const [{ auth }, { prisma }] = await Promise.all([
    import("../src/lib/auth"),
    import("../src/lib/prisma"),
  ]);
  try {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!email) {
      throw new Error("Set ADMIN_EMAIL in your local environment.");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== "admin") {
      throw new Error("The configured administrator account was not found.");
    }

    const password = await promptHidden("Enter a new administrator password (at least 10 characters): ");
    const confirmation = await promptHidden("Confirm the new password: ");
    if (password.length < 10 || password.length > 128) {
      throw new Error("Administrator password must be between 10 and 128 characters.");
    }
    if (password !== confirmation) {
      throw new Error("The passwords do not match.");
    }

    const context = await auth.$context;
    const credential = await context.internalAdapter.findCredentialAccount(user.id);
    if (!credential) {
      throw new Error("The administrator does not have a password-based login.");
    }

    const hashedPassword = await context.password.hash(password);
    await context.internalAdapter.updateAccount(credential.id, { password: hashedPassword });
    await prisma.session.deleteMany({ where: { userId: user.id } });

    console.log("Administrator password updated. Sign in with the new password.");
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error: unknown) => {
    console.error("Password reset failed:", error);
    process.exitCode = 1;
  });
