import { createHash, randomBytes } from "node:crypto";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { isStaffAccount } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const activeStatuses = ["WAITING", "SCANNED", "APPROVED"] as const;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function ttlSeconds() {
  const configured = process.env.QR_LOGIN_TTL_SECONDS;
  if (!configured) return 120;
  const seconds = Number(configured);
  if (!Number.isInteger(seconds) || seconds < 30 || seconds > 600) {
    throw new Error("QR_LOGIN_TTL_SECONDS must be an integer between 30 and 600.");
  }
  return seconds;
}

function tokenUrl(token: string) {
  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) throw new Error("BETTER_AUTH_URL is required for QR login.");
  return new URL(`/qr-login/${token}`, baseUrl).toString();
}

function preventCaching(ctx: { setHeader(name: string, value: string): void }) {
  ctx.setHeader("Cache-Control", "private, no-store, max-age=0");
  ctx.setHeader("Pragma", "no-cache");
}

async function expireIfNeeded(tokenHash: string, now: Date) {
  await prisma.qrLoginSession.updateMany({
    where: { tokenHash, status: { in: [...activeStatuses] }, expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
}

async function findValidSession(token: string) {
  const tokenHash = hash(token);
  const now = new Date();
  await expireIfNeeded(tokenHash, now);
  const session = await prisma.qrLoginSession.findUnique({ where: { tokenHash } });
  if (!session || session.expiresAt <= now || session.status === "EXPIRED") return null;
  return session;
}

function readDesktopProof(ctx: { getCookie(name: string): string | null }, cookieName: string) {
  const proof = ctx.getCookie(cookieName);
  return proof ? hash(proof) : null;
}

const create = createAuthEndpoint(
  "/qr/create",
  {
    method: "POST",
    body: z.object({}),
    metadata: { noStore: true },
  },
  async (ctx) => {
    preventCaching(ctx);
    const token = randomBytes(32).toString("base64url");
    const desktopProof = randomBytes(32).toString("base64url");
    const cookieName = `qr_login_${randomBytes(12).toString("hex")}`;
    const expiresAt = new Date(Date.now() + ttlSeconds() * 1000);

    await prisma.qrLoginSession.create({
      data: {
        tokenHash: hash(token),
        desktopProofHash: hash(desktopProof),
        desktopCookieName: cookieName,
        expiresAt,
      },
    });

    ctx.setCookie(cookieName, desktopProof, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth/qr",
      maxAge: ttlSeconds(),
    });

    return ctx.json({ token, url: tokenUrl(token), expiresAt: expiresAt.toISOString() });
  },
);

const scan = createAuthEndpoint(
  "/qr/scan",
  {
    method: "POST",
    body: z.object({ token: tokenSchema }),
    metadata: { noStore: true },
  },
  async (ctx) => {
    preventCaching(ctx);
    const tokenHash = hash(ctx.body.token);
    const now = new Date();
    await expireIfNeeded(tokenHash, now);

    await prisma.qrLoginSession.updateMany({
      where: { tokenHash, status: "WAITING", expiresAt: { gt: now } },
      data: { status: "SCANNED", scannedAt: now },
    });

    const session = await prisma.qrLoginSession.findUnique({ where: { tokenHash } });
    if (!session) throw new APIError("NOT_FOUND");
    return ctx.json({ status: session.expiresAt <= now ? "EXPIRED" : session.status });
  },
);

const status = createAuthEndpoint(
  "/qr/status",
  {
    method: "POST",
    body: z.object({ token: tokenSchema }),
    metadata: { noStore: true },
  },
  async (ctx) => {
    preventCaching(ctx);
    const session = await findValidSession(ctx.body.token);
    if (!session || readDesktopProof(ctx, session.desktopCookieName) !== session.desktopProofHash) {
      throw new APIError("NOT_FOUND");
    }
    return ctx.json({ status: session.status, expiresAt: session.expiresAt.toISOString() });
  },
);

const approve = createAuthEndpoint(
  "/qr/approve",
  {
    method: "POST",
    body: z.object({ token: tokenSchema }),
    metadata: { noStore: true },
  },
  async (ctx) => {
    preventCaching(ctx);
    const authSession = await getSessionFromCtx(ctx, { disableCookieCache: true });
    if (!authSession) throw new APIError("UNAUTHORIZED");
    if (!(await isStaffAccount(authSession.user.id))) throw new APIError("FORBIDDEN");

    const now = new Date();
    const result = await prisma.qrLoginSession.updateMany({
      where: {
        tokenHash: hash(ctx.body.token),
        status: "SCANNED",
        userId: null,
        expiresAt: { gt: now },
      },
      data: { status: "APPROVED", userId: authSession.user.id, approvedAt: now },
    });
    if (result.count !== 1) throw new APIError("BAD_REQUEST");
    return ctx.json({ status: "APPROVED" });
  },
);

const cancel = createAuthEndpoint(
  "/qr/cancel",
  {
    method: "POST",
    body: z.object({ token: tokenSchema }),
    metadata: { noStore: true },
  },
  async (ctx) => {
    preventCaching(ctx);
    const session = await findValidSession(ctx.body.token);
    if (!session || readDesktopProof(ctx, session.desktopCookieName) !== session.desktopProofHash) {
      throw new APIError("NOT_FOUND");
    }

    const result = await prisma.qrLoginSession.updateMany({
      where: {
        tokenHash: session.tokenHash,
        status: { in: [...activeStatuses] },
        expiresAt: { gt: new Date() },
      },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (result.count !== 1) throw new APIError("BAD_REQUEST");
    return ctx.json({ status: "CANCELLED" });
  },
);

const complete = createAuthEndpoint(
  "/qr/complete",
  {
    method: "POST",
    body: z.object({ token: tokenSchema }),
    metadata: { noStore: true },
  },
  async (ctx) => {
    preventCaching(ctx);
    const session = await findValidSession(ctx.body.token);
    if (
      !session ||
      session.status !== "APPROVED" ||
      !session.userId ||
      readDesktopProof(ctx, session.desktopCookieName) !== session.desktopProofHash
    ) {
      throw new APIError("BAD_REQUEST");
    }

    const user = await ctx.context.internalAdapter.findUserById(session.userId);
    if (!user || !(await isStaffAccount(session.userId))) throw new APIError("FORBIDDEN");

    const desktopSession = await ctx.context.internalAdapter.createSession(user.id);
    if (!desktopSession) throw new APIError("INTERNAL_SERVER_ERROR");

    const now = new Date();
    const consumed = await prisma.qrLoginSession.updateMany({
      where: {
        tokenHash: session.tokenHash,
        desktopProofHash: session.desktopProofHash,
        status: "APPROVED",
        userId: user.id,
        expiresAt: { gt: now },
        consumedAt: null,
      },
      data: { status: "CONSUMED", consumedAt: now },
    });

    if (consumed.count !== 1) {
      await ctx.context.internalAdapter.deleteSession(desktopSession.token);
      throw new APIError("BAD_REQUEST");
    }

    await setSessionCookie(ctx, { session: desktopSession, user });
    ctx.setCookie(session.desktopCookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth/qr",
      maxAge: 0,
    });
    return ctx.json({ status: "CONSUMED" });
  },
);

export const qrLoginPlugin = {
  id: "qr-login",
  endpoints: { create, scan, status, approve, cancel, complete },
  rateLimit: [
    { pathMatcher: (path: string) => path === "/qr/create", window: 120, max: 5 },
    { pathMatcher: (path: string) => path === "/qr/scan", window: 60, max: 20 },
    { pathMatcher: (path: string) => path === "/qr/status", window: 60, max: 35 },
    { pathMatcher: (path: string) => path === "/qr/approve", window: 60, max: 5 },
    { pathMatcher: (path: string) => path === "/qr/cancel", window: 60, max: 10 },
    { pathMatcher: (path: string) => path === "/qr/complete", window: 60, max: 10 },
  ],
} satisfies BetterAuthPlugin;
