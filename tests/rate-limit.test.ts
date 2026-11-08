import { afterEach, describe, expect, it } from "vitest";
import { clientIp } from "@/lib/rate-limit";

const withHeaders = (headers: Record<string, string>) => new Request("http://localhost/", { headers });

describe("client address for rate limits", () => {
  afterEach(() => {
    delete process.env.TRUSTED_PROXY_HOPS;
  });

  it("takes the address our proxy added, not one the client made up", () => {
    // The client sent "1.1.1.1"; our single proxy appended the real address.
    expect(clientIp(withHeaders({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(withHeaders({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("counts back further when there are more proxies", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(clientIp(withHeaders({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 10.0.0.2" }))).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(clientIp(withHeaders({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(withHeaders({}))).toBe("unknown");
    process.env.TRUSTED_PROXY_HOPS = "nonsense";
    expect(clientIp(withHeaders({ "x-forwarded-for": "9.9.9.9, 203.0.113.1" }))).toBe("203.0.113.1");
  });
});
