import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

type Limit = { scope: string; max: number; windowSeconds: number };

export const publicRateLimits = {
  booking: { scope: "booking", max: 5, windowSeconds: 10 * 60 },
  // Reviews check the sender against patient records, so attempts are limited per address.
  review: { scope: "review", max: 5, windowSeconds: 10 * 60 },
} satisfies Record<string, Limit>;

/**
 * The visitor's address, as seen by our own proxy.
 *
 * Each proxy APPENDS the address it received the request from to x-forwarded-for, so only the
 * right-hand entries were written by proxies we run; anything to the left came from the client
 * and can be made up. TRUSTED_PROXY_HOPS is how many proxies sit in front of the app (default 1,
 * e.g. Nginx or a hosting platform); the entry that many places from the right is the real client.
 */
export function clientIp(request: Request) {
  const hops = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10) || 1);
  const chain = (request.headers.get("x-forwarded-for") ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  const fromChain = chain.length >= hops ? chain[chain.length - hops] : chain[0];
  return (fromChain || request.headers.get("x-real-ip")?.trim() || "unknown").slice(0, 64);
}

/**
 * A fixed-window counter on any key (an IP address, an e-mail address…), stored in the shared
 * "rateLimit" table so it holds across restarts and several running copies of the app.
 * Throws if the database cannot be reached; callers decide whether to fail open or closed.
 */
export async function hitRateLimit(key: string, max: number, windowSeconds: number) {
  const now = BigInt(Date.now());
  const windowMs = BigInt(windowSeconds * 1000);
  const [row] = await prisma.$queryRaw<{ count: number; lastRequest: bigint }[]>`
    INSERT INTO "rateLimit" (id, key, count, "lastRequest")
    VALUES (${key}, ${key}, 1, ${now}::bigint)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN ${now}::bigint - "rateLimit"."lastRequest" >= ${windowMs}::bigint THEN 1
        ELSE "rateLimit".count + 1
      END,
      "lastRequest" = CASE
        WHEN ${now}::bigint - "rateLimit"."lastRequest" >= ${windowMs}::bigint THEN ${now}::bigint
        ELSE "rateLimit"."lastRequest"
      END
    RETURNING count, "lastRequest"
  `;
  if (row.count <= max) return { limited: false as const, retryAfter: 0 };
  const retryAfter = Math.max(1, Math.ceil((Number(row.lastRequest) + windowSeconds * 1000 - Date.now()) / 1000));
  return { limited: true as const, retryAfter };
}

/**
 * Gives one attempt back (never below zero). For "count only the failures" limits such as PIN
 * guessing: hit the limit first (so parallel guesses cannot slip past a read-then-write check),
 * then refund it when the attempt turns out to be legitimate.
 */
export async function refundRateLimit(key: string) {
  await prisma.$executeRaw`UPDATE "rateLimit" SET count = GREATEST(count - 1, 0) WHERE key = ${key}`;
}

/**
 * Per-address limit for the public website's forms. Fails OPEN: a database hiccup must not stop
 * patients from booking. (Password recovery uses hitRateLimit directly and fails closed.)
 */
export async function enforcePublicRateLimit(request: Request, limit: Limit) {
  try {
    const result = await hitRateLimit(`public:${limit.scope}:${clientIp(request)}`, limit.max, limit.windowSeconds);
    if (!result.limited) return null;
    return NextResponse.json(
      { error: "অনেকগুলো অনুরোধ পাঠানো হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।" },
      { status: 429, headers: { "Retry-After": String(result.retryAfter) } },
    );
  } catch (error) {
    logger.error("Public rate limit check failed; allowing the request.", { error, scope: limit.scope });
    return null;
  }
}
