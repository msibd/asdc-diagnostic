import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const invalidations = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/public-cache", () => ({
  publicCacheTags: { clinic: "public-clinic", gallery: "public-gallery", reviews: "public-reviews" },
  invalidatePublicCache: (tag: string) => { invalidations.push(tag); },
}));

import { GET as getContent, PUT as putContent } from "@/app/api/website-content/route";
import { prisma } from "@/lib/prisma";
import { MapLinkError, buildEmbedUrl, extractMapUrl, parseMapLocation, resolveMapLink } from "@/modules/website/map-link";
import { readWebsiteContent } from "@/modules/website/queries/website-content";
import { emptyWebsiteContent } from "@/modules/website/schemas/website-content-schema";
import { isSafeMapEmbed, resolveLayout } from "@/modules/website/schemas/website-layout";
import { call, createSession, type TestUser } from "./helpers";

// The address Google really redirects the clinic's share link to (checked against the live link).
const FULL_LINK = "https://www.google.com/maps/place/Dr+Ovi's+Dental+Care/@23.8238109,90.3508215,691m/data=!3m2!1e3!4b1!4m6!3m5!1s0x3755c13e0af78fe3:0x6381e7f295ac697c!8m2!3d23.8238109!4d90.3533964!16s%2Fg%2F11npqh17gk?entry=tts";
const SHORT_LINK = "https://maps.app.goo.gl/zH7PqUNBrXQnb5Eu6";
const EMBED = "https://www.google.com/maps?q=23.8238109%2C90.3533964&z=17&output=embed";

// A stand-in for fetch: no request ever leaves the machine.
const redirectTo = (location: string, status = 302) => vi.fn(async () => new Response(null, { status, headers: { location } }));

let admin: TestUser;
let receptionist: TestUser;

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
});

describe("reading a Google Maps link", () => {
  it("finds the pin (not just the map centre) and builds an embeddable address", () => {
    const location = parseMapLocation(new URL(FULL_LINK));
    expect(location).toEqual({ lat: "23.8238109", lng: "90.3533964", name: "Dr Ovi's Dental Care" });
    expect(buildEmbedUrl(location!)).toBe(EMBED);
    expect(isSafeMapEmbed(buildEmbedUrl(location!))).toBe(true);
  });

  it("understands the other common link shapes", () => {
    expect(parseMapLocation(new URL("https://www.google.com/maps/@23.5,90.1,15z"))).toEqual({ lat: "23.5", lng: "90.1" });
    expect(parseMapLocation(new URL("https://www.google.com/maps?q=23.5,90.1"))).toEqual({ lat: "23.5", lng: "90.1" });
    expect(parseMapLocation(new URL("https://www.google.com/maps?q=Dr+Ovi+Dental+Mirpur"))).toEqual({ query: "Dr Ovi Dental Mirpur" });
    expect(parseMapLocation(new URL("https://www.google.com/maps"))).toBeNull();
  });

  it("takes the link out of pasted embed code", () => {
    const code = '<iframe src="https://www.google.com/maps/embed?pb=!1m18!2sX&amp;z=1" width="600" height="450" loading="lazy"></iframe>';
    expect(extractMapUrl(code)).toBe("https://www.google.com/maps/embed?pb=!1m18!2sX&z=1");
    expect(extractMapUrl("  see https://maps.app.goo.gl/abc please ")).toBe("https://maps.app.goo.gl/abc");
    expect(extractMapUrl("not a link")).toBeNull();
  });

  it("follows a short link to the place, one hop at a time", async () => {
    const fetchMock = redirectTo(FULL_LINK);
    const result = await resolveMapLink(SHORT_LINK, fetchMock as unknown as typeof fetch);
    expect(result).toEqual({ mapUrl: SHORT_LINK, embedUrl: EMBED });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const options = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(options.redirect).toBe("manual");
  });

  it("accepts a full link without contacting anyone, and pasted embed code as it is", async () => {
    const fetchMock = vi.fn();
    expect((await resolveMapLink(FULL_LINK, fetchMock as unknown as typeof fetch)).embedUrl).toBe(EMBED);
    const embed = "https://www.google.com/maps/embed?pb=!1m18!2sX";
    expect(await resolveMapLink(`<iframe src="${embed}"></iframe>`, fetchMock as unknown as typeof fetch)).toEqual({ mapUrl: embed, embedUrl: embed });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses anything that is not Google Maps, and never follows a redirect out of Google", async () => {
    const fetchMock = vi.fn();
    const refuse = async (input: string) => resolveMapLink(input, fetchMock as unknown as typeof fetch).catch((error: unknown) => error);
    for (const input of [
      "http://maps.app.goo.gl/abc", "https://evil.example.com/maps", "https://google.com.evil.example/maps",
      "https://localhost/maps", "https://169.254.169.254/latest", "https://www.google.com/search?q=x", "hello",
    ]) expect(await refuse(input), input).toBeInstanceOf(MapLinkError);
    expect(fetchMock).not.toHaveBeenCalled();

    const outside = redirectTo("https://internal.example.com/secret");
    await expect(resolveMapLink(SHORT_LINK, outside as unknown as typeof fetch)).rejects.toThrow(/outside Google Maps/);
    const plain = redirectTo("http://www.google.com/maps/place/X/@1.1,2.2,1z");
    await expect(resolveMapLink(SHORT_LINK, plain as unknown as typeof fetch)).rejects.toThrow(/outside Google Maps/);
  });

  it("explains failures in plain words", async () => {
    await expect(resolveMapLink(SHORT_LINK, vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch)).rejects.toThrow(/could not be reached/);
    await expect(resolveMapLink(SHORT_LINK, vi.fn(async () => new Response("ok", { status: 200 })) as unknown as typeof fetch)).rejects.toThrow(/did not lead to a place/);
    await expect(resolveMapLink(SHORT_LINK, redirectTo("https://www.google.com/maps") as unknown as typeof fetch)).rejects.toThrow(/place could not be found/);
    // A loop of redirects ends instead of running forever.
    await expect(resolveMapLink(SHORT_LINK, redirectTo("https://goo.gl/maps/loop") as unknown as typeof fetch)).rejects.toThrow(/too many times/);
  });
});

