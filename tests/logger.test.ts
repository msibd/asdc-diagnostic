import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";

describe("logger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("never writes secrets, whatever the key's case or depth", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logger.error("boom", {
      password: "hunter2-secret", nested: { refreshToken: "tok-123", Authorization: "Bearer abc", code: "123456", safe: "visible" },
      encryptedPassword: "v1.xx", cookie: "session=1",
    });
    const written = JSON.stringify(spy.mock.calls);
    for (const secret of ["hunter2-secret", "tok-123", "Bearer abc", "123456", "v1.xx", "session=1"]) expect(written).not.toContain(secret);
    expect(written).toContain("visible");
    expect(written).toContain("[redacted]");
  });

  it("writes one JSON line per entry in production, with error details but no stack", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logger.error("failed", { error: Object.assign(new Error("db down"), { code: "P1001" }), path: "/api/x" });
    const entry = JSON.parse(String(spy.mock.calls[0][0])) as Record<string, unknown>;
    expect(entry).toMatchObject({ level: "error", message: "failed", path: "/api/x", error: { name: "Error", message: "db down", code: "P1001" } });
    expect(JSON.stringify(entry)).not.toContain("stack");
    expect(typeof entry.time).toBe("string");
    vi.unstubAllEnvs();
  });
});
