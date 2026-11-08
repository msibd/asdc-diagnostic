import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prisma } from "@/lib/prisma";
import { qrLoginPlugin } from "@/modules/auth/qr-login/qr-login-plugin";

const secret = process.env.BETTER_AUTH_SECRET;

if (!secret || secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters.");
}

const trustedOrigins = new Set<string>();
if (process.env.BETTER_AUTH_URL) {
  trustedOrigins.add(new URL(process.env.BETTER_AUTH_URL).origin);
}
if (process.env.NODE_ENV === "development") {
  trustedOrigins.add("http://192.168.68.104:3000");
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [...trustedOrigins],
  // A password is changed only through /api/security/password, which needs the e-mailed code.
  disabledPaths: ["/change-password"],
  rateLimit: {
    enabled: true,
    storage: "database",
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
  },
  plugins: [qrLoginPlugin],
  databaseHooks: {
    session: {
      create: {
        // A deactivated account cannot sign in (password or QR), even with the right password.
        before: async (session) => {
          const account = await prisma.user.findUnique({ where: { id: session.userId }, select: { isActive: true } });
          if (account && !account.isActive) throw new APIError("FORBIDDEN", { message: "This account has been deactivated." });
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
    },
  },
});
