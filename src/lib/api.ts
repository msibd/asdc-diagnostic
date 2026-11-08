import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/** Standard error body for every API route: `{ error: string }` plus the HTTP status. */
export function apiError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Reads and validates a JSON request body; a failure carries the 400 response to return as-is. */
export async function parseBody<T>(request: Request, schema: ZodType<T>, fallbackMessage = "Invalid request."): Promise<Parsed<T>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return { ok: false, response: apiError("Request body must be valid JSON.", 400) };
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, response: apiError(parsed.error.issues[0]?.message ?? fallbackMessage, 400) };
  }
  return { ok: true, data: parsed.data };
}

/** Validates URL query parameters the same way. */
export function parseQuery<T>(request: Request, schema: ZodType<T>, fallbackMessage = "Invalid query."): Parsed<T> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return { ok: false, response: apiError(parsed.error.issues[0]?.message ?? fallbackMessage, 400) };
  }
  return { ok: true, data: parsed.data };
}

/** True for a Prisma known-request error with the given code (e.g. P2025 "record not found"). */
export function isPrismaError(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
