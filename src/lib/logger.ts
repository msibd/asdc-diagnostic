// Server-side logging in one place.
//
// Production: one JSON object per line (time, level, message, context), which log collectors and
// hosting dashboards can search and alert on. Development: the same fields, readable.
// Values under sensitive-looking keys are replaced, so a password, token, code or cookie can never
// reach the logs by accident. No dependency: to send errors to a monitoring service later, add it
// in `emit` below (and in instrumentation.ts) without touching the call sites.

type Level = "info" | "warn" | "error";
type Context = Record<string, unknown>;

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|otp|^code$|codeHash|api[-_]?key|encrypted/i;
const MAX_DEPTH = 4;

function redact(value: unknown, depth = 0): unknown {
  if (value instanceof Error) return serializeError(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, inner]) => [key, SENSITIVE_KEY.test(key) ? "[redacted]" : redact(inner, depth + 1)]),
  );
}

function serializeError(error: Error): Context {
  const extra = error as Error & { code?: unknown; digest?: unknown };
  return {
    name: error.name,
    message: error.message,
    ...(extra.code !== undefined ? { code: String(extra.code) } : {}),
    ...(extra.digest !== undefined ? { digest: String(extra.digest) } : {}),
    // Stack traces help in development; in production they stay out of shared logs.
    ...(process.env.NODE_ENV !== "production" && error.stack ? { stack: error.stack } : {}),
  };
}

function emit(level: Level, message: string, context?: Context) {
  const entry = { time: new Date().toISOString(), level, message, ...(context ? (redact(context) as Context) : {}) };
  const write = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  if (process.env.NODE_ENV === "production") write(JSON.stringify(entry));
  else write(`[${level}] ${message}`, context ? redact(context) : "");
}

export const logger = {
  info: (message: string, context?: Context) => emit("info", message, context),
  warn: (message: string, context?: Context) => emit("warn", message, context),
  error: (message: string, context?: Context) => emit("error", message, context),
};