describe("saving the map in Website content", () => {
  const valid = (mapUrl: string | undefined, extra: Record<string, unknown> = {}) => ({
    ...emptyWebsiteContent,
    clinicName: "Map Test Dental",
    layout: { ...(mapUrl === undefined ? {} : { mapUrl }), ...extra },
  });
  const save = (body: unknown, cookie = admin.cookie) => call(putContent, "/api/website-content", { method: "PUT", body, cookie });

  beforeEach(async () => {
    invalidations.length = 0;
    await prisma.clinicContent.deleteMany();
    vi.unstubAllGlobals();
  });

  it("is for website managers only", async () => {
    expect((await save(valid(FULL_LINK), receptionist.cookie)).status).toBe(403);
  });

  it("stores the link and the embed address, and the website then uses them", async () => {
    const response = await save(valid(FULL_LINK));
    expect(response.status).toBe(200);
    expect(response.json.content.layout.mapUrl).toBe(FULL_LINK);
    expect(response.json.content.layout.mapEmbedUrl).toBe(EMBED);
    expect(invalidations).toContain("public-clinic");

    const resolved = resolveLayout((await readWebsiteContent()).layout);
    expect(resolved.mapUrl).toBe(FULL_LINK);
    expect(resolved.mapEmbedUrl).toBe(EMBED);
    expect((await call(getContent, "/api/website-content", { cookie: admin.cookie })).json.content.layout.mapEmbedUrl).toBe(EMBED);
  });

  it("resolves a short link on the server when saving", async () => {
    vi.stubGlobal("fetch", redirectTo(FULL_LINK));
    const response = await save(valid(SHORT_LINK));
    expect(response.status).toBe(200);
    expect(response.json.content.layout.mapUrl).toBe(SHORT_LINK);
    expect(response.json.content.layout.mapEmbedUrl).toBe(EMBED);
    // Saved again unchanged: Google is not asked a second time.
    const second = redirectTo("https://example.invalid");
    vi.stubGlobal("fetch", second);
    expect((await save(valid(SHORT_LINK))).status).toBe(200);
    expect(second).not.toHaveBeenCalled();
  });

  it("ignores an embed address sent by the browser", async () => {
    const response = await save(valid(FULL_LINK, { mapEmbedUrl: "https://www.google.com/maps?q=0,0&output=embed" }));
    expect(response.json.content.layout.mapEmbedUrl).toBe(EMBED);
    const noLink = await save(valid(undefined, { mapEmbedUrl: "https://www.google.com/maps?q=9,9&output=embed" }));
    expect(noLink.json.content.layout.mapEmbedUrl).toBeUndefined();
    expect((await save(valid(FULL_LINK, { mapEmbedUrl: "https://evil.example.com/x" }))).status).toBe(400);
  });

  it("rejects a bad link next to the field, and keeps the old map", async () => {
    await save(valid(FULL_LINK));
    const bad = await save(valid("https://evil.example.com/maps"));
    expect(bad.status).toBe(400);
    expect(bad.json.fieldErrors["layout.mapUrl"]).toMatch(/Google Maps/);
    expect((await readWebsiteContent()).layout.mapEmbedUrl).toBe(EMBED);
    expect((await save(valid("maps.app.goo.gl/abc"))).status).toBe(400);
  });

  it("clears the map when the link is emptied", async () => {
    await save(valid(FULL_LINK));
    const cleared = await save(valid(""));
    expect(cleared.status).toBe(200);
    expect(cleared.json.content.layout.mapUrl).toBeUndefined();
    expect(cleared.json.content.layout.mapEmbedUrl).toBeUndefined();
    const resolved = resolveLayout((await readWebsiteContent()).layout);
    expect(resolved.mapUrl).toBe("");
    expect(resolved.mapEmbedUrl).toBe("");
  });

  it("never lets an unsafe stored value reach the page", () => {
    expect(resolveLayout({ mapEmbedUrl: "https://evil.example.com/maps", mapUrl: "javascript:alert(1)" }).mapEmbedUrl).toBe("");
    expect(resolveLayout({ mapUrl: "javascript:alert(1)" }).mapUrl).toBe("");
    expect(isSafeMapEmbed("javascript:alert(1)")).toBe(false);
    expect(isSafeMapEmbed("https://www.google.com.evil.example/maps")).toBe(false);
    expect(isSafeMapEmbed(EMBED)).toBe(true);
  });
});
